import { test, expect } from "@playwright/test";

test("work is easy to find, the document saves in place, and details work on mobile", async ({
  page,
  context,
}) => {
  const post = async (path, data) => {
    const response = await context.request.post("/api" + path, { data });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const user = await post("/register", {
    name: "Testanvändare",
    email: `workspace-${crypto.randomUUID()}@example.test`,
    password: "Långt lösenord för test",
  });
  const team = await post("/teams", { name: "Exempelteam" });
  const create = (kind, body, parentId = null) =>
    post("/records", { teamId: team.id, kind, parentId, body });
  const plan = await create("plan", {
    title: "Införa bokningssystem",
    color: "teal",
  });
  const secondPlan = await create("plan", {
    title: "Gemensam utveckling",
    color: "purple",
  });
  const state = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  const buckets = state.records
    .filter((r) => r.kind === "bucket" && r.parent_id === plan.id)
    .sort((a, b) => a.body.order - b.body.order);
  const dateAfter = (days) =>
    new Date(Date.now() + days * 86400000).toLocaleDateString("sv-SE");
  const base = { bucketId: buckets[0].id, assignees: [user.id] };
  const late = await create(
    "card",
    { ...base, title: "Samla verksamhetens behov", due: dateAfter(-1) },
    plan.id,
  );
  const task = await create(
    "card",
    {
      ...base,
      title: "Testa bokningsflödet",
      bucketId: buckets[1].id,
      start: dateAfter(0),
      due: dateAfter(7),
    },
    plan.id,
  );
  await create(
    "card",
    {
      ...base,
      title: "Utse kontaktpersoner",
      bucketId: buckets[2].id,
      done: true,
    },
    plan.id,
  );
  const block = await create(
    "block",
    {
      type: "text",
      text: "Prova att boka ett rum från början till slut. Dokumentera vad nästa person behöver veta.",
      order: 0,
    },
    task.id,
  );
  await create(
    "block",
    {
      type: "checklist",
      order: 1,
      checked: [
        { id: crypto.randomUUID(), text: "Skapa en bokning", done: true },
        {
          id: crypto.randomUUID(),
          text: "Ändra tiden och kontrollera bekräftelsen",
          done: false,
        },
      ],
    },
    task.id,
  );
  await create(
    "block",
    {
      type: "input",
      title: "Vad behöver vi förbättra?",
      value: "Bekräftelsen behöver tydligare visa vilket rum som bokats.",
      order: 2,
    },
    task.id,
  );
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/");
  const upcoming = page.getByRole("region", { name: "På tur för dig" });
  await expect(
    upcoming.getByRole("button", { name: /Samla verksamhetens behov/ }),
  ).toBeVisible();
  await expect(upcoming.getByText("Utse kontaktpersoner")).toHaveCount(0);
  expect((await upcoming.boundingBox()).y).toBeLessThan(
    (await page.locator(".plan-grid").boundingBox()).y,
  );
  await page.screenshot({ path: "test-results/classroom-home.png" });
  await page
    .getByRole("navigation", { name: "Huvudmeny" })
    .getByRole("button", { name: "Mina uppgifter", exact: true })
    .click();
  await page.getByRole("tab", { name: /Försenade/ }).click();
  await expect(
    page.getByRole("button", { name: /Samla verksamhetens behov/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Testa bokningsflödet/ }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Klart/ }).click();
  await expect(
    page.getByRole("button", { name: /Utse kontaktpersoner/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Införa bokningssystem", exact: true })
    .click();
  await page.getByRole("tab", { name: "Uppgifter", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Planverktyg", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: /Automatisera/ }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Uppgifter", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: "test-results/classroom-board.png" });
  await page.getByRole("button", { name: /Testa bokningsflödet/ }).click();
  const sheet = page.getByRole("dialog", { name: "Uppgift", exact: true });
  await expect(sheet.getByLabel("Text", { exact: true })).toBeInViewport();
  await sheet
    .getByLabel("Text", { exact: true })
    .fill("Skriv arbetet direkt här. Ändringen sparas utan att lämna fältet.");
  await expect(sheet.getByText("Sparat", { exact: true })).toBeVisible();
  const saved = await (
    await context.request.get("/api/state?team=" + team.id)
  ).json();
  expect(saved.records.find((r) => r.id === block.id).body.text).toBe(
    "Skriv arbetet direkt här. Ändringen sparas utan att lämna fältet.",
  );
  await sheet
    .getByRole("heading", { name: "Arbetsdokument", exact: true })
    .click();
  await page.screenshot({ path: "test-results/classroom-document.png" });
  await sheet.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Testa bokningsflödet/ }).click();
  await expect(
    sheet.getByLabel("Slutdatum", { exact: true }),
  ).not.toBeVisible();
  await expect(sheet.getByLabel("Text", { exact: true })).toBeInViewport();
  await page.screenshot({ path: "test-results/classroom-mobile.png" });
  await sheet.getByText("Ansvariga och datum", { exact: true }).click();
  await expect(sheet.getByLabel("Slutdatum", { exact: true })).toBeVisible();
  await sheet.getByLabel("Slutdatum", { exact: true }).fill(dateAfter(-2));
  await expect(sheet.getByRole("alert")).toContainText(
    "Slutdatum måste vara efter startdatum",
  );
  await sheet
    .getByRole("button", { name: "Stäng meddelande", exact: true })
    .click();
  await sheet.getByLabel("Slutdatum", { exact: true }).fill(dateAfter(10));
  await expect
    .poll(async () => {
      const s = await (
        await context.request.get("/api/state?team=" + team.id)
      ).json();
      return s.records.find((r) => r.id === task.id).body.due;
    })
    .toBe(dateAfter(10));
  await sheet.getByText("Ansvariga och datum", { exact: true }).click();
  await sheet
    .getByRole("button", { name: "Markera som klar", exact: true })
    .click();
  await expect(
    sheet.getByRole("button", { name: "Öppna igen", exact: true }),
  ).toBeVisible();
  expect(
    await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await sheet.getByRole("button", { name: "Stäng", exact: true }).click();
  const blank = await create(
    "card",
    { ...base, title: "En ny gemensam uppgift" },
    plan.id,
  );
  await page.getByRole("button", { name: /En ny gemensam uppgift/ }).click();
  await sheet
    .getByLabel("Börja skriva i dokumentet")
    .fill("Mitt första utkast ska finnas kvar.");
  await create(
    "block",
    { type: "heading", text: "Kollegans rubrik", order: 0 },
    blank.id,
  );
  await expect(sheet.getByLabel("Rubrik", { exact: true })).toHaveValue(
    "Kollegans rubrik",
  );
  await expect(sheet.getByLabel("Börja skriva i dokumentet")).toHaveValue(
    "Mitt första utkast ska finnas kvar.",
  );
  await sheet
    .getByRole("button", { name: "Lägg till text", exact: true })
    .click();
  await expect(sheet.getByLabel("Text", { exact: true })).toHaveValue(
    "Mitt första utkast ska finnas kvar.",
  );
});
