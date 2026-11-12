// Règles métier partagées entre les Cloud Functions et l'application web.
// Ce fichier ne doit dépendre d'aucun SDK : il est importé des deux côtés.

export const ROLES = ['super_admin', 'admin', 'admin_lecture', 'finance', 'consultation', 'enseignant', 'etudiant'] as const;

// Années scolaires gérées par l'INSEC dans le tableau de bord.
export const ANNEE_ACADEMIQUE_PAR_DEFAUT = '2026-2027';
export const ANNEES_ACADEMIQUES_VISIBLES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'] as const;
export type Role = (typeof ROLES)[number];
/** Modifications de l'administration (étudiants, examens, comptes…). */
export const ROLES_ADMIN: readonly Role[] = ['admin', 'super_admin'];
/**
 * Tout ce que voit l'administration, en lecture seule pour « admin_lecture » :
 * mêmes pages qu'un administrateur, sans aucune modification possible.
 */
export const ROLES_VISION_ADMIN: readonly Role[] = ['admin', 'super_admin', 'admin_lecture'];
/** Rôles que seul le super-administrateur peut donner, retirer, activer ou désactiver. */
export const ROLES_RESERVES_SUPER_ADMIN: readonly Role[] = ['admin', 'super_admin', 'admin_lecture'];
export const ROLES_FINANCE: readonly Role[] = ['admin', 'super_admin', 'finance'];
/** Lecture des étudiants, inscriptions, versements et résultats ; « consultation » et « admin_lecture » ne modifient rien. */
export const ROLES_LECTURE: readonly Role[] = ['admin', 'super_admin', 'admin_lecture', 'finance', 'consultation'];
/** Documents financiers annuels : déposés par la finance, consultés aussi par l'administration en lecture seule. */
export const ROLES_DOCUMENTS_FINANCIERS: readonly Role[] = ['admin', 'super_admin', 'admin_lecture', 'finance'];
/** Comptes créables depuis l'application : l'équipe INSEC uniquement (le super-administrateur est créé par script). */
export const ROLES_CREABLES = ['admin', 'admin_lecture', 'finance', 'consultation'] as const;

export const STATUTS_ETUDIANT = ['Actif', 'Suspendu', 'Diplômé', 'Abandon'] as const;
export const STATUTS_INSCRIPTION = ['active', 'terminée', 'annulée', 'suspendue'] as const;
export const STATUTS_VERSEMENT = ['Validée', 'En attente', 'Rejetée'] as const;
/** Statut d'un versement validé puis annulé (erreur de saisie, chèque impayé…) : il ne compte plus dans le total versé. */
export const STATUT_VERSEMENT_ANNULE = 'Annulée';
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

/**
 * Tarifs par UE (ou par certificat) : prix INSEC facturé à l'étudiant (MRU) et coût reversé à l'INTEC (euros).
 * Coûts INTEC : grille tarifaire signée (correction à l'INTEC) ; un certificat de spécialisation (CS) compte comme une UE.
 */
export const TARIFS_UE = {
    DGC: { mru: 16_000, intecEuro: 160 },
    DSGC: { mru: 18_000, intecEuro: 180 },
    CS: { mru: 23_000, intecEuro: 280 },
} as const;
export type DiplomeTarife = keyof typeof TARIFS_UE;

/** Libellés courts des catalogues tarifés, pour l'affichage. */
export const LIBELLES_TARIFS: Record<DiplomeTarife, string> = {
    DGC: 'UE du DGC',
    DSGC: 'UE du DSGC',
    CS: 'Certificat de spécialisation',
};

/**
 * Validation des acquis demandée par l'INSEC pour l'étudiant (frais d'instruction réglés à l'INTEC) :
 * 70 € par dispositif, 100 € pour une VAPP et une VES du même candidat.
 */
export const VALIDATIONS_ACQUIS = ['aucune', 'VES', 'VAPP', 'VAPP+VES'] as const;
export type ValidationAcquis = (typeof VALIDATIONS_ACQUIS)[number];
export const TARIFS_VALIDATION: Record<ValidationAcquis, { mru: number; intecEuro: number; libelle: string }> = {
    aucune: { mru: 0, intecEuro: 0, libelle: 'Aucune' },
    VES: { mru: 5_500, intecEuro: 70, libelle: 'VES (validation des études supérieures)' },
    VAPP: { mru: 5_500, intecEuro: 70, libelle: 'VAPP (validation des acquis personnels et professionnels)' },
    'VAPP+VES': { mru: 8_000, intecEuro: 100, libelle: 'VAPP + VES' },
};

/** Validation des acquis connue, « aucune » par défaut (anciennes inscriptions sans le champ). */
export function validationDe(valeur: string | null | undefined): ValidationAcquis {
    return (VALIDATIONS_ACQUIS as readonly string[]).includes(valeur ?? '') ? (valeur as ValidationAcquis) : 'aucune';
}

/** Diplôme tarifé correspondant au code d'une formation (DSGC est testé avant DGC ; « CS » pour les certificats de spécialisation). */
export function diplomeTarife(codeFormation: string | null | undefined): DiplomeTarife | null {
    const code = (codeFormation ?? '').toUpperCase();
    if (code.includes('DSGC')) return 'DSGC';
    if (code.includes('DGC')) return 'DGC';
    if (code === 'CS' || code.startsWith('CS-') || code.includes('CERTIF')) return 'CS';
    return null;
}

/**
 * Montant dû d'une inscription = nombre d'UE × tarif du diplôme + frais de validation des acquis ;
 * null si le diplôme n'a pas de tarif connu. Les UE dispensées par VES ne sont pas comptées (elles ne sont pas suivies).
 */
export function montantDuSelonTarif(codeFormation: string | null | undefined, nbUe: number, validation?: string | null): number | null {
    const diplome = diplomeTarife(codeFormation);
    return diplome ? TARIFS_UE[diplome].mru * nbUe + TARIFS_VALIDATION[validationDe(validation)].mru : null;
}

/**
 * Coût INTEC d'une inscription en euros = nombre d'UE × tarif INTEC (160 € DGC, 180 € DSGC, 280 € certificat)
 * + frais d'instruction de la validation des acquis (70 € ou 100 €) ;
 * c'est aussi ce que BUMEX règle, en euros et sans marge, pour un étudiant qu'il finance. Null si le diplôme n'a pas de tarif connu.
 */
export function coutIntecEuro(codeFormation: string | null | undefined, nbUe: number, validation?: string | null): number | null {
    const diplome = diplomeTarife(codeFormation);
    return diplome ? TARIFS_UE[diplome].intecEuro * nbUe + TARIFS_VALIDATION[validationDe(validation)].intecEuro : null;
}

/**
 * Écart entre le montant dû saisi et le tarif (nombre d'UE × tarif du diplôme + validation des acquis) :
 * positif si le montant saisi dépasse le tarif, négatif s'il est inférieur ; null si le diplôme n'a pas de tarif connu.
 * La remise n'entre pas dans le calcul : elle se saisit à part.
 */
export function ecartAuTarif(codeFormation: string | null | undefined, nbUe: number, montantDu: number | null | undefined, validation?: string | null): number | null {
    const tarif = montantDuSelonTarif(codeFormation, nbUe, validation);
    return tarif === null ? null : (montantDu ?? 0) - tarif;
}

/**
 * Bénéfice net de l'INSEC sur l'année : marge des étudiants payeurs (tarif MRU − coût INTEC)
 * moins le coût des étudiants BUMEX, que l'INSEC règle à l'INTEC en euros sans rien facturer.
 * Équivaut à : recette des étudiants payeurs − facture INTEC totale. Null si une donnée manque (taux EUR/MRU).
 */
export function beneficeNetInsec(margeEtudiantsMru: number | null | undefined, coutBumexMru: number | null | undefined): number | null {
    if (margeEtudiantsMru === null || margeEtudiantsMru === undefined || coutBumexMru === null || coutBumexMru === undefined) return null;
    return margeEtudiantsMru - coutBumexMru;
}

/** UE à la fois suivies et dispensées par VES : interdit (règle de non-cumul de l'INTEC). */
export function uesEnDoublonVes(ueIds: readonly string[], ueDispenseesIds: readonly string[] | null | undefined): string[] {
    const dispensees = new Set(ueDispenseesIds ?? []);
    return ueIds.filter((id) => dispensees.has(id));
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

/**
 * Montant versé par l'étudiant à lui rembourser : tout le versé d'une inscription annulée,
 * sinon ce qui dépasse le montant net (uniquement quand les frais sont fixés).
 */
export function montantARembourser(i: SituationFinanciere): number {
    const verse = i.totalVerse ?? 0;
    if (i.statut === 'annulée') return verse;
    if (i.financeur === 'bumex' || (i.montantDu ?? 0) <= 0) return 0;
    return Math.max(verse - montantNet(i), 0);
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

export function totalEcheances(i: Pick<SituationFinanciere, 'echeances'>): number {
    return (i.echeances ?? []).reduce((total, e) => total + e.montant, 0);
}

/**
 * Montant net non couvert par l'échéancier. Un écart apparaît notamment sur un échéancier généré
 * sur le seul reste à payer : les versements déjà faits sont alors imputés une seconde fois aux tranches.
 */
export function ecartEcheancier(i: SituationFinanciere): number {
    if (!estRecouvrable(i) || !(i.echeances ?? []).length) return 0;
    return Math.max(montantNet(i) - totalEcheances(i), 0);
}

export type EtatEcheance = 'Payée' | 'Partielle' | 'En retard' | 'À venir';

/**
 * État de chaque échéance : les versements validés (total versé) sont imputés aux échéances
 * dans l'ordre chronologique. Une échéance échue (avant aujourd'hui) non couverte est « En retard »,
 * même si elle est en partie payée. Le total des parts en retard est égal à montantEnRetard.
 */
export function etatEcheances(i: SituationFinanciere, aujourdhui: string = dateDuJour()): (Echeance & { paye: number; etat: EtatEcheance })[] {
    let disponible = i.totalVerse ?? 0;
    return [...(i.echeances ?? [])]
        .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
        .map((e) => {
            const paye = Math.min(e.montant, Math.max(disponible, 0));
            disponible -= paye;
            const etat: EtatEcheance = paye >= e.montant ? 'Payée' : e.dateEcheance < aujourdhui ? 'En retard' : paye > 0 ? 'Partielle' : 'À venir';
            return { ...e, paye, etat };
        });
}

export function resultatValide(r: { presence: string; note: number | null; seuilValidation: number }): boolean {
    return r.presence === 'Présent' && r.note !== null && r.note !== undefined && r.note >= r.seuilValidation;
}

/** Ajoute des mois à une date AAAA-MM-JJ ; le jour est ramené au dernier jour du mois si besoin (31 janv. + 1 mois = 28/29 févr.). */
export function ajouterMois(dateIso: string, mois: number): string {
    const [a, m, j] = dateIso.split('-').map(Number);
    const total = a * 12 + (m - 1) + mois;
    const annee = Math.floor(total / 12);
    const moisCible = (total % 12) + 1;
    const dernierJour = new Date(Date.UTC(annee, moisCible, 0)).getUTCDate();
    return `${annee}-${String(moisCible).padStart(2, '0')}-${String(Math.min(j, dernierJour)).padStart(2, '0')}`;
}

/**
 * Découpe un montant en tranches égales (en MRU entiers, le reste sur la dernière tranche),
 * espacées de `intervalleMois` à partir de `premiereDate`.
 */
export function decouperEcheancier(montant: number, nombre: number, premiereDate: string, intervalleMois = 1): Omit<Echeance, 'id'>[] {
    const base = Math.floor(montant / nombre);
    return Array.from({ length: nombre }, (_, k) => ({
        libelle: `Tranche ${k + 1}/${nombre}`,
        montant: k === nombre - 1 ? montant - base * (nombre - 1) : base,
        dateEcheance: ajouterMois(premiereDate, k * intervalleMois),
    }));
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

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0 à 99 ; `final` : le nombre termine l'expression (« quatre-vingts », mais « quatre-vingt mille »). */
function moinsDeCent(n: number, final: boolean): string {
    if (n <= 16) return UNITES[n];
    if (n < 20) return `dix-${UNITES[n - 10]}`;
    const dizaine = Math.floor(n / 10);
    const unite = n % 10;
    if (dizaine === 7 || dizaine === 9) {
        const base = dizaine === 7 ? 'soixante' : 'quatre-vingt';
        return dizaine === 7 && unite === 1 ? 'soixante et onze' : `${base}-${moinsDeCent(10 + unite, false)}`;
    }
    if (dizaine === 8) return unite === 0 ? `quatre-vingt${final ? 's' : ''}` : `quatre-vingt-${UNITES[unite]}`;
    if (unite === 0) return DIZAINES[dizaine];
    return unite === 1 ? `${DIZAINES[dizaine]} et un` : `${DIZAINES[dizaine]}-${UNITES[unite]}`;
}

/** 0 à 999 ; « deux cents », mais « deux cent un » et « deux cent mille ». */
function moinsDeMille(n: number, final: boolean): string {
    const centaines = Math.floor(n / 100);
    const reste = n % 100;
    const cent = centaines === 0 ? '' : centaines === 1 ? 'cent' : `${UNITES[centaines]} cent${reste === 0 && final ? 's' : ''}`;
    if (!reste) return cent || 'zéro';
    return cent ? `${cent} ${moinsDeCent(reste, final)}` : moinsDeCent(reste, final);
}

/** Nombre entier positif en toutes lettres (orthographe traditionnelle), ex. 36 000 → « trente-six mille ». */
export function nombreEnLettres(valeur: number): string {
    const n = Math.round(Math.abs(valeur ?? 0));
    if (n === 0) return 'zéro';
    const parties: string[] = [];
    const milliards = Math.floor(n / 1e9);
    const millions = Math.floor((n % 1e9) / 1e6);
    const milliers = Math.floor((n % 1e6) / 1000);
    const reste = n % 1000;
    // Milliard et million sont des noms : « deux cents millions ».
    if (milliards) parties.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? 's' : ''}`);
    if (millions) parties.push(`${moinsDeMille(millions, true)} million${millions > 1 ? 's' : ''}`);
    // Mille est invariable et ne prend pas « un » devant.
    if (milliers) parties.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`);
    if (reste) parties.push(moinsDeMille(reste, true));
    return parties.join(' ');
}

/** Montant en ouguiyas en toutes lettres, pour la mention « Arrêtée la présente facture à la somme de… ». */
export function montantEnLettres(valeur: number): string {
    const n = Math.round(Math.abs(valeur ?? 0));
    const texte = `${nombreEnLettres(n)} ouguiya${n > 1 ? 's' : ''}`;
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function libelleRole(role: string): string {
    const libelles: Record<string, string> = {
        super_admin: 'Super administrateur',
        admin: 'Administrateur',
        admin_lecture: 'Administrateur (lecture seule)',
        finance: 'Finance',
        consultation: 'Consultation',
        enseignant: 'Enseignant',
        etudiant: 'Étudiant',
    };
    return libelles[role] ?? role;
}

export function numeroFormate(prefixe: string, numero: number, date?: Date): string {
    const periode = date ? `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}-` : '';
    return `${prefixe}-${periode}${String(numero).padStart(6, '0')}`;
}
