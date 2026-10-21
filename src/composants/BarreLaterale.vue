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
    { vers: '/etudiants', icone: 'fa-user', libelle: 'Étudiants', roles: ['admin', 'super_admin'] },
    { vers: '/formations', icone: 'fa-graduation-cap', libelle: 'Diplômes & UE', roles: ['admin', 'super_admin'] },
    { vers: '/convention-intec', icone: 'fa-file-contract', libelle: 'Convention INTEC', roles: ['admin', 'super_admin'] },
    { vers: '/examens', icone: 'fa-clipboard-check', libelle: 'Examens & convocations', roles: ['admin', 'super_admin'] },
    { vers: '/finances', icone: 'fa-dollar-sign', libelle: 'Finances', roles: ['admin', 'super_admin', 'finance'] },
    { vers: '/excel', icone: 'fa-file-excel', libelle: 'Imports & exports', roles: ['admin', 'super_admin'] },
] as const;

const routesGestion = ['/alertes', '/comptes', '/communications', '/audit', '/sauvegardes'];
const actif = (vers: string) =>
    vers === '/gestion' && routesGestion.some((routeGestion) => route.path === routeGestion || route.path.startsWith(`${routeGestion}/`))
        ? true
        : route.path === vers || route.path.startsWith(`${vers}/`);

async function quitter() {
    await deconnexion();
    await router.push('/connexion');
}
</script>

<template>
    <div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        <img src="/images/logo-insec-2026.png" alt="INSEC" class="h-8 w-auto object-contain" />
        <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
            :aria-expanded="ouverte"
            aria-label="Ouvrir le menu"
            @click="ouverte = !ouverte"
        >
            <i :class="['fa-solid text-lg', ouverte ? 'fa-xmark' : 'fa-bars']"></i>
        </button>
    </div>

    <aside :class="[ouverte ? 'block' : 'hidden', 'z-40 w-full border-r border-slate-200 bg-white px-4 py-3 lg:relative lg:z-auto lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:px-4 lg:py-4']">
        <header class="hidden border-b border-slate-100 pb-3 text-center lg:block">
            <img src="/images/logo-insec-2026.png" alt="Logo INSEC" class="mx-auto block h-20 w-auto max-w-[200px] object-contain" />
            <p class="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Espace administration</p>
        </header>

        <nav class="min-h-0 flex-1 pt-3">
            <RouterLink
                to="/tableau-de-bord"
                :class="['flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition', actif('/admin/tableau-de-bord') ? 'bg-insec text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-insec']"
            >
                <i class="fa-solid fa-table-cells-large w-5 text-center"></i>
                Tableau de bord
            </RouterLink>

            <div class="my-3 border-t border-slate-100"></div>

            <div class="space-y-1">
                <template v-for="lien in liens" :key="lien.vers">
                    <RouterLink
                        v-if="aRole(...lien.roles)"
                        :to="lien.vers"
                        :class="['flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition', actif(lien.vers) ? 'bg-insec text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-insec']"
                    >
                        <i :class="['fa-solid w-5 text-center', lien.icone]"></i>
                        <span class="min-w-0">{{ lien.libelle }}</span>
                    </RouterLink>
                </template>
            </div>
        </nav>

        <footer class="mt-3 shrink-0 border-t border-slate-200 pt-3">
            <div class="mb-2 flex min-w-0 items-center gap-2.5 px-2">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-insec text-[11px] font-semibold text-white">
                    {{ session.nom?.split(' ').map((partie) => partie[0]).slice(0, 2).join('').toUpperCase() || 'IN' }}
                </span>
                <div class="min-w-0">
                    <p class="truncate text-xs font-semibold text-slate-700" :title="session.email">{{ session.nom }}</p>
                    <p class="truncate text-[10px] text-slate-400">{{ session.role === 'finance' ? 'Équipe finance' : 'Équipe INSEC' }}</p>
                </div>
            </div>

            <RouterLink
                to="/gestion"
                :class="['flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 text-[13px] font-medium transition', actif('/gestion') ? 'bg-insec text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-insec']"
            >
                <span class="flex items-center gap-3">
                    <i class="fa-solid fa-sliders w-5 text-center"></i>
                    Centre de gestion
                </span>
                <span v-if="nonLues" :class="['min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold', actif('/gestion') ? 'bg-white text-insec' : 'bg-amber-100 text-amber-800']">{{ nonLues }}</span>
            </RouterLink>

            <button
                type="button"
                class="mt-1 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                @click="quitter"
            >
                <i class="fa-solid fa-right-from-bracket w-5 text-center"></i>
                Déconnexion
            </button>
        </footer>
    </aside>
</template>
