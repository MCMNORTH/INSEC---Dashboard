<script setup lang="ts">
import { date } from '../format';
import { useReferentiel } from '../referentiel';
import type { Formation } from '../types';

const { formationsActives, ues } = useReferentiel();
const uesDe = (f: Formation, annee: number) => ues.value.filter((u) => u.formationId === f.id && u.anneeParcours === annee);
const credits = (f: Formation, annee: number) => uesDe(f, annee).reduce((t, u) => t + u.credits, 0);
</script>

<template>
    <div class="mb-6">
        <p class="text-xs font-semibold tracking-wider text-amber-600 uppercase">Référentiel officiel INTEC-CNAM</p>
        <h1 class="titre-page mt-1">Diplômes et unités d’enseignement</h1>
        <p class="mt-2 text-sm text-gray-500">Catalogue limité aux deux diplômes ouverts par la convention de l’INSEC.</p>
    </div>
    <div class="space-y-6">
        <section v-for="f in formationsActives" :key="f.id" class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <header class="flex flex-wrap items-start justify-between gap-4 bg-insec px-6 py-5 text-white">
                <div>
                    <div class="flex items-center gap-3">
                        <span class="rounded-lg bg-amber-400 px-3 py-1 text-sm font-black text-insec">{{ f.code }}</span>
                        <h2 class="text-lg font-bold">{{ f.libelle }}</h2>
                    </div>
                    <p class="mt-2 text-sm text-blue-100">{{ f.niveauDiplome }} · {{ f.dureeAnnees }} ans · {{ f.creditsTotal }} ECTS</p>
                </div>
                <a v-if="f.sourceUrl" :href="f.sourceUrl" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-white/30 px-3 py-2 text-xs font-medium hover:bg-white/10">Source officielle ↗</a>
            </header>
            <div :class="['grid gap-5 p-6', f.dureeAnnees === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2']">
                <div v-for="a in f.dureeAnnees" :key="a">
                    <h3 class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 text-sm font-bold text-insec">
                        <span>{{ a }}{{ a === 1 ? 're' : 'e' }} année</span>
                        <span class="text-xs font-medium text-gray-400">{{ credits(f, a) }} ECTS</span>
                    </h3>
                    <div class="space-y-2">
                        <article v-for="ue in uesDe(f, a)" :key="ue.id" class="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-xs font-bold text-amber-700">{{ ue.code }}</p>
                                    <p class="mt-1 text-sm font-medium text-gray-800">{{ ue.libelle }}</p>
                                </div>
                                <span class="rounded-full bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap text-gray-500 shadow-sm">{{ ue.credits }} ECTS</span>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
            <footer v-if="f.sourceVerifieeLe" class="border-t border-gray-100 px-6 py-3 text-xs text-gray-400">Source vérifiée le {{ date(f.sourceVerifieeLe) }}</footer>
        </section>
    </div>
</template>
