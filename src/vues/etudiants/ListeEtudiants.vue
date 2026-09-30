<script setup lang="ts">
import { collection, orderBy, query } from 'firebase/firestore';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { appeler } from '../../api';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import ModaleConfirmation from '../../composants/ModaleConfirmation.vue';
import Pagination from '../../composants/Pagination.vue';
import { useRequete } from '../../donnees';
import { db } from '../../firebase';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Etudiant } from '../../types';

const router = useRouter();
const { formationsActives, annees, formation, annee } = useReferentiel();
const { donnees: etudiants, chargement, erreur } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const recherche = ref('');
const formationId = ref('');
const anneeId = ref('');
const page = ref(1);
const PAR_PAGE = 10;

const normaliser = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const filtres = computed(() => {
    const terme = normaliser(recherche.value.trim());
    return etudiants.value.filter((e) =>
        (!terme || [e.nom, e.prenom, e.email].some((v) => normaliser(v ?? '').includes(terme)))
        && (!formationId.value || e.formationIds?.includes(formationId.value))
        && (!anneeId.value || e.anneeIds?.includes(anneeId.value)),
    );
});
const affiches = computed(() => filtres.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE));
watch([recherche, formationId, anneeId], () => (page.value = 1));

const aSupprimer = ref<Etudiant | null>(null);
const { envoi, soumettre } = useFormulaire();
async function supprimer() {
    const cible = aSupprimer.value;
    if (!cible) return;
    const resultat = await soumettre(() => appeler('supprimerEtudiant', { id: cible.id }));
    aSupprimer.value = null;
    if (resultat) notifier(resultat.message ?? 'Étudiant supprimé.');
}
</script>

<template>
    <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-insec">Gestion des étudiants</h1>
        <RouterLink to="/etudiants/nouveau" class="bouton-action">+ Nouvel étudiant</RouterLink>
    </div>
    <div class="mb-4 flex flex-wrap gap-2">
        <input v-model="recherche" type="search" placeholder="Rechercher un étudiant…" class="champ min-w-[200px] flex-1" aria-label="Rechercher" />
        <select v-model="formationId" class="champ w-auto" aria-label="Formation">
            <option value="">Formation</option>
            <option v-for="f in formationsActives" :key="f.id" :value="f.id">{{ f.nom }}</option>
        </select>
        <select v-model="anneeId" class="champ w-auto" aria-label="Année">
            <option value="">Année</option>
            <option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option>
        </select>
    </div>
    <Chargement :chargement="chargement" :erreur="erreur">
        <div class="overflow-x-auto rounded-xl bg-white shadow">
            <table class="tableau">
                <thead><tr><th>Nom & prénom</th><th>E-mail</th><th>Formation</th><th>Année</th><th>Statut</th><th class="text-right">Actions</th></tr></thead>
                <tbody>
                    <tr v-for="e in affiches" :key="e.id" class="cursor-pointer hover:bg-gray-50" @click="router.push(`/etudiants/${e.id}`)">
                        <td class="font-medium text-gray-800">{{ e.nom }} {{ e.prenom }}</td>
                        <td class="text-gray-600">{{ e.email }}</td>
                        <td class="text-gray-600">{{ formation(e.derniere?.formationId)?.nom ?? '-' }}</td>
                        <td class="text-gray-600">{{ annee(e.derniere?.anneeId)?.libelle ?? '-' }}</td>
                        <td><BadgeStatut :statut="e.statut" /></td>
                        <td class="text-right whitespace-nowrap" @click.stop>
                            <RouterLink :to="`/etudiants/${e.id}/modifier`" class="mr-3 text-gray-400 hover:text-blue-600" title="Modifier"><i class="fa-solid fa-pen"></i></RouterLink>
                            <button class="cursor-pointer text-gray-400 hover:text-red-600" title="Supprimer" @click="aSupprimer = e"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                    <tr v-if="!filtres.length"><td colspan="6" class="text-center text-gray-400">Aucun étudiant trouvé.</td></tr>
                </tbody>
            </table>
        </div>
        <Pagination v-model="page" :total="filtres.length" :par-page="PAR_PAGE" />
    </Chargement>
    <ModaleConfirmation
        :ouverte="!!aSupprimer"
        :envoi="envoi"
        :message="`Voulez-vous vraiment supprimer ${aSupprimer?.nom} ${aSupprimer?.prenom} ? Cette action est irréversible.`"
        @annuler="aSupprimer = null"
        @confirmer="supprimer"
    />
</template>
