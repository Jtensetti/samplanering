import { env } from "cloudflare:workers";
import { runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { expect, test } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import worker, { createHandler, Workspace } from "../../worker/index.mjs";
import { verifyFirebaseToken } from "../../worker/auth.mjs";
import { call } from "../../worker/rpc.mjs";
const people = Object.fromEntries(
  ["owner", "editor", "viewer", "outsider"].map((name) => [
    name,
    {
      id: crypto.randomUUID(),
      name,
      email: name + "@example.test",
      expires: Date.now() + 3600000,
    },
  ]),
);
const app = createHandler(async (request) => {
  const user =
    people[request.headers.get("Authorization")?.replace("Bearer ", "")];
  if (!user) throw Object.assign(new Error("Logga in."), { status: 401 });
  return user;
});
function client(name) {
  let team = "";
  return {
    setTeam(id) {
      team = id;
    },
    async api(path, method = "GET", body, version, extra = {}) {
      const response = await app.fetch(
        new Request("https://pilot.example/api" + path, {
          method,
          headers: {
            Authorization: "Bearer " + name,
            ...(team ? { "X-Team-Id": team } : {}),
            ...(version ? { "If-Match": String(version) } : {}),
            ...extra,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        env,
      );
      return {
        status: response.status,
        data: await response.json(),
        headers: response.headers,
      };
    },
  };
}
async function seed() {
  const owner = client("owner"),
    editor = client("editor"),
    viewer = client("viewer"),
    outsider = client("outsider");
  const team = (await owner.api("/teams", "POST", { name: "Pilot" })).data;
  expect(team.id).toBeTruthy();
  for (const c of [owner, editor, viewer, outsider]) c.setTeam(team.id);
  for (const [role, c] of [
    ["editor", editor],
    ["viewer", viewer],
  ]) {
    const invite = (
      await owner.api(`/teams/${team.id}/invites`, "POST", { role })
    ).data;
    expect((await c.api("/join", "POST", { token: invite.token })).status).toBe(
      200,
    );
  }
  const plan = (
    await owner.api("/records", "POST", {
      teamId: team.id,
      kind: "plan",
      body: { title: "Pilotplan" },
    })
  ).data;
  const state = (await owner.api("/state?team=" + team.id)).data;
  const buckets = state.records.filter((r) => r.kind === "bucket");
  const card = (
    await owner.api("/records", "POST", {
      teamId: team.id,
      kind: "card",
      parentId: plan.id,
      body: { title: "Testuppgift", bucketId: buckets[0].id },
    })
  ).data;
  return { owner, editor, viewer, outsider, team, plan, card, buckets };
}
test("team isolation, viewer permissions, stale versions and live revocation in the Workers runtime", async () => {
  const { owner, editor, viewer, outsider, team, plan, card } = await seed();
  const block = (
    await owner.api("/records", "POST", {
      teamId: team.id,
      kind: "block",
      parentId: card.id,
      body: { type: "text", text: "Första" },
    })
  ).data;
  expect(block.id).toBeTruthy();
  expect((await outsider.api("/state?team=" + team.id)).status).toBe(403);
  expect(
    (await viewer.api("/records/" + block.id, "PATCH", { text: "intrång" }, 1))
      .status,
  ).toBe(403);
  expect(
    (await editor.api("/records/" + block.id, "PATCH", { text: "Andra" }, 1))
      .status,
  ).toBe(200);
  expect(
    (await owner.api("/records/" + block.id, "PATCH", { text: "Gammalt" }, 1))
      .status,
  ).toBe(409);
  expect(
    (
      await owner.api(
        "/records/" + card.id,
        "PATCH",
        { start: "2026-10-02", due: "2026-10-01" },
        1,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await owner.api(
        "/records/" + card.id,
        "PATCH",
        { dependencies: [card.id] },
        1,
      )
    ).status,
  ).toBe(400);
  const ticket = (
    await editor.api("/socket-ticket", "POST", { teamId: team.id })
  ).data.ticket;
  const response = await app.fetch(
    new Request("https://pilot.example/api/events?team=" + team.id, {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": "samplanering, ticket." + ticket,
      },
    }),
    env,
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  socket.accept();
  const closed = new Promise((resolve) =>
    socket.addEventListener("close", resolve, { once: true }),
  );
  expect(
    (await owner.api(`/teams/${team.id}/members/${people.editor.id}`, "DELETE"))
      .status,
  ).toBe(200);
  await closed;
  expect((await editor.api("/state?team=" + team.id)).status).toBe(403);
  expect((await editor.api("/teams")).data.some((t) => t.id === team.id)).toBe(
    false,
  );
  const stub = env.WORKSPACES.getByName(team.id);
  await runInDurableObject(stub, (instance, state) => {
    const recreated = new Workspace(state, env);
    expect(recreated.info(people.owner).id).toBe(team.id);
    const saved = state.storage.sql
      .exec("SELECT body FROM records WHERE id=?", block.id)
      .one();
    expect(JSON.parse(saved.body).text).toBe("Andra");
  });
  const another = (await owner.api("/teams", "POST", { name: "Separat" })).data;
  expect(
    (
      await call(
        env.WORKSPACES.getByName(another.id),
        "execute",
        { method: "GET", path: "/api/state?team=" + another.id },
        people.owner,
      )
    ).data.records,
  ).toHaveLength(0);
  expect(
    (
      await owner.api("/records", "POST", {
        teamId: another.id,
        kind: "block",
        parentId: card.id,
        body: { type: "text" },
      })
    ).status,
  ).toBe(400);
});
test("single-use invitations cannot change roles or expose other teams", async () => {
  const { owner, editor, outsider, team } = await seed();
  expect(
    (await editor.api(`/teams/${team.id}/invites`, "POST", { role: "editor" }))
      .status,
  ).toBe(403);
  const invite = (
    await owner.api(`/teams/${team.id}/invites`, "POST", { role: "viewer" })
  ).data;
  expect(
    (await outsider.api("/join", "POST", { token: invite.token })).status,
  ).toBe(200);
  // An interrupted response is safe to retry by the same recipient.
  expect(
    (await outsider.api("/join", "POST", { token: invite.token })).status,
  ).toBe(200);
  expect(
    (await editor.api("/join", "POST", { token: invite.token })).status,
  ).toBe(410);
  expect(
    (
      await outsider.api("/records", "POST", {
        teamId: team.id,
        kind: "doc",
        body: { title: "No" },
      })
    ).status,
  ).toBe(403);
  expect(
    (await owner.api(`/teams/${team.id}/invites`, "POST", { role: "owner" }))
      .status,
  ).toBe(400);
});
test("rules, recurrence, alarms, timers and protected attachments survive the transport change", async () => {
  const { owner, editor, viewer, outsider, team, plan, card, buckets } =
    await seed();
  const create = (kind, body, parentId = plan.id) =>
    owner.api("/records", "POST", { teamId: team.id, kind, parentId, body });
  await create("rule", {
    title: "Tilldela",
    bucketId: buckets[1].id,
    action: "assign",
    target: people.editor.id,
  });
  const moved = await owner.api(
    "/records/" + card.id,
    "PATCH",
    { bucketId: buckets[1].id, repeat: "monthly", due: "2026-01-31" },
    1,
  );
  expect(moved.status).toBe(200);
  expect(moved.data.body.assignees).toContain(people.editor.id);
  expect(
    (
      await owner.api(
        "/records/" + card.id,
        "PATCH",
        { done: true },
        moved.data.version,
      )
    ).status,
  ).toBe(200);
  let state = (await editor.api("/state?team=" + team.id)).data;
  const repeated = state.records.find(
    (r) => r.kind === "card" && r.id !== card.id,
  );
  expect(repeated.body.due).toBe("2026-02-28");
  const stub = env.WORKSPACES.getByName(team.id);
  await runDurableObjectAlarm(stub);
  state = (await editor.api("/state?team=" + team.id)).data;
  expect(state.notifications.some((n) => n.record_id === repeated.id)).toBe(
    true,
  );
  expect(
    (await editor.api("/timer/start", "POST", { cardId: repeated.id })).status,
  ).toBe(200);
  const time = await editor.api("/timer/stop", "POST");
  expect(time.data.body.minutes).toBe(1);
  const upload = await app.fetch(
    new Request(
      `https://pilot.example/api/files?team=${team.id}&name=test.txt&mime=text/plain`,
      {
        method: "POST",
        headers: { Authorization: "Bearer owner" },
        body: "Pilotens bilaga",
      },
    ),
    env,
  );
  expect(upload.status).toBe(201);
  const file = await upload.json();
  const download = await app.fetch(
    new Request("https://pilot.example/api/files/" + file.id, {
      headers: { Authorization: "Bearer viewer", "X-Team-Id": team.id },
    }),
    env,
  );
  expect(download.status).toBe(200);
  expect(await download.text()).toBe("Pilotens bilaga");
  const forbidden = await outsider.api("/files/" + file.id);
  expect(forbidden.status).toBe(403);
  expect(
    (
      await app.fetch(
        new Request(`https://pilot.example/api/files?team=${team.id}`, {
          method: "POST",
          headers: { Authorization: "Bearer viewer" },
          body: "No",
        }),
        env,
      )
    ).status,
  ).toBe(403);
  expect(
    (await owner.api("/state?team=" + team.id)).headers.get("cache-control"),
  ).toBe("no-store");
});
test("production verifies signature, issuer, audience, expiry and trusted user identity", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const token = (overrides) =>
    new SignJWT({
      auth_time: Math.floor(Date.now() / 1000),
      name: "Anna",
      email: "a@example.test",
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .setSubject("firebase-user")
      .setIssuer("https://securetoken.google.com/planner-tensetti")
      .setAudience("planner-tensetti")
      .sign(privateKey);
  const jwt = await token();
  const a = await verifyFirebaseToken(jwt, "planner-tensetti", () => publicKey);
  expect(a.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(a.name).toBe("Anna");
  await expect(
    verifyFirebaseToken(jwt, "other-project", () => publicKey),
  ).rejects.toThrow();
  await expect(
    verifyFirebaseToken(
      await token({ auth_time: Date.now() }),
      "planner-tensetti",
      () => publicKey,
    ),
  ).rejects.toThrow();
  const { publicKey: other } = await generateKeyPair("RS256");
  await expect(
    verifyFirebaseToken(jwt, "planner-tensetti", () => other),
  ).rejects.toThrow();
  const expired = await new SignJWT({ auth_time: 1 })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt(1)
    .setExpirationTime(2)
    .setSubject("x")
    .setIssuer("https://securetoken.google.com/planner-tensetti")
    .setAudience("planner-tensetti")
    .sign(privateKey);
  await expect(
    verifyFirebaseToken(expired, "planner-tensetti", () => publicKey),
  ).rejects.toThrow();
  const wrongIssuer = await new SignJWT({ auth_time: 1 })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setSubject("x")
    .setIssuer("https://attacker.invalid")
    .setAudience("planner-tensetti")
    .sign(privateKey);
  await expect(
    verifyFirebaseToken(wrongIssuer, "planner-tensetti", () => publicKey),
  ).rejects.toThrow();
  expect(
    (
      await worker.fetch(
        new Request("https://pilot.example/api/me", {
          headers: { "X-User-Id": people.owner.id },
        }),
        env,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await app.fetch(
        new Request("https://pilot.example/api/teams", {
          method: "POST",
          headers: {
            Authorization: "Bearer owner",
            Origin: "https://attacker.invalid",
          },
          body: '{"name":"Intrång"}',
        }),
        env,
      )
    ).status,
  ).toBe(403);
});
