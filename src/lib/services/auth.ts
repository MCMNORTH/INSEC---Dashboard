/**
 * Connexion, limitation des tentatives et réinitialisation du mot de passe par code e-mail.
 */
import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { loginAttempts, passwordResetCodes, users } from "@/db/schema";
import { HASH_FACTICE, hacher, verifier } from "@/lib/auth/password";
import { AppError, ValidationError, parse } from "@/lib/errors";
import { envoyerNotification } from "@/lib/mail";

const MAX_TENTATIVES = 5;
const BLOCAGE_SECONDES = 60;
const CODE_VALIDITE_MINUTES = 15;
const CODE_MAX_ESSAIS = 5;

const emailSchema = z.string().trim().toLowerCase().email("L’adresse e-mail est invalide.");

/* ------------------------------ Connexion ------------------------------ */

async function verifierBlocage(db: Db, cle: string) {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, cle));
  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    const secondes = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 1000);
    throw new ValidationError([`Trop de tentatives de connexion. Veuillez réessayer dans ${secondes} secondes.`]);
  }
}

async function enregistrerEchec(db: Db, cle: string) {
  await db
    .insert(loginAttempts)
    .values({ key: cle, attempts: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        attempts: sql`CASE WHEN ${loginAttempts.lockedUntil} IS NOT NULL AND ${loginAttempts.lockedUntil} <= now() THEN 1 ELSE ${loginAttempts.attempts} + 1 END`,
        lockedUntil: sql`CASE WHEN ${loginAttempts.lockedUntil} IS NOT NULL AND ${loginAttempts.lockedUntil} <= now() THEN NULL
          WHEN ${loginAttempts.attempts} + 1 >= ${MAX_TENTATIVES} THEN now() + make_interval(secs => ${BLOCAGE_SECONDES}) ELSE ${loginAttempts.lockedUntil} END`,
        updatedAt: new Date(),
      },
    });
}

export type Identifiants = { email: string; password: string };

/** Vérifie les identifiants ; retourne l'utilisateur ou lève une ValidationError. */
export async function authentifier(db: Db, input: unknown, ip: string) {
  const data = parse(
    z.object({
      email: emailSchema,
      password: z.string().min(1, "Le mot de passe est obligatoire."),
    }),
    input,
  );
  const cle = `${data.email}|${ip}`;
  await verifierBlocage(db, cle);

  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, data.email));
  const ok = await verifier(data.password, user?.password ?? HASH_FACTICE);
  if (!user || !ok) {
    await enregistrerEchec(db, cle);
    throw new ValidationError(["Ces identifiants ne correspondent à aucun compte."]);
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.key, cle));
  if (!user.active) throw new ValidationError(["Ce compte est désactivé."]);
  return user;
}

/* ------------------------ Mot de passe oublié ------------------------ */

/**
 * Génère un code à 6 chiffres, valable 15 minutes, et l'envoie par e-mail.
 * La réponse est identique que l'adresse existe ou non (pas d'énumération des comptes).
 */
export async function demanderCode(db: Db, input: unknown): Promise<string> {
  const email = parse(z.object({ email: emailSchema }), input).email;
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  if (!user || !user.active) return email;

  // Anti-abus : un seul envoi par minute et par adresse.
  const [existant] = await db.select().from(passwordResetCodes).where(eq(passwordResetCodes.email, email));
  if (existant && existant.createdAt.getTime() > Date.now() - 60_000) return email;

  const code = String(randomInt(100000, 1000000));
  const codeHash = await hacher(code);
  await db
    .insert(passwordResetCodes)
    .values({ email, codeHash, attempts: 0, createdAt: new Date() })
    .onConflictDoUpdate({
      target: passwordResetCodes.email,
      set: { codeHash, attempts: 0, createdAt: new Date() },
    });

  await envoyerNotification(db, {
    email: user.email,
    nom: user.name,
    type: "Sécurité",
    sujet: "Votre code de réinitialisation INSEC",
    titre: "Réinitialisation du mot de passe",
    message: `Utilisez ce code pour choisir un nouveau mot de passe. Il expire dans ${CODE_VALIDITE_MINUTES} minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,
    details: { Code: code },
  });
  return email;
}

/** Contrôle le code ; chaque échec est compté, le code est invalidé après 5 essais ou 15 minutes. */
export async function verifierCode(db: Db, emailBrut: string, codeBrut: string): Promise<void> {
  const email = parse(emailSchema, emailBrut);
  const code = parse(z.string().trim().regex(/^\d{6}$/, "Le code de vérification est invalide."), codeBrut);
  const [row] = await db.select().from(passwordResetCodes).where(eq(passwordResetCodes.email, email));
  const expire = !row || row.createdAt.getTime() < Date.now() - CODE_VALIDITE_MINUTES * 60_000;
  if (expire || row.attempts >= CODE_MAX_ESSAIS) {
    if (row) await db.delete(passwordResetCodes).where(eq(passwordResetCodes.email, email));
    throw new ValidationError(["Le code de vérification est invalide ou a expiré. Demandez-en un nouveau."]);
  }
  if (!(await verifier(code, row.codeHash))) {
    await db
      .update(passwordResetCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(passwordResetCodes.email, email));
    throw new ValidationError(["Le code de vérification est invalide."]);
  }
}

export async function reinitialiser(db: Db, input: unknown): Promise<void> {
  const data = parse(
    z
      .object({
        email: emailSchema,
        code: z.string(),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
        password_confirmation: z.string(),
      })
      .refine((d) => d.password === d.password_confirmation, "La confirmation du mot de passe ne correspond pas."),
    input,
  );
  await verifierCode(db, data.email, data.code);
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, data.email));
  if (!user) throw new AppError("Requête invalide.");
  await db
    .update(users)
    .set({ password: await hacher(data.password), sessionVersion: user.sessionVersion + 1 })
    .where(and(eq(users.id, user.id)));
  await db.delete(passwordResetCodes).where(eq(passwordResetCodes.email, data.email));
}
