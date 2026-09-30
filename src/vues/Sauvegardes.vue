<script setup lang="ts">
import { collection, orderBy, query } from 'firebase/firestore';
import { reactive, ref } from 'vue';
import { appeler } from '../api';
import BadgeStatut from '../composants/BadgeStatut.vue';
import Chargement from '../composants/Chargement.vue';
import { useRequete } from '../donnees';
import { avecEmulateurs, db } from '../firebase';
import { dateHeure } from '../format';
import { useFormulaire } from '../formulaire';
import { notifier } from '../notifications';
import { messageAuth, reauthentifier } from '../session';
import type { Sauvegarde } from '../types';

const { donnees: sauvegardes, chargement, erreur } = useRequete<Sauvegarde>(() => query(collection(db, 'sauvegardes'), orderBy('creeLe', 'desc')));
const { envoi, soumettre } = useFormulaire();
const restauration = ref<string | null>(null);
const confirmation = reactive({ motDePasse: '', texte: '' });

async function executer(operation: string, donnees: object = {}) {
    const resultat = await soumettre(() => appeler<{ message?: string; integrite?: boolean }>(operation, donnees));
    if (resultat) notifier(resultat.message ?? 'Opération terminée.', { type: resultat.integrite === false ? 'erreur' : 'succes' });
}

async function restaurer(id: string) {
    try {
        await reauthentifier(confirmation.motDePasse);
    } catch (e) {
        notifier(messageAuth(e) === 'Ces identifiants ne correspondent pas à nos enregistrements.' ? 'Mot de passe incorrect.' : messageAuth(e), { type: 'erreur' });
        return;
    }
    await executer('restaurerSauvegarde', { id, confirmation: confirmation.texte });
    Object.assign(confirmation, { motDePasse: '', texte: '' });
    restauration.value = null;
}

const lienConsole = (s: Sauvegarde) => `https://console.cloud.google.com/storage/browser/${s.bucket}/${s.nom}`;
</script>

<template>
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
            <p class="text-sm text-gray-500">Continuité d’activité</p>
            <h1 class="titre-page">Sauvegardes et restauration</h1>
            <p class="mt-1 text-sm text-gray-500">Export Firestore géré, copie des dossiers étudiants et contrôle d’intégrité.</p>
        </div>
        <button class="bouton-principal" :disabled="envoi || avecEmulateurs" @click="executer('creerSauvegarde')">
            <i :class="['fa-solid', envoi ? 'fa-circle-notch fa-spin' : 'fa-plus']"></i> Créer une sauvegarde
        </button>
    </div>
    <div v-if="avecEmulateurs" class="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Les exports Firestore gérés ne sont pas disponibles sur les émulateurs locaux : cette page est opérationnelle une fois l’application déployée.
    </div>
    <div class="mb-6 grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border bg-white p-4"><p class="text-xs text-gray-400">Planification</p><p class="mt-1 font-semibold text-insec">Tous les jours à 02:00</p></div>
        <div class="rounded-xl border bg-white p-4"><p class="text-xs text-gray-400">Conservation</p><p class="mt-1 font-semibold text-insec">30 jours</p></div>
        <div class="rounded-xl border bg-white p-4"><p class="text-xs text-gray-400">Protection</p><p class="mt-1 font-semibold text-insec">MD5 + ré-authentification</p></div>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur" :vide="!sauvegardes.length" message-vide="Aucune sauvegarde disponible.">
        <div class="space-y-3">
            <article v-for="s in sauvegardes" :key="s.id" class="rounded-xl border bg-white p-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="font-semibold text-insec">{{ s.nom }}</h2>
                            <BadgeStatut :statut="s.statut === 'Terminée' ? (s.integrite ? 'Validé' : 'À vérifier') : s.statut === 'Échec' ? 'Échec' : 'En attente'" />
                        </div>
                        <p class="mt-1 text-xs text-gray-400">{{ dateHeure(s.creeLe) }} · {{ s.nbDocuments ?? 0 }} document(s) · {{ s.motif }}</p>
                        <p v-if="s.erreur" class="mt-1 text-xs text-red-600">{{ s.erreur }}</p>
                    </div>
                    <div v-if="s.statut === 'Terminée'" class="flex flex-wrap gap-2">
                        <button class="bouton-secondaire px-3 text-xs" :disabled="envoi" @click="executer('verifierSauvegarde', { id: s.id })">Vérifier</button>
                        <a :href="lienConsole(s)" target="_blank" rel="noopener noreferrer" class="bouton-secondaire px-3 text-xs">Ouvrir dans Cloud Storage</a>
                        <button class="bouton-danger px-3 text-xs" @click="restauration = restauration === s.id ? null : s.id">Restaurer</button>
                    </div>
                </div>
                <form v-if="restauration === s.id" class="mt-4 grid items-end gap-3 border-t pt-4 md:grid-cols-3" @submit.prevent="restaurer(s.id)">
                    <p class="text-xs text-red-700 md:col-span-3">
                        Une sauvegarde de précaution est créée automatiquement. Les documents présents dans la sauvegarde remplacent leur version actuelle ; ceux créés depuis ne sont pas supprimés.
                    </p>
                    <label class="text-xs font-semibold text-gray-600">Mot de passe du compte
                        <input v-model="confirmation.motDePasse" type="password" required autocomplete="current-password" class="champ mt-1" />
                    </label>
                    <label class="text-xs font-semibold text-gray-600">Tapez RESTAURER
                        <input v-model="confirmation.texte" required class="champ mt-1" />
                    </label>
                    <button class="bouton-danger" :disabled="envoi || confirmation.texte !== 'RESTAURER'">Confirmer la restauration</button>
                </form>
            </article>
        </div>
    </Chargement>
</template>
