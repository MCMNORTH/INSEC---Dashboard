<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { correspond, NAVIGATION, type EntreeNavigation } from '../navigation';
import { aRole } from '../session';
import { useAlertesNonLues } from './alertesNonLues';

// Barre d'onglets du téléphone et de la tablette (masquée sur ordinateur) : les rubriques les plus utilisées
// sous le pouce, et « Menu » pour ouvrir la navigation complète.
defineProps<{ menuOuvert: boolean }>();
defineEmits<{ menu: [] }>();

const route = useRoute();
const nonLues = useAlertesNonLues();

const PRINCIPALES: Record<string, string> = {
    '/admin/tableau-de-bord': 'Accueil',
    '/etudiants': 'Étudiants',
    '/finances': 'Finances',
    '/examens': 'Examens',
};
const onglets = computed(() =>
    NAVIGATION.flatMap((g) => g.entrees)
        .filter((e): e is EntreeNavigation => e.vers in PRINCIPALES && aRole(...e.roles))
        .map((e) => ({ ...e, court: PRINCIPALES[e.vers] })),
);
const dansOnglet = computed(() => onglets.value.some((e) => correspond(route.path, e)));
</script>

<template>
    <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/80 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Navigation rapide"
    >
        <ul class="mx-auto flex max-w-xl items-stretch justify-around px-1">
            <li v-for="e in onglets" :key="e.vers" class="flex-1">
                <RouterLink
                    :to="e.vers"
                    :aria-current="correspond(route.path, e) ? 'page' : undefined"
                    :class="[
                        'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95',
                        correspond(route.path, e) ? 'text-insec-600' : 'text-gray-500',
                    ]"
                >
                    <span :class="['flex h-7 w-12 items-center justify-center rounded-full transition', correspond(route.path, e) ? 'bg-insec-50' : '']">
                        <i :class="['fa-solid text-[17px]', e.icone]"></i>
                    </span>
                    {{ e.court }}
                </RouterLink>
            </li>
            <li class="flex-1">
                <button
                    type="button"
                    :aria-expanded="menuOuvert"
                    :class="[
                        'relative flex h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95',
                        menuOuvert || !dansOnglet ? 'text-insec-600' : 'text-gray-500',
                    ]"
                    @click="$emit('menu')"
                >
                    <span :class="['relative flex h-7 w-12 items-center justify-center rounded-full transition', menuOuvert || !dansOnglet ? 'bg-insec-50' : '']">
                        <i class="fa-solid fa-bars text-[17px]"></i>
                        <span v-if="nonLues" class="absolute -top-0.5 right-2 h-2.5 w-2.5 rounded-full bg-[#e01a2e] ring-2 ring-surface"></span>
                    </span>
                    Menu
                </button>
            </li>
        </ul>
    </nav>
</template>
