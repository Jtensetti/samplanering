import { test, expect } from "@playwright/test";

test("fields keep their meaning, fit the content and preserve choices on desktop and touch screens", async ({
  page,
  context,
  browser,
}) => {
  const post = async (path, data) => {
    const response = await context.request.post("/api" + path, { data });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const user = await post("/register", {
    name: "Anna Andersson",
    email: `forms-${crypto.randomUUID()}@example.test`,
    password: "Ett långt testlösenord",
  });
  const team = await post("/teams", { name: "Exempelteam" });
  const create = (kind, body, parentId = null) =>
    post("/records", { teamId: team.id, kind, body, parentId });
  const fields = [
    { id: crypto.randomUUID(), label: "Verksamhet", type: "text" },
    { id: crypto.randomUUID(), label: "Budget", type: "number" },
    { id: crypto.randomUUID(), label: "Avstämning", type: "date" },
    { id: crypto.randomUUID(), label: "Godkänd", type: "checkbox" },
    {
      id: crypto.randomUUID(),
      label: "Område",
      type: "select",
      options: ["Service", "Utbildning"],
    },
  ];
  const plan = await create("plan", {
    title: "Införa bokningssystem",
    color: "teal",
    fields,
  });
  const getState = async () =>
    (await context.request.get("/api/state?team=" + team.id)).json();
  const bucket = (await getState()).records.find(
    (r) => r.kind === "bucket" && r.parent_id === plan.id,
  );
  const card = await create(
    "card",
    {
      title: "Testa bokningsflödet tillsammans med verksamheten",
      bucketId: bucket.id,
      assignees: [user.id],
      start: "2026-10-01",
      due: "2026-10-14",
    },
    plan.id,
  );
  const textBlock = await create(
    "block",
    { type: "text", text: "Prova en bokning från början till slut.", order: 0 },
    card.id,
  );
  const choice = await create(
    "block",
    {
      type: "select",
      title: "Är flödet begripligt?",
      options: ["Ja", "Nej"],
      value: "Ja",
      order: 1,
    },
    card.id,
  );
  await create(
    "block",
    {
      type: "checklist",
      checked: [
        {
          id: crypto.randomUUID(),
          text: "Prova att ändra en bokning",
          done: false,
        },
      ],
      order: 2,
    },
    card.id,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page
    .getByRole("button", { name: plan.body.title, exact: true })
    .click();
  await page.getByRole("button", { name: "Anpassa plan", exact: true }).click();
  const settings = page.getByRole("dialog", {
    name: "Anpassa plan",
    exact: true,
  });
  await settings.locator("label", { hasText: "Planens namn" }).click();
  await expect(
    settings.getByLabel("Planens namn", { exact: true }),
  ).toBeFocused();
  const nameBox = await settings
    .getByLabel("Planens namn", { exact: true })
    .boundingBox();
  const colorBox = await settings.getByLabel("Planfärg").boundingBox();
  expect(nameBox.width).toBeGreaterThan(colorBox.width);
  expect(Math.abs(nameBox.y - colorBox.y)).toBeLessThan(2);
  expect(Math.abs(nameBox.height - colorBox.height)).toBeLessThan(3);
  await page.screenshot({ path: "test-results/ux-plan-settings.png" });
  await settings.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: card.body.title }).click();
  const sheet = page.getByRole("dialog", { name: "Uppgift", exact: true });
  const start = await sheet
    .getByLabel("Startdatum", { exact: true })
    .boundingBox();
  const due = await sheet
    .getByLabel("Slutdatum", { exact: true })
    .boundingBox();
  expect(start.width).toBe(due.width);
  expect(start.height).toBe(due.height);
  // Clicking the visible custom label must toggle the actual checkbox.
  await sheet.locator("label", { hasText: "Godkänd" }).click();
  await expect(sheet.getByLabel("Godkänd", { exact: true })).toBeChecked();
  const longText = Array.from(
    { length: 10 },
    (_, i) =>
      `Steg ${i + 1}: Dokumentera resultatet så att nästa kollega kan fortsätta arbetet.`,
  ).join("\n");
  const text = sheet.getByLabel("Text", { exact: true });
  const before = await text.boundingBox();
  await text.fill(longText);
  await expect
    .poll(async () => (await text.boundingBox()).height)
    .toBeGreaterThan(before.height);
  await expect
    .poll(
      async () =>
        (await getState()).records.find((r) => r.id === textBlock.id).body.text,
    )
    .toBe(longText);
  // Editing a choice list must not silently erase an existing answer.
  await sheet.getByText("Ändra svarsalternativ", { exact: true }).click();
  await sheet
    .getByLabel("Svarsalternativ", { exact: true })
    .fill("Ja\nNej\nDelvis");
  await sheet.getByRole("heading", { name: "Arbetsdokument" }).click();
  await expect(
    sheet.getByRole("button", { name: "Spara alternativ", exact: true }),
  ).toBeVisible();
  expect(
    (await getState()).records.find((r) => r.id === choice.id).body.options,
  ).toEqual(["Ja", "Nej"]);
  await sheet
    .getByRole("button", { name: "Spara alternativ", exact: true })
    .click();
  await expect(
    sheet.getByRole("combobox", { name: "Är flödet begripligt?", exact: true }),
  ).toHaveValue("Ja");
  await expect
    .poll(
      async () =>
        (await getState()).records.find((r) => r.id === choice.id).body.options,
    )
    .toEqual(["Ja", "Nej", "Delvis"]);
  await sheet
    .getByText("Deluppgifter, kopplingar och tid", { exact: true })
    .click();
  const estimate = sheet.getByLabel("Uppskattad tid, timmar", { exact: true });
  await estimate.fill("två");
  await expect(estimate).toHaveAttribute("aria-invalid", "true");
  const errorId = await estimate.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${errorId}"]`)).toContainText(
    "Ange ett positivt antal timmar",
  );
  await estimate.fill("2,5");
  await expect(estimate).toHaveAttribute("aria-invalid", "false");
  await expect
    .poll(
      async () =>
        (await getState()).records.find((r) => r.id === card.id).body.estimate,
    )
    .toBe(2.5);
  // A failed send leaves the comment available for a deliberate retry.
  let failNextComment = true;
  await page.route("**/api/records", (route) => {
    if (failNextComment && route.request().postDataJSON()?.kind === "comment") {
      failNextComment = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test: anslutningen bröts" }),
      });
    }
    return route.continue();
  });
  await sheet
    .getByLabel("Kommentar", { exact: true })
    .fill("Vi har testat hela bokningsflödet.");
  await sheet.getByRole("button", { name: "Skicka", exact: true }).click();
  await expect(sheet.getByRole("alert")).toContainText("anslutningen bröts");
  await expect(sheet.getByLabel("Kommentar", { exact: true })).toHaveValue(
    "Vi har testat hela bokningsflödet.",
  );
  await sheet
    .getByRole("button", { name: "Stäng meddelande", exact: true })
    .click();
  await sheet.getByRole("button", { name: "Skicka", exact: true }).click();
  await expect(sheet.getByLabel("Kommentar", { exact: true })).toHaveValue("");
  const touch = await browser.newContext({
    baseURL: "http://127.0.0.1:3310",
    storageState: await context.storageState(),
    viewport: { width: 320, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await touch.newPage();
  await phone.goto("/");
  await phone.getByRole("button", { name: "Öppna meny" }).click();
  await phone
    .getByRole("button", { name: plan.body.title, exact: true })
    .click();
  await phone.getByRole("button", { name: card.body.title }).click();
  const mobileSheet = phone.getByRole("dialog", {
    name: "Uppgift",
    exact: true,
  });
  await expect(
    mobileSheet.getByLabel("Text", { exact: true }),
  ).toBeInViewport();
  await mobileSheet.getByText("Ansvariga och datum", { exact: true }).click();
  const mobileDate = mobileSheet.getByLabel("Startdatum", { exact: true });
  expect((await mobileDate.boundingBox()).height).toBeGreaterThanOrEqual(48);
  expect(
    await mobileDate.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  expect(
    await mobileSheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  // Tab order follows the mobile order: dates precede the document.
  const lastDate = mobileSheet.getByLabel("Slutdatum", { exact: true });
  await lastDate.focus();
  // Native date controls have separate month/day/year keyboard segments.
  for (
    let i = 0;
    i < 6 && (await lastDate.evaluate((el) => document.activeElement === el));
    i++
  ) {
    await phone.keyboard.press("Tab");
  }
  await expect(
    mobileSheet.getByLabel("Text: fler alternativ", { exact: true }),
  ).toBeFocused();
  await mobileSheet.getByText("Ansvariga och datum", { exact: true }).click();
  await mobileSheet.evaluate((el) => (el.scrollTop = 0));
  await phone.screenshot({ path: "test-results/ux-narrow-mobile.png" });
  await mobileSheet.getByRole("button", { name: "Stäng", exact: true }).click();
  await phone
    .getByRole("button", { name: "Anpassa plan", exact: true })
    .click();
  const mobileSettings = phone.getByRole("dialog", {
    name: "Anpassa plan",
    exact: true,
  });
  expect(
    await mobileSettings.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await phone.screenshot({ path: "test-results/ux-settings-mobile.png" });
  await touch.close();
});
