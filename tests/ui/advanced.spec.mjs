import { test, expect } from "@playwright/test";
test("a rule, whiteboard idea, work period and goal can be created through the interface", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.request.post("/api/register", {
    data: {
      name: "Testledare",
      email: `lead-${crypto.randomUUID()}@example.test`,
      password: "Lösenord för testkontot",
    },
  });
  const team = await (
    await context.request.post("/api/teams", { data: { name: "Utveckling" } })
  ).json();
  const plan = await (
    await context.request.post("/api/plans/preset", {
      data: { teamId: team.id, preset: "blank", title: "Samarbetsprojekt" },
    })
  ).json();
  const state = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  const bucket = state.records.find((r) => r.kind === "bucket");
  await context.request.post("/api/records", {
    data: {
      teamId: team.id,
      kind: "card",
      parentId: plan.id,
      body: { title: "Prova flödet", bucketId: bucket.id },
    },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Samarbetsprojekt", exact: true })
    .click();
  await page.getByRole("button", { name: /Automatisera/ }).click();
  await page
    .getByLabel("När en uppgift flyttas till")
    .selectOption({ label: "Pågår" });
  await page.getByRole("button", { name: "Skapa regel", exact: true }).click();
  await expect(
    page.getByText("När kort flyttas till Pågår, tilldela Testledare", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: /Öppna whiteboard/ }).click();
  await page.getByRole("button", { name: "Ny lapp", exact: true }).click();
  await page.getByLabel("Din idé").fill("Intervjua verksamheten");
  await page.getByRole("button", { name: "Skapa", exact: true }).click();
  await expect(page.locator(".sticky-content")).toHaveText(
    "Intervjua verksamheten",
  );
  await page.getByRole("button", { name: "Gör till uppgift" }).click();
  const task = page.getByRole("dialog", { name: "Uppgift", exact: true });
  await expect(task).toBeVisible();
  await expect(task.getByLabel("Text", { exact: true })).toHaveValue(
    "Intervjua verksamheten",
  );
  await task.getByRole("button", { name: "Stäng", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Öppna whiteboard" })
    .getByRole("button", { name: "Stäng", exact: true })
    .click();
  await page.getByRole("button", { name: /Planera arbetsperiod/ }).click();
  await page.getByRole("button", { name: "Ny arbetsperiod" }).click();
  await page.getByLabel("Namn på arbetsperiod").fill("Första veckan");
  await page.getByLabel("Gemensamt mål").fill("Förstå verksamhetens behov");
  await page.getByRole("button", { name: "Skapa arbetsperiod" }).click();
  await expect(
    page.getByRole("heading", { name: "Första veckan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: /Följ upp/ }).click();
  await page.getByRole("button", { name: "Lägg till mål" }).click();
  await page.getByLabel("Vad vill ni uppnå?").fill("Genomförda intervjuer");
  await page.getByLabel("Målvärde").fill("5");
  await page.getByRole("button", { name: "Skapa mål" }).click();
  await expect(
    page.getByRole("heading", { name: "Genomförda intervjuer" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/etapp-3-uppfoljning.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: "Teamsamtal", exact: true }).click();
  await page
    .getByLabel("Meddelande till teamet")
    .fill("Vi testar tillsammans på fredag.");
  await page.getByRole("button", { name: "Skicka meddelande" }).click();
  await expect(
    page.getByText("Vi testar tillsammans på fredag.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
