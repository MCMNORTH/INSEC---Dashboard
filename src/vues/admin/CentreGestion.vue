<script setup lang="ts">
import { computed } from 'vue';
import { useAlertesNonLues } from '../../composants/alertesNonLues';
import { aRole } from '../../session';

const nonLues = useAlertesNonLues();

const modules = computed(() => {
    const espaces = [
        {
            vers: '/alertes',
            titre: 'Alertes',
            description: 'Repérez les échéances, notifications et actions qui demandent votre attention.',
            icone: 'fa-bell',
        },
        {
            vers: '/comptes',
            titre: 'Comptes & accès',
            description: 'Gérez les comptes de l’équipe et contrôlez leurs autorisations.',
            icone: 'fa-users-gear',
        },
        {
            vers: '/communications',
            titre: 'Communications',
            description: 'Préparez et retrouvez les courriers adressés aux étudiants.',
            icone: 'fa-envelope',
        },
        {
            vers: '/audit',
            titre: 'Journal d’audit',
            description: 'Consultez l’historique des opérations réalisées dans le logiciel.',
            icone: 'fa-clock-rotate-left',
        },
        {
            vers: '/sauvegardes',
            titre: 'Sauvegardes',
            description: 'Créez une sauvegarde, vérifiez son intégrité ou restaurez les données.',
            icone: 'fa-database',
        },
    ];

    return espaces.filter((espace) => espace.vers !== '/sauvegardes' || aRole('super_admin'));
});
</script>

<template>
    <div class="mx-auto max-w-6xl space-y-7">
        <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-insec via-[#202c6b] to-[#34458c] px-7 py-8 text-white shadow-lg shadow-blue-950/10 sm:px-9 sm:py-10">
            <div class="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full border border-white/10"></div>
            <div class="absolute -right-1 -top-12 -z-10 h-52 w-52 rounded-full border border-white/10"></div>
            <div class="relative max-w-2xl">
                <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
                    <i class="fa-solid fa-layer-group"></i>
                    Espace administration
                </span>
                <h1 class="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Centre de gestion</h1>
                <p class="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                    Les alertes et les outils de l’équipe INSEC, réunis au même endroit.
                </p>
            </div>
            <div class="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-blue-50">
                <i class="fa-solid fa-grid-2 text-amber-300"></i>
                {{ modules.length }} espaces de gestion
            </div>
        </header>

        <section aria-labelledby="espaces-gestion" class="space-y-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Accès rapide</p>
                    <h2 id="espaces-gestion" class="mt-1 text-xl font-bold text-slate-800">Outils de gestion</h2>
                </div>
                <p class="text-sm text-slate-500">Sélectionnez une rubrique pour continuer.</p>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <RouterLink
                    v-for="espace in modules"
                    :key="espace.vers"
                    :to="espace.vers"
                    class="group flex min-h-48 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-insec focus-visible:ring-offset-2 sm:p-6"
                >
                    <div class="flex items-start justify-between gap-4">
                        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-insec transition group-hover:bg-insec group-hover:text-white">
                            <i :class="['fa-solid text-lg', espace.icone]"></i>
                        </span>
                        <span v-if="espace.vers === '/alertes' && nonLues" class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            {{ nonLues }} nouvelle{{ nonLues > 1 ? 's' : '' }}
                        </span>
                    </div>
                    <h3 class="mt-5 text-base font-bold text-slate-800">{{ espace.titre }}</h3>
                    <p class="mt-2 flex-1 text-sm leading-5 text-slate-500">{{ espace.description }}</p>
                    <span class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-insec">
                        Ouvrir la rubrique
                        <i class="fa-solid fa-arrow-right text-xs transition-transform group-hover:translate-x-1"></i>
                    </span>
                </RouterLink>
            </div>
        </section>
    </div>
</template>
