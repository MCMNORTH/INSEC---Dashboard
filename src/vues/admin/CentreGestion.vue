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
            description: 'Retrouvez les e-mails envoyés aux étudiants et leur statut d’envoi.',
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
    <div class="mx-auto max-w-6xl">
        <header class="en-tete-page">
            <div>
                <p class="surtitre">Espace administration</p>
                <h1 class="titre-page mt-1.5">Centre de gestion</h1>
                <p class="sous-titre">Les alertes et les outils de l’équipe INSEC, réunis au même endroit.</p>
            </div>
            <span class="pastille bg-surface text-gray-600 ring-gray-200">
                <i class="fa-solid fa-layer-group text-[11px] text-insec-500"></i>
                {{ modules.length }} espaces de gestion
            </span>
        </header>

        <section aria-labelledby="espaces-gestion">
            <h2 id="espaces-gestion" class="sr-only">Outils de gestion</h2>
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <RouterLink
                    v-for="espace in modules"
                    :key="espace.vers"
                    :to="espace.vers"
                    class="carte group flex min-h-48 flex-col p-6 transition duration-200 hover:-translate-y-0.5 hover:border-insec-200 hover:shadow-flottant"
                >
                    <div class="flex items-start justify-between gap-4">
                        <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-insec-50 text-insec-600 ring-1 ring-insec-100 transition duration-200 group-hover:bg-insec-600 group-hover:text-white group-hover:ring-insec-600">
                            <i :class="['fa-solid text-lg', espace.icone]"></i>
                        </span>
                        <span v-if="espace.vers === '/alertes' && nonLues" class="pastille bg-red-50 text-red-700 ring-red-600/15">
                            <span class="h-1.5 w-1.5 rounded-full bg-[#e01a2e]"></span>
                            {{ nonLues }} nouvelle{{ nonLues > 1 ? 's' : '' }}
                        </span>
                    </div>
                    <h3 class="mt-5 text-base font-bold text-gray-900">{{ espace.titre }}</h3>
                    <p class="mt-1.5 flex-1 text-sm leading-6 text-gray-500">{{ espace.description }}</p>
                    <span class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-insec-600">
                        Ouvrir la rubrique
                        <i class="fa-solid fa-arrow-right text-xs transition-transform duration-200 group-hover:translate-x-1"></i>
                    </span>
                </RouterLink>
            </div>
        </section>
    </div>
</template>
