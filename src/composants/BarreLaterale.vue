<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { aRole, deconnexion, session } from '../session';
import { useAlertesNonLues } from './alertesNonLues';

const route = useRoute();
const router = useRouter();
const ouverte = ref(false);
const nonLues = useAlertesNonLues();
watch(() => route.path, () => (ouverte.value = false));

const liens = [
    { vers: '/candidatures', icone: 'fa-file-signature', libelle: 'Admissions', roles: ['admin', 'super_admin'] },
    { vers: '/etudiants', icone: 'fa-user', libelle: 'Étudiants', roles: ['admin', 'super_admin'] },
    { vers: '/enseignants', icone: 'fa-chalkboard-user', libelle: 'Enseignants', roles: ['admin', 'super_admin'] },
    { vers: '/formations', icone: 'fa-graduation-cap', libelle: 'Diplômes & UE', roles: ['admin', 'super_admin'] },
    { vers: '/examens', icone: 'fa-clipboard-check', libelle: 'Examens & résultats', roles: ['admin', 'super_admin'] },
    { vers: '/finances', icone: 'fa-dollar-sign', libelle: 'Finances', roles: ['admin', 'super_admin', 'finance'] },
    { vers: '/comptes', icone: 'fa-users-gear', libelle: 'Comptes & accès', roles: ['admin', 'super_admin'] },
    { vers: '/communications', icone: 'fa-envelope', libelle: 'Communications', roles: ['admin', 'super_admin'] },
    { vers: '/excel', icone: 'fa-file-excel', libelle: 'Imports & exports', roles: ['admin', 'super_admin'] },
    { vers: '/audit', icone: 'fa-clock-rotate-left', libelle: 'Journal d’audit', roles: ['admin', 'super_admin'] },
    { vers: '/sauvegardes', icone: 'fa-database', libelle: 'Sauvegardes', roles: ['super_admin'] },
] as const;

const actif = (vers: string) => route.path === vers || route.path.startsWith(`${vers}/`);

async function quitter() {
    await deconnexion();
    await router.push('/connexion');
}
</script>

<template>
    <div class="flex items-center justify-between bg-white px-4 py-3 shadow-sm lg:hidden">
        <span class="font-bold text-insec">INSEC</span>
        <button class="text-gray-600" aria-label="Ouvrir le menu" @click="ouverte = !ouverte"><i class="fa-solid fa-bars text-xl"></i></button>
    </div>
    <aside :class="[ouverte ? 'block' : 'hidden', 'w-full border-r border-gray-200 bg-white p-4 lg:block lg:min-h-screen lg:w-64 lg:shrink-0']">
        <div class="mb-8 hidden text-center lg:block">
            <img src="/images/logo-insec.png" alt="Logo INSEC" class="mx-auto mb-2 h-20 w-20 object-contain" />
            <div class="mx-auto w-12 border-t-2 border-insec-or"></div>
            <p class="mt-3 text-xl font-bold text-insec">INSEC</p>
            <p class="mb-7 text-xs text-gray-400">{{ session.role === 'finance' ? 'Espace finance' : 'Espace administration' }}</p>
        </div>
        <nav class="space-y-1">
            <RouterLink
                to="/tableau-de-bord"
                :class="['flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', actif('/admin/tableau-de-bord') ? 'bg-insec text-white' : 'text-gray-600 hover:bg-gray-100']"
            >
                <i class="fa-solid fa-table-cells-large w-4 text-center"></i> Tableau de bord
            </RouterLink>
            <RouterLink
                to="/alertes"
                :class="['flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium', actif('/alertes') ? 'bg-insec text-white' : 'text-gray-600 hover:bg-gray-100']"
            >
                <span class="flex items-center gap-3"><i class="fa-solid fa-bell w-4 text-center"></i> Alertes</span>
                <span v-if="nonLues" :class="['rounded-full px-2 py-0.5 text-xs', actif('/alertes') ? 'bg-white text-insec' : 'bg-red-100 text-red-700']">{{ nonLues }}</span>
            </RouterLink>
            <template v-for="lien in liens" :key="lien.vers">
                <RouterLink
                    v-if="aRole(...lien.roles)"
                    :to="lien.vers"
                    :class="['flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', actif(lien.vers) ? 'bg-insec text-white' : 'text-gray-600 hover:bg-gray-100']"
                >
                    <i :class="['fa-solid w-4 text-center', lien.icone]"></i> {{ lien.libelle }}
                </RouterLink>
            </template>
            <div class="border-t pt-4 mt-4 px-3 text-xs text-gray-400 truncate" :title="session.email">{{ session.nom }}</div>
            <button class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm text-gray-500 hover:text-red-600" @click="quitter">
                <i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Déconnexion
            </button>
        </nav>
    </aside>
</template>
