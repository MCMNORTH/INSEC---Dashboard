<script setup lang="ts">
import { montantNet, soldeRestant } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { computed } from 'vue';
import Chargement from '../../composants/Chargement.vue';
import { useDocument, useRequete } from '../../donnees';
import { db } from '../../firebase';
import { dateHeure, montant } from '../../format';
import { useReferentiel } from '../../referentiel';
import { creditsInscrits, creditsValides } from '../../scolarite';
import { session } from '../../session';
import type { Etudiant, Inscription, Resultat } from '../../types';

const { formation, annee, ue } = useReferentiel();
const id = computed(() => session.etudiantId);
const { donnee: etudiant, chargement } = useDocument<Etudiant>(() => (id.value ? `etudiants/${id.value}` : null));
const { donnees: inscriptionsBrutes } = useRequete<Inscription>(() => (id.value ? query(collection(db, 'inscriptions'), where('etudiantId', '==', id.value)) : null));
const { donnees: resultats } = useRequete<Resultat>(() => (id.value ? query(collection(db, 'resultats'), where('etudiantId', '==', id.value)) : null));
const inscriptions = computed(() => [...inscriptionsBrutes.value].sort((a, b) => b.ordre - a.ordre));
const examensAVenir = computed(() =>
    resultats.value.filter((r) => r.dateExamen.toMillis() > Date.now()).sort((a, b) => a.dateExamen.toMillis() - b.dateExamen.toMillis()),
);
</script>

<template>
    <div v-if="!id" class="carte p-8 text-center text-gray-500">Aucun dossier étudiant n’est rattaché à ce compte.</div>
    <Chargement v-else :chargement="chargement" :vide="!etudiant" message-vide="Dossier étudiant introuvable.">
        <template v-if="etudiant">
            <h1 class="titre-page">Bonjour {{ etudiant.prenom }}</h1>
            <p class="mb-6 text-gray-500">Votre parcours INSEC / INTEC-CNAM</p>
            <div class="mb-7 grid gap-4 md:grid-cols-3">
                <div class="carte p-4"><p class="text-xs text-gray-500">Statut</p><strong>{{ etudiant.statut }}</strong></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Inscriptions</p><strong>{{ inscriptions.length }}</strong></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Examens à venir</p><strong>{{ examensAVenir.length }}</strong></div>
            </div>
            <h2 class="mb-3 font-bold text-insec">Mes inscriptions</h2>
            <div class="space-y-4">
                <section v-for="i in inscriptions" :key="i.id" class="carte p-5">
                    <div class="flex justify-between">
                        <div>
                            <strong>{{ formation(i.formationId)?.code }} · {{ annee(i.anneeId)?.libelle }}</strong>
                            <p class="text-sm text-gray-500">Année {{ i.anneeParcours }} · N° INTEC {{ i.numeroIntec || '—' }}</p>
                        </div>
                        <span class="text-sm">{{ creditsValides(i.id, resultats, ue) }}/{{ creditsInscrits(i.ueIds, ue) }} ECTS</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <span v-for="u in i.ueIds" :key="u" class="rounded bg-blue-50 px-2 py-1 text-xs text-blue-800">{{ ue(u)?.code ?? u }}</span>
                    </div>
                    <div class="mt-4 grid gap-2 border-t pt-3 text-sm md:grid-cols-3">
                        <div>Montant net : <strong>{{ montant(montantNet(i)) }} MRU</strong></div>
                        <div>Payé : <strong>{{ montant(i.totalVerse) }} MRU</strong></div>
                        <div>Solde : <strong :class="soldeRestant(i) > 0 ? 'text-red-600' : 'text-green-600'">{{ montant(soldeRestant(i)) }} MRU</strong></div>
                    </div>
                </section>
            </div>
            <h2 class="mt-7 mb-3 font-bold text-insec">Mes prochains examens</h2>
            <div class="carte divide-y">
                <div v-for="r in examensAVenir" :key="r.id" class="flex justify-between gap-3 p-4">
                    <div>
                        <strong>{{ ue(r.ueId)?.code }} — {{ ue(r.ueId)?.libelle }}</strong>
                        <p class="text-sm text-gray-500">{{ r.session }} · {{ r.salle || 'Lieu à confirmer' }}</p>
                    </div>
                    <strong class="whitespace-nowrap">{{ dateHeure(r.dateExamen) }}</strong>
                </div>
                <p v-if="!examensAVenir.length" class="p-5 text-gray-500">Aucun examen à venir.</p>
            </div>
        </template>
    </Chargement>
</template>
