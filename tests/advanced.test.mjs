import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.mjs";
import { nextDate } from "../server/dates.mjs";
test("recurrence clamps month ends and handles leap years", () => {
  assert.equal(nextDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDate("2028-01-31", "monthly"), "2028-02-29");
  assert.equal(nextDate("2026-12-31", "weekly"), "2027-01-07");
});
test("rules, reminders, recurrence, timers and cross-team relationships", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sam-advanced-"));
  const instance = createApp({ dataDir: dir, testing: true });
  const server = instance.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const client = () => {
    let cookie = "";
    return async (path, method = "GET", body, version) => {
      const r = await fetch(base + "/api" + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(version ? { "If-Match": String(version) } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, data: await r.json() };
    };
  };
  try {
    const a = client(),
      b = client();
    await a("/register", "POST", {
      email: "anna@test.example",
      name: "Anna",
      password: "Lösenord för testkontot!",
    });
    const bo = (
      await b("/register", "POST", {
        email: "bo@test.example",
        name: "Bo",
        password: "Lösenord för testkontot!",
      })
    ).data;
    const team = (await a("/teams", "POST", { name: "Planering" })).data,
      foreign = (await b("/teams", "POST", { name: "Annat team" })).data;
    const foreignDoc = (
      await b("/records", "POST", {
        teamId: foreign.id,
        kind: "doc",
        body: { title: "Privat" },
      })
    ).data;
    const inv = (
      await a(`/teams/${team.id}/invites`, "POST", { role: "editor" })
    ).data;
    await b("/join", "POST", { token: inv.token });
    const p = (
      await a("/plans/preset", "POST", {
        teamId: team.id,
        preset: "implementation",
        title: "Införande",
      })
    ).data;
    let state = (await a("/state?team=" + team.id)).data;
    const buckets = state.records
      .filter((r) => r.kind === "bucket")
      .sort((x, y) => x.body.order - y.body.order);
    let card = (
      await a("/records", "POST", {
        teamId: team.id,
        kind: "card",
        parentId: p.id,
        body: {
          title: "Återkommande avstämning",
          bucketId: buckets[0].id,
          due: "2026-01-31",
          repeat: "monthly",
        },
      })
    ).data;
    state = (await a("/state?team=" + team.id)).data;
    assert.equal(
      state.records.filter((r) => r.parent_id === card.id && r.kind === "block")
        .length,
      4,
    );
    assert.equal(
      (
        await a(
          "/records/" + card.id,
          "PATCH",
          { linkedDocs: [foreignDoc.id] },
          card.version,
        )
      ).status,
      400,
    );
    const rule = (
      await a("/records", "POST", {
        teamId: team.id,
        kind: "rule",
        parentId: p.id,
        body: {
          title: "Tilldela Bo",
          bucketId: buckets[1].id,
          action: "assign",
          target: bo.id,
        },
      })
    ).data;
    card = (
      await a(
        "/records/" + card.id,
        "PATCH",
        { bucketId: buckets[1].id },
        card.version,
      )
    ).data;
    assert.deepEqual(card.body.assignees, [bo.id]);
    assert.equal(card.version, 3);
    instance.tick();
    instance.tick();
    let bobState = (await b("/state?team=" + team.id)).data;
    assert.equal(bobState.notifications.filter((n) => n.dedupe).length, 1);
    assert.equal(bobState.notifications.length, 2);
    card = (
      await a("/records/" + card.id, "PATCH", { done: true }, card.version)
    ).data;
    state = (await a("/state?team=" + team.id)).data;
    const next = state.records.find(
      (r) => r.kind === "card" && r.id !== card.id,
    );
    assert.equal(next.body.due, "2026-02-28");
    assert.equal(next.body.done, false);
    card = (
      await a("/records/" + card.id, "PATCH", { done: false }, card.version)
    ).data;
    card = (
      await a("/records/" + card.id, "PATCH", { done: true }, card.version)
    ).data;
    assert.equal(
      (await a("/state?team=" + team.id)).data.records.filter(
        (r) => r.kind === "card",
      ).length,
      2,
    );
    assert.equal(
      (await a("/timer/start", "POST", { cardId: next.id })).status,
      200,
    );
    assert.equal(
      (await a("/timer/start", "POST", { cardId: next.id })).status,
      409,
    );
    let archived = (
      await a("/records/" + next.id, "PATCH", { archived: true }, next.version)
    ).data;
    const log = (await a("/timer/stop", "POST", {})).data;
    assert.equal(log.body.minutes, 1);
    assert.equal(log.parent_id, next.id);
    await a(
      "/records/" + next.id,
      "PATCH",
      { archived: false },
      archived.version,
    );
    const noteA = (
      await a("/records", "POST", {
        teamId: team.id,
        kind: "sticky",
        parentId: p.id,
        body: { text: "A", x: 0, y: 0 },
      })
    ).data;
    const noteB = (
      await a("/records", "POST", {
        teamId: team.id,
        kind: "sticky",
        parentId: p.id,
        body: { text: "B", x: 200, y: 0, connections: [noteA.id] },
      })
    ).data;
    assert.equal(
      (await a("/records/" + noteA.id, "DELETE", undefined, noteA.version))
        .status,
      200,
    );
    const remaining = (await a("/state?team=" + team.id)).data.records.find(
      (r) => r.id === noteB.id,
    );
    assert.deepEqual(remaining.body.connections, []);
    assert.equal(
      (
        await a(
          "/records/" + noteB.id,
          "PATCH",
          { text: "B redigerad" },
          remaining.version,
        )
      ).status,
      200,
    );
    card = (
      await a(
        "/records/" + card.id,
        "PATCH",
        { custom: { [p.body.fields[0].id]: "Sparat svar" } },
        card.version,
      )
    ).data;
    assert.equal(
      (await a("/records/" + p.id, "PATCH", { fields: [] }, p.version)).status,
      400,
    );
    assert.equal(
      (await a("/records/" + buckets[0].id, "PATCH", { archived: true }, 1))
        .status,
      400,
    );
    await a(`/teams/${team.id}/members/${bo.id}`, "DELETE");
    state = (await a("/state?team=" + team.id)).data;
    assert.deepEqual(
      state.records.find((r) => r.id === next.id).body.assignees,
      [],
    );
    assert.equal(
      state.records.find((r) => r.id === rule.id).body.enabled,
      false,
    );
    assert.equal((await b("/state?team=" + team.id)).status, 403);
    // CSRF origin validation remains active even when the cookie is valid.
    const attack = await fetch(base + "/api/register", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(attack.status, 403);
  } finally {
    await new Promise((r) => server.close(r));
    instance.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
