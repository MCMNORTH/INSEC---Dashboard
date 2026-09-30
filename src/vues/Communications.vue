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
const couleurs: Record<string, string> = { Envoyé: 'bg-green-50 text-green-700', Échec: 'bg-red-50 text-red-700', 'En attente': 'bg-amber-50 text-amber-700' };
</script>

<template>
    <div class="mb-6"><p class="text-sm text-gray-500">Traçabilité</p><h1 class="titre-page">Communications par e-mail</h1></div>
    <section class="mb-6 grid grid-cols-3 gap-4">
        <div v-for="s in STATUTS_EMAIL" :key="s" :class="[couleurs[s], 'rounded-xl border border-white p-4']">
            <p class="text-2xl font-bold">{{ stats[s] ?? 0 }}</p>
            <p class="text-sm text-gray-500">{{ s }}</p>
        </div>
    </section>
    <select v-model="statut" class="champ mb-4 w-auto" aria-label="Statut">
        <option value="">Tous les statuts</option>
        <option v-for="s in STATUTS_EMAIL" :key="s">{{ s }}</option>
    </select>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl border bg-white">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-500"><tr><th class="p-4 text-left">Date</th><th class="p-4 text-left">Destinataire</th><th class="p-4 text-left">Type / sujet</th><th class="p-4 text-left">Statut</th></tr></thead>
                <tbody>
                    <tr v-for="j in affiches" :key="j.id" class="border-t">
                        <td class="p-4 whitespace-nowrap">{{ dateHeure(j.creeLe) }}</td>
                        <td class="p-4"><strong>{{ j.nomDestinataire || '—' }}</strong><span class="block text-xs text-gray-400">{{ j.destinataire }}</span></td>
                        <td class="p-4"><span class="text-xs text-gray-400">{{ j.type }}</span><span class="block">{{ j.sujet }}</span></td>
                        <td class="p-4">
                            <BadgeStatut :statut="j.statut" />
                            <span v-if="j.erreur" :title="j.erreur" class="ml-2 cursor-help text-red-500"><i class="fa-solid fa-circle-info"></i></span>
                        </td>
                    </tr>
                    <tr v-if="!journaux.length"><td colspan="4" class="p-10 text-center text-gray-400">Aucun e-mail enregistré.</td></tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="journaux.length" :par-page="30" />
    </Chargement>
</template>
