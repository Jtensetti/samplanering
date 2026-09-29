import { DurableObject } from "cloudflare:workers";
import { randomBytes, createHash } from "node:crypto";
import { tables } from "../server/tables.mjs";
import { registerWorkspace } from "../server/workspace.mjs";
import { Router } from "./router.mjs";
import { call, reply } from "./rpc.mjs";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const hash = (token) => createHash("sha256").update(token).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class Workspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(tables);
    this.sql
      .exec(`CREATE TABLE IF NOT EXISTS socket_tickets(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,session_expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invite_receipts(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS upload_reservations(id TEXT PRIMARY KEY,size INTEGER NOT NULL,expires INTEGER NOT NULL);`);
    const db = {
      prepare: (query) => ({
        all: (...args) => this.sql.exec(query, ...args).toArray(),
        get: (...args) => this.sql.exec(query, ...args).toArray()[0],
        run: (...args) => {
          this.sql.exec(query, ...args).toArray();
          return { changes: this.sql.exec("SELECT changes() n").one().n };
        },
      }),
    };
    this.router = new Router();
    this.core = registerWorkspace(this.router, {
      db,
      transaction: (fn) => this.ctx.storage.transactionSync(fn),
      publish: () => this.broadcast(),
    });
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }
  invoke(method, args) {
    if (
      ![
        "initialize",
        "info",
        "execute",
        "join",
        "ticket",
        "upload",
        "download",
      ].includes(method)
    )
      return { ok: false, status: 404, error: "Adressen finns inte." };
    return reply(() => this[method](...args));
  }
  async fetch(request) {
    try {
      return this.connect(request.headers.get("X-Socket-Ticket") || "");
    } catch (error) {
      return Response.json(
        { error: "Anslut igen." },
        { status: error.status || 500 },
      );
    }
  }
  get team() {
    return this.sql.exec("SELECT * FROM teams LIMIT 1").toArray()[0];
  }
  profile(user) {
    this.sql.exec(
      "INSERT INTO users(id,email,name,password) VALUES(?,?,?,'') ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name",
      user.id,
      user.email,
      user.name,
    );
  }
  initialize(team, user) {
    if (!uuid.test(team.id) || !team.name?.trim() || team.name.length > 100)
      fail(400, "Ange ett teamnamn.");
    this.ctx.storage.transactionSync(() => {
      if (this.team) {
        if (this.team.id !== team.id) fail(409, "Fel arbetsyta.");
        this.core.role(team.id, user.id, true, true);
        return;
      }
      this.profile(user);
      this.sql.exec("INSERT INTO teams VALUES(?,?)", team.id, team.name.trim());
      this.sql.exec(
        "INSERT INTO members VALUES(?,?,'owner')",
        team.id,
        user.id,
      );
    });
    return { ...this.team, role: "owner" };
  }
  info(user) {
    if (!this.team) fail(404, "Teamet finns inte.");
    return { ...this.team, role: this.core.role(this.team.id, user.id) };
  }
  async execute(input, user) {
    this.info(user);
    this.profile(user);
    const path = new URL(input.path, "https://internal.invalid").pathname;
    if (path === "/api/teams" || path === "/api/join")
      fail(404, "Adressen finns inte.");
    if (input.method === "GET" && path === "/api/state") this.core.tick();
    const result = this.router.handle({ ...input, user });
    if (input.method !== "GET") await this.schedule();
    return result;
  }
  async join(token, user) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      fail(410, "Inbjudan är ogiltig.");
    const digest = hash(token),
      team = this.team;
    if (!team) fail(410, "Inbjudan är ogiltig.");
    this.ctx.storage.transactionSync(() => {
      const receipt = this.sql
        .exec("SELECT * FROM invite_receipts WHERE hash=?", digest)
        .toArray()[0];
      if (receipt?.user_id === user.id && receipt.expires > Date.now()) {
        this.core.role(team.id, user.id);
        return;
      }
      const invite = this.sql
        .exec(
          "SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?",
          digest,
          Date.now(),
        )
        .toArray()[0];
      if (!invite) fail(410, "Inbjudan har redan använts eller gått ut.");
      this.profile(user);
      this.sql.exec(
        "INSERT OR IGNORE INTO members VALUES(?,?,?)",
        team.id,
        user.id,
        invite.role,
      );
      this.sql.exec("UPDATE invites SET used=1 WHERE hash=?", digest);
      this.sql.exec(
        "INSERT INTO invite_receipts VALUES(?,?,?)",
        digest,
        user.id,
        invite.expires,
      );
    });
    this.broadcast();
    return { teamId: team.id };
  }
  ticket(user) {
    this.info(user);
    const token = randomBytes(32).toString("hex");
    this.sql.exec("DELETE FROM socket_tickets WHERE expires<?", Date.now());
    this.sql.exec(
      "INSERT INTO socket_tickets VALUES(?,?,?,?)",
      hash(token),
      user.id,
      Date.now() + 60000,
      user.expires,
    );
    return { ticket: token };
  }
  connect(token) {
    const ticket = this.ctx.storage.transactionSync(() => {
      const t = this.sql
        .exec("SELECT * FROM socket_tickets WHERE hash=?", hash(token))
        .toArray()[0];
      if (!t || t.expires <= Date.now() || t.session_expires <= Date.now())
        fail(401, "Anslut igen.");
      this.core.role(this.team.id, t.user_id);
      this.sql.exec("DELETE FROM socket_tickets WHERE hash=?", hash(token));
      return t;
    });
    const [client, server] = Object.values(new WebSocketPair());
    server.serializeAttachment({
      user: ticket.user_id,
      expires: ticket.session_expires,
    });
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "ready" }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "samplanering" },
    });
  }
  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const meta = ws.deserializeAttachment();
        if (meta.expires <= Date.now()) throw new Error("Expired");
        this.core.role(this.team.id, meta.user);
        ws.send(JSON.stringify({ type: "change" }));
      } catch {
        try {
          ws.close(1008, "Anslut igen.");
        } catch {}
      }
    }
  }
  webSocketMessage(ws, message) {
    if (message !== "ping") ws.close(1008, "Okänt meddelande.");
  }
  webSocketClose(ws) {
    // Browsers may close without a status (1005), which cannot be echoed back.
    ws.close(1000);
  }
  webSocketError(ws) {
    ws.close(1011, "Anslut igen.");
  }
  async schedule() {
    const timers = this.sql.exec("SELECT COUNT(*) n FROM timers").one().n;
    const deadlines = this.sql
      .exec(
        "SELECT COUNT(*) n FROM records WHERE kind='card' AND deleted IS NULL AND json_extract(body,'$.archived')=0 AND json_extract(body,'$.done')=0 AND json_extract(body,'$.due')!=''",
      )
      .one().n;
    if (timers || deadlines) {
      if ((await this.ctx.storage.getAlarm()) === null)
        await this.ctx.storage.setAlarm(Date.now() + 60000);
    } else await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    this.core.tick();
    this.sql.exec("DELETE FROM socket_tickets WHERE expires<?", Date.now());
    this.sql.exec("DELETE FROM invite_receipts WHERE expires<?", Date.now());
    this.sql.exec(
      "DELETE FROM upload_reservations WHERE expires<?",
      Date.now(),
    );
    await this.schedule();
  }
  async upload(user, bytes, name, mime) {
    this.core.role(this.team.id, user.id, true);
    if (!this.env.FILES) fail(503, "Bilagor är inte aktiverade ännu.");
    if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024)
      fail(413, "Välj en fil på högst 10 MB.");
    const file = {
      id: crypto.randomUUID(),
      team_id: this.team.id,
      name: String(name || "Fil")
        .replace(/[\x00-\x1f/\\]/g, "_")
        .slice(0, 200),
      mime: [
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
        "text/plain",
      ].includes(mime)
        ? mime
        : "application/octet-stream",
      size: bytes.byteLength,
    };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        "DELETE FROM upload_reservations WHERE expires<?",
        Date.now(),
      );
      const used =
        this.sql.exec("SELECT COALESCE(SUM(size),0) n FROM files").one().n +
        this.sql
          .exec("SELECT COALESCE(SUM(size),0) n FROM upload_reservations")
          .one().n;
      if (used + file.size > 100 * 1024 * 1024)
        fail(
          413,
          "Teamets bilagor får tillsammans vara högst 100 MB i piloten.",
        );
      this.sql.exec(
        "INSERT INTO upload_reservations VALUES(?,?,?)",
        file.id,
        file.size,
        Date.now() + 300000,
      );
    });
    const key = `${this.team.id}/${file.id}`;
    try {
      await this.env.FILES.put(key, bytes);
      this.ctx.storage.transactionSync(() => {
        this.core.role(this.team.id, user.id, true);
        this.sql.exec(
          "INSERT INTO files VALUES(?,?,?,?,?)",
          file.id,
          file.team_id,
          file.name,
          file.mime,
          file.size,
        );
        this.sql.exec("DELETE FROM upload_reservations WHERE id=?", file.id);
      });
      return file;
    } catch (error) {
      this.sql.exec("DELETE FROM upload_reservations WHERE id=?", file.id);
      await this.env.FILES.delete(key).catch(() => {});
      throw error;
    }
  }
  async download(id, user) {
    this.info(user);
    const file = this.sql
      .exec("SELECT * FROM files WHERE id=?", id)
      .toArray()[0];
    if (!file) fail(404, "Filen finns inte.");
    const bytes = await this.env.FILES.get(
      `${this.team.id}/${id}`,
      "arrayBuffer",
    );
    this.info(user);
    if (!bytes)
      fail(503, "Filen är inte tillgänglig ännu. Försök igen om en stund.");
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${file.mime.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      },
    });
  }
}
export class UserDirectory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,name TEXT NOT NULL,request_id TEXT UNIQUE)",
    );
  }
  async create(user, name, requestId) {
    name = String(name || "").trim();
    if (!name || name.length > 100 || !uuid.test(requestId))
      fail(400, "Ange ett teamnamn.");
    const team = this.ctx.storage.transactionSync(() => {
      const previous = this.sql
        .exec("SELECT id,name FROM teams WHERE request_id=?", requestId)
        .toArray()[0];
      if (previous) return previous;
      if (this.sql.exec("SELECT COUNT(*) n FROM teams").one().n >= 20)
        fail(400, "Högst 20 team per deltagare i piloten.");
      const t = { id: crypto.randomUUID(), name };
      this.sql.exec("INSERT INTO teams VALUES(?,?,?)", t.id, t.name, requestId);
      return t;
    });
    return await call(
      this.env.WORKSPACES.getByName(team.id),
      "initialize",
      team,
      user,
    );
  }
  invoke(method, args) {
    if (!["create", "add", "list"].includes(method))
      return { ok: false, status: 404, error: "Adressen finns inte." };
    return reply(() => this[method](...args));
  }
  add(team) {
    this.sql.exec(
      "INSERT INTO teams(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
      team.id,
      team.name,
    );
  }
  async list(user) {
    const result = [];
    for (const t of this.sql
      .exec("SELECT id,name,request_id FROM teams")
      .toArray()) {
      try {
        result.push(
          await call(this.env.WORKSPACES.getByName(t.id), "info", user),
        );
      } catch (error) {
        // A pending creation can be retried; revoked memberships are hidden.
        if (error.status === 403)
          this.sql.exec("DELETE FROM teams WHERE id=?", t.id);
        else if (error.status !== 404) throw error;
      }
    }
    return result;
  }
}
