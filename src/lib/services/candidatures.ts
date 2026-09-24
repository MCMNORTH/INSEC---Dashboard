import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { anneesAcademiques, candidatures, etudiants, formations, inscriptions, ues } from "@/db/schema";
import { creer, modifier } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { AppError, NotFoundError, ValidationError, isUniqueViolation, parse } from "@/lib/errors";
import { aujourdhui, dateCourte } from "@/lib/format";
import { envoyerNotification } from "@/lib/mail";
import {
  DECISIONS_CANDIDATURE,
  dateJour,
  dateJourOptionnelle,
  email,
  entier,
  identifiant,
  parmi,
  texte,
  texteOptionnel,
} from "@/lib/validation";
import { synchroniserUes } from "./etudiants";

const candidatureSchema = z.object({
  nom: texte("nom", 100),
  prenom: texte("prénom", 100),
  email: email(),
  telephone: texte("téléphone", 40),
  date_naissance: dateJourOptionnelle("date de naissance"),
  dernier_diplome: texte("dernier diplôme", 150),
  formation_id: identifiant("diplôme visé"),
  annee_academique_id: identifiant("année académique"),
  motivation: texteOptionnel("motivation", 2000),
});

function reference(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(6);
  const suffixe = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `ADM-${dateCourte()}-${suffixe}`;
}

/** Dépôt public d'une candidature (formulaire d'admission). */
export async function deposerCandidature(ctx: Ctx, input: unknown): Promise<string> {
  const data = parse(candidatureSchema, input);
  if (data.date_naissance && data.date_naissance >= aujourdhui()) {
    throw new ValidationError(["La date de naissance doit être antérieure à aujourd’hui."]);
  }
  const [formation] = await ctx.db
    .select()
    .from(formations)
    .where(and(eq(formations.id, data.formation_id), eq(formations.active, true)));
  if (!formation) throw new ValidationError(["Le diplôme visé est invalide."]);
  const [annee] = await ctx.db.select().from(anneesAcademiques).where(eq(anneesAcademiques.id, data.annee_academique_id));
  if (!annee) throw new ValidationError(["L’année académique est invalide."]);

  let candidature;
  try {
    candidature = await ctx.db.transaction((tx) =>
      creer(tx, ctx, candidatures, "Candidature", {
        reference: reference(),
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        telephone: data.telephone,
        dateNaissance: data.date_naissance,
        dernierDiplome: data.dernier_diplome,
        formationId: formation.id,
        anneeAcademiqueId: annee.id,
        motivation: data.motivation,
      }),
    );
  } catch (e) {
    if (isUniqueViolation(e, "candidatures_email_annee_unique")) {
      throw new ValidationError(["Une candidature existe déjà avec cette adresse e-mail pour cette année académique."]);
    }
    throw e;
  }

  await envoyerNotification(ctx.db, {
    email: candidature.email,
    nom: `${candidature.prenom} ${candidature.nom}`,
    type: "Candidature",
    sujet: "Votre candidature INSEC a bien été reçue",
    titre: "Candidature enregistrée",
    message: "Votre demande de préinscription est maintenant enregistrée et sera étudiée par notre équipe.",
    details: { Référence: candidature.reference, Diplôme: formation.code ?? formation.nom, Année: annee.libelle },
  });
  return candidature.reference;
}

async function charger(ctx: Ctx, id: number) {
  const c = await ctx.db.query.candidatures.findFirst({
    where: eq(candidatures.id, id),
    with: { formation: true, annee: true },
  });
  if (!c) throw new NotFoundError("Candidature introuvable.");
  return c;
}

/** Décision administrative ; le candidat est prévenu par e-mail si le statut change. */
export async function deciderCandidature(ctx: Ctx, id: number, input: unknown) {
  const c = await charger(ctx, id);
  if (c.statut === "Inscrite") throw new AppError("Cette candidature est déjà convertie.");
  const data = parse(
    z.object({ statut: parmi("statut", DECISIONS_CANDIDATURE), note_interne: texteOptionnel("note interne", 2000) }),
    input,
  );
  await ctx.db.transaction((tx) =>
    modifier(tx, ctx, candidatures, "Candidature", id, {
      statut: data.statut,
      noteInterne: data.note_interne,
      traiteeAt: new Date(),
    }),
  );
  if (c.statut !== data.statut) {
    await envoyerNotification(ctx.db, {
      email: c.email,
      nom: `${c.prenom} ${c.nom}`,
      type: "Admission",
      sujet: "Mise à jour de votre candidature INSEC",
      titre: "Décision d’admission",
      message: "Le statut de votre candidature a été mis à jour.",
      details: { Référence: c.reference, "Nouveau statut": data.statut, Diplôme: c.formation.code ?? c.formation.nom },
    });
  }
}

/**
 * Convertit une candidature admissible en dossier étudiant + inscription, avec toutes les UE actives
 * de l'année de parcours choisie.
 */
export async function convertirCandidature(ctx: Ctx, id: number, input: unknown): Promise<number> {
  const c = await charger(ctx, id);
  if (c.statut !== "Admissible") throw new AppError("La candidature doit être admissible avant inscription.");
  const data = parse(
    z.object({
      annee_parcours: entier("année de parcours", { min: 1, max: 3 }),
      date_inscription: dateJour("date d’inscription"),
      numero_inscription_intec: texteOptionnel("N° INTEC", 100),
      montant_du: entier("montant dû", { min: 0 }),
    }),
    input,
  );
  if (data.annee_parcours > c.formation.dureeAnnees) throw new AppError("Année de parcours incompatible.");

  const ueIds = (
    await ctx.db
      .select({ id: ues.id })
      .from(ues)
      .where(and(eq(ues.formationId, c.formationId), eq(ues.anneeParcours, data.annee_parcours), eq(ues.active, true)))
  ).map((u) => u.id);
  if (!ueIds.length) throw new AppError("Aucune UE active pour cette année de parcours.");

  const etudiantId = await ctx.db.transaction(async (tx) => {
    let [etudiant] = await tx.select().from(etudiants).where(eq(etudiants.email, c.email));
    etudiant ??= await creer(tx, ctx, etudiants, "Etudiant", {
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      telephone: c.telephone,
      statutEtudiant: "Actif",
    });
    const inscription = await creer(tx, ctx, inscriptions, "Inscription", {
      idEtudiant: etudiant.id,
      idFormation: c.formationId,
      idAnneeAcademique: c.anneeAcademiqueId,
      anneeParcours: data.annee_parcours,
      dateInscription: data.date_inscription,
      numeroInscriptionIntec: data.numero_inscription_intec,
      statut: "active",
      montantDu: data.montant_du,
    });
    await synchroniserUes(tx, inscription.id, ueIds);
    await modifier(tx, ctx, candidatures, "Candidature", c.id, {
      statut: "Inscrite",
      etudiantId: etudiant.id,
      traiteeAt: new Date(),
    });
    return etudiant.id;
  });

  await envoyerNotification(ctx.db, {
    email: c.email,
    nom: `${c.prenom} ${c.nom}`,
    type: "Inscription",
    sujet: "Votre inscription INSEC est confirmée",
    titre: "Inscription définitive confirmée",
    message: "Votre dossier étudiant et votre inscription ont été créés avec succès.",
    details: {
      Diplôme: c.formation.code ?? c.formation.nom,
      "Année académique": c.annee.libelle,
      "N° INTEC": data.numero_inscription_intec ?? "En attente",
    },
  });
  return etudiantId;
}
