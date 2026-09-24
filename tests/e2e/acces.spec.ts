import { expect, test } from "@playwright/test";
import { connecter, MOT_DE_PASSE } from "./aide";

test.describe("Contrôle d’accès par rôle", () => {
  test("un visiteur est renvoyé vers la connexion", async ({ page }) => {
    await page.goto("/etudiants");
    await expect(page).toHaveURL(/\/login\?next=%2Fetudiants/);
    const pdf = await page.request.get("/pdf/attestations/1", { maxRedirects: 0 });
    expect(pdf.status()).toBe(307);
  });

  test("les sondes de santé sont publiques et ne divulguent aucun secret", async ({ request }) => {
    const live = await request.get("/health/live");
    expect(live.status()).toBe(200);
    const ready = await request.get("/health/ready");
    expect(ready.status()).toBe(200);
    const corps = await ready.json();
    expect(corps.checks).toEqual({ application_key: "ok", database: "ok", storage: "ok", backup: expect.any(String) });
    expect(JSON.stringify(corps)).not.toContain("secret");
  });

  test("le finance n’accède qu’aux finances", async ({ page }) => {
    await connecter(page, "finance@insec.test");
    await expect(page).toHaveURL(/\/finances/);
    await expect(page.getByRole("heading", { name: "Finances" })).toBeVisible();
    for (const chemin of ["/etudiants", "/admin/dashboard", "/audit", "/comptes", "/sauvegardes"]) {
      const res = await page.goto(chemin);
      expect(res?.status(), chemin).toBe(403);
      await expect(page.getByText("Accès refusé")).toBeVisible();
    }
    expect((await page.request.get("/excel/etudiants")).status()).toBe(403);
  });

  test("l’étudiant ne voit que son portail", async ({ page }) => {
    await connecter(page, "etudiant@insec.test");
    await expect(page).toHaveURL(/\/portail\/etudiant/);
    await expect(page.getByRole("heading", { name: "Bonjour Sidi" })).toBeVisible();
    for (const chemin of ["/portail/enseignant", "/finances", "/admin/dashboard"]) {
      expect((await page.goto(chemin))?.status(), chemin).toBe(403);
    }
    await page.goto("/alertes");
    await expect(page.getByRole("heading", { name: "Centre d’alertes" })).toBeVisible();
  });

  test("l’enseignant ne voit que son portail", async ({ page }) => {
    await connecter(page, "enseignant@insec.test");
    await expect(page).toHaveURL(/\/portail\/enseignant/);
    await expect(page.getByText("Comptabilité")).toBeVisible();
    expect((await page.goto("/portail/etudiant"))?.status()).toBe(403);
  });

  test("un compte désactivé ne peut pas se connecter", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill("desactive@insec.test");
    await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Ce compte est désactivé.")).toBeVisible();
  });

  test("seul le super administrateur gère les sauvegardes", async ({ page }) => {
    await connecter(page, "admin@insec.test");
    expect((await page.goto("/sauvegardes"))?.status()).toBe(403);
    await page.getByRole("link", { name: "Retour à mon espace" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole("heading", { name: "Tableau de bord décisionnel" })).toBeVisible();
    await page.getByRole("navigation", { name: "Navigation principale" }).first().getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/login/);

    await connecter(page, "super@insec.test");
    await page.goto("/sauvegardes");
    await page.getByRole("button", { name: "Créer une sauvegarde" }).click();
    await expect(page.getByText("Sauvegarde créée et vérifiée.")).toBeVisible();
    await expect(page.getByText("Intègre").first()).toBeVisible();
    const lien = page.getByRole("link", { name: "Télécharger" }).first();
    const reponse = await page.request.get((await lien.getAttribute("href"))!);
    expect(reponse.headers()["content-type"]).toBe("application/zip");
  });

  test("la tâche planifiée exige le secret CRON", async ({ request }) => {
    expect((await request.get("/api/cron/sauvegarde")).status()).toBe(401);
    const ok = await request.get("/api/cron/sauvegarde", { headers: { Authorization: "Bearer cron-e2e" } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).sauvegarde).toMatch(/^insec-.*\.zip$/);
  });
});
