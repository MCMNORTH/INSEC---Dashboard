<script setup lang="ts">
import { MODES_PAIEMENT, montantEnRetard, montantNet, soldeRestant, statutPaiement } from '@shared/domaine';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, reactive, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../api';
import BadgeStatut from '../composants/BadgeStatut.vue';
import Chargement from '../composants/Chargement.vue';
import { indexer, useRequete } from '../donnees';
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
const { formation, annee, annees } = useReferentiel();
const onglet = ref<'etudiants' | 'synthese'>(route.query.onglet === 'synthese' ? 'synthese' : 'etudiants');
const { donnees: etudiants, chargement, erreur } = useRequete<Etudiant>(() => query(collection(db, 'etudiants'), orderBy('nom')));
const { donnees: inscriptions } = useRequete<Inscription>(() => collection(db, 'inscriptions'));
const parInscription = computed(() => indexer(inscriptions.value));
const recherche = ref('');
const etudiantsFiltres = computed(() => {
    const t = recherche.value.trim().toLowerCase();
    return etudiants.value.filter((e) => !t || `${e.nom} ${e.prenom} ${e.email}`.toLowerCase().includes(t));
});

const etudiantId = computed(() => (typeof route.query.etudiant === 'string' ? route.query.etudiant : null));
const selectionne = computed(() => etudiants.value.find((e) => e.id === etudiantId.value) ?? null);
const dossiers = computed(() => inscriptions.value.filter((i) => i.etudiantId === etudiantId.value).sort((a, b) => b.ordre - a.ordre));
const inscription = computed(() => {
    const demandee = typeof route.query.inscription === 'string' ? route.query.inscription : null;
    return dossiers.value.find((i) => i.id === demandee) ?? dossiers.value[0] ?? null;
});
const { donnees: versementsBruts } = useRequete<Versement>(() =>
    inscription.value ? query(collection(db, 'versements'), where('inscriptionId', '==', inscription.value.id)) : null,
);
const versements = computed(() => [...versementsBruts.value].sort((a, b) => b.dateVersement.localeCompare(a.dateVersement)));

const ouvrir = (etudiant: string, dossier?: string) => router.replace({ query: { etudiant, ...(dossier ? { inscription: dossier } : {}) } });

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

async function envoyerDocument(type: 'facture' | 'recu', id: string, libelle: string, destinataire: string) {
    const email = destinataire.trim();
    if (!email) {
        notifier('Aucune adresse e-mail n’est enregistrée pour cet étudiant.');
        return;
    }
    if (!window.confirm(`Envoyer ${libelle} en pièce jointe à ${email} ? Le PDF contient des informations personnelles.`)) return;
    const resultat = await soumettre(() => appeler('envoyerDocumentParEmail', { type, id }));
    if (resultat) notifier(resultat.message ?? 'Document envoyé par e-mail.');
}

// Synthèse annuelle des frais facturés et encaissés.
const anneeSynthese = ref('');
watchEffect(() => {
    if (!anneeSynthese.value && annees.value[0]) anneeSynthese.value = annees.value[0].id;
});
const synthese = computed(() =>
    annees.value.map((a) => {
        const liste = inscriptions.value.filter((i) => i.anneeId === a.id);
        const du = liste.reduce((t, i) => t + montantNet(i), 0);
        const encaisse = liste.reduce((t, i) => t + (i.totalVerse ?? 0), 0);
        return { id: a.id, libelle: a.libelle, nb: liste.length, du, encaisse, statut: du > 0 && encaisse >= du ? 'Soldé' : encaisse > 0 ? 'Partiel' : 'Impayé' };
    }),
);
const carte = computed(() => synthese.value.find((s) => s.id === anneeSynthese.value));
const millions = (v = 0) => (v / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
                <div class="p-3"><input v-model="recherche" type="search" placeholder="Rechercher un étudiant…" class="champ" aria-label="Rechercher" /></div>
                <div class="max-h-[70vh] overflow-y-auto">
                    <table class="tableau">
                        <thead class="sticky top-0"><tr><th>Étudiant</th><th>Restant</th><th>Statut</th></tr></thead>
                        <tbody>
                            <tr
                                v-for="e in etudiantsFiltres"
                                :key="e.id"
                                :class="['cursor-pointer hover:bg-gray-50', e.id === etudiantId ? 'bg-blue-50' : '']"
                                @click="ouvrir(e.id)"
                            >
                                <td class="text-gray-900">{{ e.nom }} {{ e.prenom }}</td>
                                <td class="text-gray-700">{{ montant(e.derniere && parInscription.get(e.derniere.inscriptionId) ? soldeRestant(parInscription.get(e.derniere.inscriptionId)!) : 0) }}</td>
                                <td>
                                    <BadgeStatut :statut="e.derniere && parInscription.get(e.derniere.inscriptionId) ? statutPaiement(parInscription.get(e.derniere.inscriptionId)!) : 'Non inscrit'" />
                                </td>
                            </tr>
                            <tr v-if="!etudiantsFiltres.length"><td colspan="3" class="p-6 text-center text-gray-400">Aucun étudiant.</td></tr>
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
                        :disabled="envoi"
                        @click="envoyerDocument('facture', inscription.id, 'la facture', selectionne.email)"
                    >Envoyer la facture par e-mail</button>
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
                                    <button v-if="aRole('admin', 'super_admin')" class="ml-1 cursor-pointer underline" @click="soumettre(() => telecharger('genererPdf', { type: 'recu', id: v.id }))">reçu PDF</button>
                                    <button
                                        v-if="aRole('admin', 'super_admin')"
                                        type="button"
                                        class="ml-2 cursor-pointer underline"
                                        :disabled="envoi || v.statut !== 'Validée'"
                                        title="Envoyer le reçu par e-mail (versement validé)"
                                        @click="envoyerDocument('recu', v.id, 'le reçu', selectionne.email)"
                                    >Envoyer</button>
                                </p>
                            </div>
                            <p v-if="!versements.length" class="text-xs text-blue-200">Aucun versement.</p>
                        </div>
                        <form class="space-y-2" @submit.prevent="ajouterVersement">
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
            <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div class="carte p-4"><p class="text-xs text-gray-500">Inscriptions concernées</p><p class="text-xl font-bold text-insec">{{ carte?.nb ?? 0 }}</p></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Frais nets facturés</p><p class="text-xl font-bold text-insec">{{ millions(carte?.du) }} M MRU</p></div>
                <div class="carte p-4"><p class="text-xs text-gray-500">Encaissé auprès des étudiants</p><p class="text-xl font-bold text-green-600">{{ millions(carte?.encaisse) }} M MRU</p></div>
            </div>
            <div class="overflow-x-auto rounded-xl bg-white shadow">
                <table class="tableau">
                    <thead><tr><th>Année académique</th><th>Inscriptions</th><th>Montant dû</th><th>Encaissé</th><th>Statut</th></tr></thead>
                    <tbody>
                        <tr v-for="s in synthese.filter((x) => x.nb > 0)" :key="s.id">
                            <td>{{ s.libelle }}</td><td>{{ s.nb }}</td><td>{{ montant(s.du) }}</td><td>{{ montant(s.encaisse) }}</td><td><BadgeStatut :statut="s.statut" /></td>
                        </tr>
                        <tr v-if="!synthese.some((x) => x.nb > 0)"><td colspan="5" class="p-6 text-center text-gray-400">Aucune donnée.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </Chargement>
</template>
