import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as rawScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./db.mjs";
import { credentials } from "./schema.mjs";
import { registerWorkspace } from "./workspace.mjs";
const scrypt = promisify(rawScrypt),
  uid = () => randomUUID(),
  now = () => new Date().toISOString(),
  digest = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const safeUser = (u) => ({ id: u.id, name: u.name, email: u.email });
export function createApp({
  dataDir = process.env.DATA_DIR || "./data",
  origin = process.env.APP_ORIGIN || "http://localhost:3000",
  production = process.env.NODE_ENV === "production",
  testing = false,
} = {}) {
  if (production && !origin.startsWith("https://"))
    throw new Error("APP_ORIGIN måste använda HTTPS i produktion");
  const db = openDatabase(dataDir),
    app = express(),
    clients = new Set();
  const sql = (s, ...p) => db.prepare(s).all(...p),
    one = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const publish = (team) => {
    for (const c of clients)
      if (c.team === team) c.res.write("event: change\ndata: {}\n\n");
  };
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "blob:"],
          "connect-src": ["'self'"],
          "object-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "upgrade-insecure-requests": production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const o = req.get("Origin");
      if (
        o &&
        o !== origin &&
        !(
          !production &&
          ["http://localhost:5173", "http://127.0.0.1:5173"].includes(o)
        )
      )
        return res
          .status(403)
          .json({ error: "Anropet kommer från fel adress." });
      if (req.get("Sec-Fetch-Site") === "cross-site")
        return res
          .status(403)
          .json({ error: "Anropet kommer från fel webbplats." });
    }
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: testing ? 10000 : 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: testing ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "För många försök. Försök igen om en stund." },
  });
  const session = (res, user) => {
    const token = randomBytes(32).toString("hex");
    run(
      "INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)",
      digest(token),
      user,
      Date.now() + 7 * 86400000,
    );
    res.cookie("samplanering", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 7 * 86400000,
      path: "/",
    });
  };
  app.post("/api/register", authLimit, async (req, res) => {
    const p = credentials.safeParse(req.body);
    if (!p.success || !p.data.name)
      fail(400, "Ange namn, e-post och ett lösenord med minst 12 tecken.");
    const { email, name, password } = p.data;
    const salt = randomBytes(16).toString("hex"),
      key = await scrypt(password, salt, 64);
    const u = { id: uid(), email, name };
    try {
      run(
        "INSERT INTO users VALUES(?,?,?,?)",
        u.id,
        email,
        name,
        `${salt}:${key.toString("hex")}`,
      );
    } catch (e) {
      if (e.code === "ERR_SQLITE_ERROR" && String(e.message).includes("UNIQUE"))
        fail(409, "Kontot kunde inte skapas. Prova att logga in.");
      throw e;
    }
    session(res, u.id);
    res.status(201).json(u);
  });
  app.post("/api/login", authLimit, async (req, res) => {
    const p = credentials.safeParse(req.body);
    if (!p.success) fail(401, "Fel e-post eller lösenord.");
    const u = one("SELECT * FROM users WHERE email=?", p.data.email),
      [salt, key] = (
        u?.password || "00000000000000000000000000000000:" + "0".repeat(128)
      ).split(":");
    const actual = await scrypt(p.data.password, salt, 64);
    if (!u || !timingSafeEqual(actual, Buffer.from(key, "hex")))
      fail(401, "Fel e-post eller lösenord.");
    session(res, u.id);
    res.json(safeUser(u));
  });
  app.use("/api", (req, res, next) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("samplanering="))
      ?.slice(13);
    const s =
      token &&
      one(
        "SELECT u.*,s.expires,s.hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?",
        digest(token),
        Date.now(),
      );
    if (!s)
      return res.status(401).json({ error: "Logga in för att fortsätta." });
    req.user = s;
    next();
  });
  app.get("/api/me", (req, res) => res.json(safeUser(req.user)));
  app.post("/api/logout", (req, res) => {
    run("DELETE FROM sessions WHERE hash=?", req.user.hash);
    res.clearCookie("samplanering", { path: "/" });
    res.json({ ok: true });
  });
  const { tick, role } = registerWorkspace(app, { db, transaction, publish });
  app.get("/api/events", (req, res) => {
    const team = String(req.query.team || "");
    role(team, req.user.id);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");
    const c = { team, res };
    clients.add(c);
    const interval = setInterval(() => {
      if (
        !one(
          "SELECT 1 FROM sessions s JOIN members m ON m.user_id=s.user_id WHERE s.hash=? AND s.expires>? AND m.team_id=?",
          req.user.hash,
          Date.now(),
          team,
        )
      ) {
        res.end();
        return;
      }
      res.write(": keepalive\n\n");
    }, 15000);
    req.on("close", () => {
      clearInterval(interval);
      clients.delete(c);
    });
  });
  const uploadDir = resolve(dataDir, "files");
  mkdirSync(uploadDir, { recursive: true });
  app.post(
    "/api/files",
    express.raw({ type: "application/octet-stream", limit: "10mb" }),
    (req, res) => {
      const team = String(req.query.team || "");
      role(team, req.user.id, true);
      if (!Buffer.isBuffer(req.body) || !req.body.length)
        fail(400, "Välj en fil.");
      const name = String(req.query.name || "Fil")
          .replace(/[\x00-\x1f/\\]/g, "_")
          .slice(0, 200),
        mime = String(req.query.mime || "application/octet-stream");
      const f = {
        id: uid(),
        team_id: team,
        name,
        mime: [
          "image/png",
          "image/jpeg",
          "image/webp",
          "application/pdf",
          "text/plain",
        ].includes(mime)
          ? mime
          : "application/octet-stream",
        size: req.body.length,
      };
      writeFileSync(resolve(uploadDir, f.id), req.body, { flag: "wx" });
      try {
        run(
          "INSERT INTO files VALUES(?,?,?,?,?)",
          f.id,
          team,
          f.name,
          f.mime,
          f.size,
        );
      } catch (e) {
        unlinkSync(resolve(uploadDir, f.id));
        throw e;
      }
      res.status(201).json(f);
    },
  );
  app.get("/api/files/:id", (req, res) => {
    const f = one("SELECT * FROM files WHERE id=?", req.params.id);
    if (!f) fail(404, "Filen finns inte.");
    role(f.team_id, req.user.id);
    res.set("Content-Type", f.mime);
    res.set(
      "Content-Disposition",
      `${f.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    );
    res.sendFile(resolve(uploadDir, f.id));
  });
  const scheduler = testing
    ? null
    : setInterval(() => {
        try {
          tick();
        } catch (e) {
          console.error("Scheduler", e);
        }
      }, 60000);
  scheduler?.unref();
  app.use(express.static(resolve("dist"), { index: false }));
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ error: "Adressen finns inte." });
    res.sendFile(resolve("dist/index.html"));
  });
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error:
        status >= 500
          ? "Något gick fel. Försök igen."
          : err.message || "Kontrollera uppgifterna.",
    });
  });
  return {
    app,
    db,
    tick,
    close() {
      clearInterval(scheduler);
      for (const c of clients) c.res.end();
      db.close();
    },
  };
}
