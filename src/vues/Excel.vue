<script setup lang="ts">
import { ref } from 'vue';
import { appeler } from '../api';
import { lireEnBase64, telecharger } from '../fichiers';
import { useFormulaire } from '../formulaire';

interface Rapport { crees: number; misAJour: number; ignores: number; erreurs: string[] }

const { envoi, soumettre } = useFormulaire();
const fichier = ref<File | null>(null);
const mode = ref<'ignorer' | 'mettre_a_jour'>('ignorer');
const rapport = ref<Rapport | null>(null);

async function importer() {
    const f = fichier.value;
    if (!f) return;
    rapport.value = null;
    const resultat = await soumettre(async () => {
        if (f.size > 5 * 1024 * 1024) throw new Error('Le fichier dépasse 5 Mo.');
        return appeler<Rapport>('importerEtudiants', { nom: f.name, contenu: await lireEnBase64(f), mode: mode.value });
    });
    if (resultat) rapport.value = resultat;
}

const exports = [
    ['etudiants', 'Étudiants et inscriptions', 'Identité, diplôme, année et statut'],
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
    <div v-if="rapport" class="mb-6 rounded-xl border bg-white p-5">
        <h2 class="font-bold text-insec">Rapport d’import</h2>
        <div class="my-4 grid grid-cols-3 gap-3 text-center">
            <div class="rounded bg-green-50 p-3"><strong>{{ rapport.crees }}</strong><span class="block text-xs">créés</span></div>
            <div class="rounded bg-blue-50 p-3"><strong>{{ rapport.misAJour }}</strong><span class="block text-xs">mis à jour</span></div>
            <div class="rounded bg-gray-50 p-3"><strong>{{ rapport.ignores }}</strong><span class="block text-xs">ignorés</span></div>
        </div>
        <details v-if="rapport.erreurs.length" class="text-sm text-red-700">
            <summary class="cursor-pointer font-semibold">{{ rapport.erreurs.length }} ligne(s) en erreur</summary>
            <ul class="mt-2 list-disc space-y-1 pl-5"><li v-for="e in rapport.erreurs" :key="e">{{ e }}</li></ul>
        </details>
    </div>
    <div class="grid gap-6 lg:grid-cols-2">
        <section class="rounded-xl border bg-white p-6">
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-700"><i class="fa-solid fa-file-arrow-up"></i></div>
            <h2 class="text-lg font-bold text-insec">Importer des étudiants</h2>
            <p class="mt-1 mb-4 text-sm text-gray-500">Utilisez exclusivement le modèle INSEC. Chaque ligne invalide est signalée sans bloquer les autres.</p>
            <button class="mb-5 inline-block cursor-pointer text-sm font-semibold text-insec" :disabled="envoi" @click="soumettre(() => telecharger('exporterExcel', { type: 'modele' }))">
                <i class="fa-solid fa-download mr-1"></i>Télécharger le modèle
            </button>
            <form class="space-y-4" @submit.prevent="importer">
                <label class="etiquette">Fichier Excel (.xlsx) ou CSV
                    <input type="file" accept=".xlsx,.csv" required class="mt-1 block w-full rounded-lg border p-2 text-sm" @change="fichier = ($event.target as HTMLInputElement).files?.[0] ?? null" />
                </label>
                <label class="etiquette">Si l’e-mail existe déjà
                    <select v-model="mode" class="champ mt-1"><option value="ignorer">Ignorer la ligne</option><option value="mettre_a_jour">Mettre à jour l’étudiant</option></select>
                </label>
                <button class="bouton-principal w-full py-3" :disabled="envoi"><i v-if="envoi" class="fa-solid fa-circle-notch fa-spin"></i> Analyser et importer</button>
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
