<script setup lang="ts">
import { date } from '../format';
import { useReferentiel } from '../referentiel';
import type { Formation } from '../types';

const { formationsActives, ues } = useReferentiel();

const certificatsSpecialisation = [
    { code: 'TEC 712', libelle: 'Audit et contrôle légal des comptes' },
    { code: 'TEC 714', libelle: 'Gestion des associations' },
    { code: 'TEC 715', libelle: 'Comptabilité internationale' },
    { code: 'TEC 716', libelle: 'Gestion comptable et financière des collectivités territoriales' },
    { code: 'TEC 761', libelle: 'Audit des systèmes d’information' },
];
const uesDe = (f: Formation, annee: number) => ues.value.filter((u) => u.formationId === f.id && u.anneeParcours === annee);
const credits = (f: Formation, annee: number) => uesDe(f, annee).reduce((t, u) => t + u.credits, 0);
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Référentiel officiel INTEC-CNAM</p>
            <h1 class="titre-page mt-1.5">Diplômes et unités d’enseignement</h1>
            <p class="sous-titre">Catalogue limité aux deux diplômes ouverts par la convention de l’INSEC.</p>
        </div>
    </header>
    <div class="space-y-6">
        <section v-for="f in formationsActives" :key="f.id" class="carte overflow-hidden">
            <header class="relative flex flex-wrap items-start justify-between gap-4 overflow-hidden bg-insec-600 px-6 py-5 text-white">
                <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgb(255_255_255/0.16),transparent_60%)]"></div>
                <div class="relative">
                    <div class="flex items-center gap-3">
                        <span class="rounded-lg bg-surface px-2.5 py-1 font-titre text-sm font-extrabold text-insec-700">{{ f.code }}</span>
                        <h2 class="font-titre text-lg font-bold">{{ f.libelle }}</h2>
                    </div>
                    <p class="mt-2 flex flex-wrap gap-2 text-xs text-white/85">
                        <span class="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{{ f.niveauDiplome }}</span>
                        <span class="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{{ f.dureeAnnees }} ans</span>
                        <span class="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{{ f.creditsTotal }} ECTS</span>
                    </p>
                </div>
                <a v-if="f.sourceUrl" :href="f.sourceUrl" target="_blank" rel="noopener noreferrer" class="relative inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/20">Source officielle <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>
            </header>
            <div :class="['grid gap-6 p-5 sm:p-6', f.dureeAnnees === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2']">
                <div v-for="a in f.dureeAnnees" :key="a">
                    <h3 class="mb-3 flex items-center justify-between border-b border-gray-100 pb-2.5 text-sm font-bold text-gray-900">
                        <span>{{ a }}{{ a === 1 ? 're' : 'e' }} année</span>
                        <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ credits(f, a) }} ECTS</span>
                    </h3>
                    <div class="space-y-2">
                        <article v-for="ue in uesDe(f, a)" :key="ue.id" class="rounded-xl bg-gray-50/70 p-3 ring-1 ring-gray-100 transition hover:bg-surface hover:shadow-carte">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-[11px] font-bold tracking-wide text-insec-500">{{ ue.code }}</p>
                                    <p class="mt-0.5 text-sm font-medium text-gray-800">{{ ue.libelle }}</p>
                                </div>
                                <span class="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-gray-500 ring-1 ring-gray-200">{{ ue.credits }} ECTS</span>
                            </div>
                        </article>
                    </div>
                </div>
            </div>
            <footer v-if="f.sourceVerifieeLe" class="flex items-center gap-2 border-t border-gray-100 px-6 py-3 text-xs text-gray-400"><i class="fa-solid fa-circle-check text-emerald-500"></i>Source vérifiée le {{ date(f.sourceVerifieeLe) }}</footer>
        </section>
    </div>

    <section class="carte mt-8 overflow-hidden">
        <header class="panneau-entete">
            <div>
                <p class="surtitre text-[10.5px]">Formations couvertes par la convention INSEC–CNAM</p>
                <h2 class="titre-section mt-1">Certificats de spécialisation</h2>
                <p class="mt-0.5 max-w-2xl text-xs text-gray-500">Un certificat correspond à une UE de spécialisation, préparée sur une année universitaire. Ce sont des certificats non diplômants.</p>
            </div>
            <a href="https://intec.cnam.fr/certificats-de-specialisation-291170.kjsp" target="_blank" rel="noopener noreferrer" class="bouton-secondaire">Catalogue officiel INTEC <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i></a>
        </header>
        <div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
            <article v-for="certificat in certificatsSpecialisation" :key="certificat.code" class="flex items-start gap-3 rounded-xl bg-gray-50/70 p-4 ring-1 ring-gray-100">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-award text-sm"></i></span>
                <div>
                    <p class="text-[11px] font-bold tracking-wide text-insec-500">{{ certificat.code }}</p>
                    <h3 class="mt-0.5 text-sm font-semibold text-gray-800">{{ certificat.libelle }}</h3>
                </div>
            </article>
        </div>
        <div class="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950 sm:mx-6 sm:mb-6">
            <i class="fa-solid fa-circle-info mt-1 text-amber-500"></i>
            <span>Le catalogue officiel INTEC consulté pour 2026–2027 répertorie cinq certificats : TEC 712, 714, 715, 716 et 761. La convention fournie mentionne les certificats de spécialisation, mais son exemplaire ne contient pas l’annexe détaillant six intitulés. Le sixième intitulé reste à confirmer auprès de l’INTEC avant ajout.</span>
        </div>
    </section>
</template>
