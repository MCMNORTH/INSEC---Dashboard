// Règles métier partagées entre les Cloud Functions et l'application web.
// Ce fichier ne doit dépendre d'aucun SDK : il est importé des deux côtés.

export const ROLES = ['super_admin', 'admin', 'finance', 'enseignant', 'etudiant'] as const;

// Années scolaires gérées par l'INSEC dans le tableau de bord.
export const ANNEE_ACADEMIQUE_PAR_DEFAUT = '2026-2027';
export const ANNEES_ACADEMIQUES_VISIBLES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'] as const;
export type Role = (typeof ROLES)[number];
export const ROLES_ADMIN: readonly Role[] = ['admin', 'super_admin'];
export const ROLES_FINANCE: readonly Role[] = ['admin', 'super_admin', 'finance'];
/** Comptes créables depuis l'application : l'équipe INSEC uniquement (le super-administrateur est créé par script). */
export const ROLES_CREABLES = ['admin', 'finance'] as const;

export const STATUTS_ETUDIANT = ['Actif', 'Suspendu', 'Diplômé', 'Abandon'] as const;
export const STATUTS_INSCRIPTION = ['active', 'terminée', 'annulée', 'suspendue'] as const;
export const STATUTS_VERSEMENT = ['Validée', 'En attente', 'Rejetée'] as const;
export const MODES_PAIEMENT = ['Espèces', 'Virement', 'Chèque', 'Carte', 'Mobile Money'] as const;
export const SESSIONS_EXAMEN = ['Normale', 'Rattrapage'] as const;
export const STATUTS_EXAMEN = ['Planifié', 'Terminé', 'Annulé'] as const;
export const PRESENCES = ['Convoqué', 'Présent', 'Absent', 'Dispensé'] as const;
export const TYPES_PIECE = ['Pièce d’identité', 'Photo', 'Diplôme', 'Relevé de notes', 'Justificatif de paiement', 'Autre'] as const;
/** Documents financiers annuels : facture de l'INTEC et justificatif du paiement par l'INSEC. */
export const TYPES_DOCUMENT_FINANCIER = ['facture-intec', 'justificatif-paiement'] as const;
export const STATUTS_PIECE = ['À vérifier', 'Validé', 'Rejeté'] as const;
export const STATUTS_EMAIL = ['Envoyé', 'Échec', 'En attente'] as const;
export const MIME_PIECES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const TAILLE_MAX_PIECE = 5 * 1024 * 1024;

export type StatutPaiement = 'Soldé' | 'Partiel' | 'Impayé' | 'À chiffrer' | 'Annulée' | 'Pris en charge BUMEX';

/** Tarifs par UE : prix INSEC facturé à l'étudiant (MRU) et coût reversé à l'INTEC (euros). */
export const TARIFS_UE = {
    DGC: { mru: 16_000, intecEuro: 160 },
    DSGC: { mru: 18_000, intecEuro: 180 },
} as const;
export type DiplomeTarife = keyof typeof TARIFS_UE;

/** Diplôme tarifé correspondant au code d'une formation (DSGC est testé avant DGC). */
export function diplomeTarife(codeFormation: string | null | undefined): DiplomeTarife | null {
    const code = (codeFormation ?? '').toUpperCase();
    if (code.includes('DSGC')) return 'DSGC';
    if (code.includes('DGC')) return 'DGC';
    return null;
}

/** Montant dû d'une inscription = nombre d'UE × tarif du diplôme ; null si le diplôme n'a pas de tarif connu. */
export function montantDuSelonTarif(codeFormation: string | null | undefined, nbUe: number): number | null {
    const diplome = diplomeTarife(codeFormation);
    return diplome ? TARIFS_UE[diplome].mru * nbUe : null;
}

export interface Echeance {
    id: string;
    libelle: string;
    montant: number;
    dateEcheance: string; // AAAA-MM-JJ
}

export interface SituationFinanciere {
    montantDu: number;
    montantRemise: number;
    totalVerse: number;
    echeances: Echeance[];
    statut?: string;
    financeur?: string;
}

/**
 * Une inscription est à recouvrer auprès de l'étudiant si elle n'est pas annulée
 * et n'est pas prise en charge par BUMEX (financement interne suivi à part).
 */
export function estRecouvrable(i: Pick<SituationFinanciere, 'statut' | 'financeur'>): boolean {
    return i.statut !== 'annulée' && i.financeur !== 'bumex';
}

export function montantNet(i: Pick<SituationFinanciere, 'montantDu' | 'montantRemise'>): number {
    return Math.max((i.montantDu ?? 0) - (i.montantRemise ?? 0), 0);
}

/** Reste dû par l'étudiant (0 pour une inscription annulée ou prise en charge par BUMEX). */
export function soldeRestant(i: SituationFinanciere): number {
    if (!estRecouvrable(i)) return 0;
    return Math.max(montantNet(i) - (i.totalVerse ?? 0), 0);
}

export function statutPaiement(i: SituationFinanciere): StatutPaiement {
    if (i.statut === 'annulée') return 'Annulée';
    if (i.financeur === 'bumex') return 'Pris en charge BUMEX';
    // Un montant dû nul signifie que les frais n'ont jamais été fixés : ce n'est pas un dossier soldé.
    if ((i.montantDu ?? 0) <= 0) return 'À chiffrer';
    const net = montantNet(i);
    if (net <= 0 || (i.totalVerse ?? 0) >= net) return 'Soldé';
    if ((i.totalVerse ?? 0) > 0) return 'Partiel';
    return 'Impayé';
}

/** Montant des échéances échues (strictement avant aujourd'hui) non couvert par les versements validés. */
export function montantEnRetard(i: SituationFinanciere, aujourdhui: string = dateDuJour()): number {
    if (!estRecouvrable(i)) return 0;
    const exigible = (i.echeances ?? [])
        .filter((e) => e.dateEcheance < aujourdhui)
        .reduce((total, e) => total + e.montant, 0);
    return Math.max(Math.min(exigible, montantNet(i)) - (i.totalVerse ?? 0), 0);
}

export function resultatValide(r: { presence: string; note: number | null; seuilValidation: number }): boolean {
    return r.presence === 'Présent' && r.note !== null && r.note !== undefined && r.note >= r.seuilValidation;
}

/** Les épreuves INTEC sont fixées à l'heure de Paris ; l'INSEC les organise à Nouakchott (UTC+0, sans heure d'été). */
export const FUSEAU_EXAMENS = 'Europe/Paris';
export const FUSEAU_LOCAL = 'Africa/Nouakchott';

/** Date (JJ/MM/AAAA) et heure (HH:MM) d'un instant dans un fuseau donné. */
export function dateHeureDansFuseau(instant: Date, fuseau: string): { date: string; heure: string } {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    return { date: `${p.day}/${p.month}/${p.year}`, heure: `${p.hour}:${p.minute}` };
}

/**
 * Horaire d'une épreuve avec les deux fuseaux, par ex.
 * « 03/05/2027 à 09:00 (heure de Paris) · 07:00 (heure de Nouakchott) ».
 * La date de Nouakchott est ajoutée si elle diffère de celle de Paris.
 */
export function horaireExamen(instant: Date): string {
    const paris = dateHeureDansFuseau(instant, FUSEAU_EXAMENS);
    const local = dateHeureDansFuseau(instant, FUSEAU_LOCAL);
    const heureLocale = local.date === paris.date ? local.heure : `${local.date} à ${local.heure}`;
    return `${paris.date} à ${paris.heure} (heure de Paris) · ${heureLocale} (heure de Nouakchott)`;
}

/** Date locale au format AAAA-MM-JJ (fuseau de l'établissement : Africa/Nouakchott = UTC). */
export function dateDuJour(maintenant: Date = new Date()): string {
    return maintenant.toISOString().slice(0, 10);
}

export function formaterMontant(valeur: number): string {
    return Math.round(valeur ?? 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function libelleRole(role: string): string {
    const libelles: Record<string, string> = {
        super_admin: 'Super administrateur',
        admin: 'Administrateur',
        finance: 'Finance',
        enseignant: 'Enseignant',
        etudiant: 'Étudiant',
    };
    return libelles[role] ?? role;
}

export function numeroFormate(prefixe: string, numero: number, date?: Date): string {
    const periode = date ? `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}-` : '';
    return `${prefixe}-${periode}${String(numero).padStart(6, '0')}`;
}
