// Règles métier partagées entre les Cloud Functions et l'application web.
// Ce fichier ne doit dépendre d'aucun SDK : il est importé des deux côtés.

export const ROLES = ['super_admin', 'admin', 'finance', 'enseignant', 'etudiant'] as const;

// Années scolaires gérées par l'INSEC dans le tableau de bord.
export const ANNEE_ACADEMIQUE_PAR_DEFAUT = '2026-2027';
export const ANNEES_ACADEMIQUES_VISIBLES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'] as const;
export type Role = (typeof ROLES)[number];
export const ROLES_ADMIN: readonly Role[] = ['admin', 'super_admin'];
export const ROLES_FINANCE: readonly Role[] = ['admin', 'super_admin', 'finance'];
export const ROLES_CREABLES = ['admin', 'finance', 'enseignant', 'etudiant'] as const;

export const STATUTS_ETUDIANT = ['Actif', 'Suspendu', 'Diplômé', 'Abandon'] as const;
export const STATUTS_INSCRIPTION = ['active', 'terminée', 'annulée', 'suspendue'] as const;
export const STATUTS_VERSEMENT = ['Validée', 'En attente', 'Rejetée'] as const;
export const MODES_PAIEMENT = ['Espèces', 'Virement', 'Chèque', 'Carte', 'Mobile Money'] as const;
export const SESSIONS_EXAMEN = ['Normale', 'Rattrapage'] as const;
export const STATUTS_EXAMEN = ['Planifié', 'Terminé', 'Annulé'] as const;
export const PRESENCES = ['Convoqué', 'Présent', 'Absent', 'Dispensé'] as const;
export const TYPES_PIECE = ['Pièce d’identité', 'Photo', 'Diplôme', 'Relevé de notes', 'Justificatif de paiement', 'Autre'] as const;
export const STATUTS_PIECE = ['À vérifier', 'Validé', 'Rejeté'] as const;
export const STATUTS_CANDIDATURE = ['Nouvelle', 'En étude', 'Admissible', 'Rejetée', 'Inscrite'] as const;
export const DECISIONS_CANDIDATURE = ['Nouvelle', 'En étude', 'Admissible', 'Rejetée'] as const;
export const STATUTS_EMAIL = ['Envoyé', 'Échec', 'En attente'] as const;
export const MIME_PIECES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const TAILLE_MAX_PIECE = 5 * 1024 * 1024;

export type StatutPaiement = 'Soldé' | 'Partiel' | 'Impayé';

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
}

export function montantNet(i: Pick<SituationFinanciere, 'montantDu' | 'montantRemise'>): number {
    return Math.max((i.montantDu ?? 0) - (i.montantRemise ?? 0), 0);
}

export function soldeRestant(i: SituationFinanciere): number {
    return Math.max(montantNet(i) - (i.totalVerse ?? 0), 0);
}

export function statutPaiement(i: SituationFinanciere): StatutPaiement {
    const net = montantNet(i);
    if (net <= 0 || (i.totalVerse ?? 0) >= net) return 'Soldé';
    if ((i.totalVerse ?? 0) > 0) return 'Partiel';
    return 'Impayé';
}

/** Montant des échéances échues (strictement avant aujourd'hui) non couvert par les versements validés. */
export function montantEnRetard(i: SituationFinanciere, aujourdhui: string = dateDuJour()): number {
    const exigible = (i.echeances ?? [])
        .filter((e) => e.dateEcheance < aujourdhui)
        .reduce((total, e) => total + e.montant, 0);
    return Math.max(Math.min(exigible, montantNet(i)) - (i.totalVerse ?? 0), 0);
}

export function resultatValide(r: { presence: string; note: number | null; seuilValidation: number }): boolean {
    return r.presence === 'Présent' && r.note !== null && r.note !== undefined && r.note >= r.seuilValidation;
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
