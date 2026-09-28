import { test, expect } from "@playwright/test";
test("create a team, plan, task and working document", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Ny här? Skapa konto" }).click();
  await page.getByLabel("Ditt namn").fill("Anna Andersson");
  await page
    .getByLabel("E-post", { exact: true })
    .fill(`anna-${Date.now()}@example.test`);
  await page
    .getByLabel("Lösenord", { exact: true })
    .fill("Ett långt testlösenord");
  await page.getByRole("button", { name: "Skapa konto", exact: true }).click();
  await page.getByLabel("Teamets namn").fill("Digitalisering");
  await page.getByRole("button", { name: "Skapa team", exact: true }).click();
  await page.getByRole("button", { name: "Skapa er första plan" }).click();
  await page.getByLabel("Vad heter planen?").fill("Införa bokningssystem");
  await page.getByRole("button", { name: "Skapa", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Införa bokningssystem", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lägg till uppgift", exact: true })
    .first()
    .click();
  await page.getByLabel("Vad behöver göras?").fill("Prova tillsammans");
  await page.getByRole("button", { name: "Skapa", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Uppgift", exact: true });
  await expect(sheet).toBeVisible();
  await sheet
    .getByLabel("Börja skriva i dokumentet", { exact: true })
    .fill("Testa bokning och dokumentera resultatet.");
  await sheet
    .getByRole("button", { name: "Lägg till text", exact: true })
    .click();
  await expect(sheet.getByLabel("Text", { exact: true })).toHaveValue(
    "Testa bokning och dokumentera resultatet.",
  );
  await sheet.getByRole("heading", { name: "Arbetsdokument" }).click();
  await expect(sheet.getByText("Sparar…")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Införa bokningssystem", exact: true })
    .click();
  await page.getByRole("button", { name: "Prova tillsammans" }).click();
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Testa bokning och dokumentera resultatet.",
  );
  await page.screenshot({
    path: "test-results/etapp-1-dokument.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.screenshot({
    path: "test-results/etapp-1-tavla.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Öppna meny" }).click();
  await page
    .getByRole("button", { name: "Mina uppgifter", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mina uppgifter" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/etapp-1-mobil.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
