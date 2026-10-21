<script setup lang="ts">
import { collection, orderBy, query } from 'firebase/firestore';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import ModaleConfirmation from '../../composants/ModaleConfirmation.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import type { Enseignant } from '../../types';

const router = useRouter();
const { donnees: enseignants, chargement, erreur } = useRequete<Enseignant>(() => query(collection(db, 'enseignants'), orderBy('nom')));
const page = ref(1);
const affiches = computed(() => enseignants.value.slice((page.value - 1) * 10, page.value * 10));
const aSupprimer = ref<Enseignant | null>(null);
const { envoi, soumettre } = useFormulaire();

async function supprimer() {
    const cible = aSupprimer.value;
    if (!cible) return;
    const resultat = await soumettre(() => appeler('supprimerEnseignant', { id: cible.id }));
    aSupprimer.value = null;
    if (resultat) notifier(resultat.message ?? 'Enseignant supprimé.');
}
</script>

<template>
    <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-insec">Gestion des enseignants</h1>
        <RouterLink to="/enseignants/nouveau" class="bouton-action">+ Nouvel enseignant</RouterLink>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl bg-white shadow">
            <table class="tableau">
                <thead><tr><th>Nom &amp; prénom</th><th>Spécialité</th><th>UE affectées</th><th>Étudiants</th><th class="w-20">Actions</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer hover:bg-gray-50" @click="router.push(`/enseignants/${e.id}`)">
                        <td class="text-gray-900">{{ e.nom }} {{ e.prenom }}</td>
                        <td class="text-gray-700">{{ e.specialite }}</td>
                        <td><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">{{ e.nbUe ?? 0 }}</span></td>
                        <td><span class="inline-flex h-6 items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-medium text-blue-700">{{ e.nbEtudiants ?? 0 }}</span></td>
                        <td class="text-right whitespace-nowrap" @click.stop>
                            <RouterLink :to="`/enseignants/${e.id}/modifier`" class="mr-3 text-gray-400 hover:text-blue-600" title="Modifier"><i class="fa-solid fa-pen"></i></RouterLink>
                            <button class="cursor-pointer text-gray-400 hover:text-red-600" title="Supprimer" @click="aSupprimer = e"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                    <tr v-if="!enseignants.length"><td colspan="5" class="p-6 text-center text-gray-400">Aucun enseignant trouvé.</td></tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="enseignants.length" :par-page="10" />
    </Chargement>
    <ModaleConfirmation
        :ouverte="!!aSupprimer"
        :envoi="envoi"
        :message="`Voulez-vous vraiment supprimer ${aSupprimer?.nom} ${aSupprimer?.prenom} ? Ses affectations seront retirées.`"
        @annuler="aSupprimer = null"
        @confirmer="supprimer"
    />
</template>
