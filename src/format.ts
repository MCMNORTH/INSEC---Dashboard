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
