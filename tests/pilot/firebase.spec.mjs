import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const password = "Pilotens testlösenord 2026!";
async function register(page, name, email, url = "/") {
  await page.goto(url);
  await page.getByRole("button", { name: "Ny här? Skapa konto" }).click();
  await page.getByLabel("Ditt namn", { exact: true }).fill(name);
  await page.getByLabel("E-post", { exact: true }).fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Skapa konto", exact: true }).click();
}
test("Firebase accounts collaborate through the complete Cloudflare app", async ({
  browser,
  page,
}) => {
  const suffix = Date.now();
  await register(page, "Anna", `anna-${suffix}@example.test`);
  await expect(page.getByRole("heading", { name: "Hej Anna." })).toBeVisible();
  await page.getByLabel("Teamets namn").fill("Pilotteam");
  await page.getByRole("button", { name: "Skapa team", exact: true }).click();
  await page
    .getByRole("button", { name: "Skapa er första plan" })
    .first()
    .click();
  await page.getByLabel("Vad heter planen?").fill("Gemensam pilot");
  await page.getByRole("button", { name: "Skapa", exact: true }).last().click();
  await page
    .getByRole("button", { name: "Lägg till uppgift", exact: true })
    .first()
    .click();
  await page.getByLabel("Vad behöver göras?").fill("Arbeta tillsammans");
  await page.getByRole("button", { name: "Skapa", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Börja skriva i dokumentet").fill("Första texten");
  await dialog
    .getByRole("button", { name: "Lägg till text", exact: true })
    .click();
  await dialog.getByLabel("Bifoga fil").setInputFiles({
    name: "pilot.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Gemensam bilaga"),
  });
  await expect(
    dialog.getByRole("link", { name: "pilot.txt", exact: true }),
  ).toHaveAttribute("href", /^blob:/);
  await dialog.getByRole("button", { name: "Stäng", exact: true }).click();
  await page
    .getByRole("button", { name: "Team och delning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skapa inbjudningslänk", exact: true })
    .click();
  const invite = await page
    .getByRole("dialog")
    .locator("input[readonly]")
    .inputValue();
  const context = await browser.newContext();
  const colleague = await context.newPage();
  await register(colleague, "Bo", `bo-${suffix}@example.test`, invite);
  await expect(
    colleague.getByRole("button", { name: /Gemensam pilot/ }).first(),
  ).toBeVisible();
  await colleague
    .getByRole("button", { name: "Logga ut", exact: true })
    .click();
  await colleague
    .getByLabel("E-post", { exact: true })
    .fill(`bo-${suffix}@example.test`);
  await colleague
    .getByRole("button", { name: "Glömt lösenord?", exact: true })
    .click();
  await expect(
    colleague.getByText(
      "Om adressen har ett konto får du ett mejl för att välja nytt lösenord.",
    ),
  ).toBeVisible();
  await colleague.getByLabel("Lösenord", { exact: true }).fill(password);
  await colleague
    .getByRole("button", { name: "Logga in", exact: true })
    .click();
  await expect(
    colleague.getByRole("button", { name: /Gemensam pilot/ }).first(),
  ).toBeVisible();
  await colleague
    .getByRole("button", { name: /Gemensam pilot/ })
    .first()
    .click();
  await colleague
    .getByRole("button", { name: /Arbeta tillsammans/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Stäng", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Arbeta tillsammans/ })
    .first()
    .click();
  const attachment = colleague.getByRole("link", {
    name: "pilot.txt",
    exact: true,
  });
  await expect(attachment).toHaveAttribute("href", /^blob:/);
  const downloaded = colleague.waitForEvent("download");
  await attachment.click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("pilot.txt");
  expect(await readFile(await file.path(), "utf8")).toBe("Gemensam bilaga");
  const text = colleague.getByRole("textbox", { name: "Text", exact: true });
  await text.fill("Bo uppdaterade dokumentet");
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toHaveValue("Bo uppdaterade dokumentet");
  await colleague.reload();
  await expect(
    colleague.getByRole("button", { name: /Gemensam pilot/ }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/firebase-pilot.png",
    fullPage: true,
  });
  await context.close();
});
