<script setup lang="ts">
import { montantNet, soldeRestant, statutPaiement } from '@shared/domaine';
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
    <RouterLink to="/etudiants" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour à la liste</RouterLink>
    <Chargement :chargement="chargement" :vide="!etudiant" message-vide="Étudiant introuvable.">
        <template v-if="etudiant">
            <section class="carte relative overflow-hidden">
                <div class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-r from-insec-900 via-insec-700 to-insec-500"></div>
                <div class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(60%_120%_at_100%_0%,rgb(224_26_46/0.25),transparent_70%)]"></div>
                <div class="relative px-5 pt-10 pb-5 sm:px-7">
                    <span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-insec-500 to-insec-900 font-titre text-2xl font-bold text-white shadow-lg ring-4 ring-white">
                            {{ `${etudiant.prenom?.[0] ?? ''}${etudiant.nom?.[0] ?? ''}`.toUpperCase() }}
                    </span>
                    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="titre-page truncate">{{ etudiant.prenom }} {{ etudiant.nom }}</h1>
                                <BadgeStatut :statut="etudiant.statut" />
                            </div>
                            <div class="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                                <span class="inline-flex items-center gap-1.5"><i class="fa-regular fa-envelope text-xs text-gray-400"></i>{{ etudiant.email || '—' }}</span>
                                <span class="inline-flex items-center gap-1.5"><i class="fa-solid fa-phone text-xs text-gray-400"></i>{{ etudiant.telephone || '—' }}</span>
                                <span class="inline-flex items-center gap-1.5"><i class="fa-regular fa-calendar text-xs text-gray-400"></i>Né(e) le {{ date(etudiant.dateNaissance) }}</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                        <RouterLink :to="`/etudiants/${id}/documents`" class="bouton-secondaire"><i class="fa-regular fa-folder-open text-xs"></i> Dossier documentaire</RouterLink>
                        <RouterLink :to="`/etudiants/${id}/modifier`" class="bouton-secondaire"><i class="fa-solid fa-pen text-xs"></i> Modifier l’identité</RouterLink>
                        <RouterLink :to="`/etudiants/${id}/inscriptions/nouvelle`" class="bouton-action"><i class="fa-solid fa-plus text-xs"></i> Nouvelle inscription</RouterLink>
                        </div>
                    </div>
                </div>
            </section>

            <section class="mt-8">
                <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 class="titre-section">Situation par année scolaire</h2>
                        <p class="mt-0.5 text-sm text-gray-500">{{ nbAnneesActives }} année(s) avec une inscription active à l’INSEC.</p>
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <article v-for="a in situationAnnuelle" :key="a.id" class="carte p-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h3 class="font-titre text-[15px] font-bold text-gray-900">{{ a.libelle }}</h3>
                            <span v-if="a.statut === 'active'" class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Inscrit à l’INSEC</span>
                            <span v-else-if="a.statut === 'suspendue'" class="pastille bg-amber-50 text-amber-800 ring-amber-600/20"><span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>Inscription suspendue</span>
                            <span v-else-if="a.statut === 'annulée'" class="pastille bg-gray-50 text-gray-600 ring-gray-500/15"><span class="h-1.5 w-1.5 rounded-full bg-gray-400"></span>Inscription annulée</span>
                            <span v-else-if="a.statut === 'terminee'" class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><span class="h-1.5 w-1.5 rounded-full bg-insec-500"></span>Inscription terminée</span>
                            <span v-else class="pastille bg-white text-gray-500 ring-gray-200">Non inscrit</span>
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

            <section class="mt-8">
                <h2 class="titre-section mb-3">Détail des inscriptions</h2>
                <div class="space-y-4">
                    <article v-for="i in inscriptions" :key="i.id" class="carte overflow-hidden">
                        <header class="panneau-entete">
                            <div class="flex items-center gap-3">
                                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-insec-50 font-titre text-xs font-bold text-insec-700 ring-1 ring-insec-100">{{ formation(i.formationId)?.code }}</span>
                                <div class="min-w-0">
                                    <h3 class="titre-section">{{ formation(i.formationId)?.code }} — {{ annee(i.anneeId)?.libelle }}</h3>
                                    <p class="text-xs text-gray-500">Année {{ i.anneeParcours }} · {{ i.statut.charAt(0).toUpperCase() + i.statut.slice(1) }} · N° INTEC {{ i.numeroIntec || '—' }}</p>
                                </div>
                            </div>
                            <RouterLink :to="`/inscriptions/${i.id}/modifier`" class="bouton-secondaire min-h-9 px-3 text-xs"><i class="fa-solid fa-pen text-[11px]"></i> Modifier</RouterLink>
                        </header>
                        <div class="px-5 py-4 sm:px-6">
                            <div class="flex flex-wrap gap-2">
                                <span v-for="ueId in i.ueIds" :key="ueId" class="pastille bg-insec-50 py-1 text-insec-800 ring-insec-600/15"><strong class="font-semibold">{{ ue(ueId)?.code ?? ueId }}</strong> {{ ue(ueId)?.libelle }}</span>
                                <span v-if="!i.ueIds.length" class="pastille bg-amber-50 text-amber-800 ring-amber-600/20"><i class="fa-solid fa-triangle-exclamation text-[10px]"></i>Aucune UE renseignée.</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-sm sm:px-6">
                            <span class="text-gray-600">
                                <i class="fa-solid fa-coins mr-1.5 text-xs text-gray-400"></i>
                                <strong class="font-semibold text-gray-900 tabular-nums">{{ montant(i.totalVerse) }}</strong> / {{ montant(montantNet(i)) }} MRU · Solde <strong class="font-semibold text-gray-900 tabular-nums">{{ montant(soldeRestant(i)) }} MRU</strong>
                                <BadgeStatut :statut="statutPaiement(i)" class="ml-2" />
                            </span>
                            <RouterLink :to="{ path: '/finances', query: { etudiant: id, inscription: i.id } }" class="lien inline-flex items-center gap-1.5 text-sm">Ouvrir le dossier financier <i class="fa-solid fa-arrow-right text-[10px]"></i></RouterLink>
                        </div>
                    </article>
                    <div v-if="!inscriptions.length" class="carte p-6 text-sm text-gray-500">Aucune inscription.</div>
                </div>
            </section>

            <section class="mt-8">
                <h2 class="titre-section mb-3">Progression académique</h2>
                <div class="grid gap-4 md:grid-cols-2">
                    <div v-for="i in inscriptions" :key="i.id" class="carte p-5">
                        <div class="flex items-center justify-between gap-3">
                            <strong class="text-sm font-semibold text-gray-900">{{ formation(i.formationId)?.code }} · {{ annee(i.anneeId)?.libelle }}</strong>
                            <span class="text-sm text-gray-500 tabular-nums"><strong class="font-semibold text-gray-900">{{ progression(i).valides }}</strong>/{{ progression(i).total }} ECTS</span>
                        </div>
                        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
                            <div class="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-600 transition-[width] duration-700" :style="{ width: `${progression(i).pourcentage}%` }"></div>
                        </div>
                        <p class="mt-2 text-xs text-gray-500">{{ progression(i).pourcentage }} % des crédits des UE inscrites sont validés.</p>
                    </div>
                </div>
            </section>
        </template>
    </Chargement>
</template>
