<script setup lang="ts">
import { montantNet, soldeRestant } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { computed } from 'vue';
import BadgeStatut from '../../composants/BadgeStatut.vue';
import Chargement from '../../composants/Chargement.vue';
import { useDocument, useRequete } from '../../donnees';
import { db } from '../../firebase';
import { date, montant } from '../../format';
import { useReferentiel } from '../../referentiel';
import { creditsInscrits, creditsValides } from '../../scolarite';
import type { Etudiant, Inscription, Resultat } from '../../types';

const props = defineProps<{ id: string }>();
const { formation, annee, annees, ue } = useReferentiel();
const { donnee: etudiant, chargement } = useDocument<Etudiant>(() => `etudiants/${props.id}`);
const { donnees: inscriptionsBrutes } = useRequete<Inscription>(() => query(collection(db, 'inscriptions'), where('etudiantId', '==', props.id)));
const { donnees: resultats } = useRequete<Resultat>(() => query(collection(db, 'resultats'), where('etudiantId', '==', props.id)));
const inscriptions = computed(() => [...inscriptionsBrutes.value].sort((a, b) => b.ordre - a.ordre));
const situationAnnuelle = computed(() => annees.value
    .map((a) => {
        const inscriptionsAnnee = inscriptions.value.filter((i) => i.anneeId === a.id);
        const active = inscriptionsAnnee.some((i) => i.statut === 'active');
        const suspendue = inscriptionsAnnee.some((i) => i.statut === 'suspendue');
        const annulee = inscriptionsAnnee.length > 0 && inscriptionsAnnee.every((i) => i.statut === 'annulée');
        return {
            ...a,
            inscriptions: inscriptionsAnnee,
            statut: active ? 'active' : suspendue ? 'suspendue' : annulee ? 'annulée' : inscriptionsAnnee.length ? 'terminee' : 'absente',
        };
    })
    .sort((a, b) => b.libelle.localeCompare(a.libelle)));
const nbAnneesActives = computed(() => situationAnnuelle.value.filter((a) => a.statut === 'active').length);


const progression = (i: Inscription) => {
    const total = creditsInscrits(i.ueIds, ue);
    const valides = creditsValides(i.id, resultats.value, ue);
    return { total, valides, pourcentage: total > 0 ? Math.min(100, Math.round((valides * 100) / total)) : 0 };
};
</script>

<template>
    <RouterLink to="/etudiants" class="text-sm text-gray-500">← Retour à la liste</RouterLink>
    <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
        <template v-if="etudiant">
            <section class="carte mt-4 p-6">
                <div class="flex flex-wrap justify-between gap-4">
                    <div>
                        <h1 class="text-lg font-bold text-insec">{{ etudiant.prenom }} {{ etudiant.nom }}</h1>
                        <BadgeStatut :statut="etudiant.statut" />
                        <p class="mt-2 text-sm text-gray-500">E-mail : {{ etudiant.email || '—' }} · Téléphone : {{ etudiant.telephone || '—' }}</p>
                        <p class="mt-1 text-sm text-gray-500">Date de naissance : {{ date(etudiant.dateNaissance) }}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <RouterLink :to="`/etudiants/${id}/documents`" class="bouton bg-blue-50 text-blue-800">Dossier documentaire</RouterLink>
                        <RouterLink :to="`/etudiants/${id}/modifier`" class="bouton bg-gray-100">Modifier l’identité</RouterLink>
                        <RouterLink :to="`/etudiants/${id}/inscriptions/nouvelle`" class="bouton-action">Nouvelle inscription</RouterLink>
                    </div>
                </div>
            </section>

            <section class="mt-8">
                <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 class="text-lg font-bold text-insec">Situation par année scolaire</h2>
                        <p class="mt-1 text-sm text-gray-500">{{ nbAnneesActives }} année(s) avec une inscription active à l’INSEC.</p>
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <article v-for="a in situationAnnuelle" :key="a.id" class="carte p-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="font-semibold text-gray-900">{{ a.libelle }}</h3>
                            <span
                                v-if="a.statut === 'active'"
                                class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                            >Inscrit à l’INSEC</span>
                            <span
                                v-else-if="a.statut === 'suspendue'"
                                class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                            >Inscription suspendue</span>
                            <span
                                v-else-if="a.statut === 'annulée'"
                                class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                            >Inscription annulée</span>
                            <span
                                v-else-if="a.statut === 'terminee'"
                                class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                            >Inscription terminée</span>
                            <span v-else class="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">Non inscrit</span>
                        </div>
                        <div v-if="a.inscriptions.length" class="mt-3 space-y-1">
                            <p v-for="i in a.inscriptions" :key="i.id" class="text-sm text-gray-600">
                                {{ formation(i.formationId)?.code ?? 'Formation inconnue' }} · année {{ i.anneeParcours }}
                            </p>
                        </div>
                        <p v-else class="mt-3 text-sm text-gray-400">Aucune inscription enregistrée pour cette année.</p>
                    </article>
                    <div v-if="!situationAnnuelle.length" class="carte p-4 text-sm text-gray-500">
                        Aucune année scolaire n’est encore définie dans le référentiel.
                    </div>
                </div>
            </section>

            <h2 class="mt-8 mb-3 text-lg font-bold text-insec">Détail des inscriptions</h2>
            <div class="space-y-4">
                <article v-for="i in inscriptions" :key="i.id" class="carte p-5">
                    <div class="flex justify-between gap-3">
                        <div>
                            <h3 class="font-semibold text-insec">{{ formation(i.formationId)?.code }} — {{ annee(i.anneeId)?.libelle }}</h3>
                            <p class="text-sm text-gray-500">Année {{ i.anneeParcours }} · {{ i.statut.charAt(0).toUpperCase() + i.statut.slice(1) }} · N° INTEC {{ i.numeroIntec || '—' }}</p>
                        </div>
                        <RouterLink :to="`/inscriptions/${i.id}/modifier`" class="text-sm text-blue-700">Modifier</RouterLink>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <span v-for="ueId in i.ueIds" :key="ueId" class="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">{{ ue(ueId)?.code ?? ueId }} · {{ ue(ueId)?.libelle }}</span>
                        <span v-if="!i.ueIds.length" class="text-sm text-amber-700">Aucune UE renseignée.</span>
                    </div>
                    <div class="mt-4 border-t pt-3 text-sm">
                        <strong>Finances :</strong> {{ montant(i.totalVerse) }} / {{ montant(montantNet(i)) }} MRU · Solde {{ montant(soldeRestant(i)) }} MRU
                        <RouterLink :to="{ path: '/finances', query: { etudiant: id, inscription: i.id } }" class="ml-2 text-blue-700">Ouvrir le dossier financier</RouterLink>
                    </div>
                </article>
                <div v-if="!inscriptions.length" class="carte p-6 text-gray-500">Aucune inscription.</div>
            </div>

            <section class="mt-8">
                <h2 class="mb-3 text-lg font-bold text-insec">Progression académique</h2>
                <div class="grid gap-4 md:grid-cols-2">
                    <div v-for="i in inscriptions" :key="i.id" class="carte p-4">
                        <div class="flex justify-between gap-3">
                            <strong>{{ formation(i.formationId)?.code }} · {{ annee(i.anneeId)?.libelle }}</strong>
                            <span class="text-sm text-gray-500">{{ progression(i).valides }}/{{ progression(i).total }} ECTS</span>
                        </div>
                        <div class="mt-3 h-2 rounded bg-gray-200"><div class="h-2 rounded bg-green-500" :style="{ width: `${progression(i).pourcentage}%` }"></div></div>
                        <p class="mt-2 text-xs text-gray-500">{{ progression(i).pourcentage }} % des crédits des UE inscrites sont validés.</p>
                    </div>
                </div>
            </section>
        </template>
    </Chargement>
</template>
