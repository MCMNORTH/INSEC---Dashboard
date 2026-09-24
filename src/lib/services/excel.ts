import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { etudiants, inscriptions, resultatsExamens } from "@/db/schema";
import { creer, modifier } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { montantEnRetard, montantNet, resultatValide, soldeRestant, statutPaiement, totalVerse } from "@/lib/domain/calculs";
import { AppError, ValidationError } from "@/lib/errors";
import { formatDateHeure } from "@/lib/format";
import { STATUTS_ETUDIANT } from "@/lib/validation";

export const ENTETES_IMPORT = ["Prénom", "Nom", "E-mail", "Téléphone", "Statut"];
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Valeur = string | number | null | undefined;

function classeur(titre: string, entetes: string[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "INSEC Dashboard";
  const ws = wb.addWorksheet(titre.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(entetes);
  const entete = ws.getRow(1);
  entete.font = { bold: true, color: { argb: "FFFFFFFF" } };
  entete.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2761" } };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: entetes.length } };
  return { wb, ws };
}

function ecrire(ws: ExcelJS.Worksheet, valeurs: Valeur[]) {
  // Les textes restent des textes (téléphones, numéros INTEC…) ; seuls les nombres sont numériques.
  ws.addRow(valeurs.map((v) => (typeof v === "number" ? v : (v ?? "").toString())));
}

function finaliser(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      max = Math.max(max, Math.min(60, String(cell.text ?? "").length + 2));
    });
    col.width = max;
  });
  const derniere = ws.rowCount;
  for (let r = 2; r <= derniere; r++) {
    ws.getRow(r).eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
  }
}

async function tampon(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function modeleImport(): Promise<Buffer> {
  const { wb, ws } = classeur("Modèle import étudiants", ENTETES_IMPORT);
  ws.addRow(["Awa", "Ba", "awa@example.com", "22000000", "Actif"]);
  ws.getRow(2).font = { color: { argb: "FF777777" } };
  [20, 20, 32, 18, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return tampon(wb);
}

export async function exporterEtudiants(db: Db): Promise<Buffer> {
  const { wb, ws } = classeur("Étudiants", [
    "ID",
    "Prénom",
    "Nom",
    "E-mail",
    "Téléphone",
    "Statut étudiant",
    "Diplôme actuel",
    "Année académique",
    "Année parcours",
    "N° INTEC",
    "Statut inscription",
  ]);
  const liste = await db.query.etudiants.findMany({
    orderBy: asc(etudiants.nom),
    with: {
      inscriptions: { orderBy: desc(inscriptions.id), limit: 1, with: { formation: true, annee: true } },
    },
  });
  for (const e of liste) {
    const i = e.inscriptions[0];
    ecrire(ws, [
      e.id,
      e.prenom,
      e.nom,
      e.email,
      e.telephone,
      e.statutEtudiant,
      i?.formation?.code,
      i?.annee?.libelle,
      i?.anneeParcours ?? null,
      i?.numeroInscriptionIntec,
      i?.statut,
    ]);
  }
  finaliser(ws);
  return tampon(wb);
}

export async function exporterFinances(db: Db): Promise<Buffer> {
  const { wb, ws } = classeur("Finances", [
    "Étudiant",
    "E-mail",
    "Diplôme",
    "Année académique",
    "Montant dû",
    "Remise",
    "Montant net",
    "Total versé",
    "Solde restant",
    "Montant en retard",
    "Statut paiement",
  ]);
  const liste = await db.query.inscriptions.findMany({
    orderBy: [desc(inscriptions.createdAt), desc(inscriptions.id)],
    with: { etudiant: true, formation: true, annee: true, versements: true, echeances: true },
  });
  for (const i of liste) {
    ecrire(ws, [
      `${i.etudiant.prenom} ${i.etudiant.nom}`,
      i.etudiant.email,
      i.formation.code,
      i.annee.libelle,
      i.montantDu,
      i.montantRemise,
      montantNet(i),
      totalVerse(i),
      soldeRestant(i),
      montantEnRetard(i),
      statutPaiement(i),
    ]);
  }
  finaliser(ws);
  for (let c = 5; c <= 10; c++) ws.getColumn(c).numFmt = '#,##0 "MRU"';
  return tampon(wb);
}

export async function exporterResultats(db: Db): Promise<Buffer> {
  const { wb, ws } = classeur("Résultats", [
    "Étudiant",
    "E-mail",
    "Diplôme",
    "UE",
    "Libellé UE",
    "Session",
    "Date examen",
    "Présence",
    "Note",
    "Note sur",
    "Décision",
  ]);
  const liste = await db.query.resultatsExamens.findMany({
    orderBy: asc(resultatsExamens.id),
    with: { inscription: { with: { etudiant: true, formation: true } }, examen: { with: { ue: true } } },
  });
  for (const r of liste.filter((r) => r.note !== null)) {
    ecrire(ws, [
      `${r.inscription.etudiant.prenom} ${r.inscription.etudiant.nom}`,
      r.inscription.etudiant.email,
      r.inscription.formation.code,
      r.examen.ue.code,
      r.examen.ue.libelle,
      r.examen.session,
      formatDateHeure(r.examen.dateExamen),
      r.presence,
      r.note,
      r.examen.noteSur,
      resultatValide(r, r.examen) ? "Validée" : "Non validée",
    ]);
  }
  finaliser(ws);
  ws.getColumn(9).numFmt = "0.00";
  ws.getColumn(10).numFmt = "0.00";
  return tampon(wb);
}

/* -------------------------------- Import -------------------------------- */

const ligneSchema = z.object({
  prenom: z.string().min(1, "Le prénom est obligatoire.").max(100, "Le prénom ne doit pas dépasser 100 caractères."),
  nom: z.string().min(1, "Le nom est obligatoire.").max(100, "Le nom ne doit pas dépasser 100 caractères."),
  email: z.string().min(1, "L’e-mail est obligatoire.").max(255).email("L’e-mail est invalide."),
  telephone: z.string().max(40, "Le téléphone ne doit pas dépasser 40 caractères."),
  statut_etudiant: z.enum(STATUTS_ETUDIANT, { error: "Le statut est invalide (Actif, Suspendu, Diplômé ou Abandon)." }),
});

export type RapportImport = { crees: number; misAJour: number; ignores: number; erreurs: string[] };

async function lireLignes(fichier: File): Promise<string[][]> {
  const nom = fichier.name.toLowerCase();
  const wb = new ExcelJS.Workbook();
  const octets = Buffer.from(await fichier.arrayBuffer());
  if (nom.endsWith(".csv")) {
    // Détection simple du séparateur (Excel en français exporte souvent avec « ; »).
    const texte = octets.toString("utf8").replace(/^﻿/, "");
    const premiere = texte.split(/\r?\n/)[0] ?? "";
    const delimiter = (premiere.match(/;/g)?.length ?? 0) > (premiere.match(/,/g)?.length ?? 0) ? ";" : ",";
    await wb.csv.read(Readable.from([texte]), { parserOptions: { delimiter } });
  } else if (nom.endsWith(".xlsx")) {
    try {
      await wb.xlsx.load(octets as unknown as ArrayBuffer);
    } catch {
      throw new AppError("Le fichier Excel est illisible.");
    }
  } else {
    throw new ValidationError(["Le fichier doit être au format .xlsx ou .csv (enregistrez les anciens fichiers .xls en .xlsx)."]);
  }
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const lignes: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    lignes.push([1, 2, 3, 4, 5].map((c) => String(row.getCell(c).text ?? "").trim()));
  }
  return lignes;
}

export async function importerEtudiants(ctx: Ctx, fichier: unknown, mode: unknown): Promise<RapportImport> {
  if (!(fichier instanceof File) || fichier.size === 0) throw new ValidationError(["Le fichier est obligatoire."]);
  if (fichier.size > 4 * 1024 * 1024) throw new ValidationError(["Le fichier ne doit pas dépasser 4 Mo."]);
  if (mode !== "ignorer" && mode !== "mettre_a_jour") throw new ValidationError(["Le mode d’import est invalide."]);

  const lignes = await lireLignes(fichier);
  const entetes = lignes.shift() ?? [];
  if (ENTETES_IMPORT.some((h, i) => entetes[i] !== h)) {
    throw new AppError("Les colonnes du fichier ne correspondent pas au modèle INSEC.");
  }

  const rapport: RapportImport = { crees: 0, misAJour: 0, ignores: 0, erreurs: [] };
  for (const [index, row] of lignes.entries()) {
    const numero = index + 2;
    if (row.every((v) => v === "")) continue;
    const brut = {
      prenom: row[0],
      nom: row[1],
      email: row[2].toLowerCase(),
      telephone: row[3],
      statut_etudiant: row[4],
    };
    const res = ligneSchema.safeParse(brut);
    if (!res.success) {
      rapport.erreurs.push(`Ligne ${numero} : ${res.error.issues.map((i) => i.message).join(" ")}`);
      continue;
    }
    const d = res.data;
    const valeurs = {
      prenom: d.prenom,
      nom: d.nom,
      email: d.email,
      telephone: d.telephone || null,
      statutEtudiant: d.statut_etudiant,
    };
    const [existant] = await ctx.db.select({ id: etudiants.id }).from(etudiants).where(eq(etudiants.email, d.email));
    if (existant && mode === "ignorer") {
      rapport.ignores++;
      continue;
    }
    await ctx.db.transaction(async (tx) => {
      if (existant) {
        await modifier(tx, ctx, etudiants, "Etudiant", existant.id, valeurs);
        rapport.misAJour++;
      } else {
        await creer(tx, ctx, etudiants, "Etudiant", valeurs);
        rapport.crees++;
      }
    });
  }
  return rapport;
}
