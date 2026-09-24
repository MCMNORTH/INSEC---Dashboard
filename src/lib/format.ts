/** Mise en forme française des montants et des dates, dans le fuseau de l'établissement. */

export const TIMEZONE = process.env.APP_TIMEZONE || "Africa/Nouakchott";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 1 234 567 (espaces fines remplacées par des espaces classiques, comme number_format PHP). */
export function formatNombre(n: number | null | undefined): string {
  return nombre.format(Math.round(n ?? 0)).replace(/[  ]/g, " ");
}

export function formatMru(n: number | null | undefined): string {
  return `${formatNombre(n)} MRU`;
}

/** Note : 12.5 → "12.5", 12 → "12" (affichage identique à PHP). */
export function formatNote(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Number(n));
}

function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  // Une date SQL "YYYY-MM-DD" est un jour civil : on l'interprète à midi UTC pour éviter tout décalage.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}

/** 24/09/2026 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const p = parts(toDate(value));
  return `${p.day}/${p.month}/${p.year}`;
}

/** 24/09/2026 14:30 */
export function formatDateHeure(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const p = parts(toDate(value));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** 24/09/2026 à 14:30 */
export function formatDateAHeure(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const p = parts(toDate(value));
  return `${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute}`;
}

export function formatDateHeureSecondes(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const p = parts(toDate(value));
  return `${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute}:${p.second}`;
}

export function formatHeure(value: Date | string): string {
  const p = parts(toDate(value));
  return `${p.hour}:${p.minute}`;
}

export function formatJourMois(value: Date | string): string {
  const p = parts(toDate(value));
  return `${p.day}/${p.month}`;
}

/** Date du jour "YYYY-MM-DD" dans le fuseau de l'établissement. */
export function aujourdhui(now = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Année civile en cours dans le fuseau de l'établissement. */
export function anneeCivile(now = new Date()): number {
  return Number(parts(now).year);
}

/** "YYYYMM" pour les numéros de reçu. */
export function anneeMois(now = new Date()): string {
  const p = parts(now);
  return `${p.year}${p.month}`;
}

/** Horodatage compact "YYYYMMDD-HHMMSS" (noms de sauvegardes). */
export function horodatage(now = new Date()): string {
  const p = parts(now);
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

/** "yymmdd" pour les références de candidature. */
export function dateCourte(now = new Date()): string {
  const p = parts(now);
  return `${p.year.slice(2)}${p.month}${p.day}`;
}

/**
 * Convertit la valeur d'un champ <input type="datetime-local"> (heure locale de l'établissement)
 * en instant absolu.
 */
export function depuisDateTimeLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  // Décalage du fuseau à cet instant : on compare l'heure affichée localement à l'heure UTC.
  const p = parts(new Date(naive));
  const affiche = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(naive - (affiche - naive));
}

/** Valeur pour un champ datetime-local à partir d'un instant. */
export function versDateTimeLocal(value: Date): string {
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
export const MOIS_COURTS = MOIS;

/** "il y a 3 heures" */
export function depuis(value: Date, now = new Date()): string {
  const secondes = Math.round((now.getTime() - value.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const unites: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unite, duree] of unites) {
    if (Math.abs(secondes) >= duree) return rtf.format(-Math.floor(secondes / duree), unite);
  }
  return "à l’instant";
}

export function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/**
 * Année académique en cours (rentrée en septembre) parmi celles disponibles, par ex. « 2026-2027 »
 * entre septembre 2026 et août 2027 ; à défaut, la plus récente.
 */
export function anneeCourante<T extends { id: number; libelle: string }>(annees: T[], now = new Date()): T | undefined {
  const p = parts(now);
  const debut = Number(p.month) >= 9 ? Number(p.year) : Number(p.year) - 1;
  return annees.find((a) => a.libelle.startsWith(`${debut}-`)) ?? annees[0];
}
