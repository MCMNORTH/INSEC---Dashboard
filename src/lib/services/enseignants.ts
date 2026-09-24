import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { affectationEnseignant, enseignants, ues } from "@/db/schema";
import { creer, modifier, supprimer } from "@/lib/audit";
import type { Ctx } from "@/lib/context";
import { NotFoundError, ValidationError, isUniqueViolation, parse } from "@/lib/errors";
import { email, entier, identifiant, texte, texteOptionnel } from "@/lib/validation";

const enseignantSchema = z.object({
  nom: texte("nom"),
  prenom: texte("prénom"),
  specialite: texte("spécialité"),
  email: email(),
  telephone: texteOptionnel("téléphone", 30),
});

function valeurs(d: z.infer<typeof enseignantSchema>) {
  return { nom: d.nom, prenom: d.prenom, specialite: d.specialite, email: d.email, telephone: d.telephone };
}

function doublon(e: unknown): never {
  if (isUniqueViolation(e)) throw new ValidationError(["Cette adresse e-mail est déjà utilisée par un autre enseignant."]);
  throw e;
}

export async function creerEnseignant(ctx: Ctx, input: unknown) {
  const data = parse(enseignantSchema, input);
  try {
    return (await ctx.db.transaction((tx) => creer(tx, ctx, enseignants, "Enseignant", valeurs(data)))).id;
  } catch (e) {
    return doublon(e);
  }
}

export async function modifierEnseignant(ctx: Ctx, id: number, input: unknown) {
  const data = parse(enseignantSchema, input);
  try {
    const res = await ctx.db.transaction((tx) => modifier(tx, ctx, enseignants, "Enseignant", id, valeurs(data)));
    if (!res) throw new NotFoundError("Enseignant introuvable.");
  } catch (e) {
    doublon(e);
  }
}

export async function supprimerEnseignant(ctx: Ctx, id: number) {
  await ctx.db.transaction(async (tx) => {
    const affectations = await tx
      .select({ id: affectationEnseignant.id })
      .from(affectationEnseignant)
      .where(eq(affectationEnseignant.enseignantId, id));
    for (const a of affectations) await supprimer(tx, ctx, affectationEnseignant, "AffectationEnseignant", a.id);
    if (!(await supprimer(tx, ctx, enseignants, "Enseignant", id))) throw new NotFoundError("Enseignant introuvable.");
  });
}

/** Affecte une UE à un enseignant (sans doublon, comme firstOrCreate). */
export async function affecterUe(ctx: Ctx, enseignantId: number, input: unknown) {
  const data = parse(
    z.object({ ue_id: identifiant("UE"), nombre_etudiants: entier("nombre d’étudiants", { min: 0 }) }),
    input,
  );
  await ctx.db.transaction(async (tx) => {
    const [ens] = await tx.select({ id: enseignants.id }).from(enseignants).where(eq(enseignants.id, enseignantId));
    if (!ens) throw new NotFoundError("Enseignant introuvable.");
    const [ue] = await tx.select({ id: ues.id }).from(ues).where(eq(ues.id, data.ue_id));
    if (!ue) throw new ValidationError(["L’UE sélectionnée est invalide."]);
    const [existante] = await tx
      .select({ id: affectationEnseignant.id })
      .from(affectationEnseignant)
      .where(and(eq(affectationEnseignant.enseignantId, enseignantId), eq(affectationEnseignant.ueId, ue.id)));
    if (!existante) {
      await creer(tx, ctx, affectationEnseignant, "AffectationEnseignant", {
        enseignantId,
        ueId: ue.id,
        nombreEtudiants: data.nombre_etudiants,
      });
    }
  });
}

export async function retirerAffectation(ctx: Ctx, affectationId: number): Promise<number> {
  return ctx.db.transaction(async (tx) => {
    const [a] = await tx.select().from(affectationEnseignant).where(eq(affectationEnseignant.id, affectationId));
    if (!a) throw new NotFoundError("Affectation introuvable.");
    await supprimer(tx, ctx, affectationEnseignant, "AffectationEnseignant", a.id);
    return a.enseignantId;
  });
}
