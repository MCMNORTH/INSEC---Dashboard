<script setup lang="ts">
import { MODES_PAIEMENT, montantEnRetard, montantNet, soldeRestant, statutPaiement } from '@shared/domaine';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, onMounted, reactive, ref, watch, watchEffect } from 'vue';
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
const inscriptionsSynthese = computed(() => inscriptions.value.filter((i) => i.anneeId === anneeSynthese.value));
const tauxEuroMru = ref<number | null>(null);
const tauxSaisi = ref<number | null>(null);
const dateTaux = ref<string | null>(null);
const chargementTaux = ref(true);
const erreurTaux = ref('');
const tauxAdmin = computed(() => aRole('admin', 'super_admin'));
const nombreFormate = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const euros = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
const dateTauxFormatee = computed(() => dateTaux.value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateTaux.value)) : null);

async function chargerTaux() {
    chargementTaux.value = true;
    erreurTaux.value = '';
    try {
        const resultat = await appeler<{ taux: number | null; modifieLe: string | null }>('lireTauxEuroMru');
        tauxEuroMru.value = resultat.taux;
        tauxSaisi.value = resultat.taux;
        dateTaux.value = resultat.modifieLe;
    } catch {
        erreurTaux.value = 'Le taux de change n’a pas pu être chargé.';
    } finally {
        chargementTaux.value = false;
    }
}
onMounted(() => { void chargerTaux(); });

async function enregistrerTaux() {
    if (tauxSaisi.value === null || !Number.isFinite(tauxSaisi.value) || tauxSaisi.value < 1 || tauxSaisi.value > 200) return;
    const resultat = await soumettre(() => appeler<{ taux: number; modifieLe: string; message: string }>('modifierTauxEuroMru', { taux: tauxSaisi.value }));
    if (!resultat) return;
    tauxEuroMru.value = resultat.taux;
    dateTaux.value = resultat.modifieLe;
    erreurTaux.value = '';
    notifier(resultat.message);
}

const detailsFinanciers = computed(() => {
    const parId = new Map(etudiants.value.map((e) => [e.id, e]));
    return inscriptionsSynthese.value.map((dossier) => {
        const etudiant = parId.get(dossier.etudiantId);
        const code = formation(dossier.formationId)?.code?.toUpperCase() ?? '';
        const tarif = code.includes('DSGC') ? { diplome: 'DSGC', intec: 180, mru: 18_000 } : code.includes('DGC') ? { diplome: 'DGC', intec: 160, mru: 16_000 } : null;
        const unites = dossier.ueIds?.length ?? 0;
        const coutIntecEuro = tarif ? tarif.intec * unites : null;
        const tarifMru = tarif ? tarif.mru * unites : null;
        const coutIntecMru = coutIntecEuro !== null && tauxEuroMru.value !== null ? Math.round(coutIntecEuro * tauxEuroMru.value) : null;
        const financeurBumex = dossier.financeur === 'bumex';
        const allocationBumex = financeurBumex ? (dossier.montantBumex ?? montantNet(dossier)) : 0;
        const margeTheorique = !financeurBumex && tarifMru !== null && coutIntecMru !== null ? tarifMru - coutIntecMru : null;
        return {
            id: dossier.id,
            nom: etudiant ? `${etudiant.nom} ${etudiant.prenom}`.trim() : 'Étudiant introuvable',
            code: tarif?.diplome ?? (code || 'Diplôme à vérifier'),
            unites,
            financeurBumex,
            coutIntecEuro,
            coutIntecMru,
            tarifMru,
            encaisse: financeurBumex ? null : dossier.totalVerse ?? 0,
            restant: financeurBumex ? null : soldeRestant(dossier),
            allocationBumex,
            bumexRegle: dossier.statutBumex === 'reglee',
            margeTheorique,
        };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
});
const totauxFinanciers = computed(() => ({
    unites: detailsFinanciers.value.reduce((total, ligne) => total + ligne.unites, 0),
    coutIntecEuro: detailsFinanciers.value.reduce((total, ligne) => total + (ligne.coutIntecEuro ?? 0), 0),
    coutIntecMru: tauxEuroMru.value === null ? null : Math.round(detailsFinanciers.value.reduce((total, ligne) => total + (ligne.coutIntecEuro ?? 0), 0) * tauxEuroMru.value),
    tarifEtudiantsMru: detailsFinanciers.value.filter((ligne) => !ligne.financeurBumex).reduce((total, ligne) => total + (ligne.tarifMru ?? 0), 0),
    financementInterneBumex: detailsFinanciers.value.filter((ligne) => ligne.financeurBumex).reduce((total, ligne) => total + ligne.allocationBumex, 0),
    margeEtudiantsMru: detailsFinanciers.value.some((ligne) => !ligne.financeurBumex && ligne.margeTheorique === null) ? null : detailsFinanciers.value.filter((ligne) => !ligne.financeurBumex).reduce((total, ligne) => total + (ligne.margeTheorique ?? 0), 0),
    diplomesAControler: detailsFinanciers.value.filter((ligne) => ligne.coutIntecEuro === null).length,
}));
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

            <section class="mb-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm" aria-labelledby="taux-euro-mru">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 id="taux-euro-mru" class="font-semibold text-insec">Taux de conversion EUR / MRU</h2>
                        <p class="mt-1 text-sm text-gray-600">Saisissez le taux réellement appliqué par votre banque ou votre opération de change. Le taux est commun aux années; les montants affichés sont recalculés avec le taux enregistré.</p>
                        <p v-if="dateTauxFormatee" class="mt-1 text-xs text-gray-500">Dernière mise à jour : {{ dateTauxFormatee }} · saisie manuelle</p>
                        <p v-else-if="!chargementTaux" class="mt-1 text-xs text-amber-800">Aucun taux n’est encore enregistré. Les équivalents en MRU et les marges restent masqués jusqu’à sa saisie.</p>
                        <p v-if="erreurTaux" role="alert" class="mt-1 text-xs text-red-700">{{ erreurTaux }}</p>
                    </div>
                    <form v-if="tauxAdmin" class="flex flex-wrap items-end gap-2" @submit.prevent="enregistrerTaux">
                        <label class="etiquette">1 EUR =
                            <div class="mt-1 flex items-center gap-2">
                                <input v-model.number="tauxSaisi" class="champ w-36" type="number" min="1" max="200" step="0.01" required aria-label="Taux MRU par euro" />
                                <span class="text-sm font-semibold text-insec">MRU</span>
                            </div>
                        </label>
                        <button class="bouton bg-insec text-white" :disabled="envoi || chargementTaux || tauxSaisi === null">Enregistrer le taux</button>
                    </form>
                    <p v-else-if="tauxEuroMru !== null" class="rounded-lg bg-blue-50 px-4 py-3 text-lg font-bold text-insec">1 EUR = {{ nombreFormate(tauxEuroMru) }} MRU</p>
                </div>
                <p v-if="tauxEuroMru !== null" class="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950">Taux enregistré : <strong>1 EUR = {{ nombreFormate(tauxEuroMru) }} MRU</strong>. Les conversions sont estimatives et ne comprennent pas les frais bancaires.</p>
            </section>

            <section class="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5" aria-labelledby="tarification-ue">
                <div class="mb-3">
                    <h2 id="tarification-ue" class="font-semibold text-insec">Tarifs convenus par UE</h2>
                    <p class="mt-1 text-sm text-gray-600">L’INSEC facture en MRU et règle l’INTEC en euros. Pour un élève payeur, la marge affichée est une estimation avant les autres charges de l’INSEC.</p>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <article class="rounded-lg border border-white bg-white p-4">
                        <h3 class="font-semibold text-insec">DGC</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">À payer à l’INTEC</dt><dd class="font-semibold text-gray-900">160 € / UE</dd></div>
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Tarif en MRU</dt><dd class="font-semibold text-gray-900">16 000 MRU / UE</dd></div>
                        </dl>
                    </article>
                    <article class="rounded-lg border border-white bg-white p-4">
                        <h3 class="font-semibold text-insec">DSGC</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">À payer à l’INTEC</dt><dd class="font-semibold text-gray-900">180 € / UE</dd></div>
                            <div class="flex items-baseline justify-between gap-3"><dt class="text-gray-600">Tarif en MRU</dt><dd class="font-semibold text-gray-900">18 000 MRU / UE</dd></div>
                        </dl>
                    </article>
                </div>
            </section>

            <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <article class="carte p-4"><p class="text-xs text-gray-500">Élèves inscrits · {{ carte?.libelle ?? anneeSynthese }}</p><p class="mt-1 text-2xl font-bold text-insec">{{ carte?.etudiants ?? 0 }}</p><p class="mt-1 text-xs text-gray-500">{{ totauxFinanciers.unites }} UE · {{ carte?.nbEtudiants ?? 0 }} à leur charge · {{ carte?.nbBumex ?? 0 }} BUMEX</p></article>
                <article class="carte p-4"><p class="text-xs text-gray-500">Facture estimée de l’INTEC</p><p class="mt-1 text-lg font-bold text-insec">{{ euros(totauxFinanciers.coutIntecEuro) }}</p><p class="mt-1 text-xs text-gray-500">{{ totauxFinanciers.coutIntecMru === null ? 'Équivalent MRU à calculer après saisie du taux' : `≈ ${montant(totauxFinanciers.coutIntecMru)} MRU` }}</p></article>
                <article class="carte p-4"><p class="text-xs text-gray-500">Tarif prévu · élèves payeurs</p><p class="mt-1 text-lg font-bold text-insec">{{ montant(totauxFinanciers.tarifEtudiantsMru) }} MRU</p><p class="mt-1 text-xs text-gray-500">Recette externe théorique selon le nombre d’UE</p></article>
                <article class="carte p-4"><p class="text-xs text-gray-500">Financement BUMEX · interne</p><p class="mt-1 text-lg font-bold text-amber-700">{{ montant(totauxFinanciers.financementInterneBumex) }} MRU</p><p class="mt-1 text-xs text-gray-500">Financement interne à l’INSEC, sans recette externe pour le groupe</p></article>
                <article class="carte p-4"><p class="text-xs text-gray-500">Marge des élèves payeurs</p><p class="mt-1 text-lg font-bold text-emerald-700">{{ totauxFinanciers.margeEtudiantsMru === null ? '—' : `${montant(totauxFinanciers.margeEtudiantsMru)} MRU` }}</p><p class="mt-1 text-xs text-gray-500">Estimation avant les autres charges de l’INSEC</p></article>
            </div>

            <p v-if="totauxFinanciers.diplomesAControler" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{{ totauxFinanciers.diplomesAControler }} inscription(s) a(ont) un diplôme non reconnu dans le barème; leur coût n’est pas estimé.</p>
            <section v-if="anneeSynthese === '2024-2025' && aRole('admin', 'super_admin')" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h2 class="font-semibold text-emerald-900">Règlement BUMEX — 2024–2025</h2>
                <p class="mt-1 text-sm text-emerald-800">Les 11 inscriptions historiques, soit 41 UE et 656 000 MRU, ont été marquées réglées selon la confirmation de la direction. Cela représente un financement interne de l’INSEC; aucun versement étudiant ni reçu fictif n’est créé.</p>
            </section>

            <section class="overflow-hidden rounded-xl bg-white shadow">
                <div class="border-b border-gray-100 px-4 py-3">
                    <h2 class="font-semibold text-insec">Détail des inscriptions · {{ carte?.libelle ?? anneeSynthese }}</h2>
                    <p class="mt-1 text-xs text-gray-500">Coûts calculés à partir des UE inscrites et du barème du diplôme. Seules les inscriptions de l’année sélectionnée apparaissent ici.</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="tableau">
                        <thead><tr><th>Élève / diplôme</th><th>UE</th><th>Facture INTEC</th><th>Tarif en MRU</th><th>Encaissement / statut</th><th>Effet pour l’INSEC</th></tr></thead>
                        <tbody>
                            <tr v-for="ligne in detailsFinanciers" :key="ligne.id">
                                <td class="text-gray-900">{{ ligne.nom }}<span class="block text-xs text-gray-500">{{ ligne.code }}</span></td>
                                <td class="whitespace-nowrap">{{ ligne.unites }}</td>
                                <td class="whitespace-nowrap">{{ ligne.coutIntecEuro === null ? 'Barème à vérifier' : euros(ligne.coutIntecEuro) }}<span class="block text-xs text-gray-500">{{ ligne.coutIntecMru === null ? '≈ — MRU' : `≈ ${montant(ligne.coutIntecMru)} MRU` }}</span></td>
                                <td class="whitespace-nowrap">{{ ligne.tarifMru === null ? '—' : `${montant(ligne.tarifMru)} MRU` }}<span class="block text-xs text-gray-500">{{ ligne.financeurBumex ? 'Financement interne BUMEX' : 'À la charge de l’élève' }}</span></td>
                                <td class="whitespace-nowrap">
                                    <template v-if="ligne.financeurBumex">
                                        <strong class="text-amber-800">{{ montant(ligne.allocationBumex) }} MRU</strong>
                                        <span class="block text-xs text-gray-500">{{ ligne.bumexRegle ? 'Financement BUMEX indiqué comme réglé' : 'Financement BUMEX à suivre' }}</span>
                                    </template>
                                    <template v-else>
                                        <strong>{{ montant(ligne.encaisse ?? 0) }} MRU encaissés</strong>
                                        <span class="block text-xs text-gray-500">{{ montant(ligne.restant ?? 0) }} MRU restant dus</span>
                                    </template>
                                </td>
                                <td class="min-w-48 text-sm">
                                    <template v-if="ligne.financeurBumex">Charge financée en interne; aucune marge externe n’est comptabilisée.</template>
                                    <template v-else-if="ligne.margeTheorique === null">Saisissez le taux EUR/MRU pour estimer la marge.</template>
                                    <template v-else><strong class="text-emerald-700">{{ montant(ligne.margeTheorique) }} MRU</strong><span class="block text-xs text-gray-500">Marge théorique avant les autres charges</span></template>
                                </td>
                            </tr>
                            <tr v-if="!detailsFinanciers.length"><td colspan="6" class="p-8 text-center text-gray-500">Aucune inscription enregistrée pour {{ carte?.libelle ?? anneeSynthese }}.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </Chargement>
</template>
