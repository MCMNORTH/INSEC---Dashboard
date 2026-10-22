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
        <div v-if="ouverteMobile" class="fixed inset-0 z-40 bg-insec-950/50 backdrop-blur-sm lg:hidden" @click="emit('update:ouverteMobile', false)"></div>
    </Transition>

    <aside
        :class="[
            'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-insec-950 text-insec-100 transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            ouverteMobile ? 'w-72 translate-x-0 shadow-2xl' : '-translate-x-full',
            compacte ? 'lg:w-[76px]' : 'lg:w-[264px]',
        ]"
        aria-label="Navigation principale"
    >
        <!-- Halo décoratif -->
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(80_101_179/0.35),transparent_60%),radial-gradient(80%_40%_at_100%_100%,rgb(224_26_46/0.12),transparent_70%)]"></div>

        <div :class="['relative flex h-[92px] shrink-0 items-center', compacte ? 'justify-center px-2' : 'justify-between px-5']">
            <RouterLink to="/tableau-de-bord" class="rounded-lg focus-visible:outline-white/60" aria-label="Accueil INSEC">
                <MarqueInsec clair :compacte="compacte" />
            </RouterLink>
            <button
                type="button"
                class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-insec-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Fermer le menu"
                @click="emit('update:ouverteMobile', false)"
            >
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        <nav class="relative min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4 [scrollbar-color:rgb(255_255_255/0.15)_transparent]">
            <div v-for="groupe in groupes" :key="groupe.titre" class="mb-5">
                <p v-if="!compacte" class="mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.16em] text-insec-400/80 uppercase">{{ groupe.titre }}</p>
                <div v-else class="mx-auto mb-2 h-px w-6 bg-white/10"></div>
                <ul class="space-y-0.5">
                    <li v-for="entree in groupe.entrees" :key="entree.vers">
                        <RouterLink
                            :to="entree.vers"
                            :title="compacte ? entree.libelle : undefined"
                            :class="[
                                'group relative flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium transition duration-150',
                                compacte ? 'justify-center px-0' : 'px-3',
                                correspond(route.path, entree)
                                    ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
                                    : 'text-insec-200/80 hover:bg-white/[0.05] hover:text-white',
                            ]"
                        >
                            <span
                                v-if="correspond(route.path, entree)"
                                class="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-[#e01a2e] shadow-[0_0_12px_rgb(224_26_46/0.7)]"
                            ></span>
                            <i :class="['fa-solid w-5 text-center text-[15px] transition', entree.icone, correspond(route.path, entree) ? 'text-white' : 'text-insec-400 group-hover:text-insec-200']"></i>
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

        <footer class="relative shrink-0 border-t border-white/[0.07] p-3">
            <div v-if="!compacte" class="mb-2 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06]">
                <p class="text-[10.5px] font-semibold tracking-[0.14em] text-insec-400 uppercase">Centre associé</p>
                <p class="mt-0.5 text-xs text-insec-200">INTEC · CNAM Paris</p>
                <p class="mt-1.5 flex items-center gap-1.5 text-xs text-insec-300">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.8)]"></span>
                    Année {{ ANNEE_ACADEMIQUE_PAR_DEFAUT }}
                </p>
            </div>
            <button
                type="button"
                class="hidden h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-xs font-medium text-insec-300 transition hover:bg-white/[0.06] hover:text-white lg:flex"
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
