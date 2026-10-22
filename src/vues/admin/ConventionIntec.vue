<script setup lang="ts">
import { computed, ref } from 'vue';
import { appeler, messageErreur } from '../../api';

const aujourdHui = ref(new Date());
const telechargementEnCours = ref(false);
const erreurTelechargement = ref('');

async function telechargerConvention() {
    if (telechargementEnCours.value) return;
    erreurTelechargement.value = '';
    telechargementEnCours.value = true;
    try {
        const pdf = await appeler<{ nom: string; mimeType: string; contenu: string }>('telechargerConventionIntec');
        const octets = Uint8Array.from(atob(pdf.contenu), (caractere) => caractere.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([octets], { type: pdf.mimeType || 'application/pdf' }));
        const lien = window.document.createElement('a');
        lien.href = url;
        lien.download = pdf.nom;
        lien.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (erreur) {
        erreurTelechargement.value = messageErreur(erreur);
    } finally {
        telechargementEnCours.value = false;
    }
}
const joursAvantEcheance = computed(() => {
    const aujourdHuiLocale = new Date(aujourdHui.value.getFullYear(), aujourdHui.value.getMonth(), aujourdHui.value.getDate());
    const echeance = new Date(2027, 9, 19);
    return Math.max(0, Math.ceil((echeance.getTime() - aujourdHuiLocale.getTime()) / 86_400_000));
});
</script>

<template>
    <main class="space-y-6">
        <header class="en-tete-page mb-0!">
            <div>
                <p class="surtitre">Partenariat de formation · CNAM–INTEC × INSEC Mauritanie</p>
                <h1 class="titre-page mt-1.5">Notre convention avec l’INTEC</h1>
                <p class="sous-titre">Les engagements du centre, les modalités d’examens et les échéances contractuelles, réunis sur une seule page.</p>
                <div class="mt-3 flex flex-wrap gap-2">
                    <span class="pastille bg-white text-gray-700 ring-gray-200"><i class="fa-regular fa-calendar text-[10px] text-insec-500"></i>Prise d’effet : 19 octobre 2024</span>
                    <span class="pastille bg-white text-gray-700 ring-gray-200"><i class="fa-regular fa-clock text-[10px] text-insec-500"></i>Durée prévue : 3 ans</span>
                </div>
            </div>
            <div class="flex flex-col items-start gap-1.5 sm:items-end">
                <button type="button" class="bouton-principal" :disabled="telechargementEnCours" @click="telechargerConvention">
                    <i :class="['fa-solid', telechargementEnCours ? 'fa-spinner fa-spin' : 'fa-file-arrow-down']"></i>
                    {{ telechargementEnCours ? 'Préparation du PDF…' : 'Télécharger la convention PDF' }}
                </button>
                <p class="text-xs text-gray-400">PDF original réservé aux comptes administrateurs INSEC.</p>
                <p v-if="erreurTelechargement" role="alert" class="text-sm font-medium text-red-600">{{ erreurTelechargement }}</p>
            </div>
        </header>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Repères contractuels">
            <article class="carte p-5">
                <p class="text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase">Signature</p>
                <p class="mt-2 font-titre text-xl font-bold text-gray-900">9 avril 2024</p>
                <p class="mt-1 text-sm text-gray-500">Convention signée à Paris</p>
            </article>
            <article class="carte p-5">
                <p class="text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase">Échéance calculée</p>
                <p class="mt-2 font-titre text-xl font-bold text-gray-900">18 octobre 2027</p>
                <p class="mt-1 text-sm text-gray-500">Fin estimée du terme de 3 ans</p>
            </article>
            <article class="carte p-5">
                <p class="text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase">Temps restant</p>
                <p class="mt-2 font-titre text-xl font-bold text-insec-700 tabular-nums">{{ joursAvantEcheance }} jours</p>
                <p class="mt-1 text-sm text-gray-500">Jusqu’à la date anniversaire du 19 octobre 2027</p>
            </article>
            <article class="carte p-5">
                <p class="text-[11px] font-semibold tracking-[0.12em] text-gray-400 uppercase">Années couvertes</p>
                <p class="mt-2 font-titre text-xl font-bold text-gray-900">2024–2027</p>
                <p class="mt-1 text-sm text-gray-500">2024/25 · 2025/26 · 2026/27</p>
            </article>
        </section>

        <section class="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-white p-5 sm:p-6" aria-labelledby="alerte-renouvellement">
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
            <article class="carte p-6">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-bullseye"></i></span>
                    <h2 class="titre-section text-lg">Objet et parcours</h2>
                </div>
                <p class="mt-4 text-sm leading-6 text-gray-600">La convention organise une coopération de formation en comptabilité et finance. Elle porte sur les parcours DGC/DCG, DSGC/DSCG et les certificats de spécialisation (CS), avec cours à distance et accompagnement oral local.</p>
                <ul class="mt-4 space-y-2 text-sm text-gray-600">
                    <li class="flex gap-2"><i class="fa-solid fa-check mt-1 text-emerald-600"></i><span>Les procédures de validation des études supérieures (VES) et de validation des acquis professionnels et personnels (VAPP) sont mentionnées.</span></li>
                    <li class="flex gap-2"><i class="fa-solid fa-check mt-1 text-emerald-600"></i><span>Les séminaires de révision intensive peuvent être organisés en collaboration.</span></li>
                </ul>
            </article>

            <article class="carte p-6">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-insec-50 text-insec-600 ring-1 ring-insec-100"><i class="fa-solid fa-people-arrows-left-right"></i></span>
                    <h2 class="titre-section text-lg">Qui fait quoi ?</h2>
                </div>
                <div class="mt-4 space-y-4 text-sm leading-6">
                    <div><h3 class="font-semibold text-gray-900">INSEC</h3><p class="text-gray-600">Organise les cours oraux et le centre d’examen local, recrute les enseignants après approbation du CNAM, transmet chaque année la liste des enseignants et leur évaluation, et adresse un rapport d’activité avant le 1<sup>er</sup> mai.</p></div>
                    <div><h3 class="font-semibold text-gray-900">INTEC / CNAM</h3><p class="text-gray-600">Vérifie les dossiers et réalise l’inscription officielle des candidats admissibles, définit les règles d’examen, corrige les copies écrites et communique les résultats et les attestations ou diplômes.</p></div>
                </div>
            </article>

            <article class="carte p-6">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><i class="fa-solid fa-clipboard-check"></i></span>
                    <h2 class="titre-section text-lg">Examens et copies</h2>
                </div>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                    <li>Le service des examens de l’INTEC fixe les règles et le centre suit ses directives pour l’organisation locale.</li>
                    <li>Les copies écrites sont renvoyées à EXATECH après la session selon la convention ; l’INTEC assure leur correction.</li>
                    <li>Les oraux des UE TEC 123, TEC 217 et TEC 218 peuvent être organisés localement sous les conditions de jury prévues au contrat.</li>
                </ul>
            </article>

            <article class="carte p-6">
                <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><i class="fa-solid fa-coins"></i></span>
                    <h2 class="titre-section text-lg">Principes financiers</h2>
                </div>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                    <li>Les droits d’inscription sont facturés par le CNAM selon les annexes tarifaires.</li>
                    <li>INSEC prend en charge les cours oraux, les locaux, l’administration locale, la surveillance et l’envoi des copies.</li>
                    <li>L’INTEC prend en charge les sujets et fournitures de copies, la correction des épreuves écrites ainsi que les attestations et diplômes.</li>
                </ul>
                <p class="mt-4 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100 text-xs leading-5 text-gray-500">Les annexes de tarifs et de reversement citées dans le texte ne figurent pas dans le PDF fourni ; aucun montant n’est donc repris ici.</p>
            </article>
        </section>

        <footer class="flex items-start gap-2.5 rounded-2xl border border-gray-200/80 bg-white/60 px-5 py-4 text-xs leading-5 text-gray-500">
            <i class="fa-solid fa-book-open mt-0.5 text-gray-400"></i>
            Source : convention signée à Paris le 9 avril 2024, prise d’effet prévue le 19 octobre 2024, articles 1 à 10. L’échéance au 18 octobre 2027 est calculée à partir de la durée contractuelle ; confirmez-la avec l’INTEC et vérifiez l’existence d’un avenant avant de vous y fier.
        </footer>
    </main>
</template>
