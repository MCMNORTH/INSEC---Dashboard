<script setup lang="ts">
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { computed, shallowRef, watch } from 'vue';
import { messageErreur } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { useDocument, useRequete } from '../../donnees';
import { db } from '../../firebase';
import { dateHeure } from '../../format';
import { useReferentiel } from '../../referentiel';
import { session } from '../../session';
import type { Affectation, Enseignant, Examen } from '../../types';

const { ue, formation } = useReferentiel();
const id = computed(() => session.enseignantId);
const { donnee: enseignant, chargement } = useDocument<Enseignant>(() => (id.value ? `enseignants/${id.value}` : null));
const { donnees: affectations } = useRequete<Affectation>(() => (id.value ? query(collection(db, 'affectations'), where('enseignantId', '==', id.value)) : null));
const examens = shallowRef<Examen[]>([]);
const erreur = shallowRef('');

// Firestore limite l'opérateur « in » à 30 valeurs : requêtes par paquets.
watch(affectations, async (liste) => {
    const ueIds = liste.map((a) => a.ueId);
    try {
        const paquets = await Promise.all(
            Array.from({ length: Math.ceil(ueIds.length / 30) }, (_, n) =>
                getDocs(query(collection(db, 'examens'), where('ueId', 'in', ueIds.slice(n * 30, n * 30 + 30)), orderBy('dateExamen', 'desc'))),
            ),
        );
        examens.value = paquets.flatMap((p) => p.docs.map((d) => ({ id: d.id, ...d.data() }) as Examen))
            .sort((a, b) => b.dateExamen.toMillis() - a.dateExamen.toMillis());
    } catch (e) {
        erreur.value = messageErreur(e);
    }
});
</script>

<template>
    <div v-if="!id" class="carte p-8 text-center text-gray-500">Aucun dossier enseignant n’est rattaché à ce compte.</div>
    <Chargement v-else :chargement="chargement" :erreur="erreur" :vide="!enseignant" message-vide="Dossier enseignant introuvable.">
        <template v-if="enseignant">
            <h1 class="titre-page">Bonjour {{ enseignant.prenom }} {{ enseignant.nom }}</h1>
            <p class="mb-6 text-gray-500">{{ enseignant.specialite }}</p>
            <h2 class="mb-3 font-bold text-insec">Mes UE</h2>
            <div class="mb-7 grid gap-4 md:grid-cols-3">
                <div v-for="a in affectations" :key="a.id" class="carte p-4">
                    <strong>{{ ue(a.ueId)?.code }}</strong>
                    <p>{{ ue(a.ueId)?.libelle }}</p>
                    <p class="text-xs text-gray-500">{{ formation(ue(a.ueId)?.formationId)?.code }} · {{ a.nombreEtudiants }} étudiants</p>
                </div>
                <p v-if="!affectations.length" class="text-gray-500">Aucune UE affectée.</p>
            </div>
            <h2 class="mb-3 font-bold text-insec">Examens de mes UE</h2>
            <div class="overflow-x-auto rounded-xl bg-white shadow">
                <table class="tableau">
                    <thead><tr><th>UE</th><th>Date</th><th>Session</th><th>Étudiants</th></tr></thead>
                    <tbody>
                        <tr v-for="e in examens" :key="e.id">
                            <td>{{ ue(e.ueId)?.code }} · {{ ue(e.ueId)?.libelle }}</td>
                            <td>{{ dateHeure(e.dateExamen) }}</td>
                            <td>{{ e.session }}</td>
                            <td>{{ e.nbConvoques }}</td>
                        </tr>
                        <tr v-if="!examens.length"><td colspan="4" class="p-6 text-center text-gray-500">Aucun examen.</td></tr>
                    </tbody>
                </table>
            </div>
        </template>
    </Chargement>
</template>
