<script setup lang="ts">
import { ref } from 'vue';
import { appeler } from '../api';
import { lireEnBase64, telecharger } from '../fichiers';
import { useFormulaire } from '../formulaire';

interface Rapport {
    crees: number;
    misAJour: number;
    ignores: number;
    inscriptionsCreees: number;
    inscriptionsExistantes: number;
    erreurs: string[];
    lignes?: { ligne: number; etudiant: string; email: string; dossier: string; inscription: string }[];
}

const { envoi, soumettre } = useFormulaire();
const fichier = ref<File | null>(null);
const champFichier = ref<HTMLInputElement | null>(null);
const mode = ref<'ignorer' | 'mettre_a_jour'>('ignorer');
const apercu = ref<Rapport | null>(null);
const rapport = ref<Rapport | null>(null);

function reinitialiserApercu() {
    apercu.value = null;
    rapport.value = null;
}

function recommencer() {
    reinitialiserApercu();
    fichier.value = null;
    if (champFichier.value) champFichier.value.value = '';
}

async function analyser() {
    const f = fichier.value;
    if (!f) return;
    reinitialiserApercu();
    const resultat = await soumettre(async () => {
        if (f.size > 5 * 1024 * 1024) throw new Error('Le fichier dépasse 5 Mo.');
        return appeler<Rapport>('importerEtudiants', {
            nom: f.name, contenu: await lireEnBase64(f), mode: mode.value, previsualiser: true,
        });
    });
    if (resultat) apercu.value = resultat;
}

async function importer() {
    const f = fichier.value;
    if (!f || !apercu.value || apercu.value.erreurs.length || !apercu.value.lignes?.length) return;
    const resultat = await soumettre(async () => {
        return appeler<Rapport>('importerEtudiants', { nom: f.name, contenu: await lireEnBase64(f), mode: mode.value });
    });
    if (resultat) {
        rapport.value = resultat;
        apercu.value = null;
    }
}

function selectionnerFichier(event: Event) {
    fichier.value = (event.target as HTMLInputElement).files?.[0] ?? null;
    reinitialiserApercu();
}

const exports = [
    ['etudiants', 'Registre complet des étudiants', 'Identité et historique de toutes les inscriptions'],
    ['finances', 'Situation financière', 'Montants dus, versés, soldes et retards'],
    ['resultats', 'Résultats académiques', 'UE, notes, présences et décisions'],
] as const;
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Données</p>
            <h1 class="titre-page mt-1.5">Imports et exports Excel</h1>
            <p class="sous-titre">Échangez les données sans modifier leur structure dans la base.</p>
        </div>
    </header>
    <section v-if="apercu" class="carte mb-6 overflow-hidden">
        <header class="panneau-entete">
            <div>
                <h2 class="titre-section">Aperçu avant import</h2>
                <p class="mt-0.5 text-xs text-gray-500">Aucune donnée n’a été écrite. Vérifiez le résultat ligne par ligne; une dernière validation aura lieu à l’import.</p>
            </div>
            <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><i class="fa-regular fa-eye text-[10px]"></i>Simulation</span>
        </header>
        <div class="p-5 sm:p-6">
            <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div class="rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100"><strong class="block font-titre text-xl text-emerald-700 tabular-nums">{{ apercu.crees }}</strong><span class="block text-xs text-gray-600">dossiers à créer</span></div>
                <div class="rounded-xl bg-insec-50/70 p-3 ring-1 ring-insec-100"><strong class="block font-titre text-xl text-insec-700 tabular-nums">{{ apercu.misAJour }}</strong><span class="block text-xs text-gray-600">dossiers à mettre à jour</span></div>
                <div class="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100"><strong class="block font-titre text-xl text-gray-700 tabular-nums">{{ apercu.ignores }}</strong><span class="block text-xs text-gray-600">lignes ignorées</span></div>
                <div class="rounded-xl bg-sky-50/70 p-3 ring-1 ring-sky-100"><strong class="block font-titre text-xl text-sky-700 tabular-nums">{{ apercu.inscriptionsCreees }}</strong><span class="block text-xs text-gray-600">inscriptions à créer</span></div>
                <div class="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100"><strong class="block font-titre text-xl text-amber-700 tabular-nums">{{ apercu.inscriptionsExistantes }}</strong><span class="block text-xs text-gray-600">inscriptions existantes</span></div>
            </div>
            <div v-if="apercu.lignes?.length" class="max-h-72 overflow-auto rounded-xl ring-1 ring-gray-200">
                <table class="tableau">
                    <thead class="sticky top-0 z-10"><tr><th class="text-right">Ligne</th><th>Étudiant</th><th>E-mail</th><th>Dossier</th><th>Inscription annuelle</th></tr></thead>
                    <tbody><tr v-for="ligne in apercu.lignes" :key="ligne.ligne">
                        <td class="text-right text-gray-400 tabular-nums">{{ ligne.ligne }}</td><td class="font-semibold text-gray-900">{{ ligne.etudiant }}</td><td class="text-gray-600">{{ ligne.email }}</td><td class="text-gray-600">{{ ligne.dossier }}</td><td class="text-gray-600">{{ ligne.inscription }}</td>
                    </tr></tbody>
                </table>
            </div>
            <details v-if="apercu.erreurs.length" class="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-800" open>
                <summary class="flex items-center gap-2 font-semibold"><i class="fa-solid fa-circle-exclamation text-red-500"></i>{{ apercu.erreurs.length }} ligne(s) à corriger avant l’import</summary>
                <ul class="mt-2 list-disc space-y-1 pl-6"><li v-for="e in apercu.erreurs" :key="e">{{ e }}</li></ul>
            </details>
            <div class="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" class="bouton-secondaire" :disabled="envoi" @click="recommencer"><i class="fa-solid fa-rotate-left text-xs"></i>Recommencer</button>
                <button type="button" class="bouton-action" :disabled="envoi || apercu.erreurs.length > 0 || !apercu.lignes?.length" @click="importer">
                    <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i><i v-else class="fa-solid fa-check text-xs"></i> Confirmer l’import
                </button>
            </div>
            <p v-if="apercu.erreurs.length" class="mt-2 text-right text-xs text-red-700">Corrigez les erreurs dans le fichier, puis sélectionnez-le à nouveau pour refaire l’aperçu.</p>
        </div>
    </section>
    <section v-if="rapport" class="carte mb-6 overflow-hidden">
        <header class="panneau-entete">
            <div><h2 class="titre-section">Rapport d’import</h2></div>
            <span class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Terminé</span>
        </header>
        <div class="p-5 sm:p-6">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div class="rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100"><strong class="block font-titre text-xl text-emerald-700 tabular-nums">{{ rapport.crees }}</strong><span class="block text-xs text-gray-600">créés</span></div>
                <div class="rounded-xl bg-insec-50/70 p-3 ring-1 ring-insec-100"><strong class="block font-titre text-xl text-insec-700 tabular-nums">{{ rapport.misAJour }}</strong><span class="block text-xs text-gray-600">mis à jour</span></div>
                <div class="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100"><strong class="block font-titre text-xl text-gray-700 tabular-nums">{{ rapport.ignores }}</strong><span class="block text-xs text-gray-600">ignorés</span></div>
                <div class="rounded-xl bg-sky-50/70 p-3 ring-1 ring-sky-100"><strong class="block font-titre text-xl text-sky-700 tabular-nums">{{ rapport.inscriptionsCreees }}</strong><span class="block text-xs text-gray-600">inscriptions créées</span></div>
                <div class="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100"><strong class="block font-titre text-xl text-amber-700 tabular-nums">{{ rapport.inscriptionsExistantes }}</strong><span class="block text-xs text-gray-600">déjà inscrits</span></div>
            </div>
            <details v-if="rapport.erreurs.length" class="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-800">
                <summary class="flex items-center gap-2 font-semibold"><i class="fa-solid fa-circle-exclamation text-red-500"></i>{{ rapport.erreurs.length }} ligne(s) en erreur</summary>
                <ul class="mt-2 list-disc space-y-1 pl-6"><li v-for="e in rapport.erreurs" :key="e">{{ e }}</li></ul>
            </details>
        </div>
    </section>
    <div class="grid gap-6 lg:grid-cols-2">
        <section class="carte p-6">
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-sm"><i class="fa-solid fa-file-arrow-up"></i></div>
            <h2 class="titre-section text-lg">Importer le registre étudiant</h2>
            <p class="mt-1 mb-4 text-sm leading-6 text-gray-500">Le modèle accepte un dossier seul ou une ligne par inscription annuelle; répétez l’identité pour conserver plusieurs années. Les exports reprennent tout l’historique; les erreurs sont signalées ligne par ligne.</p>
            <button type="button" class="lien mb-5 inline-flex items-center gap-2 text-sm" :disabled="envoi" @click="soumettre(() => telecharger('exporterExcel', { type: 'modele' }))">
                <i class="fa-solid fa-download text-xs"></i>Télécharger le modèle
            </button>
            <form class="space-y-4" @submit.prevent="analyser">
                <label class="etiquette">Fichier Excel (.xlsx) ou CSV
                    <span class="mt-1.5 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center transition hover:border-insec-300 hover:bg-insec-50/30">
                        <i class="fa-solid fa-file-excel text-2xl text-emerald-500"></i>
                        <span class="text-xs text-gray-500">Choisissez un fichier de 5 Mo maximum</span>
                        <input ref="champFichier" type="file" accept=".xlsx,.csv" required class="max-w-full text-xs text-gray-600" @change="selectionnerFichier" />
                    </span>
                </label>
                <label class="etiquette">Si l’e-mail existe déjà
                    <select v-model="mode" class="champ mt-1.5" @change="reinitialiserApercu"><option value="ignorer">Ignorer le dossier et la ligne</option><option value="mettre_a_jour">Mettre à jour le dossier</option></select>
                </label>
                <button class="bouton-principal h-11 w-full" :disabled="envoi"><i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i><i v-else class="fa-solid fa-magnifying-glass-chart text-xs"></i> Analyser le fichier</button>
            </form>
        </section>
        <section class="carte p-6">
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-insec-500 to-insec-800 text-white shadow-sm"><i class="fa-solid fa-file-arrow-down"></i></div>
            <h2 class="titre-section text-lg">Exporter les données</h2>
            <p class="mt-1 mb-5 text-sm text-gray-500">Les exports utilisent les données actuelles et des colonnes filtrables.</p>
            <div class="space-y-3">
                <button
                    v-for="[type, titre, detail] in exports"
                    :key="type"
                    type="button"
                    class="group flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left ring-1 ring-gray-200 transition hover:bg-insec-50/40 hover:ring-insec-200 disabled:opacity-60"
                    :disabled="envoi"
                    @click="soumettre(() => telecharger('exporterExcel', { type }))"
                >
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><i class="fa-solid fa-table"></i></span>
                    <span class="min-w-0 flex-1"><strong class="block text-sm font-semibold text-gray-900">{{ titre }}</strong><span class="text-xs text-gray-500">{{ detail }}</span></span>
                    <i class="fa-solid fa-download text-gray-300 transition group-hover:text-insec-600"></i>
                </button>
            </div>
        </section>
    </div>
</template>
