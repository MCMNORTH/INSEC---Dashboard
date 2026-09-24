import { expect, test } from "@playwright/test";
import { connecter } from "./aide";

test.describe.serial("Parcours complet d’administration", () => {
  test("candidature publique jusqu’à l’inscription", async ({ page }) => {
    await page.goto("/admission");
    await page.getByLabel("Prénom").fill("Aminata");
    await page.getByLabel("Nom", { exact: true }).fill("Sow");
    await page.getByLabel("Adresse e-mail").fill("aminata.sow@example.com");
    await page.getByLabel("Téléphone").fill("22334455");
    await page.getByLabel("Dernier diplôme obtenu").fill("Licence de gestion");
    await page.getByLabel("Diplôme visé").selectOption({ label: "DSGC — Diplôme supérieur de gestion et de comptabilité" });
    await page.getByLabel(/Je certifie/).check();
    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
    await expect(page.getByRole("heading", { name: "Candidature bien reçue" })).toBeVisible();
    const reference = await page.locator("p.font-mono").innerText();
    expect(reference).toMatch(/^ADM-/);

    await connecter(page, "admin@insec.test");
    await page.goto("/candidatures");
    await page.getByRole("link", { name: "Examiner →" }).first().click();
    await expect(page).toHaveURL(/\/candidatures\/\d+$/);
    await page.getByLabel("Statut").selectOption("Admissible");
    await page.getByRole("button", { name: "Enregistrer la décision" }).click();
    await expect(page.getByText("Décision enregistrée.")).toBeVisible();
    await page.getByLabel("Montant dû (MRU)").fill("150000");
    await page.getByRole("button", { name: "Créer l’étudiant et son inscription" }).click();
    await expect(page.getByText("Candidature convertie en étudiant et inscription créée.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aminata Sow" })).toBeVisible();
    await expect(page.getByText("TEC211 · Gestion juridique, fiscale et sociale")).toBeVisible();
  });

  test("création d’un étudiant, paiement, reçu et documents PDF", async ({ page }) => {
    await connecter(page, "admin@insec.test");
    await expect(page.getByRole("heading", { name: "Tableau de bord décisionnel" })).toBeVisible();
    await page.goto("/etudiants/create");
    await page.getByLabel("Nom", { exact: true }).fill("Traoré");
    await page.getByLabel("Prénom").fill("Moussa");
    await page.getByLabel("E-mail").fill("moussa.traore@example.com");
    await page.getByLabel("Diplôme").selectOption({ label: "DGC — Diplôme de gestion et de comptabilité" });
    await page.getByLabel("Année de parcours").selectOption("1");
    await page.getByLabel(/TEC111/).check();
    await page.getByLabel(/TEC119/).check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Étudiant et première inscription enregistrés.")).toBeVisible();

    // Une erreur de validation conserve la saisie.
    await page.goto("/etudiants/create");
    await page.getByLabel("Nom", { exact: true }).fill("Doublon");
    await page.getByLabel("Prénom").fill("Test");
    await page.getByLabel("E-mail").fill("moussa.traore@example.com");
    await page.getByLabel("Diplôme").selectOption({ label: "DGC — Diplôme de gestion et de comptabilité" });
    await page.getByLabel("Année de parcours").selectOption("1");
    await page.getByLabel(/TEC111/).check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/déjà utilisée/)).toBeVisible();
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Doublon");

    await page.goto("/etudiants?search=Traor");
    await page.getByRole("link", { name: "Traoré Moussa" }).click();
    await expect(page).toHaveURL(/\/etudiants\/\d+$/);
    await page.getByRole("main").getByRole("link", { name: "Finances" }).click();
    await expect(page).toHaveURL(/inscription=\d+/);
    await page.getByLabel("Montant brut").fill("120000");
    await page.getByLabel("Remise").fill("20000");
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Situation financière mise à jour.")).toBeVisible();
    await page.getByLabel("Montant du versement").fill("40000");
    await page.getByLabel("Date du versement").fill("2026-09-15");
    await page.getByLabel("Mode de paiement").selectOption("Mobile Money");
    await page.getByRole("button", { name: "+ Ajouter le versement" }).click();
    await expect(page.getByText(/Versement enregistré avec le reçu REC-\d{6}-\d{6}/)).toBeVisible();
    await expect(page.getByText("60 000 MRU").first()).toBeVisible();

    const recu = page.getByRole("link", { name: /^REC-/ }).first();
    const pdf = await page.request.get((await recu.getAttribute("href"))!);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.goto("/etudiants?search=Traor");
    await page.getByRole("link", { name: "Traoré Moussa" }).click();
    await page.getByRole("link", { name: "Dossier documentaire" }).click();
    await expect(page).toHaveURL(/\/documents$/);
    await page.getByLabel("Fichier").setInputFiles({ name: "cni.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("Pièce ajoutée au dossier.")).toBeVisible();
    const attestation = await page.request.get((await page.getByRole("link", { name: "Attestation d’inscription" }).first().getAttribute("href"))!);
    expect(attestation.headers()["content-disposition"]).toContain("attestation-inscription-");
  });

  test("planification d’un examen, saisie de note et journal d’audit", async ({ page }) => {
    await connecter(page, "admin@insec.test");
    await page.goto("/examens/create");
    await page.locator("select[name=ue_id]").selectOption({ label: "DGC · TEC111 — Fondamentaux du droit" });
    await page.locator("select[name=annee_academique_id]").selectOption({ index: 0 });
    await page.getByLabel("Date et heure").fill("2030-06-10T09:00");
    await page.getByLabel("Salle / lien").fill("Salle B");
    await page.getByRole("button", { name: "Créer et convoquer" }).click();
    await expect(page.getByText(/Examen créé ; \d+ étudiant\(s\) éligible\(s\) convoqué\(s\)\./)).toBeVisible();

    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Journal d’audit" })).toBeVisible();
    await expect(page.getByText(/Création Examen #\d+/).first()).toBeVisible();

    await page.goto("/excel");
    const exp = await page.request.get("/excel/finances");
    expect(exp.headers()["content-type"]).toContain("spreadsheetml");
    await page.goto("/communications");
    await expect(page.getByText(/les e-mails sont journalisés « En attente »/)).toBeVisible();
  });
});
