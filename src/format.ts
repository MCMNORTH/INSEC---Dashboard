import { formaterMontant } from '@shared/domaine';
import type { Timestamp } from 'firebase/firestore';

export { formaterMontant as montant };

type DateSouple = Timestamp | Date | string | null | undefined;

function versDate(valeur: DateSouple): Date | null {
    if (!valeur) return null;
    if (typeof valeur === 'string') return new Date(valeur.length === 10 ? `${valeur}T00:00:00` : valeur);
    if (valeur instanceof Date) return valeur;
    return valeur.toDate();
}

/** 20/09/2026 */
export function date(valeur: DateSouple): string {
    if (typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) return valeur.split('-').reverse().join('/');
    const d = versDate(valeur);
    return d ? d.toLocaleDateString('fr-FR') : '—';
}

/** 20/09/2026 09:00 */
export function dateHeure(valeur: DateSouple): string {
    const d = versDate(valeur);
    return d ? `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—';
}

const FUSEAU_EXAMENS = 'Europe/Paris';

function partiesParis(dateInstant: Date) {
    return Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: FUSEAU_EXAMENS,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(dateInstant).map(({ type, value }) => [type, value]),
    );
}

/** Formate les horaires des épreuves dans le fuseau officiel du calendrier INTEC. */
export function dateHeureParis(valeur: DateSouple): string {
    const d = versDate(valeur);
    if (!d) return '—';
    const p = partiesParis(d);
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Interprète la valeur d'un champ datetime-local comme une heure de Paris. */
export function instantDepuisDateHeureParis(valeur: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur);
    if (!m) return null;
    const [, annee, mois, jour, heure, minute] = m;
    const cible = Date.UTC(Number(annee), Number(mois) - 1, Number(jour), Number(heure), Number(minute));
    let instant = cible;
    for (let essai = 0; essai < 4; essai += 1) {
        const p = partiesParis(new Date(instant));
        const heureParisUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
        const ecart = cible - heureParisUtc;
        if (ecart === 0) return new Date(instant).toISOString();
        instant += ecart;
    }
    // Une heure inexistante au passage à l'heure d'été est refusée au lieu d'être déplacée silencieusement.
    return null;
}

export function heure(valeur: DateSouple): string {
    const d = versDate(valeur);
    return d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
}

const relatif = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « il y a 3 heures » */
export function depuis(valeur: DateSouple): string {
    const d = versDate(valeur);
    if (!d) return '';
    const secondes = Math.round((d.getTime() - Date.now()) / 1000);
    const unites: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unite, duree] of unites) if (Math.abs(secondes) >= duree) return relatif.format(Math.round(secondes / duree), unite);
    return 'à l’instant';
}

export const nomComplet = (e?: { prenom?: string; nom?: string } | null) => (e ? `${e.prenom ?? ''} ${e.nom ?? ''}`.trim() : '—');
export const aujourdhui = () => new Date().toISOString().slice(0, 10);
