import { eq } from "drizzle-orm";
import { z } from "zod";
import { echeances, etudiants, inscriptions, versements } from "@/db/schema";
import { creer, modifier } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { NotFoundError, parse } from "@/lib/errors";
import { anneeMois, formatDate, formatMru } from "@/lib/format";
import { envoyerNotification } from "@/lib/mail";
import { MODES_PAIEMENT, STATUTS_VERSEMENT, dateJour, entier, parmi, texte, texteOptionnel } from "@/lib/validation";

const situationSchema = z
  .object({
    montant_du: entier("montant brut", { min: 0 }),
    montant_remise: entier("remise", { min: 0 }),
    note_financiere: texteOptionnel("note financière", 2000),
  })
  .refine((d) => d.montant_remise <= d.montant_du, "La remise ne peut pas dépasser le montant brut.");

const versementSchema = z.object({
  montant: entier("montant", { min: 1 }),
  date_versement: dateJour("date du versement"),
  statut: parmi("statut", STATUTS_VERSEMENT),
  mode_paiement: parmi("mode de paiement", MODES_PAIEMENT),
  reference: texteOptionnel("référence", 100),
  note: texteOptionnel("note", 1000),
});

const echeanceSchema = z.object({
  libelle: texte("libellé", 100),
  montant: entier("montant", { min: 1 }),
  date_echeance: dateJour("date d’échéance"),
});

async function inscriptionOu404(ctx: Ctx, id: number) {
  const [row] = await ctx.db.select().from(inscriptions).where(eq(inscriptions.id, id));
  if (!row) throw new NotFoundError("Inscription introuvable.");
  return row;
}

export async function modifierSituation(ctx: Ctx, inscriptionId: number, input: unknown) {
  const data = parse(situationSchema, input);
  const ins = await inscriptionOu404(ctx, inscriptionId);
  await ctx.db.transaction((tx) =>
    modifier(tx, ctx, inscriptions, "Inscription", inscriptionId, {
      montantDu: data.montant_du,
      montantRemise: data.montant_remise,
      noteFinanciere: data.note_financiere,
    }),
  );
  return ins;
}

/** Enregistre un versement, lui attribue un numéro de reçu et confirme par e-mail s'il est validé. */
export async function ajouterVersement(ctx: Ctx, inscriptionId: number, input: unknown) {
  const data = parse(versementSchema, input);
  const ins = await inscriptionOu404(ctx, inscriptionId);
  const versement = await ctx.db.transaction(async (tx) => {
    const v = await creer(tx, ctx, versements, "Versement", {
      inscriptionId,
      montant: data.montant,
      dateVersement: data.date_versement,
      statut: data.statut,
      modePaiement: data.mode_paiement,
      reference: data.reference,
      note: data.note,
    });
    const numero = `REC-${anneeMois()}-${String(v.id).padStart(6, "0")}`;
    return (await modifier(tx, ctx, versements, "Versement", v.id, { numeroRecu: numero }))!;
  });

  if (versement.statut === "Validée") {
    const [e] = await ctx.db.select().from(etudiants).where(eq(etudiants.id, ins.idEtudiant));
    await envoyerNotification(ctx.db, {
      email: e.email,
      nom: `${e.prenom} ${e.nom}`,
      type: "Paiement",
      sujet: "Confirmation de votre paiement INSEC",
      titre: "Paiement validé",
      message: "Votre versement a été validé et enregistré dans votre dossier financier.",
      details: {
        Reçu: versement.numeroRecu ?? "",
        Montant: formatMru(versement.montant),
        Date: formatDate(versement.dateVersement),
      },
    });
  }
  return { inscription: ins, versement };
}

export async function ajouterEcheance(ctx: Ctx, inscriptionId: number, input: unknown) {
  const data = parse(echeanceSchema, input);
  const ins = await inscriptionOu404(ctx, inscriptionId);
  await ctx.db.transaction((tx) =>
    creer(tx, ctx, echeances, "Echeance", {
      inscriptionId,
      libelle: data.libelle,
      montant: data.montant,
      dateEcheance: data.date_echeance,
    }),
  );
  return ins;
}
