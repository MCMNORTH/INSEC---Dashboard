<script setup lang="ts">
import BoutonTheme from './BoutonTheme.vue';
import MarqueInsec from './MarqueInsec.vue';

// Mise en page des écrans publics (connexion, mot de passe oublié) : panneau de marque et formulaire.
defineProps<{ titre: string; sousTitre: string }>();

const POINTS = [
    { icone: 'fa-user-graduate', titre: 'Étudiants & inscriptions', texte: 'DGC et DSGC, UE et années scolaires au même endroit.' },
    { icone: 'fa-calendar-check', titre: 'Examens INTEC', texte: 'Heure de Paris et de Nouakchott, côte à côte.' },
    { icone: 'fa-coins', titre: 'Finances en MRU', texte: 'Versements, échéances et relances suivis.' },
];
</script>

<template>
    <div class="relative flex min-h-screen bg-surface">
        <aside class="relative hidden w-[46%] max-w-[640px] overflow-hidden bg-linear-to-br from-[#3b76f6] to-[#1d4ed8] p-12 text-white lg:flex lg:flex-col xl:p-16">
            <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_0%_0%,rgb(255_255_255/0.18),transparent_60%),radial-gradient(70%_50%_at_100%_100%,rgb(224_26_46/0.18),transparent_65%)]"></div>
            <svg class="pointer-events-none absolute inset-0 h-full w-full opacity-[0.1]" aria-hidden="true">
                <defs>
                    <pattern id="grille-accueil" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M32 0H0V32" fill="none" stroke="white" stroke-width="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grille-accueil)" />
            </svg>

            <div class="relative">
                <MarqueInsec clair />
            </div>

            <div class="relative mt-auto">
                <p class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/85 uppercase">
                    <span class="h-1.5 w-1.5 rounded-full bg-[#e01a2e]"></span>
                    Centre associé INTEC · CNAM Paris
                </p>
                <h1 class="mt-6 font-titre text-4xl leading-[1.1] font-bold tracking-tight xl:text-[2.75rem]">
                    La gestion de l’INSEC,<br />
                    <span class="bg-linear-to-r from-white to-white/70 bg-clip-text text-transparent">claire et sereine.</span>
                </h1>
                <ul class="mt-10 space-y-5">
                    <li v-for="p in POINTS" :key="p.titre" class="flex gap-4">
                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                            <i :class="['fa-solid text-sm text-white', p.icone]"></i>
                        </span>
                        <span>
                            <span class="block text-sm font-semibold">{{ p.titre }}</span>
                            <span class="block text-sm text-white/75">{{ p.texte }}</span>
                        </span>
                    </li>
                </ul>
            </div>
            <p class="relative mt-14 text-xs text-white/65">© {{ new Date().getFullYear() }} INSEC · Nouakchott, Mauritanie</p>
        </aside>

        <div class="absolute top-4 right-4 z-10"><BoutonTheme /></div>
        <main class="flex flex-1 items-center justify-center bg-[radial-gradient(60%_40%_at_50%_0%,var(--color-insec-50),transparent)] px-6 py-12 sm:px-10">
            <div class="w-full max-w-[400px] animate-apparition">
                <div class="mb-10 lg:hidden"><MarqueInsec /></div>
                <h2 class="font-titre text-[1.75rem] font-bold tracking-tight text-gray-900">{{ titre }}</h2>
                <p class="mt-2 mb-8 text-sm text-gray-500">{{ sousTitre }}</p>
                <slot />
            </div>
        </main>
    </div>
</template>
