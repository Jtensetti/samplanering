import { randomBytes, randomUUID, createHash } from "node:crypto";
import { teamToday, nextDate } from "./dates.mjs";
import { presets } from "../shared/presets.mjs";
import { schemas, parentKinds } from "./schema.mjs";
const uid = () => randomUUID(),
  now = () => new Date().toISOString();
const digest = (s) => createHash("sha256").update(s).digest("hex");
const decode = (r) => (r ? { ...r, body: JSON.parse(r.body) } : null);
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function registerWorkspace(app, { db, transaction, publish }) {
  const sql = (s, ...p) => db.prepare(s).all(...p),
    one = (s, ...p) => db.prepare(s).get(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  const record = (id) =>
    decode(one("SELECT * FROM records WHERE id=? AND deleted IS NULL", id));
  const role = (team, user, write = false, owner = false) => {
    const m = one(
      "SELECT role FROM members WHERE team_id=? AND user_id=?",
      team,
      user,
    );
    if (!m || (write && m.role === "viewer") || (owner && m.role !== "owner"))
      fail(403, "Du har inte behörighet att göra detta.");
    return m.role;
  };
  const event = (r, user, action) =>
    run(
      "INSERT INTO events(team_id,record_id,user_id,action,body,at) VALUES(?,?,?,?,?,?)",
      r.team_id,
      r.id,
      user,
      action,
      JSON.stringify(r.body),
      now(),
    );
  const notify = (team, user, id, text, dedupe = null) =>
    run(
      "INSERT OR IGNORE INTO notifications(id,team_id,user_id,record_id,text,at,dedupe) VALUES(?,?,?,?,?,?,?)",
      uid(),
      team,
      user,
      id,
      text,
      now(),
      dedupe,
    );
  const requireRecord = (id, user, write = false) => {
    const r = record(id);
    if (!r) fail(404, "Innehållet finns inte längre.");
    role(r.team_id, user, write);
    return r;
  };
  function validate(kind, body, team, parent, self = "") {
    const schema = schemas[kind];
    if (!schema) fail(400, "Okänd innehållstyp.");
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      fail(400, parsed.error.issues[0]?.message || "Kontrollera fälten.");
    body = parsed.data;
    const expected = parentKinds[kind],
      p = parent ? record(parent) : null;
    if (
      (expected &&
        (!p ||
          p.team_id !== team ||
          !expected.includes(p.kind) ||
          (p.body.archived && !self && kind !== "time"))) ||
      (!expected && parent)
    )
      fail(400, "Innehållet ligger på fel plats.");
    const ref = (id, kinds, parentId) => {
      const r = record(id);
      if (
        !r ||
        r.team_id !== team ||
        !kinds.includes(r.kind) ||
        (parentId && r.parent_id !== parentId)
      )
        fail(400, "En koppling är ogiltig.");
      return r;
    };
    const member = (id) => {
      if (!one("SELECT 1 FROM members WHERE team_id=? AND user_id=?", team, id))
        fail(400, "Personen ingår inte i teamet.");
    };
    if (kind === "plan" && body.defaultTemplateId)
      ref(body.defaultTemplateId, ["template"]);
    if (kind === "plan" && self) {
      const before = record(self);
      const values = sql(
        "SELECT body FROM records WHERE parent_id=? AND kind='card' AND deleted IS NULL",
        self,
      ).map((r) => JSON.parse(r.body).custom);
      for (const old of before.body.fields) {
        if (!values.some((v) => Object.hasOwn(v, old.id))) continue;
        const next = body.fields.find((f) => f.id === old.id);
        if (
          !next ||
          next.type !== old.type ||
          (next.type === "select" &&
            values.some((v) => v[old.id] && !next.options.includes(v[old.id])))
        )
          fail(
            400,
            "Fältet innehåller sparade svar. Dölj fältet för att bevara dem.",
          );
      }
    }
    if (
      kind === "bucket" &&
      body.archived &&
      sql(
        "SELECT body FROM records WHERE parent_id=? AND kind='card' AND deleted IS NULL",
        parent,
      ).some((r) => {
        const d = JSON.parse(r.body);
        return d.bucketId === self && !d.archived;
      })
    )
      fail(400, "Flytta uppgifterna innan du arkiverar kolumnen.");
    if (kind === "card") {
      ref(body.bucketId, ["bucket"], parent);
      body.assignees.forEach(member);
      body.linkedDocs.forEach((x) => ref(x, ["doc"]));
      if (body.sprintId) ref(body.sprintId, ["sprint"], parent);
      for (const d of body.dependencies) ref(d, ["card"], parent);
      if (body.parentCardId) ref(body.parentCardId, ["card"], parent);
      const reaches = (id, target, key, seen = new Set()) => {
        if (id === target) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        const r = record(id);
        const next =
          key === "dependencies"
            ? r?.body.dependencies || []
            : [r?.body.parentCardId].filter(Boolean);
        return next.some((x) => reaches(x, target, key, seen));
      };
      if (
        self &&
        (body.dependencies.some((x) => reaches(x, self, "dependencies")) ||
          (body.parentCardId &&
            reaches(body.parentCardId, self, "parentCardId")))
      )
        fail(400, "Kopplingen skulle skapa en cirkel.");
      for (const [key, value] of Object.entries(body.custom)) {
        const f = p.body.fields.find((f) => f.id === key);
        if (!f) fail(400, "Fältet finns inte i planen.");
        if (
          value !== "" &&
          ((f.type === "number" && typeof value !== "number") ||
            (f.type === "checkbox" && typeof value !== "boolean") ||
            (f.type === "select" && !f.options.includes(value)) ||
            (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)))
        )
          fail(400, "Ett fält innehåller fel sorts värde.");
      }
    }
    if (kind === "rule") {
      ref(body.bucketId, ["bucket"], parent);
      if (body.action === "assign" || body.action === "notify") {
        if (body.enabled) member(body.target);
      } else ref(body.target, ["template"]);
    }
    if (kind === "sticky") {
      if (body.cardId) ref(body.cardId, ["card"], parent);
      body.connections.forEach((x) => {
        if (x === self) fail(400, "En lapp kan inte kopplas till sig själv.");
        ref(x, ["sticky"], parent);
      });
    }
    if (kind === "comment" || kind === "message") body.mentions.forEach(member);
    if (
      kind === "block" &&
      body.fileId &&
      !one("SELECT 1 FROM files WHERE id=? AND team_id=?", body.fileId, team)
    )
      fail(400, "Filen finns inte i teamet.");
    if (kind === "template")
      body.blocks = body.blocks.map((b) => {
        const v = schemas.block.safeParse(b);
        if (!v.success) fail(400, "Mallen innehåller ett ogiltigt block.");
        if (
          v.data.fileId &&
          !one(
            "SELECT 1 FROM files WHERE id=? AND team_id=?",
            v.data.fileId,
            team,
          )
        )
          fail(400, "Filen finns inte i teamet.");
        return v.data;
      });
    return body;
  }
  const insert = (team, kind, parent, body, user) => {
    const r = {
      id: uid(),
      team_id: team,
      kind,
      parent_id: parent || null,
      body: validate(kind, body, team, parent),
      version: 1,
      created_by: user,
      updated_at: now(),
      deleted: null,
    };
    run(
      "INSERT INTO records(id,team_id,kind,parent_id,body,created_by,updated_at) VALUES(?,?,?,?,?,?,?)",
      r.id,
      team,
      kind,
      r.parent_id,
      JSON.stringify(r.body),
      user,
      r.updated_at,
    );
    event(r, user, "created");
    return r;
  };
  const update = (r, body, user, action = "updated") => {
    const next = {
      ...r,
      body: validate(r.kind, body, r.team_id, r.parent_id, r.id),
      version: r.version + 1,
      updated_at: now(),
    };
    run(
      "UPDATE records SET body=?,version=?,updated_at=? WHERE id=?",
      JSON.stringify(next.body),
      next.version,
      next.updated_at,
      next.id,
    );
    event(next, user, action);
    return next;
  };
  const version = (req, r) => {
    if (Number(req.get("If-Match")) !== r.version)
      fail(
        409,
        "Någon har ändrat samma innehåll. Din text finns kvar. Läs in ändringen innan du sparar igen.",
      );
  };
  function changes(r, previous, user) {
    if (r.kind === "card")
      for (const id of r.body.assignees)
        if (id !== user && !previous?.body.assignees.includes(id))
          notify(r.team_id, id, r.id, `Du har tilldelats ${r.body.title}`);
    if (r.kind === "comment" || r.kind === "message")
      for (const id of r.body.mentions)
        if (id !== user)
          notify(
            r.team_id,
            id,
            r.kind === "message" ? r.id : r.parent_id,
            `${one("SELECT name FROM users WHERE id=?", user).name} nämnde dig: ${r.body.text.slice(0, 150)}`,
          );
  }
  app.get("/api/teams", (req, res) =>
    res.json(
      sql(
        "SELECT t.*,m.role FROM teams t JOIN members m ON m.team_id=t.id WHERE m.user_id=?",
        req.user.id,
      ),
    ),
  );
  app.post("/api/teams", (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 100) fail(400, "Ange ett teamnamn.");
    const team = { id: uid(), name };
    transaction(() => {
      run("INSERT INTO teams VALUES(?,?)", team.id, name);
      run("INSERT INTO members VALUES(?,?,?)", team.id, req.user.id, "owner");
    });
    res.status(201).json(team);
  });
  app.post("/api/teams/:team/invites", (req, res) => {
    role(req.params.team, req.user.id, true, true);
    const grant = req.body.role;
    if (!["viewer", "editor"].includes(grant)) fail(400, "Välj en roll.");
    const token = randomBytes(32).toString("hex");
    run(
      "INSERT INTO invites(hash,team_id,role,expires) VALUES(?,?,?,?)",
      digest(token),
      req.params.team,
      grant,
      Date.now() + 7 * 86400000,
    );
    res.json({ token, expiresInDays: 7 });
  });
  app.post("/api/join", (req, res) => {
    if (typeof req.body.token !== "string") fail(400, "Inbjudan saknas.");
    const team = transaction(() => {
      const i = one(
        "SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?",
        digest(req.body.token),
        Date.now(),
      );
      if (!i) fail(410, "Inbjudan har redan använts eller gått ut.");
      run(
        "INSERT OR IGNORE INTO members VALUES(?,?,?)",
        i.team_id,
        req.user.id,
        i.role,
      );
      run("UPDATE invites SET used=1 WHERE hash=?", i.hash);
      return i.team_id;
    });
    publish(team);
    res.json({ teamId: team });
  });
  app.delete("/api/teams/:team/members/:user", (req, res) => {
    const { team, user } = req.params;
    role(team, req.user.id, true, true);
    const m = one(
      "SELECT role FROM members WHERE team_id=? AND user_id=?",
      team,
      user,
    );
    if (m?.role === "owner") fail(400, "Teamets ägare kan inte tas bort.");
    transaction(() => {
      for (const r of sql(
        "SELECT * FROM records WHERE team_id=? AND deleted IS NULL AND kind='card'",
        team,
      ).map(decode))
        if (r.body.assignees.includes(user))
          update(
            r,
            {
              ...r.body,
              assignees: r.body.assignees.filter((id) => id !== user),
            },
            req.user.id,
          );
      for (const r of sql(
        "SELECT * FROM records WHERE team_id=? AND deleted IS NULL AND kind='rule'",
        team,
      ).map(decode))
        if (r.body.target === user)
          update(r, { ...r.body, enabled: false }, req.user.id);
      run("DELETE FROM timers WHERE team_id=? AND user_id=?", team, user);
      run("DELETE FROM members WHERE team_id=? AND user_id=?", team, user);
    });
    publish(team);
    res.json({ ok: true });
  });
  app.get("/api/state", (req, res) => {
    const team = String(req.query.team || "");
    const access = role(team, req.user.id);
    res.json({
      team: one("SELECT * FROM teams WHERE id=?", team),
      role: access,
      members: sql(
        "SELECT u.id,u.name,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.team_id=?",
        team,
      ),
      records: sql(
        "SELECT * FROM records WHERE team_id=? AND deleted IS NULL ORDER BY updated_at",
        team,
      ).map(decode),
      notifications: sql(
        "SELECT * FROM notifications WHERE team_id=? AND user_id=? ORDER BY at DESC LIMIT 100",
        team,
        req.user.id,
      ),
      timer: one("SELECT * FROM timers WHERE user_id=?", req.user.id) || null,
    });
  });
  app.post("/api/records", (req, res) => {
    const { teamId, kind, parentId = null, body } = req.body;
    role(teamId, req.user.id, true);
    const r = transaction(() => {
      const r = insert(teamId, kind, parentId, body, req.user.id);
      if (kind === "plan")
        for (const [order, title] of ["Att göra", "Pågår", "Klart"].entries())
          insert(
            teamId,
            "bucket",
            r.id,
            { title, order, done: order === 2 },
            req.user.id,
          );
      if (kind === "card") {
        const p = record(parentId);
        if (p.body.defaultTemplateId) {
          const t = record(p.body.defaultTemplateId);
          t?.body.blocks.forEach((b, i) =>
            insert(teamId, "block", r.id, { ...b, order: i }, req.user.id),
          );
        }
      }
      changes(r, null, req.user.id);
      return r;
    });
    publish(teamId);
    res.status(201).json(r);
  });
  app.patch("/api/records/:id", (req, res) => {
    const r = requireRecord(req.params.id, req.user.id, true);
    version(req, r);
    if (
      ["comment", "message", "time"].includes(r.kind) &&
      r.created_by !== req.user.id
    )
      fail(403, "Du kan bara ändra dina egna inlägg.");
    const next = transaction(() => {
      let next = update(r, { ...r.body, ...req.body }, req.user.id);
      changes(next, r, req.user.id);
      if (next.kind === "card" && next.body.bucketId !== r.body.bucketId)
        next = automate(next, req.user.id);
      if (next.kind === "card" && next.body.done && !r.body.done)
        recur(next, req.user.id);
      return next;
    });
    publish(r.team_id);
    res.json(next);
  });
  app.delete("/api/records/:id", (req, res) => {
    const r = requireRecord(req.params.id, req.user.id, true);
    version(req, r);
    if (
      ![
        "block",
        "comment",
        "message",
        "sticky",
        "view",
        "rule",
        "time",
        "goal",
      ].includes(r.kind)
    )
      fail(400, "Arkivera innehållet i stället.");
    if (
      ["comment", "message", "time"].includes(r.kind) &&
      r.created_by !== req.user.id
    )
      fail(403, "Du kan bara ta bort dina egna inlägg.");
    transaction(() => {
      if (r.kind === "sticky") {
        for (const note of sql(
          "SELECT * FROM records WHERE parent_id=? AND kind='sticky' AND deleted IS NULL",
          r.parent_id,
        ).map(decode)) {
          if (note.body.connections.includes(r.id))
            update(
              note,
              {
                ...note.body,
                connections: note.body.connections.filter((id) => id !== r.id),
              },
              req.user.id,
            );
        }
      }
      run(
        "UPDATE records SET deleted=?,version=version+1 WHERE id=?",
        now(),
        r.id,
      );
      event(r, req.user.id, "deleted");
    });
    publish(r.team_id);
    res.json({ id: r.id, version: r.version + 1 });
  });
  app.post("/api/records/:id/restore", (req, res) => {
    const r = decode(one("SELECT * FROM records WHERE id=?", req.params.id));
    if (!r || !r.deleted) fail(404, "Innehållet hittades inte.");
    role(r.team_id, req.user.id, true);
    version(req, r);
    if (
      ["comment", "message", "time"].includes(r.kind) &&
      r.created_by !== req.user.id
    )
      fail(403, "Du kan bara återställa dina egna inlägg.");
    validate(r.kind, r.body, r.team_id, r.parent_id, r.id);
    run("UPDATE records SET deleted=NULL,version=version+1 WHERE id=?", r.id);
    event(r, req.user.id, "restored");
    publish(r.team_id);
    res.json(record(r.id));
  });
  app.get("/api/records/:id/history", (req, res) => {
    const r = requireRecord(req.params.id, req.user.id);
    res.json(
      sql(
        "SELECT e.*,u.name FROM events e JOIN users u ON u.id=e.user_id WHERE e.record_id=? OR e.record_id IN (SELECT id FROM records WHERE parent_id=?) ORDER BY e.id DESC LIMIT 150",
        r.id,
        r.id,
      ).map((e) => ({ ...e, body: JSON.parse(e.body) })),
    );
  });
  app.post("/api/plans/preset", (req, res) => {
    const { teamId, preset, title } = req.body;
    role(teamId, req.user.id, true);
    const spec = Object.hasOwn(presets, preset) ? presets[preset] : null;
    if (!spec) fail(400, "Mallen finns inte.");
    const p = transaction(() => {
      let template = null;
      if (spec.blocks.length) {
        const blocks = spec.blocks.map((b, i) => {
          const { items, ...other } = b;
          return schemas.block.parse({
            ...other,
            order: i,
            checked: (items || []).map((text) => ({
              id: uid(),
              text,
              done: false,
            })),
          });
        });
        template = insert(
          teamId,
          "template",
          null,
          { title: spec.name, blocks },
          req.user.id,
        );
      }
      const p = insert(
        teamId,
        "plan",
        null,
        {
          title,
          defaultTemplateId: template?.id || "",
          fields: spec.fields.map(([label, type, options = []]) => ({
            id: uid(),
            label,
            type,
            options,
          })),
        },
        req.user.id,
      );
      spec.buckets.forEach((title, order) =>
        insert(
          teamId,
          "bucket",
          p.id,
          { title, order, done: order === spec.buckets.length - 1 },
          req.user.id,
        ),
      );
      return p;
    });
    publish(teamId);
    res.status(201).json(p);
  });
  app.post("/api/notifications/read", (req, res) => {
    role(req.body.teamId, req.user.id);
    run(
      "UPDATE notifications SET read=1 WHERE user_id=? AND team_id=?",
      req.user.id,
      req.body.teamId,
    );
    res.json({ ok: true });
  });
  app.post("/api/records/:id/template", (req, res) => {
    const r = requireRecord(req.params.id, req.user.id, true),
      t = requireRecord(req.body.templateId, req.user.id);
    if (
      !["card", "doc"].includes(r.kind) ||
      t.kind !== "template" ||
      t.team_id !== r.team_id
    )
      fail(400, "Mallen kan inte användas här.");
    transaction(() => {
      const max = Math.max(
        0,
        ...sql(
          "SELECT body FROM records WHERE parent_id=? AND kind=? AND deleted IS NULL",
          r.id,
          "block",
        ).map((x) => JSON.parse(x.body).order),
      );
      t.body.blocks.forEach((b, i) =>
        insert(
          r.team_id,
          "block",
          r.id,
          { ...b, order: max + i + 1 },
          req.user.id,
        ),
      );
    });
    publish(r.team_id);
    res.json({ ok: true });
  });
  app.post("/api/timer/start", (req, res) => {
    const c = requireRecord(req.body.cardId, req.user.id, true);
    if (c.kind !== "card" || c.body.archived)
      fail(400, "Välj en aktiv uppgift.");
    if (one("SELECT 1 FROM timers WHERE user_id=?", req.user.id))
      fail(409, "Stoppa din pågående tidtagning först.");
    run(
      "INSERT INTO timers VALUES(?,?,?,?)",
      req.user.id,
      c.team_id,
      c.id,
      Date.now(),
    );
    publish(c.team_id);
    res.json({ ok: true });
  });
  app.post("/api/timer/stop", (req, res) => {
    const t = one("SELECT * FROM timers WHERE user_id=?", req.user.id);
    if (!t) fail(404, "Ingen tidtagning pågår.");
    role(t.team_id, req.user.id, true);
    const r = transaction(() => {
      const r = insert(
        t.team_id,
        "time",
        t.card_id,
        {
          minutes: Math.max(
            1,
            Math.min(1440, Math.ceil((Date.now() - t.started) / 60000)),
          ),
          date: teamToday(),
          note: "Tidtagning",
        },
        req.user.id,
      );
      run("DELETE FROM timers WHERE user_id=?", req.user.id);
      return r;
    });
    publish(t.team_id);
    res.json(r);
  });
  function automate(r, user) {
    const rules = sql(
      "SELECT * FROM records WHERE parent_id=? AND kind='rule' AND deleted IS NULL",
      r.parent_id,
    )
      .map(decode)
      .filter(
        (x) =>
          x.body.enabled &&
          !x.body.archived &&
          x.body.bucketId === r.body.bucketId,
      );
    for (const rule of rules) {
      const d = rule.body;
      if (
        d.action === "assign" &&
        one(
          "SELECT 1 FROM members WHERE team_id=? AND user_id=?",
          r.team_id,
          d.target,
        )
      ) {
        const previous = r;
        r = update(
          r,
          {
            ...r.body,
            assignees: [...new Set([...r.body.assignees, d.target])],
          },
          user,
          "automation",
        );
        changes(r, previous, user);
      } else if (
        d.action === "notify" &&
        one(
          "SELECT 1 FROM members WHERE team_id=? AND user_id=?",
          r.team_id,
          d.target,
        )
      )
        notify(
          r.team_id,
          d.target,
          r.id,
          `${r.body.title} har flyttats till ${record(r.body.bucketId).body.title}`,
        );
      else if (d.action === "template") {
        const t = record(d.target);
        if (!t || t.body.archived) continue;
        const base = Math.max(
          0,
          ...sql(
            "SELECT body FROM records WHERE parent_id=? AND kind='block' AND deleted IS NULL",
            r.id,
          ).map((x) => JSON.parse(x.body).order),
        );
        t.body.blocks.forEach((block, i) =>
          insert(
            r.team_id,
            "block",
            r.id,
            { ...block, order: base + i + 1 },
            user,
          ),
        );
      }
    }
    return r;
  }
  function recur(r, user) {
    if (
      r.body.repeat === "none" ||
      one("SELECT 1 FROM recurrences WHERE source_id=?", r.id)
    )
      return;
    const c = insert(
      r.team_id,
      "card",
      r.parent_id,
      {
        ...r.body,
        done: false,
        bucketId:
          sql(
            "SELECT * FROM records WHERE parent_id=? AND kind='bucket' AND deleted IS NULL",
            r.parent_id,
          )
            .map(decode)
            .filter((b) => !b.body.archived && !b.body.done)
            .sort((a, b) => a.body.order - b.body.order)[0]?.id ||
          r.body.bucketId,
        start: nextDate(r.body.start, r.body.repeat),
        due: nextDate(r.body.due || teamToday(), r.body.repeat),
        dependencies: [],
        parentCardId: "",
      },
      user,
    );
    for (const b of sql(
      "SELECT * FROM records WHERE parent_id=? AND kind='block' AND deleted IS NULL",
      r.id,
    ).map(decode))
      insert(
        r.team_id,
        "block",
        c.id,
        {
          ...b.body,
          value: "",
          checked: b.body.checked.map((x) => ({
            ...x,
            id: uid(),
            done: false,
          })),
        },
        user,
      );
    run("INSERT INTO recurrences VALUES(?,?)", r.id, c.id);
    changes(c, null, user);
  }
  function tick() {
    const date = teamToday(),
      changed = new Set();
    transaction(() => {
      for (const r of sql(
        "SELECT * FROM records WHERE kind='card' AND deleted IS NULL",
      ).map(decode)) {
        if (
          r.body.archived ||
          r.body.done ||
          !r.body.due ||
          r.body.due > date ||
          record(r.parent_id)?.body.archived
        )
          continue;
        for (const u of r.body.assignees) {
          if (
            !one(
              "SELECT 1 FROM members WHERE team_id=? AND user_id=?",
              r.team_id,
              u,
            )
          )
            continue;
          const result = notify(
            r.team_id,
            u,
            r.id,
            `${r.body.title}: ${r.body.due === date ? "klart idag" : "slutdatum har passerat"}`,
            `${r.id}:${r.body.due}:${u}`,
          );
          if (result.changes) changed.add(r.team_id);
        }
      }
      // A forgotten timer stops after 24 hours rather than accumulating forever.
      for (const t of sql(
        "SELECT * FROM timers WHERE started<=?",
        Date.now() - 86400000,
      )) {
        if (record(t.card_id))
          insert(
            t.team_id,
            "time",
            t.card_id,
            {
              minutes: 1440,
              date: date,
              note: "Tidtagning stoppad automatiskt efter 24 timmar",
            },
            t.user_id,
          );
        run("DELETE FROM timers WHERE user_id=?", t.user_id);
        changed.add(t.team_id);
      }
      run("DELETE FROM sessions WHERE expires<?", Date.now());
      run("DELETE FROM invites WHERE expires<?", Date.now());
    });
    changed.forEach(publish);
  }
  return { tick, role };
}
