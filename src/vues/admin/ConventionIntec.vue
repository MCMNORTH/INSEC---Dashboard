<script setup lang="ts">
import { computed, ref } from 'vue';

const aujourdHui = ref(new Date());
const joursAvantEcheance = computed(() => {
    const aujourdHuiLocale = new Date(aujourdHui.value.getFullYear(), aujourdHui.value.getMonth(), aujourdHui.value.getDate());
    const echeance = new Date(2027, 9, 19);
    return Math.max(0, Math.ceil((echeance.getTime() - aujourdHuiLocale.getTime()) / 86_400_000));
});
</script>

<template>
    <main class="mx-auto max-w-6xl space-y-6">
        <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-insec via-[#202c6b] to-[#34458c] px-7 py-8 text-white shadow-lg sm:px-9 sm:py-10">
            <div class="absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full border border-white/10"></div>
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Partenariat de formation · CNAM–INTEC × INSEC Mauritanie</p>
            <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Notre convention avec l’INTEC</h1>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">Les engagements du centre, les modalités d’examens et les échéances contractuelles, réunis sur une seule page.</p>
            <div class="mt-6 flex flex-wrap gap-3">
                <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm">Prise d’effet : 19 octobre 2024</span>
                <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm">Durée prévue : 3 ans</span>
            </div>
        </header>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Repères contractuels">
            <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Signature</p>
                <p class="mt-2 text-lg font-bold text-slate-800">9 avril 2024</p>
                <p class="mt-1 text-sm text-slate-500">Convention signée à Paris</p>
            </article>
            <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Échéance calculée</p>
                <p class="mt-2 text-lg font-bold text-slate-800">18 octobre 2027</p>
                <p class="mt-1 text-sm text-slate-500">Fin estimée du terme de 3 ans</p>
            </article>
            <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Temps restant</p>
                <p class="mt-2 text-lg font-bold text-insec">{{ joursAvantEcheance }} jours</p>
                <p class="mt-1 text-sm text-slate-500">Jusqu’à la date anniversaire du 19 octobre 2027</p>
            </article>
            <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Années couvertes</p>
                <p class="mt-2 text-lg font-bold text-slate-800">2024–2027</p>
                <p class="mt-1 text-sm text-slate-500">2024/25 · 2025/26 · 2026/27</p>
            </article>
        </section>

        <section class="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6" aria-labelledby="alerte-renouvellement">
            <div class="flex items-start gap-4">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><i class="fa-solid fa-bell"></i></span>
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Rappel de renouvellement</p>
                    <h2 id="alerte-renouvellement" class="mt-1 text-lg font-bold text-amber-950">Anticiper la discussion avec le CNAM avant le 19 avril 2027</h2>
                    <p class="mt-2 text-sm leading-6 text-amber-950">Cette date correspond à un rappel de préparation, fixé six mois avant l’échéance estimée. La convention fournie ne prévoit pas de renouvellement automatique ni de procédure de reconduction : demander confirmation écrite à l’INTEC sur la suite du partenariat.</p>
                    <p class="mt-2 text-xs leading-5 text-amber-900">L’article 9 indique également que chaque partie peut résilier la convention avant le 1<sup>er</sup> avril de chaque année par lettre recommandée avec accusé de réception. Faites confirmer par le CNAM l’effet de cette clause pour le terme 2027.</p>
                </div>
            </div>
        </section>

        <section class="grid gap-5 lg:grid-cols-2">
            <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-insec"><i class="fa-solid fa-bullseye"></i></span>
                    <h2 class="text-lg font-bold text-slate-800">Objet et parcours</h2>
                </div>
                <p class="mt-4 text-sm leading-6 text-slate-600">La convention organise une coopération de formation en comptabilité et finance. Elle porte sur les parcours DGC/DCG, DSGC/DSCG et les certificats de spécialisation (CS), avec cours à distance et accompagnement oral local.</p>
                <ul class="mt-4 space-y-2 text-sm text-slate-600">
                    <li class="flex gap-2"><i class="fa-solid fa-check mt-1 text-emerald-600"></i><span>Les procédures de validation des études supérieures (VES) et de validation des acquis professionnels et personnels (VAPP) sont mentionnées.</span></li>
                    <li class="flex gap-2"><i class="fa-solid fa-check mt-1 text-emerald-600"></i><span>Les séminaires de révision intensive peuvent être organisés en collaboration.</span></li>
                </ul>
            </article>

            <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-insec"><i class="fa-solid fa-people-arrows-left-right"></i></span>
                    <h2 class="text-lg font-bold text-slate-800">Qui fait quoi ?</h2>
                </div>
                <div class="mt-4 space-y-4 text-sm leading-6">
                    <div><h3 class="font-semibold text-insec">INSEC</h3><p class="text-slate-600">Organise les cours oraux et le centre d’examen local, recrute les enseignants après approbation du CNAM, transmet chaque année la liste des enseignants et leur évaluation, et adresse un rapport d’activité avant le 1<sup>er</sup> mai.</p></div>
                    <div><h3 class="font-semibold text-insec">INTEC / CNAM</h3><p class="text-slate-600">Vérifie les dossiers et réalise l’inscription officielle des candidats admissibles, définit les règles d’examen, corrige les copies écrites et communique les résultats et les attestations ou diplômes.</p></div>
                </div>
            </article>

            <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><i class="fa-solid fa-clipboard-check"></i></span>
                    <h2 class="text-lg font-bold text-slate-800">Examens et copies</h2>
                </div>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>Le service des examens de l’INTEC fixe les règles et le centre suit ses directives pour l’organisation locale.</li>
                    <li>Les copies écrites sont renvoyées à EXATECH après la session selon la convention ; l’INTEC assure leur correction.</li>
                    <li>Les oraux des UE TEC 123, TEC 217 et TEC 218 peuvent être organisés localement sous les conditions de jury prévues au contrat.</li>
                </ul>
            </article>

            <article class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><i class="fa-solid fa-coins"></i></span>
                    <h2 class="text-lg font-bold text-slate-800">Principes financiers</h2>
                </div>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>Les droits d’inscription sont facturés par le CNAM selon les annexes tarifaires.</li>
                    <li>INSEC prend en charge les cours oraux, les locaux, l’administration locale, la surveillance et l’envoi des copies.</li>
                    <li>L’INTEC prend en charge les sujets et fournitures de copies, la correction des épreuves écrites ainsi que les attestations et diplômes.</li>
                </ul>
                <p class="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Les annexes de tarifs et de reversement citées dans le texte ne figurent pas dans le PDF fourni ; aucun montant n’est donc repris ici.</p>
            </article>
        </section>

        <footer class="rounded-xl border border-slate-200 bg-white px-5 py-4 text-xs leading-5 text-slate-500">
            Source : convention signée à Paris le 9 avril 2024, prise d’effet prévue le 19 octobre 2024, articles 1 à 10. L’échéance au 18 octobre 2027 est calculée à partir de la durée contractuelle ; confirmez-la avec l’INTEC et vérifiez l’existence d’un avenant avant de vous y fier.
        </footer>
    </main>
</template>
