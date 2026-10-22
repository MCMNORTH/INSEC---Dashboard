<script setup lang="ts">
import { ANNEE_ACADEMIQUE_PAR_DEFAUT } from '@shared/domaine';
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { correspond, NAVIGATION } from '../navigation';
import { aRole } from '../session';
import { useAlertesNonLues } from './alertesNonLues';
import MarqueInsec from './MarqueInsec.vue';

const props = defineProps<{ reduite: boolean; ouverteMobile: boolean }>();
const emit = defineEmits<{ 'update:reduite': [valeur: boolean]; 'update:ouverteMobile': [valeur: boolean] }>();

const route = useRoute();
const nonLues = useAlertesNonLues();
watch(() => route.path, () => emit('update:ouverteMobile', false));

const groupes = computed(() => NAVIGATION
    .map((g) => ({ ...g, entrees: g.entrees.filter((e) => aRole(...e.roles)) }))
    .filter((g) => g.entrees.length));
// En mode réduit, seule la version bureau masque les libellés ; le tiroir mobile reste complet.
const compacte = computed(() => props.reduite && !props.ouverteMobile);
</script>

<template>
    <!-- Voile du tiroir mobile -->
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-200">
        <div v-if="ouverteMobile" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" @click="emit('update:ouverteMobile', false)"></div>
    </Transition>

    <aside
        :class="[
            'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-gray-200/80 bg-surface transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            ouverteMobile ? 'w-72 translate-x-0 shadow-2xl' : '-translate-x-full',
            compacte ? 'lg:w-[76px]' : 'lg:w-[256px]',
        ]"
        aria-label="Navigation principale"
    >
        <div :class="['flex h-[88px] shrink-0 items-center', compacte ? 'justify-center px-2' : 'justify-between px-6']">
            <RouterLink to="/tableau-de-bord" class="rounded-lg" aria-label="Accueil INSEC">
                <MarqueInsec :compacte="compacte" />
            </RouterLink>
            <button type="button" class="bouton-icone lg:hidden" aria-label="Fermer le menu" @click="emit('update:ouverteMobile', false)">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        <nav class="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-4">
            <div v-for="groupe in groupes" :key="groupe.titre" class="mb-5">
                <p v-if="!compacte" class="mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.14em] text-gray-400 uppercase">{{ groupe.titre }}</p>
                <div v-else class="mx-auto mb-2 h-px w-6 bg-gray-200"></div>
                <ul class="space-y-0.5">
                    <li v-for="entree in groupe.entrees" :key="entree.vers">
                        <RouterLink
                            :to="entree.vers"
                            :title="compacte ? entree.libelle : undefined"
                            :class="[
                                'group relative flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium transition duration-150',
                                compacte ? 'justify-center px-0' : 'px-3',
                                correspond(route.path, entree)
                                    ? 'bg-insec-50 font-semibold text-insec-700'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                            ]"
                        >
                            <i :class="['fa-solid w-5 text-center text-[15px] transition', entree.icone, correspond(route.path, entree) ? 'text-insec-600' : 'text-gray-400 group-hover:text-gray-600']"></i>
                            <span v-if="!compacte" class="min-w-0 flex-1 truncate">{{ entree.libelle }}</span>
                            <span
                                v-if="entree.vers === '/alertes' && nonLues"
                                :class="[
                                    'rounded-full bg-[#e01a2e] text-center text-[10px] font-bold text-white',
                                    compacte ? 'absolute top-1 right-2 h-4 min-w-4 px-1 leading-4' : 'min-w-5 px-1.5 py-0.5',
                                ]"
                            >{{ nonLues }}</span>
                        </RouterLink>
                    </li>
                </ul>
            </div>
        </nav>

        <footer class="shrink-0 border-t border-gray-100 p-3">
            <div v-if="!compacte" class="mb-2 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200/70">
                <p class="text-[10.5px] font-semibold tracking-[0.14em] text-gray-400 uppercase">Centre associé</p>
                <p class="mt-0.5 text-xs font-medium text-gray-700">INTEC · CNAM Paris</p>
                <p class="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Année {{ ANNEE_ACADEMIQUE_PAR_DEFAUT }}
                </p>
            </div>
            <button
                type="button"
                class="hidden h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 lg:flex"
                :class="compacte ? 'justify-center px-0' : ''"
                :aria-label="compacte ? 'Déplier le menu' : 'Réduire le menu'"
                @click="emit('update:reduite', !reduite)"
            >
                <i :class="['fa-solid w-5 text-center', compacte ? 'fa-angles-right' : 'fa-angles-left']"></i>
                <span v-if="!compacte">Réduire le menu</span>
            </button>
        </footer>
    </aside>
</template>
