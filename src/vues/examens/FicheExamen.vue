<script setup lang="ts">
import { PRESENCES } from '@shared/domaine';
import { collection, query, where } from 'firebase/firestore';
import { computed, reactive, watch } from 'vue';
import { appeler } from '../../api';
import Chargement from '../../composants/Chargement.vue';
import { indexer, useDocument, useRequete } from '../../donnees';
import { telecharger } from '../../fichiers';
import { db } from '../../firebase';
import { horaireExamen, nomComplet } from '../../format';
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
    if (sauvegarde) notifier(sauvegarde.message ?? 'Suivi local enregistré.');
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
    <RouterLink to="/examens" class="lien mb-4 inline-flex items-center gap-2 text-sm"><i class="fa-solid fa-arrow-left text-xs"></i> Retour aux examens</RouterLink>
    <Chargement :chargement="chargement" :vide="!examen" message-vide="Examen introuvable.">
        <template v-if="examen">
            <section class="carte relative overflow-hidden">
                <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-insec-50/80 to-transparent"></div>
                <div class="relative flex flex-wrap items-start gap-5 p-5 sm:p-6">
                    <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-insec-600 to-insec-700 text-white shadow-sm">
                        <i class="fa-solid fa-calendar-check text-xl"></i>
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="surtitre">{{ formation(examen.formationId)?.code }} · {{ annee(examen.anneeId)?.libelle }}</p>
                        <h1 class="titre-page mt-1.5">{{ ue(examen.ueId)?.code }} — {{ ue(examen.ueId)?.libelle }}</h1>
                    </div>
                </div>
                <dl class="relative grid gap-px border-t border-gray-100 bg-gray-100 text-sm sm:grid-cols-2 md:grid-cols-4">
                    <div class="bg-surface px-5 py-4 sm:px-6"><dt class="text-xs font-medium text-gray-500">Date officielle INTEC</dt><dd class="mt-1 font-semibold text-gray-900">{{ horaireExamen(examen.dateExamen) }}</dd></div>
                    <div class="bg-surface px-5 py-4 sm:px-6"><dt class="text-xs font-medium text-gray-500">Session</dt><dd class="mt-1 font-semibold text-gray-900">{{ examen.session }}</dd></div>
                    <div class="bg-surface px-5 py-4 sm:px-6"><dt class="text-xs font-medium text-gray-500">Salle</dt><dd class="mt-1 font-semibold text-gray-900">{{ examen.salle || '—' }}</dd></div>
                    <div class="bg-surface px-5 py-4 sm:px-6"><dt class="text-xs font-medium text-gray-500">Validation</dt><dd class="mt-1 font-semibold text-gray-900 tabular-nums">{{ examen.seuilValidation }}/{{ examen.noteSur }}</dd></div>
                </dl>
            </section>

            <section class="carte mt-6 overflow-hidden">
                <header class="panneau-entete">
                    <div>
                        <h2 class="titre-section">Suivi local INSEC et retour des copies</h2>
                        <p class="mt-0.5 text-xs leading-5 text-gray-500">L’INTEC fixe l’épreuve. L’INSEC suit les consignes : sujets reçus, salle et surveillance, présence des candidats, puis retour des copies.</p>
                        <p class="mt-0.5 text-xs leading-5 text-gray-600">{{ candidatsPresents }} candidat(s) marqué(s) présent(s) : le nombre de copies doit correspondre avant d’enregistrer leur envoi.</p>
                    </div>
                    <div class="flex min-w-44 flex-col items-end gap-1.5">
                        <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ progressionPreparation.termine }}/{{ progressionPreparation.total }} étapes terminées</span>
                        <span class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <span class="block h-full rounded-full bg-linear-to-r from-insec-500 to-insec-700 transition-all" :style="{ width: `${(progressionPreparation.termine * 100) / progressionPreparation.total}%` }"></span>
                        </span>
                    </div>
                </header>
                <form class="space-y-5 p-5 sm:p-6" @submit.prevent="enregistrerPreparation">
                    <div class="grid gap-4 lg:grid-cols-3">
                        <section class="rounded-2xl border border-gray-200 p-4">
                            <h3 class="mb-3 flex items-center gap-2.5 text-sm font-semibold text-gray-900"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-insec-600 text-[11px] font-bold text-white">1</span>Réception des sujets</h3>
                            <label class="etiquette">Date de réception
                                <input v-model="preparation.sujetsRecusLe" type="date" class="champ mt-1.5" />
                            </label>
                            <label class="etiquette mt-3 block">Nombre de lots reçus
                                <input v-model.number="preparation.nombreSujetsRecus" type="number" min="0" max="500" step="1" class="champ mt-1.5" />
                            </label>
                            <p class="mt-2 text-xs text-gray-500">Renseignez la date et le nombre de lots ensemble pour confirmer la réception.</p>
                        </section>
                        <section class="rounded-2xl border border-gray-200 p-4">
                            <h3 class="mb-3 flex items-center gap-2.5 text-sm font-semibold text-gray-900"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-insec-600 text-[11px] font-bold text-white">2</span>Organisation de la salle</h3>
                            <label class="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
                                <input v-model="preparation.salleConfirmee" type="checkbox" class="mt-0.5" />
                                <span>Salle d’examen confirmée</span>
                            </label>
                            <label class="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
                                <input v-model="preparation.surveillanceConfirmee" type="checkbox" class="mt-0.5" />
                                <span>Surveillance organisée</span>
                            </label>
                        </section>
                        <section class="rounded-2xl border border-gray-200 p-4">
                            <h3 class="mb-3 flex items-center gap-2.5 text-sm font-semibold text-gray-900"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-insec-600 text-[11px] font-bold text-white">3</span>Retour des copies</h3>
                            <label class="etiquette">Copies rassemblées
                                <input v-model.number="preparation.nombreCopiesRassemblees" type="number" min="0" :max="candidatsPresents" step="1" class="champ mt-1.5" />
                            </label>
                            <label class="etiquette mt-3 block">Date d’envoi à l’INTEC
                                <input v-model="preparation.copiesEnvoyeesLe" type="date" class="champ mt-1.5" />
                            </label>
                            <label class="etiquette mt-3 block">Référence d’envoi <span class="font-normal text-gray-400">(facultatif)</span>
                                <input v-model="preparation.referenceEnvoiCopies" maxlength="120" class="champ mt-1.5" />
                            </label>
                        </section>
                    </div>
                    <p v-if="incoherenceReceptionSujets" role="alert" class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm text-amber-900">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5 text-amber-500"></i>
                        <span>Pour confirmer la réception des sujets, indiquez à la fois la date et le nombre de lots reçus.</span>
                    </p>
                    <p v-if="incoherenceCopies" role="alert" class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-sm text-amber-900">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5 text-amber-500"></i>
                        <span>Le nombre de copies doit correspondre aux {{ candidatsPresents }} candidat(s) présents avant de renseigner la date d’envoi. Vérifiez d’abord les présences ci-dessous.</span>
                    </p>
                    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <p class="flex items-center gap-2 text-xs text-gray-500"><i class="fa-solid fa-shield-halved"></i>Chaque modification est enregistrée dans le journal d’audit.</p>
                        <button class="bouton-action" :disabled="envoi || incoherenceCopies || incoherenceReceptionSujets">Enregistrer le suivi</button>
                    </div>
                </form>
            </section>

            <div class="mt-8 mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 class="titre-section">Convocations et résultats <span class="ml-1 text-sm font-medium text-gray-400">({{ resultats.length }})</span></h2>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || !resultats.length || examen.statut === 'Annulé'"
                        title="Télécharger la feuille de présence PDF"
                        @click="soumettre(() => telecharger('genererPdf', { type: 'feuillePresence', id: props.id }))"
                    ><i class="fa-solid fa-file-pdf text-red-500"></i> Feuille de présence</button>
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || !resultats.length || examen.statut === 'Annulé'"
                        title="Télécharger le bordereau d’accompagnement des copies"
                        @click="soumettre(() => telecharger('genererPdf', { type: 'bordereauCopies', id: props.id }))"
                    ><i class="fa-solid fa-file-pdf text-red-500"></i> Bordereau des copies</button>
                    <button
                        type="button"
                        class="bouton-principal"
                        :disabled="envoi || !convocables.length || examen.statut === 'Annulé'"
                        @click="envoyerToutesConvocations"
                    ><i class="fa-solid fa-paper-plane"></i> Envoyer les convocations ({{ convocables.length }} à envoyer)</button>
                </div>
            </div>
            <div class="carte mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-sm text-gray-700">
                <p class="flex flex-wrap items-center gap-1.5">
                    <i class="fa-solid fa-envelope mr-1 text-gray-400"></i>
                    Convocations :
                    <span class="pastille bg-insec-50 text-insec-700 ring-insec-600/15">{{ convocables.length }} à envoyer</span>
                    <span class="pastille bg-emerald-50 text-emerald-700 ring-emerald-600/15">{{ resumeConvocations.envoyees }} déjà envoyée(s)</span>
                    <span v-if="resumeConvocations.enCours" class="pastille bg-gray-50 text-gray-600 ring-gray-500/15">{{ resumeConvocations.enCours }} en cours</span>
                    <span v-if="resumeConvocations.sansAdresse" class="pastille bg-amber-50 text-amber-800 ring-amber-600/20">{{ resumeConvocations.sansAdresse }} adresse(s) à vérifier</span>
                </p>
                <p class="flex flex-wrap items-center gap-1.5">
                    <i class="fa-solid fa-user-check mr-1 text-gray-400"></i>
                    À pointer <strong class="tabular-nums">{{ resumePresence['Convoqué'] }}</strong>
                    · Présents <strong class="text-emerald-700 tabular-nums">{{ resumePresence['Présent'] }}</strong>
                    · Absents <strong class="text-red-700 tabular-nums">{{ resumePresence['Absent'] }}</strong>
                    · Dispensés <strong class="tabular-nums">{{ resumePresence['Dispensé'] }}</strong>
                </p>
                <button
                    type="button"
                    class="bouton-principal ml-auto"
                    :disabled="envoi || !presencesEnAttente.length || examen.statut === 'Annulé'"
                    @click="enregistrerPresences"
                >Enregistrer les présences ({{ presencesEnAttente.length }})</button>
            </div>
            <div class="space-y-3">
                <form v-for="r in lignes" :key="r.id" class="carte grid items-end gap-3 p-4 transition hover:border-gray-300 md:grid-cols-7" @submit.prevent="enregistrer(r)">
                    <div class="flex items-center gap-3 md:col-span-2">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec-50 text-[11px] font-bold text-insec-700 ring-1 ring-insec-100">
                            {{ nomComplet(parEtudiant.get(r.etudiantId)).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }}
                        </span>
                        <div class="min-w-0">
                            <p class="truncate font-semibold text-gray-900">{{ nomComplet(parEtudiant.get(r.etudiantId)) }}</p>
                            <p class="text-xs text-gray-500">N° INTEC {{ parInscription.get(r.inscriptionId)?.numeroIntec || '—' }}</p>
                        </div>
                    </div>
                    <label class="etiquette text-xs text-gray-500">Présence
                        <select v-model="valeur(r).presence" class="champ mt-1"><option v-for="p in PRESENCES" :key="p">{{ p }}</option></select>
                    </label>
                    <label class="etiquette text-xs text-gray-500">Note / {{ examen.noteSur }}
                        <input v-model="valeur(r).note" type="number" step="0.01" min="0" :max="examen.noteSur" class="champ mt-1" />
                    </label>
                    <label class="etiquette text-xs text-gray-500">Commentaire <input v-model="valeur(r).commentaire" class="champ mt-1" maxlength="1000" /></label>
                    <button class="bouton-principal" :disabled="envoi">Enregistrer</button>
                    <button type="button" class="bouton-secondaire" :disabled="envoi" title="Convocation PDF" @click="soumettre(() => telecharger('genererPdf', { type: 'convocation', id: r.id }))">
                        <i class="fa-solid fa-file-pdf text-red-500"></i> Convocation
                    </button>
                    <p v-if="r.convocationEnvoiStatut === 'Envoyée'" class="flex items-center gap-1.5 text-xs font-medium text-emerald-700 md:col-span-7"><i class="fa-solid fa-circle-check"></i>Convocation envoyée — aucun nouvel envoi ne sera effectué.</p>
                    <p v-else-if="r.convocationEnvoiStatut === 'En cours'" class="flex items-center gap-1.5 text-xs text-insec-700 md:col-span-7"><i class="fa-solid fa-circle-notch fa-spin"></i>Envoi en cours — un nouvel envoi est bloqué.</p>
                    <p v-else-if="r.convocationEnvoiStatut === 'Échec'" class="flex items-center gap-1.5 text-xs text-amber-700 md:col-span-7"><i class="fa-solid fa-triangle-exclamation"></i>Échec du dernier envoi. Vérifiez le journal des communications avant de réessayer.</p>
                    <button
                        type="button"
                        class="bouton-secondaire"
                        :disabled="envoi || examen.statut === 'Annulé' || !adresseValide(parEtudiant.get(r.etudiantId)?.email) || r.convocationEnvoiStatut === 'Envoyée' || r.convocationEnvoiStatut === 'En cours'"
                        title="Envoyer la convocation par e-mail"
                        @click="envoyerConvocation(r)"
                    ><i class="fa-solid fa-paper-plane"></i> Envoyer par e-mail</button>
                    <p v-if="enCours.id === r.id && erreurs.note" class="text-xs text-red-600 md:col-span-7">{{ erreurs.note }}</p>
                    <p v-if="r.presence === 'Présent' && r.note !== null" class="md:col-span-7">
                        <span :class="['pastille', r.valide ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' : 'bg-red-50 text-red-700 ring-red-600/15']">
                            <span :class="['h-1.5 w-1.5 rounded-full', r.valide ? 'bg-emerald-500' : 'bg-red-500']"></span>
                            {{ r.valide ? 'UE validée' : 'UE non validée' }}
                        </span>
                    </p>
                </form>
                <div v-if="!resultats.length" class="carte flex flex-col items-center px-6 py-12 text-center">
                    <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><i class="fa-solid fa-user-slash"></i></span>
                    <p class="mt-3 text-sm text-gray-500">Aucun étudiant inscrit à cette UE pour cette année.</p>
                </div>
            </div>
        </template>
    </Chargement>
</template>
