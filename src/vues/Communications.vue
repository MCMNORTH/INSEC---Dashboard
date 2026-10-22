<script setup lang="ts">
import { STATUTS_EMAIL } from '@shared/domaine';
import { collection, getCountFromServer, orderBy, query, where } from 'firebase/firestore';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import BadgeStatut from '../composants/BadgeStatut.vue';
import Chargement from '../composants/Chargement.vue';
import Pagination from '../composants/Pagination.vue';
import { useRequete } from '../donnees';
import { db } from '../firebase';
import { dateHeure } from '../format';
import type { JournalEmail } from '../types';

const statut = ref('');

/** Traduit les erreurs SMTP courantes en consigne compréhensible. */
function explicationErreur(erreur: string): string {
    if (/535|Invalid login|authentication/i.test(erreur)) return 'Mot de passe de la messagerie refusé par le serveur : mettez à jour le secret SMTP_PASSWORD. (' + erreur + ')';
    if (/SMTP_HOST/.test(erreur)) return 'Aucun serveur d’envoi configuré. (' + erreur + ')';
    if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(erreur)) return 'Serveur de messagerie injoignable. (' + erreur + ')';
    return erreur;
}
const page = ref(1);
const { donnees: journaux, chargement, erreur } = useRequete<JournalEmail>(() =>
    statut.value
        ? query(collection(db, 'journalEmails'), where('statut', '==', statut.value), orderBy('creeLe', 'desc'))
        : query(collection(db, 'journalEmails'), orderBy('creeLe', 'desc')),
);
watch(statut, () => (page.value = 1));
const affiches = computed(() => journaux.value.slice((page.value - 1) * 30, page.value * 30));

const stats = reactive<Record<string, number>>({});
async function compter() {
    for (const s of STATUTS_EMAIL) stats[s] = (await getCountFromServer(query(collection(db, 'journalEmails'), where('statut', '==', s)))).data().count;
}
onMounted(compter);
watch(journaux, compter);
const couleurs: Record<string, string> = { Envoyé: 'bg-emerald-50 text-emerald-600', Échec: 'bg-red-50 text-red-600', 'En attente': 'bg-amber-50 text-amber-600' };
</script>

<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Traçabilité</p>
            <h1 class="titre-page mt-1.5">Communications par e-mail</h1>
            <p class="sous-titre">
                Les factures se préparent dans Finances, les reçus après validation d’un versement et les convocations depuis la fiche d’examen.
                Chaque PDF est joint au message; son envoi et son résultat sont suivis ici.
            </p>
        </div>
    </header>
    <section class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
            v-for="s in STATUTS_EMAIL"
            :key="s"
            type="button"
            :class="['carte flex cursor-pointer items-center justify-between gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-flottant', statut === s && 'ring-2 ring-insec-500/40']"
            @click="statut = statut === s ? '' : s"
        >
            <span>
                <span class="block text-[13px] font-medium text-gray-500">{{ s }}</span>
                <span class="mt-2 block font-titre text-[1.75rem] leading-none font-bold tracking-tight text-gray-900 tabular-nums">{{ stats[s] ?? 0 }}</span>
            </span>
            <span :class="['flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/5 ring-inset', couleurs[s]]">
                <i :class="['fa-solid text-sm', s === 'Envoyé' ? 'fa-paper-plane' : s === 'Échec' ? 'fa-circle-exclamation' : 'fa-hourglass-half']"></i>
            </span>
        </button>
    </section>
    <div class="carte mb-4 flex flex-wrap items-center gap-3 p-3">
        <label class="flex items-center gap-2 text-sm text-gray-500">
            <i class="fa-solid fa-filter text-xs text-gray-400"></i>
            <select v-model="statut" class="champ w-auto" aria-label="Statut">
                <option value="">Tous les statuts</option>
                <option v-for="s in STATUTS_EMAIL" :key="s">{{ s }}</option>
            </select>
        </label>
        <span class="ml-auto text-xs text-gray-400">{{ journaux.length }} e-mail(s)</span>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="carte overflow-x-auto">
            <table class="tableau">
                <thead><tr><th>Date</th><th>Destinataire</th><th>Type / sujet</th><th>Statut</th></tr></thead>
                <tbody>
                    <tr v-for="j in affiches" :key="j.id">
                        <td class="whitespace-nowrap text-gray-500">{{ dateHeure(j.creeLe) }}</td>
                        <td><strong class="font-semibold text-gray-900">{{ j.nomDestinataire || '—' }}</strong><span class="block text-xs text-gray-400">{{ j.destinataire }}</span></td>
                        <td>
                            <span class="text-[11px] font-semibold tracking-wide text-insec-500 uppercase">{{ j.type }}</span>
                            <span class="block text-gray-800">{{ j.sujet }}</span>
                            <span v-if="j.nomPieceJointe" class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500"><i class="fa-solid fa-paperclip text-[10px]"></i>{{ j.nomPieceJointe }}</span>
                        </td>
                        <td>
                            <BadgeStatut :statut="j.statut" />
                            <p v-if="j.erreur" class="mt-1.5 max-w-xs text-xs text-red-600">{{ explicationErreur(j.erreur) }}</p>
                        </td>
                    </tr>
                    <tr v-if="!journaux.length">
                        <td colspan="4" class="py-14 text-center">
                            <i class="fa-regular fa-envelope text-2xl text-gray-300"></i>
                            <p class="mt-2 text-sm text-gray-500">Aucun e-mail enregistré.</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="journaux.length" :par-page="30" />
    </Chargement>
</template>
