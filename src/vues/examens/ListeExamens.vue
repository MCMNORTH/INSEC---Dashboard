<script setup lang="ts">
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Chargement from '../../composants/Chargement.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { dateHeureParis } from '../../format';
import { useReferentiel } from '../../referentiel';
import type { Examen } from '../../types';

const router = useRouter();
const { annees, annee, ue, formation } = useReferentiel();
const anneeId = ref('');
const page = ref(1);
const PAR_PAGE = 15;
const { donnees: examens, chargement, erreur } = useRequete<Examen>(() =>
    anneeId.value
        ? query(collection(db, 'examens'), where('anneeId', '==', anneeId.value), orderBy('dateExamen', 'desc'))
        : query(collection(db, 'examens'), orderBy('dateExamen', 'desc')),
);
watch(anneeId, () => (page.value = 1));
const affiches = computed(() => examens.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE));
</script>

<template>
    <div class="mb-5 flex flex-wrap justify-between gap-3">
        <div>
            <h1 class="text-xl font-bold text-insec">Examens & résultats</h1>
            <p class="text-sm text-gray-500">Planification, convocations et validation des UE</p>
        </div>
        <RouterLink to="/examens/nouveau" class="bouton-action">+ Planifier un examen</RouterLink>
    </div>
    <div class="carte mb-4 p-3">
        <select v-model="anneeId" class="champ w-auto" aria-label="Année académique">
            <option value="">Toutes les années</option>
            <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
        </select>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl bg-white shadow">
            <table class="tableau">
                <thead><tr><th>Date et heure (Paris)</th><th>Diplôme / UE</th><th>Session</th><th>Salle</th><th>Convoqués</th><th>Statut</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer hover:bg-gray-50" @click="router.push(`/examens/${e.id}`)">
                        <td>{{ dateHeureParis(e.dateExamen) }}</td>
                        <td><strong>{{ formation(e.formationId)?.code }} · {{ ue(e.ueId)?.code }}</strong><br /><span class="text-gray-500">{{ ue(e.ueId)?.libelle }}</span></td>
                        <td>{{ e.session }}<br /><span class="text-xs text-gray-500">{{ annee(e.anneeId)?.libelle }}</span></td>
                        <td>{{ e.salle || '—' }}</td>
                        <td>{{ e.nbConvoques }}</td>
                        <td>{{ e.statut }}</td>
                    </tr>
                    <tr v-if="!examens.length">
                        <td colspan="6" class="p-0">
                            <div class="flex flex-col items-center px-6 py-10 text-center">
                                <i class="fa-solid fa-calendar-check mb-4 text-2xl text-insec" aria-hidden="true"></i>
                                <h2 class="font-semibold text-gray-800">{{ anneeId ? 'Aucun examen pour cette année scolaire' : 'Aucune session planifiée' }}</h2>
                                <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                                    Après la planification, la fiche de chaque épreuve permet de suivre la réception des sujets,
                                    la confirmation de la salle et de la surveillance, puis le retour des copies à l’INTEC.
                                </p>
                                <RouterLink to="/examens/nouveau" class="bouton-action mt-5">+ Planifier un examen</RouterLink>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="examens.length" :par-page="PAR_PAGE" />
    </Chargement>
</template>
