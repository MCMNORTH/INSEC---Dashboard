<script setup lang="ts">
import { STATUTS_CANDIDATURE } from '@shared/domaine';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, ref, watch } from 'vue';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useReferentiel } from '../../referentiel';
import type { Candidature } from '../../types';

const { formation, annee } = useReferentiel();
const statut = ref('');
const page = ref(1);
const { donnees: candidatures, chargement, erreur } = useRequete<Candidature>(() =>
    statut.value
        ? query(collection(db, 'candidatures'), where('statut', '==', statut.value), orderBy('creeLe', 'desc'))
        : query(collection(db, 'candidatures'), orderBy('creeLe', 'desc')),
);
watch(statut, () => (page.value = 1));
const affichees = computed(() => candidatures.value.slice((page.value - 1) * 20, page.value * 20));
</script>

<template>
    <div class="mb-6 flex items-end justify-between">
        <div><p class="text-sm text-gray-500">Admissions</p><h1 class="titre-page">Candidatures</h1></div>
        <a href="/admission" target="_blank" class="bouton-principal">Ouvrir le formulaire public</a>
    </div>
    <select v-model="statut" class="champ mb-4 w-auto" aria-label="Statut">
        <option value="">Tous les statuts</option>
        <option v-for="s in STATUTS_CANDIDATURE" :key="s">{{ s }}</option>
    </select>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl border bg-white">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-gray-500"><tr><th class="p-4 text-left">Référence / candidat</th><th class="p-4 text-left">Diplôme</th><th class="p-4 text-left">Année</th><th class="p-4 text-left">Statut</th><th></th></tr></thead>
                <tbody>
                    <tr v-for="c in affichees" :key="c.id" class="border-t">
                        <td class="p-4"><strong>{{ c.prenom }} {{ c.nom }}</strong><span class="block text-xs text-gray-400">{{ c.reference }} · {{ c.email }}</span></td>
                        <td class="p-4 font-semibold">{{ formation(c.formationId)?.code }}</td>
                        <td class="p-4">{{ annee(c.anneeId)?.libelle }}</td>
                        <td class="p-4"><BadgeStatut :statut="c.statut" /></td>
                        <td class="p-4 text-right"><RouterLink :to="`/candidatures/${c.id}`" class="font-semibold text-insec">Examiner →</RouterLink></td>
                    </tr>
                    <tr v-if="!candidatures.length"><td colspan="5" class="p-10 text-center text-gray-400">Aucune candidature.</td></tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="candidatures.length" :par-page="20" />
    </Chargement>
</template>
