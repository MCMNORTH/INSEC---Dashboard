import { ROLES_ADMIN, ROLES_FINANCE, type Role } from '@shared/domaine';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { apresNavigation } from './notifications';
import { accueil, aRole, session, sessionPrete } from './session';

declare module 'vue-router' {
    interface RouteMeta {
        /** Page accessible sans connexion. */
        publique?: boolean;
        /** Page réservée aux visiteurs non connectés (connexion). */
        invite?: boolean;
        roles?: readonly Role[];
        titre?: string;
    }
}

const admin = { roles: ROLES_ADMIN };

const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/connexion' },
    { path: '/login', redirect: '/connexion' },
    { path: '/connexion', component: () => import('./vues/auth/Connexion.vue'), meta: { publique: true, invite: true, titre: 'Connexion' } },
    { path: '/mot-de-passe-oublie', component: () => import('./vues/auth/MotDePasseOublie.vue'), meta: { publique: true, invite: true, titre: 'Mot de passe oublié' } },
    { path: '/admission', redirect: '/connexion' },
    { path: '/admission/:pathMatch(.*)*', redirect: '/connexion' },
    { path: '/acces-refuse', component: () => import('./vues/AccesRefuse.vue'), meta: { titre: 'Accès refusé' } },
    { path: '/tableau-de-bord', redirect: () => accueil() },
    { path: '/dashboard', redirect: () => accueil() },

    { path: '/admin/tableau-de-bord', component: () => import('./vues/admin/TableauDeBord.vue'), meta: { ...admin, titre: 'Tableau de bord' } },
    { path: '/candidatures', redirect: '/admin/tableau-de-bord' },
    { path: '/candidatures/:pathMatch(.*)*', redirect: '/admin/tableau-de-bord' },
    { path: '/etudiants', component: () => import('./vues/etudiants/ListeEtudiants.vue'), meta: { ...admin, titre: 'Étudiants' } },
    { path: '/etudiants/nouveau', component: () => import('./vues/etudiants/NouvelEtudiant.vue'), meta: { ...admin, titre: 'Nouvel étudiant' } },
    { path: '/etudiants/:id', component: () => import('./vues/etudiants/FicheEtudiant.vue'), props: true, meta: { ...admin, titre: 'Étudiant' } },
    { path: '/etudiants/:id/modifier', component: () => import('./vues/etudiants/ModifierEtudiant.vue'), props: true, meta: { ...admin, titre: 'Modifier l’étudiant' } },
    { path: '/etudiants/:id/documents', component: () => import('./vues/etudiants/DocumentsEtudiant.vue'), props: true, meta: { ...admin, titre: 'Dossier documentaire' } },
    { path: '/etudiants/:id/inscriptions/nouvelle', component: () => import('./vues/etudiants/EditionInscription.vue'), props: (r) => ({ etudiantId: r.params.id }), meta: { ...admin, titre: 'Nouvelle inscription' } },
    { path: '/inscriptions/:id/modifier', component: () => import('./vues/etudiants/EditionInscription.vue'), props: (r) => ({ inscriptionId: r.params.id }), meta: { ...admin, titre: 'Modifier l’inscription' } },
    { path: '/formations', component: () => import('./vues/Formations.vue'), meta: { ...admin, titre: 'Diplômes & UE' } },
    { path: '/examens', component: () => import('./vues/examens/ListeExamens.vue'), meta: { ...admin, titre: 'Examens' } },
    { path: '/examens/importer-calendrier', component: () => import('./vues/examens/ImporterCalendrierIntec.vue'), meta: { ...admin, titre: 'Importer le calendrier INTEC' } },
    { path: '/examens/nouveau', component: () => import('./vues/examens/NouvelExamen.vue'), meta: { ...admin, titre: 'Suivi local de l’épreuve INTEC' } },
    { path: '/examens/:id', component: () => import('./vues/examens/FicheExamen.vue'), props: true, meta: { ...admin, titre: 'Examen' } },
    { path: '/enseignants', redirect: '/admin/tableau-de-bord' },
    { path: '/enseignants/:pathMatch(.*)*', redirect: '/admin/tableau-de-bord' },
    { path: '/comptes', component: () => import('./vues/Comptes.vue'), meta: { ...admin, titre: 'Comptes & accès' } },
    { path: '/communications', component: () => import('./vues/Communications.vue'), meta: { ...admin, titre: 'Communications' } },
    { path: '/excel', component: () => import('./vues/Excel.vue'), meta: { ...admin, titre: 'Imports & exports' } },
    { path: '/audit', component: () => import('./vues/Audit.vue'), meta: { ...admin, titre: 'Journal d’audit' } },
    { path: '/sauvegardes', component: () => import('./vues/Sauvegardes.vue'), meta: { roles: ['super_admin'], titre: 'Sauvegardes' } },
    { path: '/finances', component: () => import('./vues/Finances.vue'), meta: { roles: ROLES_FINANCE, titre: 'Finances' } },
    { path: '/alertes', component: () => import('./vues/Alertes.vue'), meta: { titre: 'Alertes' } },
    { path: '/portail/:pathMatch(.*)*', redirect: '/acces-refuse' },
    { path: '/:chemin(.*)*', component: () => import('./vues/Introuvable.vue'), meta: { publique: true, titre: 'Page introuvable' } },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: (_vers, _depuis, position) => position ?? { top: 0 },
});

router.beforeEach(async (vers) => {
    await sessionPrete();
    const connecte = !!session.uid;
    if (vers.meta.invite && connecte && session.role) return accueil();
    if (vers.path === '/examens/nouveau' && vers.query.source !== 'intec') return '/examens';
    if (vers.meta.publique) return true;
    if (!connecte) return { path: '/connexion', query: vers.fullPath !== '/' ? { redirection: vers.fullPath } : {} };
    if (vers.meta.roles && !aRole(...vers.meta.roles)) return vers.path === '/acces-refuse' ? true : '/acces-refuse';
    return true;
});

router.afterEach((vers) => {
    apresNavigation();
    document.title = vers.meta.titre ? `${vers.meta.titre} · INSEC` : 'INSEC Dashboard';
});
