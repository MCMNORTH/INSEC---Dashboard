/** Aides zod pour les champs de formulaire (valeurs texte), avec messages en français. */
import { z } from "zod";

const vide = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export const texte = (champ: string, max = 255) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: `Le champ ${champ} est obligatoire.` })
      .min(1, `Le champ ${champ} est obligatoire.`)
      .max(max, `Le champ ${champ} ne doit pas dépasser ${max} caractères.`),
  );

export const texteOptionnel = (champ: string, max = 255) =>
  z.preprocess(
    (v) => (vide(v) ? null : typeof v === "string" ? v.trim() : v),
    z.string().max(max, `Le champ ${champ} ne doit pas dépasser ${max} caractères.`).nullable(),
  );

export const email = (champ = "e-mail") =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z
      .string({ error: `Le champ ${champ} est obligatoire.` })
      .min(1, `Le champ ${champ} est obligatoire.`)
      .max(255)
      .email(`Le champ ${champ} doit être une adresse e-mail valide.`),
  );

export const entier = (champ: string, { min, max }: { min?: number; max?: number } = {}) => {
  let s = z.number({ error: `Le champ ${champ} doit être un nombre entier.` }).int(`Le champ ${champ} doit être un nombre entier.`);
  if (min !== undefined) s = s.min(min, `Le champ ${champ} doit être supérieur ou égal à ${min}.`);
  if (max !== undefined) s = s.max(max, `Le champ ${champ} doit être inférieur ou égal à ${max}.`);
  return z.preprocess((v) => (vide(v) ? undefined : Number(v)), s);
};

export const nombre = (champ: string, { min, max }: { min?: number; max?: number } = {}) => {
  let s = z.number({ error: `Le champ ${champ} doit être un nombre.` }).finite(`Le champ ${champ} doit être un nombre.`);
  if (min !== undefined) s = s.min(min, `Le champ ${champ} doit être supérieur ou égal à ${min}.`);
  if (max !== undefined) s = s.max(max, `Le champ ${champ} doit être inférieur ou égal à ${max}.`);
  return z.preprocess((v) => (vide(v) ? undefined : Number(String(v).replace(",", "."))), s);
};

export const nombreOptionnel = (champ: string, { min }: { min?: number } = {}) => {
  let s = z.number({ error: `Le champ ${champ} doit être un nombre.` }).finite();
  if (min !== undefined) s = s.min(min, `Le champ ${champ} doit être supérieur ou égal à ${min}.`);
  return z.preprocess((v) => (vide(v) ? null : Number(String(v).replace(",", "."))), s.nullable());
};

function dateValide(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Date "YYYY-MM-DD" obligatoire. */
export const dateJour = (champ: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ error: `Le champ ${champ} est obligatoire.` })
      .min(1, `Le champ ${champ} est obligatoire.`)
      .refine(dateValide, `Le champ ${champ} doit être une date valide.`),
  );

export const dateJourOptionnelle = (champ: string) =>
  z.preprocess(
    (v) => (vide(v) ? null : typeof v === "string" ? v.trim() : v),
    z.string().refine(dateValide, `Le champ ${champ} doit être une date valide.`).nullable(),
  );

export const parmi = <T extends readonly [string, ...string[]]>(champ: string, valeurs: T) =>
  z.enum(valeurs, { error: `La valeur du champ ${champ} est invalide.` });

export const identifiant = (champ: string) => entier(champ, { min: 1 });

export const listeIdentifiants = (champ: string, messageVide: string) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]).map((x) => Number(x)),
    z
      .array(z.number().int().positive(`Le champ ${champ} contient une valeur invalide.`))
      .min(1, messageVide)
      .refine((a) => new Set(a).size === a.length, `Le champ ${champ} contient des doublons.`),
  );

export const STATUTS_ETUDIANT = ["Actif", "Suspendu", "Diplômé", "Abandon"] as const;
export const STATUTS_INSCRIPTION = ["active", "terminée", "annulée", "suspendue"] as const;
export const STATUTS_VERSEMENT = ["Validée", "En attente", "Rejetée"] as const;
export const MODES_PAIEMENT = ["Espèces", "Virement", "Chèque", "Carte", "Mobile Money"] as const;
export const SESSIONS_EXAMEN = ["Normale", "Rattrapage"] as const;
export const STATUTS_EXAMEN = ["Planifié", "Terminé", "Annulé"] as const;
export const PRESENCES = ["Convoqué", "Présent", "Absent", "Dispensé"] as const;
export const TYPES_PIECE = [
  "Pièce d’identité",
  "Photo",
  "Diplôme",
  "Relevé de notes",
  "Justificatif de paiement",
  "Autre",
] as const;
export const STATUTS_PIECE = ["À vérifier", "Validé", "Rejeté"] as const;
export const STATUTS_CANDIDATURE = ["Nouvelle", "En étude", "Admissible", "Rejetée", "Inscrite"] as const;
export const DECISIONS_CANDIDATURE = ["Nouvelle", "En étude", "Admissible", "Rejetée"] as const;
