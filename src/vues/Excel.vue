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
    lignes?: { ligne: number; dossier: string; inscription: string }[];
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
    <div class="mb-7">
        <p class="text-sm text-gray-500">Données</p>
        <h1 class="titre-page">Imports et exports Excel</h1>
        <p class="mt-1 text-sm text-gray-500">Échangez les données sans modifier leur structure dans la base.</p>
    </div>
    <div v-if="apercu" class="mb-6 rounded-xl border border-blue-200 bg-white p-5">
        <h2 class="font-bold text-insec">Aperçu avant import</h2>
        <p class="mt-1 text-sm text-gray-500">Aucune donnée n’a été écrite. Vérifiez le résultat ligne par ligne; une dernière validation aura lieu à l’import.</p>
        <div class="my-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            <div class="rounded bg-green-50 p-3"><strong>{{ apercu.crees }}</strong><span class="block text-xs">dossiers à créer</span></div>
            <div class="rounded bg-blue-50 p-3"><strong>{{ apercu.misAJour }}</strong><span class="block text-xs">dossiers à mettre à jour</span></div>
            <div class="rounded bg-gray-50 p-3"><strong>{{ apercu.ignores }}</strong><span class="block text-xs">lignes ignorées</span></div>
            <div class="rounded bg-emerald-50 p-3"><strong>{{ apercu.inscriptionsCreees }}</strong><span class="block text-xs">inscriptions à créer</span></div>
            <div class="rounded bg-amber-50 p-3"><strong>{{ apercu.inscriptionsExistantes }}</strong><span class="block text-xs">inscriptions existantes</span></div>
        </div>
        <div v-if="apercu.lignes?.length" class="max-h-64 overflow-auto rounded-lg border">
            <table class="w-full text-left text-sm">
                <thead class="sticky top-0 bg-gray-50"><tr><th class="p-2">Ligne</th><th class="p-2">Dossier</th><th class="p-2">Inscription annuelle</th></tr></thead>
                <tbody><tr v-for="ligne in apercu.lignes" :key="ligne.ligne" class="border-t">
                    <td class="p-2">{{ ligne.ligne }}</td><td class="p-2">{{ ligne.dossier }}</td><td class="p-2">{{ ligne.inscription }}</td>
                </tr></tbody>
            </table>
        </div>
        <details v-if="apercu.erreurs.length" class="mt-3 text-sm text-red-700" open>
            <summary class="cursor-pointer font-semibold">{{ apercu.erreurs.length }} ligne(s) à corriger avant l’import</summary>
            <ul class="mt-2 list-disc space-y-1 pl-5"><li v-for="e in apercu.erreurs" :key="e">{{ e }}</li></ul>
        </details>
        <div class="mt-4 flex flex-wrap gap-3">
            <button type="button" class="rounded-lg border px-4 py-2 text-sm" :disabled="envoi" @click="recommencer">Recommencer</button>
            <button type="button" class="bouton-principal px-4 py-2" :disabled="envoi || apercu.erreurs.length > 0 || !apercu.lignes?.length" @click="importer">
                <i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i> Confirmer l’import
            </button>
        </div>
        <p v-if="apercu.erreurs.length" class="mt-2 text-xs text-red-700">Corrigez les erreurs dans le fichier, puis sélectionnez-le à nouveau pour refaire l’aperçu.</p>
    </div>
    <div v-if="rapport" class="mb-6 rounded-xl border bg-white p-5">
        <h2 class="font-bold text-insec">Rapport d’import</h2>
        <div class="my-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            <div class="rounded bg-green-50 p-3"><strong>{{ rapport.crees }}</strong><span class="block text-xs">créés</span></div>
            <div class="rounded bg-blue-50 p-3"><strong>{{ rapport.misAJour }}</strong><span class="block text-xs">mis à jour</span></div>
            <div class="rounded bg-gray-50 p-3"><strong>{{ rapport.ignores }}</strong><span class="block text-xs">ignorés</span></div>
            <div class="rounded bg-emerald-50 p-3"><strong>{{ rapport.inscriptionsCreees }}</strong><span class="block text-xs">inscriptions créées</span></div>
            <div class="rounded bg-amber-50 p-3"><strong>{{ rapport.inscriptionsExistantes }}</strong><span class="block text-xs">déjà inscrits</span></div>
        </div>
        <details v-if="rapport.erreurs.length" class="text-sm text-red-700">
            <summary class="cursor-pointer font-semibold">{{ rapport.erreurs.length }} ligne(s) en erreur</summary>
            <ul class="mt-2 list-disc space-y-1 pl-5"><li v-for="e in rapport.erreurs" :key="e">{{ e }}</li></ul>
        </details>
    </div>
    <div class="grid gap-6 lg:grid-cols-2">
        <section class="rounded-xl border bg-white p-6">
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-700"><i class="fa-solid fa-file-arrow-up"></i></div>
            <h2 class="text-lg font-bold text-insec">Importer le registre étudiant</h2>
            <p class="mt-1 mb-4 text-sm text-gray-500">Le modèle accepte un dossier seul ou une ligne par inscription annuelle; répétez l’identité pour conserver plusieurs années. Les exports reprennent tout l’historique; les erreurs sont signalées ligne par ligne.</p>
            <button class="mb-5 inline-block cursor-pointer text-sm font-semibold text-insec" :disabled="envoi" @click="soumettre(() => telecharger('exporterExcel', { type: 'modele' }))">
                <i class="fa-solid fa-download mr-1"></i>Télécharger le modèle
            </button>
            <form class="space-y-4" @submit.prevent="analyser">
                <label class="etiquette">Fichier Excel (.xlsx) ou CSV
                    <input ref="champFichier" type="file" accept=".xlsx,.csv" required class="mt-1 block w-full rounded-lg border p-2 text-sm" @change="selectionnerFichier" />
                </label>
                <label class="etiquette">Si l’e-mail existe déjà
                    <select v-model="mode" class="champ mt-1" @change="reinitialiserApercu"><option value="ignorer">Ignorer le dossier et la ligne</option><option value="mettre_a_jour">Mettre à jour le dossier</option></select>
                </label>
                <button class="bouton-principal w-full py-3" :disabled="envoi"><i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i> Analyser le fichier</button>
            </form>
        </section>
        <section class="rounded-xl border bg-white p-6">
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><i class="fa-solid fa-file-arrow-down"></i></div>
            <h2 class="text-lg font-bold text-insec">Exporter les données</h2>
            <p class="mt-1 mb-5 text-sm text-gray-500">Les exports utilisent les données actuelles et des colonnes filtrables.</p>
            <div class="space-y-3">
                <button
                    v-for="[type, titre, detail] in exports"
                    :key="type"
                    class="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 text-left hover:border-insec-or disabled:opacity-60"
                    :disabled="envoi"
                    @click="soumettre(() => telecharger('exporterExcel', { type }))"
                >
                    <span><strong class="block text-sm">{{ titre }}</strong><span class="text-xs text-gray-400">{{ detail }}</span></span>
                    <i class="fa-solid fa-download text-insec"></i>
                </button>
            </div>
        </section>
    </div>
</template>
