<script setup lang="ts">
import { MODES_PAIEMENT, montantEnRetard, montantNet, soldeRestant, statutPaiement } from '@shared/domaine';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, reactive, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../api';
import BadgeStatut from '../composants/BadgeStatut.vue';
import Chargement from '../composants/Chargement.vue';
import { useRequete } from '../donnees';
import { telecharger } from '../fichiers';
import { db } from '../firebase';
import { aujourdhui, date, montant } from '../format';
import { useFormulaire } from '../formulaire';
import { notifier } from '../notifications';
import { useReferentiel } from '../referentiel';
import { aRole } from '../session';
import type { Etudiant, Inscription, Versement } from '../types';

const route = useRoute();
const router = useRouter();
const { formation, annee, annees, anneeCourante } = useReferentiel();
const onglet = ref<'etudiants' | 'synthese'>(route.query.onglet === 'synthese' ? 'synthese' : 'etudiants');
const { donnees: etudiants, chargement, erreur } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const { donnees: inscriptions } = useRequete<Inscription>(() => collection(db, 'inscriptions'));
const recherche = ref('');
const anneeEtudiants = ref(typeof route.query.annee === 'string' ? route.query.annee : anneeCourante.value?.id ?? '2026-2027');
watch(anneeCourante, (a) => { if (!anneeEtudiants.value && a) anneeEtudiants.value = a.id; }, { immediate: true });
const inscriptionsAnnee = computed(() => inscriptions.value.filter((i) => i.anneeId === anneeEtudiants.value));
const lignesEtudiants = computed(() => {
    const t = recherche.value.trim().toLowerCase();
    const parId = new Map(etudiants.value.map((e) => [e.id, e]));
    return inscriptionsAnnee.value.flatMap((dossier) => {
        const etudiant = parId.get(dossier.etudiantId);
        return etudiant && (!t || `${etudiant.nom} ${etudiant.prenom} ${etudiant.email}`.toLowerCase().includes(t)) ? [{ dossier, etudiant }] : [];
    });
});

const etudiantId = computed(() => (typeof route.query.etudiant === 'string' ? route.query.etudiant : null));
const selectionne = computed(() => etudiants.value.find((e) => e.id === etudiantId.value) ?? null);
const emailEtudiantValide = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectionne.value?.email?.trim() ?? ''));
const dossiers = computed(() => inscriptionsAnnee.value.filter((i) => i.etudiantId === etudiantId.value).sort((a, b) => b.ordre - a.ordre));
const inscription = computed(() => {
    const demandee = typeof route.query.inscription === 'string' ? route.query.inscription : null;
    return dossiers.value.find((i) => i.id === demandee) ?? dossiers.value[0] ?? null;
});
const { donnees: versementsBruts } = useRequete<Versement>(() =>
    inscription.value ? query(collection(db, 'versements'), where('inscriptionId', '==', inscription.value.id)) : null,
);
const versements = computed(() => [...versementsBruts.value].sort((a, b) => b.dateVersement.localeCompare(a.dateVersement)));

const ouvrir = (etudiant: string, dossier?: string) => router.replace({ query: { onglet: 'etudiants', annee: anneeEtudiants.value, etudiant, ...(dossier ? { inscription: dossier } : {}) } });
watch(anneeEtudiants, (value) => {
    void router.replace({ query: { onglet: 'etudiants', annee: value } });
});

// Formulaires du dossier sélectionné.
const { envoi, erreurs, soumettre } = useFormulaire();
const situation = reactive({ montantDu: 0, montantRemise: 0, noteFinanciere: '' });
watch(inscription, (i) => {
    if (i) Object.assign(situation, { montantDu: i.montantDu, montantRemise: i.montantRemise, noteFinanciere: i.noteFinanciere ?? '' });
}, { immediate: true });
const echeance = reactive({ libelle: '', montant: null as number | null, dateEcheance: '' });
const versement = reactive({ montant: null as number | null, dateVersement: aujourdhui(), statut: 'Validée', modePaiement: 'Espèces', reference: '', note: '' });

async function executer(operation: string, donnees: object, apres?: () => void) {
    const resultat = await soumettre(() => appeler(operation, donnees));
    if (!resultat) return;
    notifier(resultat.message ?? 'Enregistré.');
    apres?.();
}
const majSituation = () => executer('modifierSituationFinanciere', { id: inscription.value!.id, ...situation });
const ajouterEcheance = () =>
    executer('ajouterEcheance', { inscriptionId: inscription.value!.id, ...echeance }, () => Object.assign(echeance, { libelle: '', montant: null, dateEcheance: '' }));
const ajouterVersement = () =>
    executer('ajouterVersement', { inscriptionId: inscription.value!.id, ...versement }, () => Object.assign(versement, { montant: null, reference: '', note: '' }));
const confirmerVersement = async () => {
    if (versement.statut === 'Validée') {
        const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim() || 'étudiant';
        const email = selectionne.value?.email?.trim() ?? '';
        const notification = emailEtudiantValide.value
            ? `Une confirmation sera mise en file d’envoi à ${email}.`
            : 'Aucune adresse e-mail valide : le paiement sera enregistré sans notification par e-mail.';
        const resume = `Valider le versement de ${montant(versement.montant ?? 0)} MRU pour ${nom}, le ${date(versement.dateVersement)}, par ${versement.modePaiement} ?\n\nCe versement sera immédiatement ajouté au total encaissé. ${notification}`;
        if (!window.confirm(resume)) return;
    }
    await ajouterVersement();
};

async function envoyerDocument(type: 'facture' | 'recu', id: string, libelle: string, destinataire: string) {
    const email = destinataire.trim();
    const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim() || 'étudiant';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        notifier('Adresse e-mail absente ou invalide. Corrigez-la dans la fiche de l’étudiant avant l’envoi.');
        return;
    }
    if (!window.confirm(`Envoyer ${libelle} en PDF à ${nom} (${email}) ? Le document contient des informations personnelles.`)) return;
    const resultat = await soumettre(() => appeler('envoyerDocumentParEmail', { type, id }));
    if (resultat) notifier(resultat.message ?? 'Document envoyé par e-mail.');
}

// Synthèse annuelle des frais facturés et encaissés.
const anneeSynthese = ref('');
watchEffect(() => {
    if (!anneeSynthese.value && anneeCourante.value) anneeSynthese.value = anneeCourante.value.id;
});
const synthese = computed(() =>
    annees.value.map((a) => {
        const liste = inscriptions.value.filter((i) => i.anneeId === a.id);
        const bumex = liste.filter((i) => i.financeur === 'bumex');
        const payeesEtudiants = liste.filter((i) => i.financeur !== 'bumex');
        const duEtudiants = payeesEtudiants.reduce((t, i) => t + montantNet(i), 0);
        const encaisseEtudiants = payeesEtudiants.reduce((t, i) => t + (i.totalVerse ?? 0), 0);
        const resteEtudiants = payeesEtudiants.reduce((t, i) => t + soldeRestant(i), 0);
        const montantBumex = bumex.reduce((t, i) => t + (i.montantBumex ?? montantNet(i)), 0);
        const bumexRegle = bumex.filter((i) => i.statutBumex === 'reglee').reduce((t, i) => t + (i.montantBumex ?? montantNet(i)), 0);
        return { id: a.id, libelle: a.libelle, nb: liste.length, etudiants: new Set(liste.map((i) => i.etudiantId)).size, nbEtudiants: payeesEtudiants.length, nbBumex: bumex.length, du: duEtudiants, encaisse: encaisseEtudiants, resteEtudiants, montantBumex, bumexRegle, statut: duEtudiants === 0 ? (montantBumex > 0 ? (bumexRegle >= montantBumex ? 'BUMEX réglé' : 'À régler par BUMEX') : 'Aucun montant dû') : encaisseEtudiants >= duEtudiants ? 'Soldé' : encaisseEtudiants > 0 ? 'Partiel' : 'Impayé' };
    }),
);
const carte = computed(() => synthese.value.find((s) => s.id === anneeSynthese.value));
const millions = (v = 0) => (v / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
async function confirmerBumex() {
    const confirmation = window.confirm('Confirmer la prise en charge et le règlement intégral par BUMEX des 11 inscriptions DGC 2024–2025 (41 UE, 656 000 MRU) ? Cette action annotera les dossiers vérifiés sans créer de versements individuels ni de reçus.');
    if (confirmation) await executer('confirmerReglementBumex2024', {});
}
</script>

<template>
    <h1 class="mb-4 text-xl font-bold text-insec">Finances</h1>
    <div class="mb-4 flex gap-2">
        <button :class="['bouton', onglet === 'etudiants' ? 'bg-insec text-white' : 'border bg-white text-gray-600']" @click="onglet = 'etudiants'">Étudiants</button>
        <button :class="['bouton', onglet === 'synthese' ? 'bg-insec text-white' : 'border bg-white text-gray-600']" @click="onglet = 'synthese'">Synthèse annuelle</button>
    </div>

    <Chargement :chargement="chargement" :erreur="erreur">
        <div v-if="onglet === 'etudiants'" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div class="overflow-hidden rounded-xl bg-white shadow lg:col-span-2">
                <div class="grid gap-3 p-3 sm:grid-cols-2">
                    <label class="etiquette">Année académique
                        <select v-model="anneeEtudiants" class="champ mt-1"><option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option></select>
                    </label>
                    <label class="etiquette">Rechercher un étudiant
                        <input v-model="recherche" type="search" placeholder="Nom ou prénom…" class="champ mt-1" aria-label="Rechercher" />
                    </label>
                </div>
                <div class="max-h-[70vh] overflow-y-auto">
                    <table class="tableau">
                        <thead class="sticky top-0"><tr><th>Étudiant</th><th>Financeur</th><th>Restant étudiant</th><th>Statut</th></tr></thead>
                        <tbody>
                            <tr
                                v-for="ligne in lignesEtudiants"
                                :key="ligne.dossier.id"
                                :class="['cursor-pointer hover:bg-gray-50', ligne.dossier.id === inscription?.id ? 'bg-blue-50' : '']"
                                @click="ouvrir(ligne.etudiant.id, ligne.dossier.id)"
                            >
                                <td class="text-gray-900">{{ ligne.etudiant.nom }} {{ ligne.etudiant.prenom }}<span class="block text-xs text-gray-500">{{ formation(ligne.dossier.formationId)?.code }} · {{ ligne.dossier.ueIds.length }} UE</span></td>
                                <td><BadgeStatut :statut="ligne.dossier.financeur === 'bumex' ? 'Pris en charge par BUMEX' : 'À la charge de l’étudiant'" /></td>
                                <td class="text-gray-700">{{ ligne.dossier.financeur === 'bumex' ? '—' : montant(soldeRestant(ligne.dossier)) }}</td>
                                <td>
                                    <BadgeStatut :statut="ligne.dossier.financeur === 'bumex' ? (ligne.dossier.statutBumex === 'reglee' ? 'BUMEX a réglé' : 'À régler par BUMEX') : statutPaiement(ligne.dossier)" />
                                </td>
                            </tr>
                            <tr v-if="!lignesEtudiants.length"><td colspan="4" class="p-6 text-center text-gray-400">Aucune inscription pour {{ annee(anneeEtudiants)?.libelle ?? anneeEtudiants }}.</td></tr>
                        </tbody>
                    </table>
                </div>
                <p class="p-3 text-xs text-gray-400">Cliquez sur un étudiant pour ouvrir son dossier.</p>
            </div>

            <div v-if="selectionne" class="rounded-xl bg-insec p-5 text-white shadow">
                <p class="text-xs font-bold tracking-wide text-amber-400 uppercase">Dossier — {{ selectionne.nom }} {{ selectionne.prenom }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        v-for="d in dossiers"
                        :key="d.id"
                        :class="['cursor-pointer rounded px-2 py-1 text-xs', inscription?.id === d.id ? 'bg-amber-500 text-white' : 'bg-white/10 text-blue-100']"
                        @click="ouvrir(selectionne.id, d.id)"
                    >{{ formation(d.formationId)?.code }} {{ annee(d.anneeId)?.libelle }}</button>
                </div>

                <template v-if="inscription">
                    <p class="mt-4 rounded-lg border border-white/20 bg-white/10 p-3 text-sm" :class="inscription.financeur === 'bumex' ? 'text-green-100' : 'text-blue-100'">
                        <template v-if="inscription.financeur === 'bumex'">Cette inscription est prise en charge par BUMEX. Montant couvert : {{ montant(inscription.montantBumex ?? montantNet(inscription)) }} MRU · {{ inscription.statutBumex === 'reglee' ? 'intégralement réglé par BUMEX' : 'paiement de BUMEX à confirmer' }}.</template>
                        <template v-else>Les frais de cette inscription sont à la charge de l’étudiant.</template>
                    </p>
                    <template v-if="inscription.financeur !== 'bumex'">
                    <p class="mt-4 text-xs text-blue-200">Montant brut</p>
                    <p class="text-2xl font-bold">{{ montant(inscription.montantDu) }} MRU</p>
                    <p class="mt-3 text-xs text-blue-200">Remise · Montant net</p>
                    <p class="text-sm"><span class="text-amber-300">- {{ montant(inscription.montantRemise) }}</span> · <strong>{{ montant(montantNet(inscription)) }} MRU</strong></p>
                    <p class="mt-4 text-xs text-blue-200">Total versé</p>
                    <p class="text-lg font-bold text-green-400">{{ montant(inscription.totalVerse) }} MRU</p>
                    <p class="mt-4 text-xs text-blue-200">Solde restant (calculé)</p>
                    <p class="text-lg font-bold text-amber-400">{{ montant(soldeRestant(inscription)) }} MRU</p>
                    <button
                        v-if="aRole('admin', 'super_admin')"
                        class="mt-3 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
                        @click="soumettre(() => telecharger('genererPdf', { type: 'facture', id: inscription.id }))"
                    >Télécharger la facture PDF</button>
                    <button
                        v-if="aRole('admin', 'super_admin')"
                        type="button"
                        class="mt-2 w-full rounded-lg border border-white/30 px-3 py-2 text-sm text-blue-50 hover:bg-white/10"
                        :disabled="envoi || !emailEtudiantValide"
                        @click="envoyerDocument('facture', inscription.id, 'la facture', selectionne.email ?? '')"
                    >Envoyer la facture par e-mail</button>
                    <p v-if="emailEtudiantValide" role="status" class="mt-2 text-xs text-blue-100">Destinataire : {{ selectionne.email }}</p>
                    <p v-else class="mt-2 rounded bg-amber-400/15 p-2 text-xs text-amber-100">
                        Adresse e-mail absente ou invalide. <RouterLink :to="`/etudiants/${selectionne.id}/modifier`" class="underline">Corriger la fiche étudiant</RouterLink> avant l’envoi.
                    </p>
                    <p v-if="montantEnRetard(inscription) > 0" class="mt-2 rounded bg-red-500/20 p-2 text-xs text-red-200">En retard : {{ montant(montantEnRetard(inscription)) }} MRU</p>

                    <form class="mt-4 space-y-2 border-t border-blue-400/30 pt-4" @submit.prevent="majSituation">
                        <div class="flex gap-2">
                            <label class="flex-1 text-xs text-blue-200">Montant brut <input v-model.number="situation.montantDu" type="number" min="0" class="mt-1 w-full rounded-lg text-xs text-gray-900" required /></label>
                            <label class="flex-1 text-xs text-blue-200">Remise <input v-model.number="situation.montantRemise" type="number" min="0" class="mt-1 w-full rounded-lg text-xs text-gray-900" required /></label>
                        </div>
                        <p v-if="erreurs.montantRemise" class="text-xs text-red-200">{{ erreurs.montantRemise }}</p>
                        <textarea v-model="situation.noteFinanciere" placeholder="Note financière interne" class="w-full rounded-lg text-xs text-gray-900" maxlength="2000"></textarea>
                        <button class="bouton w-full bg-amber-500 py-2 text-xs text-white" :disabled="envoi">Mettre à jour</button>
                    </form>

                    <div class="mt-4 border-t border-blue-400/30 pt-4">
                        <p class="mb-2 text-xs text-blue-200">Échéancier</p>
                        <div v-for="e in inscription.echeances" :key="e.id" class="mb-1 flex justify-between rounded bg-white/10 px-2 py-1 text-xs">
                            <span>{{ e.libelle }} · {{ date(e.dateEcheance) }}</span><strong>{{ montant(e.montant) }}</strong>
                        </div>
                        <p v-if="!inscription.echeances?.length" class="text-xs text-blue-200">Aucune échéance.</p>
                        <form class="mt-2 grid grid-cols-2 gap-2" @submit.prevent="ajouterEcheance">
                            <input v-model="echeance.libelle" placeholder="Ex. 1re tranche" class="rounded text-xs text-gray-900" required maxlength="100" />
                            <input v-model.number="echeance.montant" type="number" min="1" placeholder="Montant" class="rounded text-xs text-gray-900" required />
                            <input v-model="echeance.dateEcheance" type="date" class="rounded text-xs text-gray-900" required aria-label="Date d’échéance" />
                            <button class="cursor-pointer rounded bg-white/10 text-xs" :disabled="envoi">+ Échéance</button>
                        </form>
                    </div>

                    <div class="mt-4 border-t border-blue-400/30 pt-4">
                        <p class="mb-2 text-xs text-blue-200">Versements</p>
                        <div class="mb-4 space-y-2">
                            <div v-for="v in versements" :key="v.id">
                                <div class="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-xs">
                                    <span>{{ date(v.dateVersement) }}</span>
                                    <span>{{ montant(v.montant) }}</span>
                                    <span :class="v.statut === 'Validée' ? 'text-green-400' : 'text-amber-400'">{{ v.statut }}</span>
                                </div>
                                <p class="px-2 text-[10px] text-blue-200">
                                    {{ v.numeroRecu }} · {{ v.modePaiement }}<template v-if="v.reference"> · {{ v.reference }}</template>
                                    <button
                                        v-if="aRole('admin', 'super_admin')"
                                        class="ml-1 cursor-pointer underline disabled:cursor-not-allowed disabled:opacity-50"
                                        :disabled="envoi || v.statut !== 'Validée'"
                                        :title="v.statut === 'Validée' ? 'Télécharger le reçu PDF' : 'Disponible après validation du versement'"
                                        @click="soumettre(() => telecharger('genererPdf', { type: 'recu', id: v.id }))"
                                    >reçu PDF</button>
                                    <button
                                        v-if="aRole('admin', 'super_admin')"
                                        type="button"
                                        class="ml-2 cursor-pointer underline"
                                        :disabled="envoi || v.statut !== 'Validée' || !emailEtudiantValide"
                                        title="Envoyer le reçu par e-mail (versement validé)"
                                        @click="envoyerDocument('recu', v.id, 'le reçu', selectionne.email ?? '')"
                                    >Envoyer</button>
                                </p>
                            </div>
                            <p v-if="!versements.length" class="text-xs text-blue-200">Aucun versement.</p>
                        </div>
                        <form class="space-y-2" @submit.prevent="confirmerVersement">
                            <p class="text-xs text-blue-200">Ajouter un versement</p>
                            <div class="flex gap-2">
                                <input v-model.number="versement.montant" type="number" min="1" placeholder="Montant" class="w-1/2 rounded-lg text-xs text-gray-900" required />
                                <input v-model="versement.dateVersement" type="date" class="w-1/2 rounded-lg text-xs text-gray-900" required aria-label="Date du versement" />
                            </div>
                            <select v-model="versement.statut" class="w-full rounded-lg text-xs text-gray-900" aria-label="Statut"><option>Validée</option><option>En attente</option></select>
                            <div class="flex gap-2">
                                <select v-model="versement.modePaiement" class="w-1/2 rounded-lg text-xs text-gray-900" aria-label="Mode de paiement"><option v-for="m in MODES_PAIEMENT" :key="m">{{ m }}</option></select>
                                <input v-model="versement.reference" placeholder="Référence (facultatif)" class="w-1/2 rounded-lg text-xs text-gray-900" maxlength="100" />
                            </div>
                            <textarea v-model="versement.note" placeholder="Note (facultatif)" class="w-full rounded-lg text-xs text-gray-900" maxlength="1000"></textarea>
                            <button class="bouton w-full bg-amber-500 py-2 text-xs text-white hover:bg-amber-600" :disabled="envoi">+ Ajouter le versement</button>
                        </form>
                    </div>
                    </template>
                    <div v-else class="mt-4 rounded-lg bg-green-900/30 p-3 text-sm text-green-100">
                        Aucun versement étudiant ni reçu étudiant ne doit être saisi pour cette inscription. Le règlement est suivi séparément au titre de BUMEX.
                    </div>
                </template>
                <p v-else class="mt-4 text-sm text-blue-200">
                    Cet étudiant n’a pas encore d’inscription.
                    <RouterLink v-if="aRole('admin', 'super_admin')" :to="`/etudiants/${selectionne.id}/inscriptions/nouvelle`" class="text-amber-400 underline">Créer une inscription</RouterLink>
                </p>
            </div>
        </div>

        <div v-else>
            <label class="mb-4 flex items-center gap-3 text-sm text-gray-600">Année académique :
                <select v-model="anneeSynthese" class="champ w-auto"><option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option></select>
            </label>
            <section class="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5" aria-labelledby="tarification-ue">
                <div class="mb-3">
                    <h2 id="tarification-ue" class="font-semibold text-insec">Tarifs par UE et par diplôme</h2>
                    <p class="mt-1 text-sm text-gray-600">Coût payé par l’INSEC à l’INTEC et tarif facturé à l’étudiant.</p>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <article class="rounded-lg border border-white bg-white p-4">
                        <h3 class="font-semibold text-insec">DGC</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Coût INTEC</dt><dd class="font-semibold text-gray-900">160 € / UE</dd></div>
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Tarif étudiant</dt><dd class="font-semibold text-gray-900">16 000 MRU / UE</dd></div>
                        </dl>
                    </article>
                    <article class="rounded-lg border border-white bg-white p-4">
                        <h3 class="font-semibold text-insec">DSGC</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Coût INTEC</dt><dd class="font-semibold text-gray-900">180 € / UE</dd></div>
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Tarif étudiant</dt><dd class="font-semibold text-gray-900">18 000 MRU / UE</dd></div>
                        </dl>
                    </article>
                </div>
            </section>
            <section v-if="anneeSynthese === '2024-2025' && aRole('admin', 'super_admin')" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h2 class="font-semibold text-emerald-900">Règlement BUMEX — 2024–2025</h2>
                <p class="mt-1 text-sm text-emerald-800">Vous avez confirmé que BUMEX a réglé l’intégralité des 11 inscriptions historiques. La confirmation vérifie les 11 dossiers et leurs 41 UE avant d’enregistrer le règlement (656 000 MRU). Aucun paiement étudiant ni reçu fictif n’est créé.</p>
                <button class="bouton mt-3 bg-emerald-700 text-white" :disabled="envoi" @click="confirmerBumex">Confirmer le règlement intégral de BUMEX</button>
            </section>
            <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="carte p-4"><p class="text-xs text-gray-500">Étudiants inscrits · {{ carte?.libelle }}</p><p class="text-xl font-bold text-insec">{{ carte?.etudiants ?? 0 }}</p><p class="mt-1 text-xs text-gray-500">{{ carte?.nbEtudiants ?? 0 }} à leur charge · {{ carte?.nbBumex ?? 0 }} pris en charge par BUMEX</p></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Part des étudiants · dû / encaissé / restant</p><p class="text-sm font-bold text-insec">{{ millions(carte?.du) }} / {{ millions(carte?.encaisse) }} / {{ millions(carte?.resteEtudiants) }} M MRU</p></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Part BUMEX · couvert / réglé</p><p class="text-sm font-bold text-green-700">{{ millions(carte?.montantBumex) }} / {{ millions(carte?.bumexRegle) }} M MRU</p></div>
            </div>
            <div class="overflow-x-auto rounded-xl bg-white shadow">
                <table class="tableau">
                    <thead><tr><th>Année académique</th><th>Étudiants</th><th>À leur charge · dû</th><th>Encaissé</th><th>Restant</th><th>BUMEX couvert</th><th>BUMEX réglé</th><th>Statut étudiants</th></tr></thead>
                    <tbody>
                        <tr v-for="s in synthese.filter((x) => x.nb > 0)" :key="s.id">
                            <td>{{ s.libelle }}<span class="block text-xs text-gray-500">{{ s.nbEtudiants }} étudiant(s) · {{ s.nbBumex }} BUMEX</span></td><td>{{ s.etudiants }}</td><td>{{ montant(s.du) }}</td><td>{{ montant(s.encaisse) }}</td><td>{{ montant(s.resteEtudiants) }}</td><td>{{ montant(s.montantBumex) }}</td><td>{{ montant(s.bumexRegle) }}</td><td><BadgeStatut :statut="s.statut" /></td>
                        </tr>
                        <tr v-if="!synthese.some((x) => x.nb > 0)"><td colspan="8" class="p-6 text-center text-gray-400">Aucune donnée.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </Chargement>
</template>
