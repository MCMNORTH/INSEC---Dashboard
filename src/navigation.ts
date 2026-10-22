import type { Role } from '@shared/domaine';
import { ROLES_ADMIN, ROLES_FINANCE } from '@shared/domaine';

/** Entrées de navigation partagées par la barre latérale et la recherche rapide. */
export interface EntreeNavigation {
    vers: string;
    icone: string;
    libelle: string;
    description: string;
    roles: readonly Role[];
    /** Autres chemins rattachés à cette entrée (pour l'état actif). */
    associes?: string[];
}

export interface GroupeNavigation {
    titre: string;
    entrees: EntreeNavigation[];
}

export const NAVIGATION: GroupeNavigation[] = [
    {
        titre: 'Pilotage',
        entrees: [
            { vers: '/admin/tableau-de-bord', icone: 'fa-chart-simple', libelle: 'Tableau de bord', description: 'Actions du jour, chiffres clés et prochaines épreuves', roles: ROLES_ADMIN },
        ],
    },
    {
        titre: 'Scolarité',
        entrees: [
            { vers: '/etudiants', icone: 'fa-user-graduate', libelle: 'Étudiants', description: 'Registre, inscriptions annuelles et dossiers', roles: ROLES_ADMIN, associes: ['/inscriptions'] },
            { vers: '/formations', icone: 'fa-book-open', libelle: 'Diplômes & UE', description: 'DGC, DSGC, unités d’enseignement et tarifs', roles: ROLES_ADMIN },
            { vers: '/examens', icone: 'fa-calendar-check', libelle: 'Examens', description: 'Calendrier INTEC, convocations et copies', roles: ROLES_ADMIN },
        ],
    },
    {
        titre: 'Gestion',
        entrees: [
            { vers: '/finances', icone: 'fa-coins', libelle: 'Finances', description: 'Versements, échéances, relances et documents', roles: ROLES_FINANCE },
            { vers: '/convention-intec', icone: 'fa-handshake', libelle: 'Convention INTEC', description: 'Convention, taux EUR/MRU et obligations', roles: ROLES_ADMIN },
            { vers: '/excel', icone: 'fa-file-excel', libelle: 'Imports & exports', description: 'Registre Excel, modèles et extractions', roles: ROLES_ADMIN },
        ],
    },
    {
        titre: 'Administration',
        entrees: [
            { vers: '/gestion', icone: 'fa-sliders', libelle: 'Centre de gestion', description: 'Outils de l’équipe INSEC', roles: ROLES_ADMIN, associes: ['/comptes', '/communications', '/audit', '/sauvegardes'] },
            { vers: '/alertes', icone: 'fa-bell', libelle: 'Alertes', description: 'Échéances et notifications à traiter', roles: ['admin', 'super_admin', 'finance'] },
        ],
    },
];

/** Pages secondaires proposées par la recherche rapide. */
export const PAGES_SECONDAIRES: EntreeNavigation[] = [
    { vers: '/etudiants/nouveau', icone: 'fa-user-plus', libelle: 'Nouvel étudiant', description: 'Créer un dossier et sa première inscription', roles: ROLES_ADMIN },
    { vers: '/examens/importer-calendrier', icone: 'fa-file-import', libelle: 'Importer le calendrier INTEC', description: 'Depuis le PDF officiel', roles: ROLES_ADMIN },
    { vers: '/comptes', icone: 'fa-users-gear', libelle: 'Comptes & accès', description: 'Comptes de l’équipe et autorisations', roles: ROLES_ADMIN },
    { vers: '/communications', icone: 'fa-envelope', libelle: 'Communications', description: 'E-mails envoyés et statut d’envoi', roles: ROLES_ADMIN },
    { vers: '/audit', icone: 'fa-clock-rotate-left', libelle: 'Journal d’audit', description: 'Historique des opérations', roles: ROLES_ADMIN },
    { vers: '/sauvegardes', icone: 'fa-database', libelle: 'Sauvegardes', description: 'Créer, vérifier ou restaurer', roles: ['super_admin'] },
];

export const correspond = (chemin: string, entree: EntreeNavigation) =>
    [entree.vers, ...(entree.associes ?? [])].some((v) => chemin === v || chemin.startsWith(`${v}/`));

export const initiales = (nom: string) =>
    nom.split(/[\s@.]+/).filter(Boolean).map((partie) => partie[0]).slice(0, 2).join('').toUpperCase() || 'IN';

export const LIBELLES_ROLES: Record<string, string> = {
    super_admin: 'Super administrateur',
    admin: 'Administration',
    finance: 'Équipe finance',
};
