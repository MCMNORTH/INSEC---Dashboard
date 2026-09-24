import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { anneesAcademiques, etudiants, examens, inscriptionUe, inscriptions, resultatsExamens, ues } from "@/db/schema";
import { creer, modifier } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { resultatValide } from "@/lib/domain/calculs";
import { NotFoundError, ValidationError, parse } from "@/lib/errors";
import { depuisDateTimeLocal, formatDateAHeure, formatNote } from "@/lib/format";
import { type Notification, envoyerNotification, urlApplication } from "@/lib/mail";
import {
  PRESENCES,
  SESSIONS_EXAMEN,
  STATUTS_EXAMEN,
  identifiant,
  nombre,
  nombreOptionnel,
  parmi,
  texte,
  texteOptionnel,
} from "@/lib/validation";

const examenSchema = z
  .object({
    ue_id: identifiant("UE"),
    annee_academique_id: identifiant("année académique"),
    session: parmi("session", SESSIONS_EXAMEN),
    date_examen: texte("date et heure"),
    salle: texteOptionnel("salle", 100),
    note_sur: nombre("note sur", { max: 100 }).refine((n) => n > 0, "La note maximale doit être supérieure à 0."),
    seuil_validation: nombre("seuil de validation", { min: 0 }),
    statut: parmi("statut", STATUTS_EXAMEN).default("Planifié"),
  })
  .refine((d) => d.seuil_validation <= d.note_sur, "Le seuil de validation ne peut pas dépasser la note maximale.");

/**
 * Planifie un examen et convoque automatiquement les étudiants inscrits à l'UE pendant l'année choisie.
 * Retourne les e-mails de convocation à envoyer (l'appelant les expédie après la réponse).
 */
export async function planifierExamen(ctx: Ctx, input: unknown): Promise<{ id: number; convocations: Notification[] }> {
  const data = parse(examenSchema, input);
  const date = depuisDateTimeLocal(data.date_examen);
  if (!date) throw new ValidationError(["Le champ date et heure doit être une date valide."]);
  const [ue] = await ctx.db.select().from(ues).where(eq(ues.id, data.ue_id));
  if (!ue) throw new ValidationError(["L’UE sélectionnée est invalide."]);
  const [annee] = await ctx.db.select().from(anneesAcademiques).where(eq(anneesAcademiques.id, data.annee_academique_id));
  if (!annee) throw new ValidationError(["L’année académique sélectionnée est invalide."]);

  const { examen, convoques } = await ctx.db.transaction(async (tx) => {
    const examen = await creer(tx, ctx, examens, "Examen", {
      ueId: ue.id,
      anneeAcademiqueId: annee.id,
      session: data.session,
      dateExamen: date,
      salle: data.salle,
      noteSur: data.note_sur,
      seuilValidation: data.seuil_validation,
      statut: data.statut,
    });
    const eligibles = await tx
      .selectDistinct({ inscriptionId: inscriptions.id, email: etudiants.email, prenom: etudiants.prenom, nom: etudiants.nom })
      .from(inscriptions)
      .innerJoin(inscriptionUe, eq(inscriptionUe.inscriptionId, inscriptions.id))
      .innerJoin(etudiants, eq(etudiants.id, inscriptions.idEtudiant))
      .where(and(eq(inscriptions.idAnneeAcademique, annee.id), eq(inscriptionUe.ueId, ue.id)));
    for (const e of eligibles) {
      await creer(tx, ctx, resultatsExamens, "ResultatExamen", {
        examenId: examen.id,
        inscriptionId: e.inscriptionId,
        presence: "Convoqué",
      });
    }
    return { examen, convoques: eligibles };
  });

  const convocations: Notification[] = convoques.map((e) => ({
    email: e.email,
    nom: `${e.prenom} ${e.nom}`,
    type: "Convocation",
    sujet: "Convocation à un examen INSEC",
    titre: "Nouvelle convocation",
    message: "Vous êtes convoqué(e) à l’examen ci-dessous.",
    details: {
      UE: ue.code,
      Session: examen.session,
      Date: formatDateAHeure(examen.dateExamen),
      Salle: examen.salle || "À confirmer",
    },
  }));
  return { id: examen.id, convocations };
}

const resultatSchema = z.object({
  presence: parmi("présence", PRESENCES),
  note: nombreOptionnel("note", { min: 0 }),
  commentaire: texteOptionnel("commentaire", 1000),
});

export async function saisirResultat(ctx: Ctx, examenId: number, resultatId: number, input: unknown) {
  const data = parse(resultatSchema, input);
  const resultat = await ctx.db.query.resultatsExamens.findFirst({
    where: eq(resultatsExamens.id, resultatId),
    with: { examen: { with: { ue: true } }, inscription: { with: { etudiant: true } } },
  });
  if (!resultat || resultat.examenId !== examenId) throw new NotFoundError("Résultat introuvable.");
  const examen = resultat.examen;

  if (data.presence === "Présent" && data.note === null) {
    throw new ValidationError(["Une note est obligatoire pour un étudiant présent."]);
  }
  if (data.note !== null && data.note > examen.noteSur) {
    throw new ValidationError([`La note ne peut pas dépasser ${formatNote(examen.noteSur)}.`]);
  }
  const note = data.presence === "Présent" ? data.note : null;

  await ctx.db.transaction((tx) =>
    modifier(tx, ctx, resultatsExamens, "ResultatExamen", resultat.id, {
      presence: data.presence,
      note,
      commentaire: data.commentaire,
    }),
  );

  if (note !== null) {
    const e = resultat.inscription.etudiant;
    const valide = resultatValide({ presence: data.presence, note }, examen);
    await envoyerNotification(ctx.db, {
      email: e.email,
      nom: `${e.prenom} ${e.nom}`,
      type: "Résultat",
      sujet: "Publication d’un résultat INSEC",
      titre: "Votre résultat est disponible",
      message: "Une note vient d’être publiée dans votre dossier académique.",
      details: {
        UE: examen.ue.code,
        Note: `${formatNote(note)}/${formatNote(examen.noteSur)}`,
        Décision: valide ? "Validée" : "Non validée",
      },
      url: urlApplication("/portail/etudiant"),
      label: "Consulter mon espace",
    });
  }
}
