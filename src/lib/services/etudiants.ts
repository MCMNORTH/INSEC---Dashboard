import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db";
import { anneesAcademiques, etudiants, formations, inscriptionUe, inscriptions, ues, versements } from "@/db/schema";
import { creer, modifier, supprimer } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { AppError, NotFoundError, ValidationError, isUniqueViolation, parse } from "@/lib/errors";
import {
  STATUTS_ETUDIANT,
  STATUTS_INSCRIPTION,
  dateJour,
  email,
  entier,
  identifiant,
  listeIdentifiants,
  parmi,
  texte,
  texteOptionnel,
} from "@/lib/validation";

export const identiteSchema = z.object({
  nom: texte("nom"),
  prenom: texte("prénom"),
  email: email(),
  telephone: texteOptionnel("téléphone", 30),
  statut_etudiant: parmi("statut étudiant", STATUTS_ETUDIANT),
});

const inscriptionChamps = {
  formation_id: identifiant("diplôme"),
  annee_academique_id: identifiant("année académique"),
  annee_parcours: entier("année de parcours", { min: 1 }),
  date_inscription: dateJour("date d’inscription"),
  numero_inscription_intec: texteOptionnel("N° INTEC", 100),
  ue_ids: listeIdentifiants("UE", "Sélectionnez au moins une UE."),
};

export const inscriptionSchema = z.object({
  ...inscriptionChamps,
  statut: parmi("statut de l’inscription", STATUTS_INSCRIPTION),
});

export type InscriptionInput = z.infer<typeof inscriptionSchema>;

const MESSAGE_UE = "Les UE choisies doivent appartenir au diplôme et à l’année de parcours sélectionnés.";

/** Vérifie la cohérence diplôme / année de parcours / UE (règle de l'ancienne application). */
export async function verifierInscription(tx: Tx, data: Omit<InscriptionInput, "statut">) {
  const [formation] = await tx.select().from(formations).where(eq(formations.id, data.formation_id));
  if (!formation) throw new ValidationError(["Le diplôme sélectionné est invalide."]);
  const [annee] = await tx.select().from(anneesAcademiques).where(eq(anneesAcademiques.id, data.annee_academique_id));
  if (!annee) throw new ValidationError(["L’année académique sélectionnée est invalide."]);
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(ues)
    .where(
      and(
        eq(ues.formationId, formation.id),
        eq(ues.anneeParcours, data.annee_parcours),
        inArray(ues.id, data.ue_ids),
      ),
    );
  if (data.annee_parcours > formation.dureeAnnees || n !== data.ue_ids.length) {
    throw new ValidationError([MESSAGE_UE]);
  }
  return formation;
}

/** Remplace les UE d'une inscription (équivalent de ->ues()->sync()). */
export async function synchroniserUes(tx: Tx, inscriptionId: number, ueIds: number[]) {
  await tx
    .delete(inscriptionUe)
    .where(
      ueIds.length
        ? and(eq(inscriptionUe.inscriptionId, inscriptionId), notInArray(inscriptionUe.ueId, ueIds))
        : eq(inscriptionUe.inscriptionId, inscriptionId),
    );
  if (ueIds.length) {
    await tx
      .insert(inscriptionUe)
      .values(ueIds.map((ueId) => ({ inscriptionId, ueId })))
      .onConflictDoNothing();
  }
}

function attributsInscription(data: Omit<InscriptionInput, "statut"> & { statut?: string }) {
  return {
    idFormation: data.formation_id,
    idAnneeAcademique: data.annee_academique_id,
    anneeParcours: data.annee_parcours,
    dateInscription: data.date_inscription,
    numeroInscriptionIntec: data.numero_inscription_intec,
    statut: data.statut ?? "active",
  };
}

function emailDejaUtilise(e: unknown): never {
  if (isUniqueViolation(e)) throw new ValidationError(["Cette adresse e-mail est déjà utilisée par un autre étudiant."]);
  throw e;
}

/** Nouvel étudiant et sa première inscription, dans une même transaction. */
export async function creerEtudiant(ctx: Ctx, input: unknown): Promise<number> {
  const data = parse(identiteSchema.extend(inscriptionChamps), input);
  try {
    return await ctx.db.transaction(async (tx) => {
      await verifierInscription(tx, data);
      const etudiant = await creer(tx, ctx, etudiants, "Etudiant", {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        telephone: data.telephone,
        statutEtudiant: data.statut_etudiant,
      });
      const inscription = await creer(tx, ctx, inscriptions, "Inscription", {
        idEtudiant: etudiant.id,
        ...attributsInscription(data),
      });
      await synchroniserUes(tx, inscription.id, data.ue_ids);
      return etudiant.id;
    });
  } catch (e) {
    return emailDejaUtilise(e);
  }
}

/** Mise à jour de l'identité seule : l'historique d'inscriptions n'est pas touché. */
export async function modifierEtudiant(ctx: Ctx, id: number, input: unknown) {
  const data = parse(identiteSchema, input);
  try {
    const res = await ctx.db.transaction((tx) =>
      modifier(tx, ctx, etudiants, "Etudiant", id, {
        nom: data.nom,
        prenom: data.prenom,
        email: data.email,
        telephone: data.telephone,
        statutEtudiant: data.statut_etudiant,
      }),
    );
    if (!res) throw new NotFoundError("Étudiant introuvable.");
  } catch (e) {
    emailDejaUtilise(e);
  }
}

/** Suppression refusée dès qu'un historique financier existe. */
export async function supprimerEtudiant(ctx: Ctx, id: number) {
  await ctx.db.transaction(async (tx) => {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(versements)
      .innerJoin(inscriptions, eq(versements.inscriptionId, inscriptions.id))
      .where(eq(inscriptions.idEtudiant, id));
    if (n > 0) throw new AppError("Impossible de supprimer cet étudiant : un historique financier existe.");
    if (!(await supprimer(tx, ctx, etudiants, "Etudiant", id))) throw new NotFoundError("Étudiant introuvable.");
  });
}

export async function ajouterInscription(ctx: Ctx, etudiantId: number, input: unknown) {
  const data = parse(inscriptionSchema, input);
  await ctx.db.transaction(async (tx) => {
    const [etudiant] = await tx.select({ id: etudiants.id }).from(etudiants).where(eq(etudiants.id, etudiantId));
    if (!etudiant) throw new NotFoundError("Étudiant introuvable.");
    await verifierInscription(tx, data);
    const inscription = await creer(tx, ctx, inscriptions, "Inscription", {
      idEtudiant: etudiantId,
      ...attributsInscription(data),
    });
    await synchroniserUes(tx, inscription.id, data.ue_ids);
  });
}

export async function modifierInscription(ctx: Ctx, inscriptionId: number, input: unknown): Promise<number> {
  const data = parse(inscriptionSchema, input);
  return ctx.db.transaction(async (tx) => {
    await verifierInscription(tx, data);
    const res = await modifier(tx, ctx, inscriptions, "Inscription", inscriptionId, attributsInscription(data));
    if (!res) throw new NotFoundError("Inscription introuvable.");
    await synchroniserUes(tx, inscriptionId, data.ue_ids);
    return res.idEtudiant;
  });
}
