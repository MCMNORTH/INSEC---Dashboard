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
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Continuité d’activité</p>
            <h1 class="titre-page mt-1.5">Sauvegardes et restauration</h1>
            <p class="sous-titre">Export Firestore géré, copie des dossiers étudiants et contrôle d’intégrité.</p>
        </div>
        <button class="bouton-principal" :disabled="envoi || avecEmulateurs" @click="executer('creerSauvegarde')">
            <i :class="['fa-solid', envoi ? 'fa-circle-notch fa-spin' : 'fa-plus']"></i> Créer une sauvegarde
        </button>
    </header>
    <div v-if="avecEmulateurs" class="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <i class="fa-solid fa-flask mt-0.5 text-amber-500"></i>
        <span>Les exports Firestore gérés ne sont pas disponibles sur les émulateurs locaux : cette page est opérationnelle une fois l’application déployée.</span>
    </div>
    <div class="mb-6 grid gap-4 md:grid-cols-3">
        <div class="carte flex items-center gap-4 p-5">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-insec-50 text-insec-600"><i class="fa-regular fa-clock"></i></span>
            <div><p class="text-xs text-gray-500">Planification</p><p class="mt-0.5 font-semibold text-gray-900">Tous les jours à 02:00</p></div>
        </div>
        <div class="carte flex items-center gap-4 p-5">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-insec-50 text-insec-600"><i class="fa-solid fa-box-archive"></i></span>
            <div><p class="text-xs text-gray-500">Conservation</p><p class="mt-0.5 font-semibold text-gray-900">30 jours</p></div>
        </div>
        <div class="carte flex items-center gap-4 p-5">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><i class="fa-solid fa-shield-halved"></i></span>
            <div><p class="text-xs text-gray-500">Protection</p><p class="mt-0.5 font-semibold text-gray-900">MD5 + ré-authentification</p></div>
        </div>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur" :vide="!sauvegardes.length" message-vide="Aucune sauvegarde disponible.">
        <section class="carte overflow-hidden">
            <ul class="divide-y divide-gray-100">
                <li v-for="s in sauvegardes" :key="s.id" class="px-5 py-4 sm:px-6">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="flex min-w-0 items-center gap-3.5">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-100"><i class="fa-solid fa-database text-sm"></i></span>
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h2 class="truncate font-mono text-sm font-semibold text-gray-900">{{ s.nom }}</h2>
                                    <BadgeStatut :statut="s.statut === 'Terminée' ? (s.integrite ? 'Validé' : 'À vérifier') : s.statut === 'Échec' ? 'Échec' : 'En attente'" />
                                </div>
                                <p class="mt-1 text-xs text-gray-400">{{ dateHeure(s.creeLe) }} · {{ s.nbDocuments ?? 0 }} document(s) · {{ s.motif }}</p>
                                <p v-if="s.erreur" class="mt-1 text-xs text-red-600">{{ s.erreur }}</p>
                            </div>
                        </div>
                        <div v-if="s.statut === 'Terminée'" class="flex flex-wrap items-center gap-2">
                            <button class="bouton-secondaire min-h-9 px-3 text-xs" :disabled="envoi" @click="executer('verifierSauvegarde', { id: s.id })"><i class="fa-solid fa-check-double text-[11px]"></i> Vérifier</button>
                            <a :href="lienConsole(s)" target="_blank" rel="noopener noreferrer" class="bouton-secondaire min-h-9 px-3 text-xs">Cloud Storage <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>
                            <span class="mx-1 hidden h-6 w-px bg-gray-200 sm:block"></span>
                            <button
                                :class="['bouton min-h-9 border px-3 text-xs', restauration === s.id ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-200 bg-white text-red-600 hover:bg-red-50']"
                                @click="restauration = restauration === s.id ? null : s.id"
                            ><i class="fa-solid fa-clock-rotate-left text-[11px]"></i> Restaurer</button>
                        </div>
                    </div>
                    <form v-if="restauration === s.id" class="mt-4 grid animate-apparition items-end gap-4 rounded-2xl border border-red-200 bg-red-50/40 p-4 md:grid-cols-3 sm:p-5" @submit.prevent="restaurer(s.id)">
                        <p class="flex items-start gap-2.5 text-xs leading-5 text-red-800 md:col-span-3">
                            <i class="fa-solid fa-triangle-exclamation mt-0.5 text-red-500"></i>
                            <span><strong class="font-semibold">Zone sensible.</strong> Une sauvegarde de précaution est créée automatiquement. Les documents présents dans la sauvegarde remplacent leur version actuelle ; ceux créés depuis ne sont pas supprimés.</span>
                        </p>
                        <label class="etiquette">Mot de passe du compte
                            <input v-model="confirmation.motDePasse" type="password" required autocomplete="current-password" class="champ mt-1.5" />
                        </label>
                        <label class="etiquette">Tapez RESTAURER
                            <input v-model="confirmation.texte" required class="champ mt-1.5 font-mono tracking-wider" />
                        </label>
                        <button class="bouton-danger" :disabled="envoi || confirmation.texte !== 'RESTAURER'">Confirmer la restauration</button>
                    </form>
                </li>
            </ul>
        </section>
    </Chargement>
</template>
