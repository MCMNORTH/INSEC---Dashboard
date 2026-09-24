import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { etudiants, formations, inscriptionUe, ues } from "@/db/schema";
import { deposerPiece } from "@/lib/services/documents";
import { exporterEtudiants, exporterFinances, importerEtudiants, modeleImport } from "@/lib/services/excel";
import { verifierDisponibilite } from "@/lib/services/readiness";
import {
  creerSauvegarde,
  inspecterArchive,
  listerSauvegardes,
  lireSauvegarde,
  purgerSauvegardes,
  restaurerSauvegarde,
} from "@/lib/services/sauvegardes";
import { getStockage } from "@/lib/storage";
import { creerUtilisateur, ctx, etudiantInscrit } from "../aide";

async function classeur(lignes: (string | number)[][]): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  lignes.forEach((l) => ws.addRow(l));
  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], "import.xlsx");
}

describe("Référentiel", () => {
  it("charge le catalogue officiel DGC et DSGC", async () => {
    const liste = await getDb().query.formations.findMany({ with: { ues: true } });
    const dgc = liste.find((f) => f.code === "DGC")!;
    const dsgc = liste.find((f) => f.code === "DSGC")!;
    expect(dgc.dureeAnnees).toBe(3);
    expect(dgc.ues).toHaveLength(13);
    expect(dsgc.ues).toHaveLength(7);
    expect(dgc.ues.reduce((s, u) => s + u.credits, 0)).toBe(180);
    expect(dsgc.ues.reduce((s, u) => s + u.credits, 0)).toBe(120);
    expect(await getDb().select().from(formations).where(eq(formations.active, true))).toHaveLength(2);
    expect(await getDb().select().from(ues)).toHaveLength(20);
  });
});

describe("Imports et exports Excel", () => {
  it("exporte des classeurs lisibles", async () => {
    await etudiantInscrit();
    for (const generer of [modeleImport, () => exporterEtudiants(getDb()), () => exporterFinances(getDb())]) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await generer()) as unknown as ArrayBuffer);
      expect(wb.worksheets[0].rowCount).toBeGreaterThanOrEqual(2);
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exporterEtudiants(getDb())) as unknown as ArrayBuffer);
    expect(wb.worksheets[0].getRow(2).getCell(4).text).toBe("mariam@example.com");
  });

  it("importe les lignes valides et signale les lignes invalides sans bloquer", async () => {
    const admin = await creerUtilisateur("admin");
    await etudiantInscrit("existant@example.com");
    const fichier = await classeur([
      ["Prénom", "Nom", "E-mail", "Téléphone", "Statut"],
      ["Awa", "Ba", "AWA@example.com", "22000000", "Actif"],
      ["Sans", "Email", "", "", "Actif"],
      ["Mauvais", "Statut", "statut@example.com", "", "Inconnu"],
      ["", "", "", "", ""],
      ["Mariam", "Ba", "existant@example.com", "", "Diplômé"],
    ]);
    const rapport = await importerEtudiants(ctx(admin), fichier, "ignorer");
    expect(rapport).toMatchObject({ crees: 1, misAJour: 0, ignores: 1 });
    expect(rapport.erreurs).toHaveLength(2);
    expect(rapport.erreurs[0]).toMatch(/^Ligne 3 :/);

    const maj = await importerEtudiants(ctx(admin), await classeur([["Prénom", "Nom", "E-mail", "Téléphone", "Statut"], ["Mariam", "Ba", "existant@example.com", "", "Diplômé"]]), "mettre_a_jour");
    expect(maj.misAJour).toBe(1);
    const [e] = await getDb().select().from(etudiants).where(eq(etudiants.email, "existant@example.com"));
    expect(e.statutEtudiant).toBe("Diplômé");
  });

  it("refuse un fichier dont les colonnes ne suivent pas le modèle et accepte un CSV à points-virgules", async () => {
    const admin = await creerUtilisateur("admin");
    await expect(importerEtudiants(ctx(admin), await classeur([["Nom", "Prénom"]]), "ignorer")).rejects.toThrow("modèle INSEC");
    const csv = new File(["Prénom;Nom;E-mail;Téléphone;Statut\nIbrahima;Kane;ibrahima@example.com;;Actif\n"], "import.csv", { type: "text/csv" });
    expect((await importerEtudiants(ctx(admin), csv, "ignorer")).crees).toBe(1);
  });
});

describe("Sauvegardes", () => {
  it("crée une archive vérifiée contenant la base et les pièces, puis la restaure", async () => {
    const admin = await creerUtilisateur("super_admin");
    const { etudiant, inscription } = await etudiantInscrit();
    const [ue] = await getDb().select().from(ues).limit(1);
    await getDb().insert(inscriptionUe).values({ inscriptionId: inscription.id, ueId: ue.id });
    await deposerPiece(ctx(admin), etudiant.id, {
      type: "Diplôme",
      fichier: new File([strToU8("%PDF-1.4 diplome")], "diplome.pdf"),
    });

    const sauvegarde = await creerSauvegarde(getDb());
    expect(sauvegarde.integrite).toBe(true);
    expect(sauvegarde.documents).toBe(1);
    expect((await listerSauvegardes(getDb()))[0].nom).toBe(sauvegarde.nom);

    // Modifications après la sauvegarde, qui doivent disparaître à la restauration.
    await getDb().update(etudiants).set({ nom: "Modifié" }).where(eq(etudiants.id, etudiant.id));
    await getDb().insert(etudiants).values({ nom: "Nouveau", prenom: "X", email: "nouveau@example.com" });

    await restaurerSauvegarde(getDb(), sauvegarde.nom);
    const liste = await getDb().select().from(etudiants);
    expect(liste).toHaveLength(1);
    expect(liste[0].nom).toBe("Ba");
    // La séquence repart après le plus grand identifiant restauré.
    const [nouveau] = await getDb().insert(etudiants).values({ nom: "Après", prenom: "Y", email: "apres@example.com" }).returning();
    expect(nouveau.id).toBe(etudiant.id + 1);
    // Une sauvegarde de précaution a été créée avant la restauration.
    const toutes = await listerSauvegardes(getDb());
    expect(toutes.some((s) => s.motif === "Sauvegarde automatique avant restauration")).toBe(true);
  });

  it("détecte une archive altérée et refuse de la restaurer", async () => {
    await etudiantInscrit();
    const s = await creerSauvegarde(getDb());
    const fichiers = unzipSync(await lireSauvegarde(getDb(), s.nom));
    fichiers["data.json"] = strToU8(JSON.stringify({ etudiants: [] }));
    const alteree = zipSync(fichiers);
    expect(inspecterArchive(s.nom, alteree).integrite).toBe(false);
    await getStockage(getDb()).ecrire(`backups/${s.nom}`, alteree, "application/zip");
    await expect(restaurerSauvegarde(getDb(), s.nom)).rejects.toThrow("corrompue");
    expect(await getDb().select().from(etudiants)).toHaveLength(1);
    await expect(lireSauvegarde(getDb(), "../../etc/passwd")).rejects.toThrow("introuvable");
  });

  it("purge les archives de plus de 30 jours", async () => {
    const s = await creerSauvegarde(getDb());
    const stockage = getStockage(getDb());
    const resume = { ...s, cree_le: new Date(Date.now() - 40 * 86_400_000).toISOString() };
    await stockage.ecrire(`backups/${s.nom}.json`, strToU8(JSON.stringify(resume)), "application/json");
    expect(await purgerSauvegardes(getDb(), 30)).toBe(1);
    expect(await listerSauvegardes(getDb())).toHaveLength(0);
  });
});

describe("Sondes de santé", () => {
  it("vérifie les dépendances critiques et signale l’absence de sauvegarde en avertissement", async () => {
    const r = await verifierDisponibilite(getDb());
    expect(r.checks.database.status).toBe("ok");
    expect(r.checks.storage.status).toBe("ok");
    expect(r.checks.application_key.status).toBe("ok");
    expect(r.checks.backup.status).toBe("warning");
    expect(r.status).toBe("warning");
    await creerSauvegarde(getDb());
    expect((await verifierDisponibilite(getDb())).status).toBe("ok");
  });
});
