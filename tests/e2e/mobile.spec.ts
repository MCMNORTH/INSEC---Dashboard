import { expect, test } from "@playwright/test";
import { connecter } from "./aide";

test("sur mobile, le menu remplace la barre latérale et la page ne déborde pas", async ({ page }) => {
  await connecter(page, "admin@insec.test");
  await page.goto("/etudiants");
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(largeur).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Finances" }).click();
  await expect(page).toHaveURL(/\/finances/);
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
});
