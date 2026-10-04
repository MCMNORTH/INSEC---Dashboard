<script setup lang="ts">
import { PRESENCES } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { computed, reactive, watch } from 'vue';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { indexer, useDocument, useRequete } from '../../donnees';
import { telecharger } from '../../fichiers';
import { db } from '../../firebase';
import { dateHeureParis, nomComplet } from '../../format';
import { useFormulaire } from '../../formulaire';
import { notifier } from '../../notifications';
import { useReferentiel } from '../../referentiel';
import type { Etudiant, Examen, Inscription, Resultat } from '../../types';

const props = defineProps<{ id: string }>();
const { ue, annee, formation } = useReferentiel();
const { donnee: examen, chargement } = useDocument<Examen>(() => `examens/${props.id}`);
const { donnees: resultats } = useRequete<Resultat>(() => query(collection(db, 'resultats'), where('examenId', '==', props.id)));
const { donnees: etudiants } = useRequete<Etudiant>(() => collection(db, 'etudiants'));
const { donnees: inscriptions } = useRequete<Inscription>(() => (examen.value ? query(collection(db, 'inscriptions'), where('anneeId', '==', examen.value.anneeId)) : null));
const parEtudiant = computed(() => indexer(etudiants.value));
const parInscription = computed(() => indexer(inscriptions.value));
const preparation = reactive({
    sujetsRecusLe: '',
    nombreSujetsRecus: null as number | null,
    salleConfirmee: false,
    surveillanceConfirmee: false,
    nombreCopiesRassemblees: null as number | null,
    copiesEnvoyeesLe: '',
    referenceEnvoiCopies: '',
});
watch(examen, (e) => {
    if (!e) return;
    preparation.sujetsRecusLe = e.sujetsRecusLe ?? '';
    preparation.nombreSujetsRecus = e.nombreSujetsRecus ?? null;
    preparation.salleConfirmee = e.salleConfirmee ?? false;
    preparation.surveillanceConfirmee = e.surveillanceConfirmee ?? false;
    preparation.nombreCopiesRassemblees = e.nombreCopiesRassemblees ?? null;
    preparation.copiesEnvoyeesLe = e.copiesEnvoyeesLe ?? '';
    preparation.referenceEnvoiCopies = e.referenceEnvoiCopies ?? '';
}, { immediate: true });
const incoherenceReceptionSujets = computed(() =>
    Boolean(preparation.sujetsRecusLe) !== (String(preparation.nombreSujetsRecus ?? '').trim() !== ''),
);
const candidatsPresents = computed(() => resultats.value.filter((resultat) => resultat.presence === 'Présent').length);
const incoherenceCopies = computed(() =>
    (preparation.nombreCopiesRassemblees !== null && preparation.nombreCopiesRassemblees > candidatsPresents.value)
    || (!!preparation.copiesEnvoyeesLe && preparation.nombreCopiesRassemblees !== candidatsPresents.value),
);
const progressionPreparation = computed(() => {
    const total = 4;
    const termine = Number(!!preparation.sujetsRecusLe && preparation.nombreSujetsRecus !== null)
        + Number(preparation.salleConfirmee && preparation.surveillanceConfirmee)
        + Number(preparation.nombreCopiesRassemblees !== null)
        + Number(!!preparation.copiesEnvoyeesLe);
    return { termine, total };
});

const lignes = computed(() =>
    [...resultats.value].sort((a, b) => nomComplet(parEtudiant.value.get(a.etudiantId)).localeCompare(nomComplet(parEtudiant.value.get(b.etudiantId)))),
);
const adresseValide = (email?: string | null) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim() ?? '');
const convocables = computed(() => {
    if (examen.value?.statut === 'Annulé') return [];
    const uniques = new Map<string, Resultat>();
    for (const resultat of resultats.value) {
        const email = parEtudiant.value.get(resultat.etudiantId)?.email;
        const dejaEnvoyee = resultat.convocationEnvoiStatut === 'Envoyée' || resultat.convocationEnvoiStatut === 'En cours';
        if (resultat.presence === 'Convoqué' && !dejaEnvoyee && adresseValide(email)) {
            uniques.set(resultat.etudiantId, resultat);
        }
    }
    return [...uniques.values()];
});
const resumeConvocations = computed(() => ({
    envoyees: resultats.value.filter((r) => r.convocationEnvoiStatut === 'Envoyée').length,
    enCours: resultats.value.filter((r) => r.convocationEnvoiStatut === 'En cours').length,
    sansAdresse: resultats.value.filter((r) => r.presence === 'Convoqué' && !adresseValide(parEtudiant.value.get(r.etudiantId)?.email)).length,
}));

const saisie = reactive<Record<string, { presence: string; note: number | '' | null; commentaire: string }>>({});
const valeur = (r: Resultat) => (saisie[r.id] ??= { presence: r.presence, note: r.note ?? '', commentaire: r.commentaire ?? '' });
const resumePresence = computed(() =>
    Object.fromEntries(PRESENCES.map((presence) => [presence, resultats.value.filter((r) => r.presence === presence).length])) as Record<string, number>,
);
const presencesEnAttente = computed(() => lignes.value.filter((r) => valeur(r).presence !== r.presence));
const { envoi, erreurs, soumettre } = useFormulaire();
const enCours = reactive({ id: '' });

async function enregistrerPreparation() {
    const sauvegarde = await soumettre(() =>
        appeler('mettreAJourPreparationExamen', { id: props.id, ...preparation }),
    );
    if (sauvegarde) notifier(sauvegarde.message ?? 'Suivi de préparation enregistré.');
}

async function enregistrer(r: Resultat) {
    enCours.id = r.id;
    const resultat = await soumettre(() => appeler('enregistrerResultat', { id: r.id, ...valeur(r) }));
    if (resultat) notifier(resultat.message ?? 'Résultat enregistré.');
}

async function enregistrerPresences() {
    const changements = presencesEnAttente.value;
    if (!changements.length) return;
    const nombre = changements.length;
    if (!window.confirm(`Enregistrer le statut de présence de ${nombre} étudiant(s) ? Les notes ne seront pas modifiées et aucun e-mail ne sera envoyé.`)) return;
    const resultat = await soumettre(() =>
        appeler<{ message: string }>('enregistrerPresencesExamen', {
            id: props.id,
            presences: changements.map((r) => ({ resultatId: r.id, presence: valeur(r).presence })),
        }),
    );
    if (resultat) notifier(resultat.message);
}

async function envoyerToutesConvocations() {
    const nombre = convocables.value.length;
    if (!nombre || examen.value?.statut === 'Annulé') return;
    if (!window.confirm(`Envoyer ${nombre} convocation(s) ? Les convocations déjà marquées « Envoyée » seront ignorées et ne seront pas renvoyées.`)) return;
    const resultat = await soumettre(() => appeler('envoyerConvocationsExamen', { id: props.id }));
    if (resultat) notifier(resultat.message ?? 'Envoi groupé terminé.');
}

async function envoyerConvocation(r: Resultat) {
    const etudiant = parEtudiant.value.get(r.etudiantId);
    const email = etudiant?.email?.trim();
    if (r.convocationEnvoiStatut === 'Envoyée') {
        notifier('Cette convocation a déjà été envoyée ; elle ne sera pas transmise une seconde fois.');
        return;
    }
    if (r.convocationEnvoiStatut === 'En cours') {
        notifier('L’envoi de cette convocation est déjà en cours.');
        return;
    }
    if (!adresseValide(email)) {
        notifier('Aucune adresse e-mail n’est enregistrée pour cet étudiant.');
        return;
    }
    if (!window.confirm(`Envoyer la convocation PDF à ${nomComplet(etudiant)} — ${email} ?`)) return;
    const resultat = await soumettre(() => appeler('envoyerDocumentParEmail', { type: 'convocation', id: r.id }));
    if (resultat) notifier(resultat.message ?? 'Convocation envoyée par e-mail.');
}
</script>

<template>
    <RouterLink to="/examens" class="text-sm text-gray-500">← Retour</RouterLink>
    <Chargement :chargement="chargement" :vide="!examen" message-vide="Examen introuvable.">
        <template v-if="examen">
            <section class="carte mt-4 p-5">
                <p class="text-sm font-semibold text-amber-600">{{ formation(examen.formationId)?.code }} · {{ annee(examen.anneeId)?.libelle }}</p>
                <h1 class="text-xl font-bold text-insec">{{ ue(examen.ueId)?.code }} — {{ ue(examen.ueId)?.libelle }}</h1>
                <div class="mt-4 grid gap-3 text-sm md:grid-cols-4">
                    <div><span class="text-gray-500">Date et heure (Paris)</span><br /><strong>{{ dateHeureParis(examen.dateExamen) }}</strong></div>
                    <div><span class="text-gray-500">Session</span><br /><strong>{{ examen.session }}</strong></div>
                    <div><span class="text-gray-500">Salle</span><br /><strong>{{ examen.salle || '—' }}</strong></div>
                    <div><span class="text-gray-500">Validation</span><br /><strong>{{ examen.seuilValidation }}/{{ examen.noteSur }}</strong></div>
                </div>
            </section>
            <section class="carte mt-6 p-5">
                <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-lg font-bold text-insec">Préparation de l’épreuve et retour des copies</h2>
                        <p class="mt-1 text-sm text-gray-500">Suivez les sujets reçus, l’organisation de la salle et l’envoi des copies à l’INTEC.</p>
                        <p class="mt-1 text-sm text-gray-600">{{ candidatsPresents }} candidat(s) marqué(s) présent(s) : le nombre de copies doit correspondre avant d’enregistrer leur envoi.</p>
                    </div>
                    <span class="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                        {{ progressionPreparation.termine }}/{{ progressionPreparation.total }} étapes terminées
                    </span>
                </div>
                <form class="space-y-5" @submit.prevent="enregistrerPreparation">
                    <div class="grid gap-5 lg:grid-cols-3">
                        <section class="rounded-lg border border-gray-200 p-4">
                            <h3 class="mb-3 font-semibold text-gray-800">1. Réception des sujets</h3>
                            <label class="etiquette">Date de réception
                                <input v-model="preparation.sujetsRecusLe" type="date" class="champ mt-1" />
                            </label>
                            <label class="etiquette mt-3 block">Nombre de lots reçus
                                <input v-model.number="preparation.nombreSujetsRecus" type="number" min="0" max="500" step="1" class="champ mt-1" />
                            </label>
                            <p class="mt-2 text-xs text-gray-500">Renseignez la date et le nombre de lots ensemble pour confirmer la réception.</p>
                        </section>
                        <section class="rounded-lg border border-gray-200 p-4">
                            <h3 class="mb-3 font-semibold text-gray-800">2. Organisation de la salle</h3>
                            <label class="flex items-start gap-3 py-2 text-sm text-gray-700">
                                <input v-model="preparation.salleConfirmee" type="checkbox" class="mt-1 rounded border-gray-300" />
                                <span>Salle d’examen confirmée</span>
                            </label>
                            <label class="flex items-start gap-3 py-2 text-sm text-gray-700">
                                <input v-model="preparation.surveillanceConfirmee" type="checkbox" class="mt-1 rounded border-gray-300" />
                                <span>Surveillance organisée</span>
                            </label>
                        </section>
                        <section class="rounded-lg border border-gray-200 p-4">
                            <h3 class="mb-3 font-semibold text-gray-800">3. Retour des copies</h3>
                            <label class="etiquette">Copies rassemblées
                                <input v-model.number="preparation.nombreCopiesRassemblees" type="number" min="0" :max="candidatsPresents" step="1" class="champ mt-1" />
                            </label>
                            <label class="etiquette mt-3 block">Date d’envoi à l’INTEC
                                <input v-model="preparation.copiesEnvoyeesLe" type="date" class="champ mt-1" />
                            </label>
                            <label class="etiquette mt-3 block">Référence d’envoi <span class="text-gray-400">(facultatif)</span>
                                <input v-model="preparation.referenceEnvoiCopies" maxlength="120" class="champ mt-1" />
                            </label>
                        </section>
                    </div>
                    <p v-if="incoherenceReceptionSujets" role="alert" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Pour confirmer la réception des sujets, indiquez à la fois la date et le nombre de lots reçus.
                    </p>
                    <p v-if="incoherenceCopies" role="alert" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Le nombre de copies doit correspondre aux {{ candidatsPresents }} candidat(s) présents avant de renseigner la date d’envoi. Vérifiez d’abord les présences ci-dessous.
                    </p>
                    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <p class="text-xs text-gray-500">Chaque modification est enregistrée dans le journal d’audit.</p>
                        <button class="bouton-action" :disabled="envoi || incoherenceCopies || incoherenceReceptionSujets">Enregistrer le suivi</button>
                    </div>
                </form>
            </section>
            <div class="mt-7 mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 class="font-bold text-insec">Convocations et résultats ({{ resultats.length }})</h2>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || !resultats.length || examen.statut === 'Annulé'"
                        title="Télécharger la feuille de présence PDF"
                        @click="soumettre(() => telecharger('genererPdf', { type: 'feuillePresence', id: props.id }))"
                    ><i class="fa-solid fa-file-pdf"></i> Feuille de présence</button>
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || !resultats.length || examen.statut === 'Annulé'"
                        title="Télécharger le bordereau d’accompagnement des copies"
                        @click="soumettre(() => telecharger('genererPdf', { type: 'bordereauCopies', id: props.id }))"
                    ><i class="fa-solid fa-file-pdf"></i> Bordereau des copies</button>
                    <button
                        type="button"
                        class="bouton-principal"
                        :disabled="envoi || !convocables.length || examen.statut === 'Annulé'"
                        @click="envoyerToutesConvocations"
                    ><i class="fa-solid fa-paper-plane"></i> Envoyer les convocations ({{ convocables.length }} à envoyer)</button>
                </div>
            </div>
            <div class="mb-3 grid gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 md:grid-cols-2">
                <p>
                    Convocations : <strong>{{ convocables.length }} à envoyer</strong>
                    · <strong class="text-green-700">{{ resumeConvocations.envoyees }} déjà envoyée(s)</strong>
                    <span v-if="resumeConvocations.enCours"> · {{ resumeConvocations.enCours }} en cours</span>
                    <span v-if="resumeConvocations.sansAdresse" class="text-amber-700"> · {{ resumeConvocations.sansAdresse }} adresse(s) à vérifier</span>
                </p>
                <p>
                    À pointer <strong>{{ resumePresence['Convoqué'] }}</strong>
                    · Présents <strong class="text-green-700">{{ resumePresence['Présent'] }}</strong>
                    · Absents <strong class="text-red-700">{{ resumePresence['Absent'] }}</strong>
                    · Dispensés <strong>{{ resumePresence['Dispensé'] }}</strong>
                </p>
                <button
                    type="button"
                    class="bouton-principal"
                    :disabled="envoi || !presencesEnAttente.length || examen.statut === 'Annulé'"
                    @click="enregistrerPresences"
                >Enregistrer les présences ({{ presencesEnAttente.length }})</button>
            </div>
            <div class="space-y-3">
                <form v-for="r in lignes" :key="r.id" class="carte grid items-end gap-3 p-4 md:grid-cols-7" @submit.prevent="enregistrer(r)">
                    <div class="md:col-span-2">
                        <p class="font-semibold">{{ nomComplet(parEtudiant.get(r.etudiantId)) }}</p>
                        <p class="text-xs text-gray-500">N° INTEC {{ parInscription.get(r.inscriptionId)?.numeroIntec || '—' }}</p>
                    </div>
                    <label class="text-xs text-gray-500">Présence
                        <select v-model="valeur(r).presence" class="champ mt-1"><option v-for="p in PRESENCES" :key="p">{{ p }}</option></select>
                    </label>
                    <label class="text-xs text-gray-500">Note / {{ examen.noteSur }}
                        <input v-model="valeur(r).note" type="number" step="0.01" min="0" :max="examen.noteSur" class="champ mt-1" />
                    </label>
                    <label class="text-xs text-gray-500">Commentaire <input v-model="valeur(r).commentaire" class="champ mt-1" maxlength="1000" /></label>
                    <button class="bouton-principal" :disabled="envoi">Enregistrer</button>
                    <button type="button" class="bouton-secondaire" :disabled="envoi" title="Convocation PDF" @click="soumettre(() => telecharger('genererPdf', { type: 'convocation', id: r.id }))">
                        <i class="fa-solid fa-file-pdf"></i> Convocation
                    </button>
                    <p v-if="r.convocationEnvoiStatut === 'Envoyée'" class="text-xs font-medium text-green-700 md:col-span-7">Convocation envoyée — aucun nouvel envoi ne sera effectué.</p>
                    <p v-else-if="r.convocationEnvoiStatut === 'En cours'" class="text-xs text-blue-700 md:col-span-7">Envoi en cours — un nouvel envoi est bloqué.</p>
                    <p v-else-if="r.convocationEnvoiStatut === 'Échec'" class="text-xs text-amber-700 md:col-span-7">Échec du dernier envoi. Vérifiez le journal des communications avant de réessayer.</p>
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || examen.statut === 'Annulé' || !adresseValide(parEtudiant.get(r.etudiantId)?.email) || r.convocationEnvoiStatut === 'Envoyée' || r.convocationEnvoiStatut === 'En cours'"
                        title="Envoyer la convocation par e-mail"
                        @click="envoyerConvocation(r)"
                    ><i class="fa-solid fa-paper-plane"></i> Envoyer par e-mail</button>
                    <p v-if="enCours.id === r.id && erreurs.note" class="text-xs text-red-600 md:col-span-7">{{ erreurs.note }}</p>
                    <p v-if="r.presence === 'Présent' && r.note !== null" :class="['text-xs md:col-span-7', r.valide ? 'text-green-700' : 'text-red-700']">
                        {{ r.valide ? 'UE validée' : 'UE non validée' }}
                    </p>
                </form>
                <div v-if="!resultats.length" class="carte p-6 text-gray-500">Aucun étudiant inscrit à cette UE pour cette année.</div>
            </div>
        </template>
    </Chargement>
</template>
