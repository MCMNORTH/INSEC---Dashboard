import { eq } from "drizzle-orm";
import { z } from "zod";
import { enseignants, etudiants, users } from "@/db/schema";
import { creer, modifier } from "@/lib/audit";
import { hacher } from "@/lib/auth/password";
import type { Ctx } from "@/lib/context";
import { AppError, NotFoundError, ValidationError, isUniqueViolation, parse } from "@/lib/errors";
import { email, texte } from "@/lib/validation";

const optionnelId = z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable());

const compteSchema = z
  .object({
    name: texte("nom affiché"),
    email: email(),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
    password_confirmation: z.string(),
    role: z.enum(["admin", "finance", "enseignant", "etudiant"], { error: "Le rôle sélectionné est invalide." }),
    etudiant_id: optionnelId,
    enseignant_id: optionnelId,
  })
  .refine((d) => d.password === d.password_confirmation, "La confirmation du mot de passe ne correspond pas.");

/** Création d'un accès ; un compte étudiant ou enseignant doit être rattaché à son dossier. */
export async function creerCompte(ctx: Ctx, input: unknown) {
  const data = parse(compteSchema, input);
  if (data.role === "etudiant" && !data.etudiant_id) throw new ValidationError(["Un dossier étudiant est obligatoire."]);
  if (data.role === "enseignant" && !data.enseignant_id) throw new ValidationError(["Un dossier enseignant est obligatoire."]);
  const etudiantId = data.role === "etudiant" ? data.etudiant_id : null;
  const enseignantId = data.role === "enseignant" ? data.enseignant_id : null;

  if (etudiantId) {
    const [e] = await ctx.db.select({ id: etudiants.id }).from(etudiants).where(eq(etudiants.id, etudiantId));
    if (!e) throw new ValidationError(["Le dossier étudiant sélectionné est invalide."]);
  }
  if (enseignantId) {
    const [e] = await ctx.db.select({ id: enseignants.id }).from(enseignants).where(eq(enseignants.id, enseignantId));
    if (!e) throw new ValidationError(["Le dossier enseignant sélectionné est invalide."]);
  }

  try {
    await ctx.db.transaction(async (tx) =>
      creer(tx, ctx, users, "User", {
        name: data.name,
        email: data.email,
        password: await hacher(data.password),
        role: data.role,
        etudiantId,
        enseignantId,
        active: true,
      }),
    );
  } catch (e) {
    if (isUniqueViolation(e, "users_email_unique")) throw new ValidationError(["Cette adresse e-mail est déjà utilisée."]);
    if (isUniqueViolation(e)) throw new ValidationError(["Ce dossier est déjà rattaché à un autre compte."]);
    throw e;
  }
}

/** Active ou désactive un compte ; un utilisateur ne peut pas se désactiver lui-même. */
export async function basculerCompte(ctx: Ctx, userId: number): Promise<boolean> {
  if (ctx.user?.id === userId) throw new AppError("Vous ne pouvez pas désactiver votre propre compte.");
  return ctx.db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u) throw new NotFoundError("Compte introuvable.");
    if (u.role === "super_admin" && ctx.user?.role !== "super_admin") {
      throw new AppError("Seul un super administrateur peut modifier ce compte.", 403);
    }
    await modifier(tx, ctx, users, "User", u.id, { active: !u.active });
    return !u.active;
  });
}
