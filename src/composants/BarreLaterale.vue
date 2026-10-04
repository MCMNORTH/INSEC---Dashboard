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
    <div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <img src="/images/logo-insec-2026.png" alt="INSEC" class="h-8 w-auto object-contain" />
        <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
            :aria-expanded="ouverte"
            aria-label="Ouvrir le menu"
            @click="ouverte = !ouverte"
        >
            <i :class="['fa-solid text-lg', ouverte ? 'fa-xmark' : 'fa-bars']"></i>
        </button>
    </div>

    <aside :class="[ouverte ? 'block' : 'hidden', 'z-40 w-full border-r border-slate-200 bg-white p-4 shadow-sm lg:relative lg:z-auto lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:bg-gradient-to-b lg:from-white lg:to-slate-50/80 lg:px-4 lg:py-5 lg:shadow-none']">
        <div class="mb-8 hidden rounded-2xl border border-slate-100 bg-white px-4 py-5 text-center shadow-sm lg:block">
            <img src="/images/logo-insec-2026.png" alt="Logo INSEC" class="mx-auto block h-auto max-h-20 w-full max-w-[160px] object-contain" />
            <div class="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-insec">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Espace administration
            </div>
        </div>

        <nav class="flex-1 space-y-6">
            <section>
                <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Pilotage</p>
                <RouterLink
                    to="/tableau-de-bord"
                    :class="['group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', actif('/admin/tableau-de-bord') ? 'bg-insec text-white shadow-md shadow-blue-950/15' : 'text-slate-600 hover:bg-slate-100 hover:text-insec']"
                >
                    <span :class="['flex h-8 w-8 items-center justify-center rounded-lg transition', actif('/admin/tableau-de-bord') ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-insec']">
                        <i class="fa-solid fa-table-cells-large text-sm"></i>
                    </span>
                    Tableau de bord
                </RouterLink>
            </section>

            <section>
                <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Scolarité & opérations</p>
                <div class="space-y-1">
                    <template v-for="lien in liens" :key="lien.vers">
                        <RouterLink
                            v-if="aRole(...lien.roles)"
                            :to="lien.vers"
                            :class="['group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', actif(lien.vers) ? 'bg-blue-50 text-insec ring-1 ring-inset ring-blue-100' : 'text-slate-600 hover:bg-slate-100 hover:text-insec']"
                        >
                            <span :class="['flex h-8 w-8 items-center justify-center rounded-lg transition', actif(lien.vers) ? 'bg-white text-insec shadow-sm' : 'text-slate-400 group-hover:bg-white group-hover:text-insec']">
                                <i :class="['fa-solid text-sm', lien.icone]"></i>
                            </span>
                            {{ lien.libelle }}
                        </RouterLink>
                    </template>
                </div>
            </section>
        </nav>

        <div class="mt-7 border-t border-slate-200 pt-4 lg:mt-auto">
            <div class="mb-3 flex min-w-0 items-center gap-3 px-2">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec text-xs font-bold text-white">
                    {{ session.nom?.split(' ').map((partie) => partie[0]).slice(0, 2).join('').toUpperCase() || 'IN' }}
                </span>
                <div class="min-w-0">
                    <p class="truncate text-xs font-semibold text-slate-700" :title="session.email">{{ session.nom }}</p>
                    <p class="truncate text-[11px] text-slate-400">{{ session.role === 'finance' ? 'Équipe finance' : 'Équipe INSEC' }}</p>
                </div>
            </div>

            <RouterLink
                to="/gestion"
                :class="['group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', actif('/gestion') ? 'bg-insec text-white shadow-md shadow-blue-950/15' : 'text-slate-600 hover:bg-slate-100 hover:text-insec']"
            >
                <span class="flex items-center gap-3">
                    <span :class="['flex h-8 w-8 items-center justify-center rounded-lg transition', actif('/gestion') ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-insec']">
                        <i class="fa-solid fa-sliders text-sm"></i>
                    </span>
                    Centre de gestion
                </span>
                <span v-if="nonLues" :class="['min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold', actif('/gestion') ? 'bg-white text-insec' : 'bg-amber-100 text-amber-800']">{{ nonLues }}</span>
            </RouterLink>

            <button
                type="button"
                class="group mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                @click="quitter"
            >
                <span class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition group-hover:text-red-600">
                    <i class="fa-solid fa-right-from-bracket text-sm"></i>
                </span>
                Déconnexion
            </button>
        </div>
    </aside>
</template>
