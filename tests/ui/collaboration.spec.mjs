import { test, expect } from "@playwright/test";
const password = "Ett långt testlösenord";
async function register(context, name) {
  const r = await context.request.post("/api/register", {
    data: {
      name,
      email: `${name}-${crypto.randomUUID()}@example.test`,
      password,
    },
  });
  expect(r.status()).toBe(201);
  return r.json();
}
async function create(context, teamId, kind, body, parentId = null) {
  const r = await context.request.post("/api/records", {
    data: { teamId, kind, parentId, body },
  });
  expect(r.status()).toBe(201);
  return r.json();
}
test("templates, custom fields, search and calendar share the same cards", async ({
  page,
  context,
}) => {
  await register(context, "Malltest");
  const team = await (
    await context.request.post("/api/teams", { data: { name: "Mallteam" } })
  ).json();
  const p = await (
    await context.request.post("/api/plans/preset", {
      data: { teamId: team.id, preset: "implementation", title: "Ny e-tjänst" },
    })
  ).json();
  const state = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  const bucket = state.records.find(
    (r) => r.kind === "bucket" && r.parent_id === p.id,
  );
  const c = await create(
    context,
    team.id,
    "card",
    {
      title: "Bedöm behovet",
      bucketId: bucket.id,
      due: new Date().toLocaleDateString("sv-SE"),
    },
    p.id,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Ny e-tjänst", exact: true }).click();
  await page.getByRole("button", { name: "Bedöm behovet" }).click();
  await expect(
    page.getByLabel("Vilket problem ska vi lösa?", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Verksamhet", { exact: true })
    .fill("Kulturförvaltningen");
  await page.getByRole("heading", { name: "Arbetsdokument" }).click();
  await expect(page.getByText("Sparar…")).toHaveCount(0);
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByLabel("Sök uppgifter").fill("Kulturförvaltningen");
  await expect(
    page.getByRole("button", { name: /Bedöm behovet/ }),
  ).toBeVisible();
  await page.getByLabel("Sök uppgifter").fill("hittas-inte");
  await expect(page.getByRole("button", { name: /Bedöm behovet/ })).toHaveCount(
    0,
  );
  await page.getByLabel("Sök uppgifter").fill("");
  await page.getByRole("button", { name: "Kalender", exact: true }).click();
  await expect(
    page
      .locator(".calendar-day")
      .getByRole("button", { name: "Bedöm behovet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tidslinje", exact: true }).click();
  await expect(page.locator(".timeline-label")).toHaveText("Bedöm behovet");
  await page.screenshot({
    path: "test-results/etapp-2-tidslinje.png",
    fullPage: true,
  });
  const final = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  expect(
    final.records.find((r) => r.id === c.id).body.custom[p.body.fields[0].id],
  ).toBe("Kulturförvaltningen");
});
test("two browsers keep drafts when another editor changes the same block", async ({
  browser,
  context,
  page,
}) => {
  const a = await register(context, "Alice");
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:3310" });
  await register(second, "Bob");
  const team = await (
    await context.request.post("/api/teams", { data: { name: "Samtidigt" } })
  ).json();
  const inv = await (
    await context.request.post(`/api/teams/${team.id}/invites`, {
      data: { role: "editor" },
    })
  ).json();
  await second.request.post("/api/join", { data: { token: inv.token } });
  const p = await create(context, team.id, "plan", { title: "Samarbete" });
  const state = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  const c = await create(
    context,
    team.id,
    "card",
    {
      title: "Gemensamt kort",
      bucketId: state.records.find((r) => r.kind === "bucket").id,
    },
    p.id,
  );
  const b = await create(
    context,
    team.id,
    "block",
    { type: "text", text: "Ursprunglig text" },
    c.id,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Samarbete", exact: true }).click();
  await page.getByRole("button", { name: "Gemensamt kort" }).click();
  await page.getByLabel("Text", { exact: true }).fill("Alices osparade utkast");
  const response = await second.request.patch("/api/records/" + b.id, {
    headers: { "If-Match": "1" },
    data: { text: "Bobs nya text" },
  });
  expect(response.status()).toBe(200);
  await page.getByRole("heading", { name: "Arbetsdokument" }).click();
  await expect(
    page.getByText("Någon har ändrat samma innehåll.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Alices osparade utkast",
  );
  await expect(page.getByText("Bobs nya text", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Använd senaste", exact: true })
    .click();
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Bobs nya text",
  );
  // Delay the save response while the user continues typing.
  let release, received;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const requestSeen = new Promise((resolve) => {
    received = resolve;
  });
  await page.route(
    "**/api/records/" + b.id,
    async (route) => {
      const response = await route.fetch();
      received();
      await gate;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  const text = page.getByLabel("Text", { exact: true });
  await text.fill("Första sparningen");
  await page.getByRole("heading", { name: "Arbetsdokument" }).click();
  await requestSeen;
  await text.fill("Fortsatt skrivning under sparning");
  release();
  await expect(page.getByText("Sparar…", { exact: true })).toHaveCount(0);
  await expect(text).toHaveValue("Fortsatt skrivning under sparning");
  await page.getByRole("heading", { name: "Arbetsdokument" }).click();
  await expect(page.locator('.draft[data-dirty="true"]')).toHaveCount(0);
  const latest = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  expect(latest.records.find((r) => r.id === b.id).body.text).toBe(
    "Fortsatt skrivning under sparning",
  );
  await second.close();
});
