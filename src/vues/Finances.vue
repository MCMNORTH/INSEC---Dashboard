<script setup lang="ts">
import {
    beneficeNetInsec, coutIntecEuro, diplomeTarife, ecartAuTarif, ecartEcheancier, estRecouvrable, etatEcheances, type EtatEcheance, MODES_PAIEMENT, montantARembourser, montantDuSelonTarif,
    montantEnRetard, montantNet, ROLES_FINANCE, ROLES_VISION_ADMIN, soldeRestant, statutPaiement, TARIFS_UE, TARIFS_VALIDATION, totalEcheances,
} from '@shared/domaine';
import { collection, orderBy, query, where } from 'firebase/firestore';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { appeler } from '../api';
import BadgeStatut from '../composants/BadgeStatut.vue';
import Chargement from '../composants/Chargement.vue';
import DocumentsFinanciers from '../composants/DocumentsFinanciers.vue';
import { useRequete } from '../donnees';
import { telecharger } from '../fichiers';
import { db } from '../firebase';
import { aujourdhui, date, montant } from '../format';
import { confirmer, demanderMotif } from '../dialogue';
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
const fermer = () => router.replace({ query: { onglet: 'etudiants', annee: anneeEtudiants.value } });
watch(anneeEtudiants, (value) => {
    void router.replace({ query: { onglet: 'etudiants', annee: value } });
});

// Filtre rapide de la liste par situation de paiement.
type FiltrePaiement = 'tous' | 'retard' | 'impayes' | 'partiels' | 'soldes' | 'bumex';
const filtrePaiement = ref<FiltrePaiement>('tous');
// Apparence de chaque échéance selon son état (versements imputés dans l'ordre des dates).
const STYLE_ECHEANCE: Record<EtatEcheance, { pastille: string; icone: string }> = {
    Payée: { pastille: 'bg-emerald-50 text-emerald-600', icone: 'fa-check' },
    Partielle: { pastille: 'bg-insec-50 text-insec-600', icone: 'fa-circle-half-stroke' },
    'En retard': { pastille: 'bg-red-50 text-red-600', icone: 'fa-triangle-exclamation' },
    'À venir': { pastille: 'bg-gray-100 text-gray-500', icone: 'fa-calendar' },
};
// Comparaison du montant dû saisi avec le tarif (nombre d'UE × tarif du diplôme + validation des acquis) ; sans objet pour BUMEX.
const codeDe = (d: Inscription) => formation(d.formationId)?.code ?? d.formationId;
const tarifUe = (d: Inscription) => {
    const diplome = diplomeTarife(codeDe(d));
    return diplome ? TARIFS_UE[diplome].mru : null;
};
const tarifDe = (d: Inscription) => montantDuSelonTarif(codeDe(d), d.ueIds?.length ?? 0, d.validationAcquis);
const ecartDe = (d: Inscription) => (d.financeur === 'bumex' ? null : ecartAuTarif(codeDe(d), d.ueIds?.length ?? 0, d.montantDu, d.validationAcquis));
function appliquerTarif() {
    const tarif = inscription.value ? tarifDe(inscription.value) : null;
    if (tarif === null) return;
    situation.montantDu = tarif;
    ongletDossier.value = 'situation';
}
const statutLigne = (d: Inscription) =>
    d.financeur === 'bumex' ? (d.statutBumex === 'reglee' ? 'BUMEX a réglé' : 'À régler par BUMEX') : statutPaiement(d);
const pourcentagePaye = (d: Inscription) => {
    const net = montantNet(d);
    return net > 0 ? Math.min(100, Math.round(((d.totalVerse ?? 0) * 100) / net)) : 100;
};
const FILTRES_PAIEMENT: { valeur: FiltrePaiement; libelle: string; garder: (d: Inscription) => boolean }[] = [
    { valeur: 'tous', libelle: 'Tous', garder: () => true },
    { valeur: 'retard', libelle: 'En retard', garder: (d) => montantEnRetard(d) > 0 },
    { valeur: 'impayes', libelle: 'Impayés', garder: (d) => d.financeur !== 'bumex' && statutPaiement(d) === 'Impayé' },
    { valeur: 'partiels', libelle: 'Partiels', garder: (d) => d.financeur !== 'bumex' && statutPaiement(d) === 'Partiel' },
    { valeur: 'soldes', libelle: 'Soldés', garder: (d) => d.financeur !== 'bumex' && statutPaiement(d) === 'Soldé' },
    { valeur: 'bumex', libelle: 'BUMEX', garder: (d) => d.financeur === 'bumex' },
];
const compteFiltre = (f: (typeof FILTRES_PAIEMENT)[number]) => lignesEtudiants.value.filter(({ dossier }) => f.garder(dossier)).length;
const lignesAffichees = computed(() => {
    const filtre = FILTRES_PAIEMENT.find((f) => f.valeur === filtrePaiement.value)!;
    return lignesEtudiants.value.filter(({ dossier }) => filtre.garder(dossier));
});

// Fenêtre du dossier : onglet affiché, fermeture avec Échap, page figée derrière.
const ongletDossier = ref<'versements' | 'echeancier' | 'situation'>('versements');
watch(etudiantId, () => (ongletDossier.value = 'versements'));
function toucheEchap(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectionne.value && !echeanceEnCours.value) void fermer();
}
watch(selectionne, (ouvert) => {
    document.body.style.overflow = ouvert ? 'hidden' : '';
    if (ouvert) document.addEventListener('keydown', toucheEchap);
    else document.removeEventListener('keydown', toucheEchap);
}, { immediate: true });
onBeforeUnmount(() => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', toucheEchap);
});

// Formulaires du dossier sélectionné.
const { envoi, erreurs, soumettre } = useFormulaire();
const situation = reactive({ montantDu: 0, montantRemise: 0, noteFinanciere: '' });
// Valeurs lues dans la base ; une saisie en cours n'est pas écrasée par une mise à jour en direct
// (versement d'un collègue), et le serveur refuse si ces champs ont changé entre-temps.
const situationLue = reactive({ id: '', montantDu: 0, montantRemise: 0, noteFinanciere: '' });
watch(inscription, (i) => {
    if (!i) return;
    const saisieEnCours = situationLue.id === i.id
        && (situation.montantDu !== situationLue.montantDu || situation.montantRemise !== situationLue.montantRemise || situation.noteFinanciere !== situationLue.noteFinanciere);
    if (saisieEnCours) return;
    const valeurs = { montantDu: i.montantDu, montantRemise: i.montantRemise, noteFinanciere: i.noteFinanciere ?? '' };
    Object.assign(situation, valeurs);
    Object.assign(situationLue, { id: i.id, ...valeurs });
}, { immediate: true });
const echeance = reactive({ libelle: '', montant: null as number | null, dateEcheance: '' });
const versement = reactive({ montant: null as number | null, dateVersement: aujourdhui(), statut: 'Validée', modePaiement: 'Espèces', reference: '', note: '' });
const echeancier = reactive({ nombre: 3, premiereDate: aujourdhui(), intervalleMois: 1, remplacer: false });
const echeanceEnCours = ref<string | null>(null);
const echeanceModifiee = reactive({ libelle: '', montant: 0, dateEcheance: '' });

async function executer(operation: string, donnees: object, apres?: () => void) {
    const resultat = await soumettre(() => appeler(operation, donnees));
    if (!resultat) return;
    notifier(resultat.message ?? 'Enregistré.');
    apres?.();
}
const majSituation = () => executer('modifierSituationFinanciere', {
    id: inscription.value!.id,
    ...situation,
    attendu: { montantDu: situationLue.montantDu, montantRemise: situationLue.montantRemise, noteFinanciere: situationLue.noteFinanciere },
}, () => Object.assign(situationLue, { id: inscription.value!.id, ...situation }));
const ajouterEcheance = () =>
    executer('ajouterEcheance', { inscriptionId: inscription.value!.id, ...echeance }, () => Object.assign(echeance, { libelle: '', montant: null, dateEcheance: '' }));
const ajouterVersement = () =>
    executer('ajouterVersement', { inscriptionId: inscription.value!.id, ...versement }, () => Object.assign(versement, { montant: null, reference: '', note: '' }));
const genererEcheancier = () => executer('genererEcheancier', { inscriptionId: inscription.value!.id, ...echeancier }, () => (echeancier.remplacer = false));
function editerEcheance(e: { id: string; libelle: string; montant: number; dateEcheance: string }) {
    echeanceEnCours.value = e.id;
    Object.assign(echeanceModifiee, { libelle: e.libelle, montant: e.montant, dateEcheance: e.dateEcheance });
}
const enregistrerEcheance = () =>
    executer('modifierEcheance', { inscriptionId: inscription.value!.id, id: echeanceEnCours.value, ...echeanceModifiee }, () => (echeanceEnCours.value = null));
async function supprimerEcheance(e: { id: string; libelle: string; montant: number; dateEcheance: string }) {
    const ok = await confirmer({
        titre: 'Supprimer cette échéance ?',
        message: 'L’échéance sera retirée de l’échéancier. Les versements déjà enregistrés ne changent pas.',
        details: { Échéance: e.libelle, 'Date limite': date(e.dateEcheance), Montant: `${montant(e.montant)} MRU` },
        libelle: 'Supprimer',
        ton: 'danger',
    });
    if (ok) void executer('supprimerEcheance', { inscriptionId: inscription.value!.id, id: e.id });
}
async function traiterVersement(v: Versement, statut: 'Validée' | 'Rejetée') {
    const details = { Montant: `${montant(v.montant)} MRU`, Date: date(v.dateVersement), Mode: v.modePaiement };
    if (statut === 'Validée') {
        const ok = await confirmer({ titre: 'Valider ce versement ?', message: 'Il sera ajouté au total versé.', details, libelle: 'Valider le versement' });
        if (ok) void executer('traiterVersement', { id: v.id, statut });
        return;
    }
    const motif = await demanderMotif({
        titre: 'Rejeter ce versement ?',
        message: 'Le versement ne sera pas compté dans le total versé.',
        details,
        champ: 'Motif du rejet',
        indication: 'Ex. chèque sans provision, montant incorrect',
        libelle: 'Rejeter',
        ton: 'danger',
    });
    if (motif) void executer('traiterVersement', { id: v.id, statut, motif });
}
async function annulerVersement(v: Versement) {
    const motif = await demanderMotif({
        titre: 'Annuler ce versement validé ?',
        message: 'Il sera retiré du total versé.',
        details: { Montant: `${montant(v.montant)} MRU`, Date: date(v.dateVersement), Reçu: v.numeroRecu ?? '—' },
        champ: 'Motif de l’annulation',
        indication: 'Ex. erreur de saisie, chèque impayé',
        libelle: 'Annuler le versement',
        ton: 'danger',
    });
    if (motif) void executer('annulerVersement', { id: v.id, motif });
}
// Règlement par BUMEX d'une inscription qu'il finance (pas de versement étudiant).
const reglementBumex = reactive({ montant: 0, dateReglement: aujourdhui(), reference: '' });
watch(inscription, (i) => {
    if (i?.financeur === 'bumex') Object.assign(reglementBumex, { montant: i.montantBumex ?? montantNet(i), dateReglement: aujourdhui(), reference: '' });
}, { immediate: true });
async function confirmerReglementBumex() {
    const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim();
    const ok = await confirmer({
        titre: 'Confirmer le règlement BUMEX ?',
        details: { Étudiant: nom, Montant: `${montant(reglementBumex.montant)} MRU`, 'Date du règlement': date(reglementBumex.dateReglement) },
        libelle: 'Confirmer le règlement',
    });
    if (!ok) return;
    void executer('enregistrerReglementBumex', { inscriptionId: inscription.value!.id, regle: true, ...reglementBumex });
}
async function annulerReglementBumex() {
    const motif = await demanderMotif({
        titre: 'Annuler le règlement BUMEX ?',
        message: 'Le règlement enregistré sera retiré du dossier.',
        champ: 'Motif de l’annulation',
        indication: 'Ex. virement rejeté, erreur de saisie',
        libelle: 'Annuler le règlement',
        ton: 'danger',
    });
    if (motif) void executer('enregistrerReglementBumex', { inscriptionId: inscription.value!.id, regle: false, motif });
}

const couleurStatut = (statut: string) =>
    statut === 'Validée' ? 'text-gray-900' : statut === 'En attente' ? 'text-amber-700' : 'text-gray-400 line-through';

// Relances de paiement (envoi manuel, une par inscription et par jour au maximum).
const retardsAnnee = computed(() => lignesEtudiants.value.filter(({ dossier }) => montantEnRetard(dossier) > 0).length);
async function relancer() {
    const i = inscription.value!;
    const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim();
    const ok = await confirmer({
        titre: 'Envoyer une relance de paiement ?',
        details: { Étudiant: nom, 'E-mail': selectionne.value?.email ?? '—', 'Montant en retard': `${montant(montantEnRetard(i))} MRU` },
        libelle: 'Envoyer la relance',
        ton: 'envoi',
    });
    if (!ok) return;
    void executer('relancerPaiement', { inscriptionId: i.id });
}
async function relancerTous() {
    const ok = await confirmer({
        titre: 'Relancer tous les étudiants en retard ?',
        message: 'Un étudiant déjà relancé aujourd’hui ne recevra pas de second e-mail.',
        details: { 'Étudiants en retard': String(retardsAnnee.value), 'Année scolaire': anneeEtudiants.value },
        libelle: 'Envoyer les relances',
        ton: 'envoi',
    });
    if (!ok) return;
    void executer('relancerTousLesRetards', { anneeId: anneeEtudiants.value });
}

const confirmerVersement = async () => {
    const i = inscription.value!;
    // Paiement supérieur au reste à payer : l'excédent deviendrait un trop-perçu à rembourser.
    const excedent = (i.montantDu ?? 0) > 0 ? (versement.montant ?? 0) - soldeRestant(i) : 0;
    // Même montant à la même date déjà enregistré (hors rejeté ou annulé) : probable double saisie.
    const doublon = versements.value.find((v) =>
        v.statut !== 'Rejetée' && v.statut !== 'Annulée' && v.montant === versement.montant && v.dateVersement === versement.dateVersement);
    const valide = versement.statut === 'Validée';
    if (!valide && excedent <= 0 && !doublon) return ajouterVersement();
    const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim() || 'étudiant';
    const email = selectionne.value?.email?.trim() ?? '';
    const notification = !valide
        ? ''
        : emailEtudiantValide.value
            ? ` Une confirmation sera envoyée à ${email}.`
            : ' Aucune adresse e-mail valide : le paiement sera enregistré sans notification par e-mail.';
    const avertissements = [
        ...(doublon ? [`Un versement de ${montant(doublon.montant)} MRU à cette date est déjà enregistré (reçu ${doublon.numeroRecu ?? '—'}) : vérifiez qu’il ne s’agit pas d’une double saisie.`] : []),
        ...(excedent > 0 ? [`Ce versement dépasse le reste à payer de ${montant(excedent)} MRU : cette somme sera à rembourser à l’étudiant.`] : []),
    ];
    // Une seule fenêtre : les avertissements éventuels et le récapitulatif de validation.
    const ok = await confirmer({
        titre: doublon ? 'Ce versement est peut-être déjà enregistré' : excedent > 0 ? 'Montant supérieur au reste à payer' : 'Valider ce versement ?',
        message: avertissements.length
            ? `${avertissements.join(' ')}${notification}`
            : `Il sera immédiatement ajouté au total encaissé.${notification}`,
        details: {
            Étudiant: nom,
            Montant: `${montant(versement.montant ?? 0)} MRU`,
            ...(excedent > 0 ? { 'Reste à payer': `${montant(soldeRestant(i))} MRU` } : {}),
            Date: date(versement.dateVersement),
            Mode: versement.modePaiement,
        },
        libelle: avertissements.length ? 'Enregistrer quand même' : 'Valider le versement',
        ton: avertissements.length ? 'danger' : 'action',
    });
    if (ok) await ajouterVersement();
};

async function envoyerDocument(type: 'facture' | 'recu', id: string, libelle: string, destinataire: string) {
    const email = destinataire.trim();
    const nom = `${selectionne.value?.prenom ?? ''} ${selectionne.value?.nom ?? ''}`.trim() || 'étudiant';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        notifier('Adresse e-mail absente ou invalide. Corrigez-la dans la fiche de l’étudiant avant l’envoi.');
        return;
    }
    const ok = await confirmer({
        titre: `Envoyer ${libelle} par e-mail ?`,
        message: 'Le document PDF contient des informations personnelles : vérifiez l’adresse avant l’envoi.',
        details: { Destinataire: nom, 'E-mail': email },
        libelle: 'Envoyer',
        ton: 'envoi',
    });
    if (!ok) return;
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
        const bumex = liste.filter((i) => i.financeur === 'bumex' && i.statut !== 'annulée');
        const payeesEtudiants = liste.filter((i) => estRecouvrable(i));
        const duEtudiants = payeesEtudiants.reduce((t, i) => t + montantNet(i), 0);
        const encaisseEtudiants = payeesEtudiants.reduce((t, i) => t + (i.totalVerse ?? 0), 0);
        const resteEtudiants = payeesEtudiants.reduce((t, i) => t + soldeRestant(i), 0);
        const montantBumex = bumex.reduce((t, i) => t + (i.montantBumex ?? montantNet(i)), 0);
        const bumexRegle = bumex.filter((i) => i.statutBumex === 'reglee').reduce((t, i) => t + (i.montantBumex ?? montantNet(i)), 0);
        return { id: a.id, libelle: a.libelle, nb: liste.length, etudiants: new Set(liste.map((i) => i.etudiantId)).size, nbEtudiants: payeesEtudiants.length, nbBumex: bumex.length, du: duEtudiants, encaisse: encaisseEtudiants, resteEtudiants, montantBumex, bumexRegle, statut: duEtudiants === 0 ? (montantBumex > 0 ? (bumexRegle >= montantBumex ? 'BUMEX réglé' : 'À régler par BUMEX') : 'Aucun montant dû') : resteEtudiants === 0 ? 'Soldé' : encaisseEtudiants > 0 ? 'Partiel' : 'Impayé' };
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
// Le rôle « consultation » voit tout en lecture seule : aucun formulaire ni bouton d'action.
const peutModifier = computed(() => aRole(...ROLES_FINANCE));
// L'administration en lecture seule voit les mêmes informations qu'un administrateur (factures, reçus, documents), sans envoi.
const voitAdmin = computed(() => aRole(...ROLES_VISION_ADMIN));
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
        const diplome = diplomeTarife(code);
        const tarif = diplome ? { diplome, intec: TARIFS_UE[diplome].intecEuro, mru: TARIFS_UE[diplome].mru } : null;
        const unites = dossier.ueIds?.length ?? 0;
        const coutEuro = coutIntecEuro(code, unites, dossier.validationAcquis);
        const tarifMru = montantDuSelonTarif(code, unites, dossier.validationAcquis);
        const coutIntecMru = coutEuro !== null && tauxEuroMru.value !== null ? Math.round(coutEuro * tauxEuroMru.value) : null;
        const financeurBumex = dossier.financeur === 'bumex';
        const margeTheorique = !financeurBumex && tarifMru !== null && coutIntecMru !== null ? tarifMru - coutIntecMru : null;
        return {
            id: dossier.id,
            nom: etudiant ? `${etudiant.nom} ${etudiant.prenom}`.trim() : 'Étudiant introuvable',
            code: tarif?.diplome ?? (code || 'Diplôme à vérifier'),
            unites,
            financeurBumex,
            coutIntecEuro: coutEuro,
            coutIntecMru,
            tarifMru,
            encaisse: financeurBumex ? null : dossier.totalVerse ?? 0,
            restant: financeurBumex ? null : soldeRestant(dossier),
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
    // BUMEX règle à l'INTEC le tarif des UE en euros, sans marge pour l'INSEC.
    financementBumexEuro: detailsFinanciers.value.filter((ligne) => ligne.financeurBumex).reduce((total, ligne) => total + (ligne.coutIntecEuro ?? 0), 0),
    financementBumexMru: tauxEuroMru.value === null ? null : Math.round(detailsFinanciers.value.filter((ligne) => ligne.financeurBumex).reduce((total, ligne) => total + (ligne.coutIntecEuro ?? 0), 0) * tauxEuroMru.value),
    margeEtudiantsMru: detailsFinanciers.value.some((ligne) => !ligne.financeurBumex && ligne.margeTheorique === null) ? null : detailsFinanciers.value.filter((ligne) => !ligne.financeurBumex).reduce((total, ligne) => total + (ligne.margeTheorique ?? 0), 0),
    diplomesAControler: detailsFinanciers.value.filter((ligne) => ligne.coutIntecEuro === null).length,
}));
// Grille « Tarifs convenus » : une ligne par prestation, marge au taux EUR/MRU enregistré.
const lignesTarifs = computed(() => {
    const marge = (mru: number, euro: number) => (tauxEuroMru.value === null ? null : Math.round(mru - euro * tauxEuroMru.value));
    const diplomes = (['DGC', 'DSGC', 'CS'] as const).map((d) => ({
        cle: d, libelle: d === 'CS' ? 'Certificat' : d, unite: d === 'CS' ? 'par certificat' : 'par UE',
        euro: TARIFS_UE[d].intecEuro, mru: TARIFS_UE[d].mru, marge: marge(TARIFS_UE[d].mru, TARIFS_UE[d].intecEuro), validation: false, premiereValidation: false,
    }));
    const validations = (['VES', 'VAPP', 'VAPP+VES'] as const).map((v, i) => ({
        cle: v, libelle: v === 'VAPP+VES' ? 'VAPP + VES' : v, unite: 'par dossier',
        euro: TARIFS_VALIDATION[v].intecEuro, mru: TARIFS_VALIDATION[v].mru, marge: marge(TARIFS_VALIDATION[v].mru, TARIFS_VALIDATION[v].intecEuro), validation: true, premiereValidation: i === 0,
    }));
    return [...diplomes, ...validations];
});
// Ce qui reste à l'INSEC une fois la facture INTEC réglée, étudiants BUMEX compris (avant les autres charges).
const benefice = computed(() => {
    const t = totauxFinanciers.value;
    const net = beneficeNetInsec(t.margeEtudiantsMru, t.financementBumexMru);
    return {
        net,
        recettePayeursMru: t.tarifEtudiantsMru,
        coutIntecPayeursMru: t.margeEtudiantsMru === null ? null : t.tarifEtudiantsMru - t.margeEtudiantsMru,
    };
});
</script>


<template>
    <header class="en-tete-page">
        <div>
            <p class="surtitre">Gestion</p>
            <h1 class="titre-page mt-1.5">Finances</h1>
            <p class="sous-titre">Versements, échéances, relances et synthèse annuelle des frais facturés et encaissés, en MRU.</p>
        </div>
        <div class="inline-flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Vues des finances">
            <button
                type="button"
                role="tab"
                :aria-selected="onglet === 'etudiants'"
                :class="['inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', onglet === 'etudiants' ? 'bg-surface text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800']"
                @click="onglet = 'etudiants'"
            ><i class="fa-solid fa-user-graduate text-xs"></i>Étudiants</button>
            <button
                type="button"
                role="tab"
                :aria-selected="onglet === 'synthese'"
                :class="['inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', onglet === 'synthese' ? 'bg-surface text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800']"
                @click="onglet = 'synthese'"
            ><i class="fa-solid fa-chart-pie text-xs"></i>Synthèse annuelle</button>
        </div>
    </header>

    <Chargement :chargement="chargement" :erreur="erreur">
        <div v-if="onglet === 'etudiants'">
            <section class="carte overflow-hidden">
                <div class="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 sm:px-5">
                    <label class="flex items-center gap-1 rounded-xl border border-gray-200 bg-surface pl-3.5 shadow-xs">
                        <i class="fa-regular fa-calendar text-sm text-insec-500"></i>
                        <span class="sr-only">Année scolaire</span>
                        <select v-model="anneeEtudiants" class="border-0 bg-transparent py-2.5 pl-2 text-sm font-semibold text-gray-900 focus:ring-0">
                            <option v-for="a in annees" :key="a.id" :value="a.id">Année {{ a.libelle }}</option>
                        </select>
                    </label>
                    <span class="relative min-w-56 flex-1">
                        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[13px] text-gray-400"></i>
                        <input v-model="recherche" type="search" placeholder="Rechercher un étudiant…" class="champ pl-10" aria-label="Rechercher un étudiant" />
                    </span>
                    <button v-if="retardsAnnee && peutModifier" type="button" class="bouton-secondaire text-red-600 max-sm:w-full" :disabled="envoi" @click="relancerTous">
                        <i class="fa-regular fa-paper-plane text-xs"></i>Relancer les {{ retardsAnnee }} retard(s)
                    </button>
                </div>

                <div class="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-4 py-3 sm:px-5" role="tablist" aria-label="Filtrer par situation de paiement">
                    <button
                        v-for="f in FILTRES_PAIEMENT"
                        :key="f.valeur"
                        type="button"
                        role="tab"
                        :aria-selected="filtrePaiement === f.valeur"
                        :class="[
                            'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                            filtrePaiement === f.valeur ? 'bg-insec-600 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900',
                        ]"
                        @click="filtrePaiement = f.valeur"
                    >
                        {{ f.libelle }}
                        <span :class="['rounded-full px-1.5 text-[11px] font-semibold tabular-nums', filtrePaiement === f.valeur ? 'bg-white/20' : 'bg-surface text-gray-500']">{{ compteFiltre(f) }}</span>
                    </button>
                </div>

                <!-- Téléphone : une carte par dossier, à toucher pour l’ouvrir. -->
                <ul class="divide-y divide-gray-100 sm:hidden">
                    <li v-for="ligne in lignesAffichees" :key="ligne.dossier.id">
                        <button type="button" class="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition active:bg-gray-50" @click="ouvrir(ligne.etudiant.id, ligne.dossier.id)">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-insec-50 text-xs font-bold text-insec-700 ring-1 ring-insec-100">
                                {{ `${ligne.etudiant.nom?.[0] ?? ''}${ligne.etudiant.prenom?.[0] ?? ''}`.toUpperCase() }}
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="flex items-baseline justify-between gap-2">
                                    <strong class="truncate text-[15px] font-semibold text-gray-900">{{ ligne.etudiant.nom }} {{ ligne.etudiant.prenom }}</strong>
                                    <span v-if="ligne.dossier.financeur === 'bumex'" class="shrink-0 text-xs font-semibold text-emerald-700"><i class="fa-solid fa-building-columns mr-1 text-[10px]"></i>BUMEX</span>
                                    <span v-else class="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{{ montant(soldeRestant(ligne.dossier)) }} <span class="text-[11px] font-medium text-gray-400">MRU</span></span>
                                </span>
                                <span class="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-500">
                                    <span class="truncate">{{ formation(ligne.dossier.formationId)?.code }} · {{ ligne.dossier.ueIds.length }} UE<template v-if="ligne.dossier.financeur !== 'bumex'"> · {{ montant(ligne.dossier.totalVerse ?? 0) }} versés</template></span>
                                    <BadgeStatut :statut="statutLigne(ligne.dossier)" />
                                </span>
                                <span v-if="ligne.dossier.financeur !== 'bumex'" class="mt-2 block h-1 overflow-hidden rounded-full bg-gray-100">
                                    <span
                                        :class="['block h-full rounded-full', pourcentagePaye(ligne.dossier) >= 100 ? 'bg-emerald-500' : montantEnRetard(ligne.dossier) > 0 ? 'bg-red-500' : 'bg-insec-500']"
                                        :style="{ width: `${pourcentagePaye(ligne.dossier)}%` }"
                                    ></span>
                                </span>
                                <span v-if="ligne.dossier.financeur !== 'bumex' && montantEnRetard(ligne.dossier) > 0" class="mt-1 block text-[11px] text-red-600">dont {{ montant(montantEnRetard(ligne.dossier)) }} MRU en retard</span>
                            </span>
                            <i class="fa-solid fa-chevron-right text-xs text-gray-300"></i>
                        </button>
                    </li>
                    <li v-if="!lignesAffichees.length" class="px-4 py-12 text-center text-sm text-gray-500">
                        {{ lignesEtudiants.length ? 'Aucun dossier ne correspond à ce filtre.' : `Aucune inscription pour ${annee(anneeEtudiants)?.libelle ?? anneeEtudiants}.` }}
                    </li>
                </ul>
                <div class="overflow-x-auto max-sm:hidden">
                    <table class="tableau">
                        <thead>
                            <tr>
                                <th>Étudiant</th>
                                <th>Financeur</th>
                                <th class="text-right">Net à payer</th>
                                <th class="text-right">Versé</th>
                                <th class="text-right">Restant</th>
                                <th class="w-40">Paiement</th>
                                <th>Statut</th>
                                <th class="w-8"><span class="sr-only">Ouvrir</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="ligne in lignesAffichees" :key="ligne.dossier.id" class="group cursor-pointer" @click="ouvrir(ligne.etudiant.id, ligne.dossier.id)">
                                <td>
                                    <span class="flex items-center gap-3">
                                        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-insec-50 text-[11px] font-bold text-insec-700 ring-1 ring-insec-100">
                                            {{ `${ligne.etudiant.nom?.[0] ?? ''}${ligne.etudiant.prenom?.[0] ?? ''}`.toUpperCase() }}
                                        </span>
                                        <span class="min-w-0">
                                            <span class="block font-semibold whitespace-nowrap text-gray-900">{{ ligne.etudiant.nom }} {{ ligne.etudiant.prenom }}</span>
                                            <span class="block text-xs text-gray-500">{{ formation(ligne.dossier.formationId)?.code }} · {{ ligne.dossier.ueIds.length }} UE</span>
                                        </span>
                                    </span>
                                </td>
                                <td class="text-gray-600">
                                    <span v-if="ligne.dossier.financeur === 'bumex'" class="inline-flex items-center gap-1.5"><i class="fa-solid fa-building-columns text-xs text-emerald-600"></i>BUMEX</span>
                                    <span v-else class="inline-flex items-center gap-1.5"><i class="fa-solid fa-user text-xs text-gray-400"></i>Étudiant</span>
                                </td>
                                <template v-if="ligne.dossier.financeur === 'bumex'">
                                    <td class="text-right whitespace-nowrap tabular-nums text-gray-600">{{ montant(ligne.dossier.montantBumex ?? montantNet(ligne.dossier)) }} <span class="text-[11px] text-gray-400">MRU</span></td>
                                    <td class="text-right text-gray-300">—</td>
                                    <td class="text-right text-gray-300">—</td>
                                    <td><span class="text-xs text-gray-400">Suivi BUMEX</span></td>
                                </template>
                                <template v-else>
                                    <td class="text-right whitespace-nowrap tabular-nums text-gray-600">
                                        <span
                                            v-if="ecartDe(ligne.dossier)"
                                            class="mr-1.5 inline-flex"
                                            :title="`Montant dû différent du tarif (${montant(tarifDe(ligne.dossier) ?? 0)} MRU pour ${ligne.dossier.ueIds.length} UE)`"
                                        ><i class="fa-solid fa-triangle-exclamation text-[11px] text-amber-500"></i></span>
                                        {{ montant(montantNet(ligne.dossier)) }} <span class="text-[11px] text-gray-400">MRU</span>
                                    </td>
                                    <td class="text-right whitespace-nowrap tabular-nums text-emerald-700">{{ montant(ligne.dossier.totalVerse ?? 0) }}</td>
                                    <td class="text-right whitespace-nowrap tabular-nums">
                                        <span class="font-semibold text-gray-900">{{ montant(soldeRestant(ligne.dossier)) }}</span>
                                        <span v-if="montantEnRetard(ligne.dossier) > 0" class="block text-[11px] text-red-600">dont {{ montant(montantEnRetard(ligne.dossier)) }} en retard</span>
                                        <span v-if="montantARembourser(ligne.dossier) > 0" class="block text-[11px] text-sky-700">{{ montant(montantARembourser(ligne.dossier)) }} à rembourser</span>
                                    </td>
                                    <td>
                                        <span class="flex items-center gap-2">
                                            <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                <span
                                                    :class="['block h-full rounded-full', pourcentagePaye(ligne.dossier) >= 100 ? 'bg-emerald-500' : montantEnRetard(ligne.dossier) > 0 ? 'bg-red-500' : 'bg-insec-500']"
                                                    :style="{ width: `${pourcentagePaye(ligne.dossier)}%` }"
                                                ></span>
                                            </span>
                                            <span class="w-9 text-right text-[11px] font-medium text-gray-500 tabular-nums">{{ pourcentagePaye(ligne.dossier) }} %</span>
                                        </span>
                                    </td>
                                </template>
                                <td><BadgeStatut :statut="statutLigne(ligne.dossier)" /></td>
                                <td class="text-right"><i class="fa-solid fa-chevron-right text-[11px] text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-insec-500"></i></td>
                            </tr>
                            <tr v-if="!lignesAffichees.length">
                                <td colspan="8" class="py-14 text-center">
                                    <i class="fa-regular fa-folder-open text-xl text-gray-300"></i>
                                    <p class="mt-2 text-sm text-gray-500">
                                        {{ lignesEtudiants.length ? 'Aucun dossier ne correspond à ce filtre.' : `Aucune inscription pour ${annee(anneeEtudiants)?.libelle ?? anneeEtudiants}.` }}
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- Dossier financier : fenêtre centrée -->
            <Teleport to="body">
                <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
                    <div v-if="selectionne" class="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6" @mousedown.self="fermer">
                        <div
                            role="dialog"
                            aria-modal="true"
                            :aria-label="`Dossier financier de ${selectionne.prenom} ${selectionne.nom}`"
                            class="flex max-h-[94vh] w-full max-w-4xl animate-surgir flex-col overflow-hidden rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_24px_64px_-12px_rgb(0_0_0/0.35)] max-sm:max-h-[92dvh] sm:rounded-3xl"
                        >
                            <span class="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden" aria-hidden="true"></span>
                            <!-- En-tête : identité, inscriptions, fermeture -->
                            <header class="flex items-start gap-4 border-b border-gray-100 px-5 pt-5 pb-4 sm:px-7">
                                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-insec-600 font-titre text-base font-bold text-white">
                                    {{ `${selectionne.prenom?.[0] ?? ''}${selectionne.nom?.[0] ?? ''}`.toUpperCase() }}
                                </span>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[11px] font-semibold tracking-[0.14em] text-insec-600 uppercase">Dossier financier</p>
                                    <h2 class="truncate font-titre text-xl font-bold text-gray-900">{{ selectionne.prenom }} {{ selectionne.nom }}</h2>
                                    <div class="mt-2 flex flex-wrap items-center gap-1.5">
                                        <button
                                            v-for="d in dossiers"
                                            :key="d.id"
                                            type="button"
                                            :class="['cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition', inscription?.id === d.id ? 'bg-insec-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
                                            @click="ouvrir(selectionne.id, d.id)"
                                        >{{ formation(d.formationId)?.code }} · {{ annee(d.anneeId)?.libelle }}</button>
                                        <RouterLink :to="`/etudiants/${selectionne.id}`" class="lien ml-1 text-xs">Fiche étudiant</RouterLink>
                                    </div>
                                </div>
                                <button type="button" class="bouton-icone -mt-1 -mr-2 h-10 w-10" aria-label="Fermer le dossier" @click="fermer"><i class="fa-solid fa-xmark text-lg"></i></button>
                            </header>

                            <div class="min-h-0 flex-1 overflow-y-auto">
                                <p v-if="!inscription" class="p-7 text-sm text-gray-500">
                                    Cet étudiant n’a pas encore d’inscription.
                                    <RouterLink v-if="aRole('admin', 'super_admin')" :to="`/etudiants/${selectionne.id}/inscriptions/nouvelle`" class="lien">Créer une inscription</RouterLink>
                                </p>

                                <!-- Inscription financée par BUMEX -->
                                <div v-else-if="inscription.financeur === 'bumex'" class="space-y-5 p-5 sm:p-7">
                                    <div :class="['flex items-start gap-4 rounded-2xl border p-5', inscription.statutBumex === 'reglee' ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70']">
                                        <span :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', inscription.statutBumex === 'reglee' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
                                            <i :class="['fa-solid', inscription.statutBumex === 'reglee' ? 'fa-circle-check' : 'fa-hourglass-half']"></i>
                                        </span>
                                        <div :class="['min-w-0 flex-1 text-sm', inscription.statutBumex === 'reglee' ? 'text-emerald-900' : 'text-amber-900']">
                                            <p class="font-semibold">{{ inscription.statutBumex === 'reglee' ? 'Réglé par BUMEX' : 'À régler par BUMEX' }}</p>
                                            <p class="mt-1">
                                                Montant couvert : <strong class="tabular-nums">{{ montant(inscription.montantBumex ?? montantNet(inscription)) }} MRU</strong>
                                                <template v-if="inscription.statutBumex === 'reglee' && inscription.dateReglementBumex"> · réglé le {{ date(inscription.dateReglementBumex) }}</template>
                                                <template v-if="inscription.referenceBumex"> · réf. {{ inscription.referenceBumex }}</template>
                                            </p>
                                            <p v-if="inscription.statutBumex !== 'reglee' && inscription.motifAnnulationBumex" class="mt-1 text-xs">Dernier règlement annulé : {{ inscription.motifAnnulationBumex }}</p>
                                            <p class="mt-2 text-xs opacity-80">Aucun versement ni reçu étudiant : ce financement est suivi séparément.</p>
                                        </div>
                                        <button
                                            v-if="inscription.statutBumex === 'reglee' && peutModifier"
                                            type="button"
                                            class="bouton-fantome shrink-0 text-xs text-gray-500 hover:text-red-600"
                                            :disabled="envoi"
                                            @click="annulerReglementBumex"
                                        >Annuler</button>
                                    </div>

                                    <form v-if="inscription.statutBumex !== 'reglee' && peutModifier" class="rounded-2xl bg-gray-50/70 p-5 ring-1 ring-gray-100" @submit.prevent="confirmerReglementBumex">
                                        <p class="text-sm font-semibold text-gray-900">Enregistrer le règlement de BUMEX</p>
                                        <p class="mt-0.5 text-xs text-gray-500">À remplir quand BUMEX a effectivement payé cette inscription.</p>
                                        <div class="mt-4 grid gap-3 sm:grid-cols-3">
                                            <label class="etiquette">Montant réglé (MRU)<input v-model.number="reglementBumex.montant" type="number" min="1" class="champ mt-1.5" required /></label>
                                            <label class="etiquette">Date du règlement<input v-model="reglementBumex.dateReglement" type="date" :max="aujourdhui()" class="champ mt-1.5" required /></label>
                                            <label class="etiquette">Référence <span class="text-gray-400">(facultatif)</span><input v-model="reglementBumex.reference" placeholder="Ex. n° de virement" class="champ mt-1.5" maxlength="100" /></label>
                                        </div>
                                        <p v-if="erreurs.montant || erreurs.dateReglement" class="mt-2 text-xs text-red-600">{{ erreurs.montant || erreurs.dateReglement }}</p>
                                        <button class="bouton-principal mt-4" :disabled="envoi"><i class="fa-solid fa-check text-xs"></i>Marquer comme réglé</button>
                                    </form>
                                </div>

                                <template v-else>
                                    <!-- Chiffres clés -->
                                    <section class="px-5 pt-5 sm:px-7">
                                        <div class="grid grid-cols-3 gap-2 sm:gap-3">
                                            <div class="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100 sm:p-4">
                                                <p class="text-xs text-gray-500">Net à payer</p>
                                                <p class="mt-1 font-titre text-base font-bold text-gray-900 tabular-nums max-sm:whitespace-nowrap sm:text-2xl">{{ montant(montantNet(inscription)) }}</p>
                                                <p class="mt-0.5 text-[11px] text-gray-400">
                                                    MRU<template v-if="inscription.montantRemise"> · remise {{ montant(inscription.montantRemise) }}</template>
                                                </p>
                                            </div>
                                            <div class="rounded-2xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100 sm:p-4">
                                                <p class="text-xs text-emerald-700">Versé</p>
                                                <p class="mt-1 font-titre text-base font-bold text-emerald-700 tabular-nums max-sm:whitespace-nowrap sm:text-2xl">{{ montant(inscription.totalVerse) }}</p>
                                                <p class="mt-0.5 text-[11px] text-emerald-700/70">MRU</p>
                                            </div>
                                            <div v-if="montantARembourser(inscription) > 0" class="rounded-2xl bg-sky-50/70 p-3 ring-1 ring-sky-100 sm:p-4">
                                                <p class="text-xs text-sky-800">À rembourser</p>
                                                <p class="mt-1 font-titre text-base font-bold text-sky-800 tabular-nums max-sm:whitespace-nowrap sm:text-2xl">{{ montant(montantARembourser(inscription)) }}</p>
                                                <p class="mt-0.5 text-[11px] text-sky-800/70">MRU · {{ inscription.statut === 'annulée' ? 'inscription annulée' : 'trop-perçu' }}</p>
                                            </div>
                                            <div v-else :class="['rounded-2xl p-3 ring-1 sm:p-4', montantEnRetard(inscription) > 0 ? 'bg-red-50/70 ring-red-100' : 'bg-amber-50/70 ring-amber-100']">
                                                <p :class="['text-xs', montantEnRetard(inscription) > 0 ? 'text-red-700' : 'text-amber-800']">Reste à payer</p>
                                                <p :class="['mt-1 font-titre text-base font-bold tabular-nums max-sm:whitespace-nowrap sm:text-2xl', montantEnRetard(inscription) > 0 ? 'text-red-700' : 'text-amber-800']">{{ montant(soldeRestant(inscription)) }}</p>
                                                <p :class="['mt-0.5 text-[11px]', montantEnRetard(inscription) > 0 ? 'text-red-700/80' : 'text-amber-800/70']">
                                                    MRU<template v-if="montantEnRetard(inscription) > 0"> · {{ montant(montantEnRetard(inscription)) }} en retard</template>
                                                </p>
                                            </div>
                                        </div>
                                        <div v-if="ecartDe(inscription)" class="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                                            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
                                            <span class="min-w-0 flex-1">
                                                Le montant dû ({{ montant(inscription.montantDu) }} MRU) diffère du tarif :
                                                <strong class="tabular-nums">{{ inscription.ueIds.length }} UE × {{ montant(tarifUe(inscription) ?? 0) }} = {{ montant(tarifDe(inscription) ?? 0) }} MRU</strong>
                                                {{ ' ' }}<span class="text-amber-800/80">({{ ecartDe(inscription)! > 0 ? '+' : '' }}{{ montant(ecartDe(inscription)!) }})</span>.
                                            </span>
                                            <button v-if="peutModifier" type="button" class="bouton-secondaire min-h-0 py-1.5 text-xs max-sm:min-h-10 max-sm:w-full" @click="appliquerTarif">Utiliser le tarif</button>
                                        </div>
                                        <div class="mt-4 flex items-center gap-3">
                                            <span class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                <span
                                                    :class="['block h-full rounded-full transition-all', pourcentagePaye(inscription) >= 100 ? 'bg-emerald-500' : montantEnRetard(inscription) > 0 ? 'bg-red-500' : 'bg-insec-500']"
                                                    :style="{ width: `${pourcentagePaye(inscription)}%` }"
                                                ></span>
                                            </span>
                                            <span class="text-xs font-semibold text-gray-600 tabular-nums">{{ pourcentagePaye(inscription) }} % payé</span>
                                            <BadgeStatut :statut="statutPaiement(inscription)" />
                                        </div>

                                        <!-- Actions -->
                                        <div class="mt-4 flex flex-wrap items-center gap-2">
                                            <template v-if="voitAdmin">
                                                <button type="button" class="bouton-secondaire max-sm:flex-1" :disabled="envoi" @click="soumettre(() => telecharger('genererPdf', { type: 'facture', id: inscription.id }))">
                                                    <i class="fa-solid fa-file-pdf text-xs text-red-500"></i>Facture PDF
                                                </button>
                                                <button v-if="tauxAdmin"
                                                    type="button"
                                                    class="bouton-secondaire max-sm:flex-1"
                                                    :disabled="envoi || !emailEtudiantValide"
                                                    :title="emailEtudiantValide ? `Envoyer à ${selectionne.email}` : 'Adresse e-mail absente ou invalide'"
                                                    @click="envoyerDocument('facture', inscription.id, 'la facture', selectionne.email ?? '')"
                                                ><i class="fa-regular fa-envelope text-xs"></i>Envoyer la facture</button>
                                            </template>
                                            <button
                                                v-if="montantEnRetard(inscription) > 0 && peutModifier"
                                                type="button"
                                                class="bouton-danger max-sm:w-full"
                                                :disabled="envoi || !emailEtudiantValide || inscription.derniereRelanceLe === aujourdhui()"
                                                @click="relancer"
                                            ><i class="fa-regular fa-bell text-xs"></i>{{ inscription.derniereRelanceLe === aujourdhui() ? 'Déjà relancé aujourd’hui' : 'Relancer par e-mail' }}</button>
                                        </div>
                                        <p class="mt-2 text-xs text-gray-500">
                                            <template v-if="emailEtudiantValide"><i class="fa-regular fa-envelope mr-1"></i>{{ selectionne.email }}</template>
                                            <template v-else>
                                                <i class="fa-solid fa-triangle-exclamation mr-1 text-amber-500"></i>Adresse e-mail absente ou invalide :
                                                <RouterLink v-if="aRole('admin', 'super_admin')" :to="`/etudiants/${selectionne.id}/modifier`" class="lien">corriger la fiche</RouterLink>
                                                <template v-else>à corriger par l’administration</template>.
                                            </template>
                                            <template v-if="inscription.derniereRelanceLe"> · Dernière relance le {{ date(inscription.derniereRelanceLe) }}<template v-if="inscription.nbRelances"> ({{ inscription.nbRelances }} au total)</template></template>
                                        </p>
                                    </section>

                                    <!-- Onglets -->
                                    <div class="sticky top-0 z-10 mt-5 border-b border-gray-100 bg-surface px-5 sm:px-7" role="tablist" aria-label="Sections du dossier">
                                        <div class="flex gap-5">
                                            <button
                                                v-for="o in [
                                                    { valeur: 'versements', libelle: 'Versements', nombre: versements.length },
                                                    { valeur: 'echeancier', libelle: 'Échéancier', nombre: inscription.echeances?.length ?? 0 },
                                                    { valeur: 'situation', libelle: 'Situation', nombre: null },
                                                ] as const"
                                                :key="o.valeur"
                                                type="button"
                                                role="tab"
                                                :aria-selected="ongletDossier === o.valeur"
                                                :class="[
                                                    '-mb-px flex cursor-pointer items-center gap-2 border-b-2 py-3 text-sm font-semibold transition',
                                                    ongletDossier === o.valeur ? 'border-insec-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800',
                                                ]"
                                                @click="ongletDossier = o.valeur"
                                            >
                                                {{ o.libelle }}
                                                <span v-if="o.nombre !== null" class="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-500 tabular-nums">{{ o.nombre }}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="px-5 py-5 sm:px-7">
                                        <!-- Versements -->
                                        <div v-if="ongletDossier === 'versements'" class="grid gap-5 md:grid-cols-[1fr_300px]">
                                            <ul class="space-y-2">
                                                <li v-for="v in versements" :key="v.id" class="rounded-2xl p-3.5 ring-1 ring-gray-100">
                                                    <div class="flex items-center gap-3">
                                                        <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', v.statut === 'Validée' ? 'bg-emerald-50 text-emerald-600' : v.statut === 'En attente' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400']">
                                                            <i class="fa-solid fa-money-bill-wave text-xs"></i>
                                                        </span>
                                                        <span class="min-w-0 flex-1">
                                                            <strong :class="['block text-sm tabular-nums', couleurStatut(v.statut)]">{{ montant(v.montant) }} MRU</strong>
                                                            <span class="block truncate text-xs text-gray-500">{{ date(v.dateVersement) }} · {{ v.modePaiement }} · {{ v.numeroRecu }}<template v-if="v.reference"> · {{ v.reference }}</template></span>
                                                        </span>
                                                        <BadgeStatut :statut="v.statut" />
                                                    </div>
                                                    <p v-if="v.motifAnnulation || v.motifRejet" class="mt-2 text-xs text-red-600">Motif : {{ v.motifAnnulation || v.motifRejet }}</p>
                                                    <p class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2.5 text-xs">
                                                        <template v-if="v.statut === 'En attente' && peutModifier">
                                                            <button type="button" class="cursor-pointer font-semibold text-emerald-700 hover:underline" :disabled="envoi" @click="traiterVersement(v, 'Validée')">Valider</button>
                                                            <button type="button" class="cursor-pointer font-semibold text-red-600 hover:underline" :disabled="envoi" @click="traiterVersement(v, 'Rejetée')">Rejeter</button>
                                                        </template>
                                                        <template v-if="voitAdmin && v.statut === 'Validée'">
                                                            <button type="button" class="lien" :disabled="envoi" @click="soumettre(() => telecharger('genererPdf', { type: 'recu', id: v.id }))">Reçu PDF</button>
                                                            <button v-if="tauxAdmin" type="button" class="lien disabled:cursor-not-allowed disabled:opacity-50" :disabled="envoi || !emailEtudiantValide" @click="envoyerDocument('recu', v.id, 'le reçu', selectionne.email ?? '')">Envoyer le reçu</button>
                                                        </template>
                                                        <button v-if="v.statut === 'Validée' && peutModifier" type="button" class="ml-auto cursor-pointer font-medium text-gray-400 hover:text-red-600" :disabled="envoi" @click="annulerVersement(v)">Annuler</button>
                                                    </p>
                                                </li>
                                                <li v-if="!versements.length" class="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">Aucun versement pour l’instant.</li>
                                            </ul>
                                            <p v-if="inscription.statut === 'annulée'" class="self-start rounded-2xl bg-gray-50/70 p-4 text-sm leading-6 text-gray-600 ring-1 ring-gray-100">
                                                <i class="fa-solid fa-ban mr-1 text-gray-400"></i>Inscription annulée : aucun nouveau versement ne peut être enregistré.
                                            </p>
                                            <form v-else-if="peutModifier" class="space-y-2.5 self-start rounded-2xl bg-gray-50/70 p-4 ring-1 ring-gray-100" @submit.prevent="confirmerVersement">
                                                <p class="text-sm font-semibold text-gray-900">Nouveau versement</p>
                                                <label class="etiquette">Montant (MRU)<input v-model.number="versement.montant" type="number" min="1" class="champ mt-1" required /></label>
                                                <label class="etiquette">Date<input v-model="versement.dateVersement" type="date" class="champ mt-1" required /></label>
                                                <div class="grid grid-cols-2 gap-2">
                                                    <label class="etiquette">Mode<select v-model="versement.modePaiement" class="champ mt-1"><option v-for="m in MODES_PAIEMENT" :key="m">{{ m }}</option></select></label>
                                                    <label class="etiquette">Statut<select v-model="versement.statut" class="champ mt-1"><option>Validée</option><option>En attente</option></select></label>
                                                </div>
                                                <input v-model="versement.reference" placeholder="Référence (facultatif)" class="champ" maxlength="100" aria-label="Référence" />
                                                <textarea v-model="versement.note" placeholder="Note (facultatif)" class="champ" rows="2" maxlength="1000" aria-label="Note"></textarea>
                                                <button class="bouton-action w-full" :disabled="envoi"><i class="fa-solid fa-plus text-xs"></i>Enregistrer le versement</button>
                                            </form>
                                        </div>

                                        <!-- Échéancier -->
                                        <div v-else-if="ongletDossier === 'echeancier'" class="grid gap-5 md:grid-cols-[1fr_300px]">
                                            <div>
                                                <p v-if="inscription.echeances?.length" class="mb-3 text-xs text-gray-500">
                                                    {{ etatEcheances(inscription).filter((e) => e.etat === 'Payée').length }} / {{ inscription.echeances.length }} tranche(s) payée(s) · les versements validés sont imputés aux échéances dans l’ordre des dates.
                                                </p>
                                                <p v-if="ecartEcheancier(inscription) > 0 && soldeRestant(inscription) > 0" class="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
                                                    <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                                                    <span>L’échéancier totalise {{ montant(totalEcheances(inscription)) }} MRU pour un net de {{ montant(montantNet(inscription)) }} MRU. Si les {{ montant(ecartEcheancier(inscription)) }} MRU d’écart ont été versés avant l’échéancier, régénérez-le en cochant « Remplacer l’échéancier existant » : sinon le retard affiché est sous-estimé.</span>
                                                </p>
                                                <ul class="space-y-2">
                                                    <li v-for="e in etatEcheances(inscription)" :key="e.id">
                                                        <form v-if="echeanceEnCours === e.id" class="grid gap-2 rounded-2xl bg-insec-50/60 p-3 ring-1 ring-insec-100 sm:grid-cols-[1fr_120px_150px_auto]" @submit.prevent="enregistrerEcheance">
                                                            <input v-model="echeanceModifiee.libelle" class="champ py-2" required maxlength="100" aria-label="Libellé" />
                                                            <input v-model.number="echeanceModifiee.montant" type="number" min="1" class="champ py-2" required aria-label="Montant" />
                                                            <input v-model="echeanceModifiee.dateEcheance" type="date" class="champ py-2" required aria-label="Date d’échéance" />
                                                            <span class="flex gap-1.5">
                                                                <button class="bouton-principal" :disabled="envoi">OK</button>
                                                                <button type="button" class="bouton-fantome" @click="echeanceEnCours = null">Annuler</button>
                                                            </span>
                                                        </form>
                                                        <div v-else class="group flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-gray-100 transition hover:bg-gray-50">
                                                            <span :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs', STYLE_ECHEANCE[e.etat].pastille]"><i :class="['fa-solid', STYLE_ECHEANCE[e.etat].icone]"></i></span>
                                                            <span class="min-w-0 flex-1">
                                                                <span class="flex flex-wrap items-center gap-2">
                                                                    <span class="text-sm font-medium text-gray-900">{{ e.libelle }}</span>
                                                                    <BadgeStatut :statut="e.etat" />
                                                                </span>
                                                                <span :class="['block text-xs', e.etat === 'En retard' ? 'text-red-600' : 'text-gray-500']">
                                                                    {{ date(e.dateEcheance) }}<template v-if="e.etat === 'Partielle' || (e.etat === 'En retard' && e.paye > 0)"> · {{ montant(e.paye) }} payés, reste {{ montant(e.montant - e.paye) }}</template>
                                                                </span>
                                                            </span>
                                                            <strong class="text-sm text-gray-900 tabular-nums">{{ montant(e.montant) }} <span class="text-[11px] font-medium text-gray-400">MRU</span></strong>
                                                            <button v-if="peutModifier" type="button" class="bouton-icone h-8 w-8" title="Modifier" :disabled="envoi" @click="editerEcheance(e)"><i class="fa-solid fa-pen text-[11px]"></i></button>
                                                            <button v-if="peutModifier" type="button" class="bouton-icone h-8 w-8 hover:bg-red-50 hover:text-red-600" title="Supprimer" :disabled="envoi" @click="supprimerEcheance(e)"><i class="fa-solid fa-trash text-[11px]"></i></button>
                                                        </div>
                                                    </li>
                                                    <li v-if="!inscription.echeances?.length" class="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">Aucune échéance. Générez un échéancier ou ajoutez une échéance.</li>
                                                </ul>
                                                <p v-if="erreurs.montant" class="mt-2 text-xs text-red-600">{{ erreurs.montant }}</p>
                                            </div>
                                            <div v-if="peutModifier" class="space-y-4 self-start">
                                                <form class="space-y-2.5 rounded-2xl bg-gray-50/70 p-4 ring-1 ring-gray-100" @submit.prevent="genererEcheancier">
                                                    <p class="text-sm font-semibold text-gray-900">Générer un échéancier</p>
                                                    <p class="text-xs text-gray-500">Répartit le reste à payer ({{ montant(soldeRestant(inscription)) }} MRU). Les versements déjà validés sont repris sur une première ligne « Déjà versé ».</p>
                                                    <div class="grid grid-cols-2 gap-2">
                                                        <label class="etiquette">Tranches<input v-model.number="echeancier.nombre" type="number" min="2" max="12" class="champ mt-1" required /></label>
                                                        <label class="etiquette">Tous les (mois)<input v-model.number="echeancier.intervalleMois" type="number" min="1" max="6" class="champ mt-1" required /></label>
                                                    </div>
                                                    <label class="etiquette">1re échéance<input v-model="echeancier.premiereDate" type="date" class="champ mt-1" required /></label>
                                                    <label v-if="inscription.echeances?.length" class="flex items-center gap-2 text-xs text-gray-600"><input v-model="echeancier.remplacer" type="checkbox" /> Remplacer l’échéancier existant</label>
                                                    <p v-if="erreurs.nombre" class="text-xs text-red-600">{{ erreurs.nombre }}</p>
                                                    <button class="bouton-secondaire w-full" :disabled="envoi || soldeRestant(inscription) <= 0"><i class="fa-solid fa-wand-magic-sparkles text-xs"></i>Générer</button>
                                                </form>
                                                <form class="space-y-2.5 rounded-2xl p-4 ring-1 ring-gray-100" @submit.prevent="ajouterEcheance">
                                                    <p class="text-sm font-semibold text-gray-900">Ajouter une échéance</p>
                                                    <input v-model="echeance.libelle" placeholder="Ex. 1re tranche" class="champ" required maxlength="100" aria-label="Libellé" />
                                                    <div class="grid grid-cols-2 gap-2">
                                                        <input v-model.number="echeance.montant" type="number" min="1" placeholder="Montant" class="champ" required aria-label="Montant" />
                                                        <input v-model="echeance.dateEcheance" type="date" class="champ" required aria-label="Date d’échéance" />
                                                    </div>
                                                    <button class="bouton-secondaire w-full" :disabled="envoi"><i class="fa-solid fa-plus text-xs"></i>Ajouter</button>
                                                </form>
                                            </div>
                                        </div>

                                        <!-- Situation financière -->
                                        <form v-else class="max-w-xl" @submit.prevent="majSituation"><fieldset :disabled="!peutModifier" class="space-y-4">
                                            <p class="text-sm text-gray-500">Montant facturé et remise accordée pour cette inscription. Le net à payer et le reste sont recalculés automatiquement.</p>
                                            <div class="grid grid-cols-2 gap-3">
                                                <label class="etiquette">Montant brut (MRU)<input v-model.number="situation.montantDu" type="number" min="0" class="champ mt-1.5" required /></label>
                                                <label class="etiquette">Remise (MRU)<input v-model.number="situation.montantRemise" type="number" min="0" class="champ mt-1.5" required /></label>
                                            </div>
                                            <p v-if="erreurs.montantRemise" class="text-xs text-red-600">{{ erreurs.montantRemise }}</p>
                                            <p v-if="tarifDe(inscription) !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                <span><i class="fa-solid fa-calculator mr-1.5 text-gray-400"></i>Tarif : {{ inscription.ueIds.length }} UE × {{ montant(tarifUe(inscription) ?? 0) }} = <strong class="text-gray-800 tabular-nums">{{ montant(tarifDe(inscription)!) }} MRU</strong></span>
                                                <button v-if="situation.montantDu !== tarifDe(inscription) && peutModifier" type="button" class="lien" @click="situation.montantDu = tarifDe(inscription)!">Utiliser ce montant</button>
                                                <span v-else class="text-emerald-700"><i class="fa-solid fa-check mr-1"></i>Conforme au tarif</span>
                                            </p>
                                            <label class="etiquette">Note financière interne<textarea v-model="situation.noteFinanciere" class="champ mt-1.5" rows="3" maxlength="2000"></textarea></label>
                                            <button v-if="peutModifier" class="bouton-principal" :disabled="envoi"><i class="fa-solid fa-check text-xs"></i>Enregistrer</button>
                                            <p v-else class="text-xs text-gray-500"><i class="fa-solid fa-eye mr-1"></i>Consultation : lecture seule.</p>
                                        </fieldset></form>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>
        </div>

        <div v-else>
            <div class="carte mb-6 flex flex-wrap items-center gap-3 p-3">
                <label class="flex items-center gap-2 pl-2 text-sm font-medium text-gray-600">
                    <i class="fa-regular fa-calendar text-insec-500"></i>Année scolaire
                    <select v-model="anneeSynthese" class="champ w-auto"><option v-for="a in annees" :key="a.id" :value="a.id">{{ a.libelle }}</option></select>
                </label>
            </div>

            <section class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5" aria-label="Chiffres clés de l’année">
                <article class="carte p-4 max-sm:last:col-span-2 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">Étudiants inscrits · {{ carte?.libelle ?? anneeSynthese }}</p>
                        <span class="flex h-9 w-9 shrink-0 max-sm:hidden items-center justify-center rounded-xl bg-linear-to-br from-insec-500 to-insec-700 text-white shadow-sm"><i class="fa-solid fa-users text-[13px]"></i></span>
                    </div>
                    <p class="mt-3 font-titre text-2xl leading-none font-bold tracking-tight text-gray-900 tabular-nums sm:text-[1.75rem]">{{ carte?.etudiants ?? 0 }}</p>
                    <p class="mt-2.5 text-xs text-gray-500">{{ totauxFinanciers.unites }} UE · {{ carte?.nbEtudiants ?? 0 }} à leur charge · {{ carte?.nbBumex ?? 0 }} BUMEX</p>
                </article>
                <article class="carte p-4 max-sm:last:col-span-2 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">Facture estimée de l’INTEC</p>
                        <span class="flex h-9 w-9 shrink-0 max-sm:hidden items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-sky-600 text-white shadow-sm"><i class="fa-solid fa-euro-sign text-[13px]"></i></span>
                    </div>
                    <p class="mt-3 font-titre text-xl leading-none font-bold tracking-tight text-gray-900 tabular-nums sm:text-[1.5rem]">{{ euros(totauxFinanciers.coutIntecEuro) }}</p>
                    <p class="mt-2.5 text-xs text-gray-500">{{ totauxFinanciers.coutIntecMru === null ? 'Équivalent MRU à calculer après saisie du taux' : `≈ ${montant(totauxFinanciers.coutIntecMru)} MRU` }}</p>
                </article>
                <article class="carte p-4 max-sm:last:col-span-2 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">Tarif prévu · étudiants payeurs</p>
                        <span class="flex h-9 w-9 shrink-0 max-sm:hidden items-center justify-center rounded-xl bg-linear-to-br from-slate-400 to-slate-600 text-white shadow-sm"><i class="fa-solid fa-receipt text-[13px]"></i></span>
                    </div>
                    <p class="mt-3 font-titre text-xl leading-none font-bold tracking-tight text-gray-900 tabular-nums sm:text-[1.5rem]">{{ montant(totauxFinanciers.tarifEtudiantsMru) }}<span class="ml-1 text-sm font-semibold text-gray-400">MRU</span></p>
                    <p class="mt-2.5 text-xs text-gray-500">Recette externe théorique selon le nombre d’UE</p>
                </article>
                <article class="carte p-4 max-sm:last:col-span-2 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">Financement BUMEX · interne</p>
                        <span class="flex h-9 w-9 shrink-0 max-sm:hidden items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-sm"><i class="fa-solid fa-building-columns text-[13px]"></i></span>
                    </div>
                    <p class="mt-3 font-titre text-xl leading-none font-bold tracking-tight text-gray-900 tabular-nums sm:text-[1.5rem]">{{ euros(totauxFinanciers.financementBumexEuro) }}</p>
                    <p class="mt-2.5 text-xs text-gray-500">{{ totauxFinanciers.financementBumexMru === null ? 'Équivalent MRU à calculer après saisie du taux' : `≈ ${montant(totauxFinanciers.financementBumexMru)} MRU` }}</p>
                    <p class="mt-1 text-xs text-gray-400">Tarif INTEC par UE, payé en euros, sans marge</p>
                </article>
                <article class="carte p-4 max-sm:last:col-span-2 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <p class="text-[13px] font-medium text-gray-500">Marge des étudiants payeurs</p>
                        <span class="flex h-9 w-9 shrink-0 max-sm:hidden items-center justify-center rounded-xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-sm"><i class="fa-solid fa-arrow-trend-up text-[13px]"></i></span>
                    </div>
                    <p class="mt-3 font-titre text-xl leading-none font-bold tracking-tight text-emerald-700 tabular-nums sm:text-[1.5rem]">
                        <template v-if="totauxFinanciers.margeEtudiantsMru === null">—</template>
                        <template v-else>{{ montant(totauxFinanciers.margeEtudiantsMru) }}<span class="ml-1 text-sm font-semibold text-gray-400">MRU</span></template>
                    </p>
                    <p class="mt-2.5 text-xs text-gray-500">Estimation avant les autres charges de l’INSEC</p>
                </article>
            </section>

            <section class="carte mb-6 overflow-hidden" aria-labelledby="benefice-net-insec">
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div class="flex flex-col justify-center gap-2 p-5 sm:p-6" :class="benefice.net !== null && benefice.net < 0 ? 'bg-red-50/70' : 'bg-emerald-50/70'">
                        <div class="flex items-center gap-3">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" :class="benefice.net !== null && benefice.net < 0 ? 'bg-linear-to-br from-red-400 to-red-600' : 'bg-linear-to-br from-emerald-400 to-emerald-600'"><i class="fa-solid fa-sack-dollar text-sm"></i></span>
                            <h2 id="benefice-net-insec" class="font-titre text-base font-bold text-gray-900">Bénéfice net de l’INSEC · {{ carte?.libelle ?? anneeSynthese }}</h2>
                        </div>
                        <p class="font-titre text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-[2.25rem]" :class="benefice.net !== null && benefice.net < 0 ? 'text-red-700' : 'text-emerald-700'">
                            <template v-if="benefice.net === null">—</template>
                            <template v-else>{{ montant(benefice.net) }}<span class="ml-1 text-base font-semibold text-gray-400">MRU</span></template>
                        </p>
                        <p class="text-xs text-gray-600">
                            <template v-if="benefice.net === null">Saisissez le taux EUR/MRU pour calculer le bénéfice.</template>
                            <template v-else>Ce qui reste une fois la facture INTEC réglée, étudiants BUMEX compris.</template>
                        </p>
                    </div>
                    <dl class="divide-y divide-gray-100 p-5 text-sm sm:p-6">
                        <div class="flex items-baseline justify-between gap-4 py-2">
                            <dt class="text-gray-600">Recette des étudiants payeurs</dt>
                            <dd class="font-semibold text-gray-900 tabular-nums">{{ montant(benefice.recettePayeursMru) }} MRU</dd>
                        </div>
                        <div class="flex items-baseline justify-between gap-4 py-2">
                            <dt class="text-gray-600">− Facture INTEC des étudiants payeurs</dt>
                            <dd class="font-semibold text-gray-900 tabular-nums">{{ benefice.coutIntecPayeursMru === null ? '—' : `${montant(benefice.coutIntecPayeursMru)} MRU` }}</dd>
                        </div>
                        <div class="flex items-baseline justify-between gap-4 py-2">
                            <dt class="font-medium text-gray-700">= Marge des étudiants payeurs</dt>
                            <dd class="font-semibold text-emerald-700 tabular-nums">{{ totauxFinanciers.margeEtudiantsMru === null ? '—' : `${montant(totauxFinanciers.margeEtudiantsMru)} MRU` }}</dd>
                        </div>
                        <div class="flex items-baseline justify-between gap-4 py-2">
                            <dt class="text-gray-600">− Étudiants BUMEX, payés à l’INTEC en euros <span class="text-gray-400">({{ euros(totauxFinanciers.financementBumexEuro) }})</span></dt>
                            <dd class="font-semibold text-gray-900 tabular-nums">{{ totauxFinanciers.financementBumexMru === null ? '—' : `${montant(totauxFinanciers.financementBumexMru)} MRU` }}</dd>
                        </div>
                        <div class="flex items-baseline justify-between gap-4 pt-3">
                            <dt class="font-semibold text-gray-900">= Bénéfice net</dt>
                            <dd class="font-bold tabular-nums" :class="benefice.net !== null && benefice.net < 0 ? 'text-red-700' : 'text-emerald-700'">{{ benefice.net === null ? '—' : `${montant(benefice.net)} MRU` }}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                <section class="carte overflow-hidden xl:col-span-2" aria-labelledby="taux-euro-mru">
                    <header class="panneau-entete">
                        <div>
                            <h2 id="taux-euro-mru" class="titre-section">Taux de conversion EUR / MRU</h2>
                            <p v-if="dateTauxFormatee" class="mt-0.5 text-xs text-gray-500">Dernière mise à jour : {{ dateTauxFormatee }} · saisie manuelle</p>
                        </div>
                        <span v-if="tauxEuroMru !== null" class="pastille bg-insec-50 text-insec-700 ring-insec-600/15"><span class="h-1.5 w-1.5 rounded-full bg-insec-500"></span>1 EUR = {{ nombreFormate(tauxEuroMru) }} MRU</span>
                    </header>
                    <div class="p-5 sm:p-6">
                        <p class="text-sm text-gray-600">Saisissez le taux réellement appliqué par votre banque ou votre opération de change. Le taux est commun aux années; les montants affichés sont recalculés avec le taux enregistré.</p>
                        <p v-if="!dateTauxFormatee && !chargementTaux" class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900"><i class="fa-solid fa-circle-info mt-0.5 text-amber-500"></i>Aucun taux n’est encore enregistré. Les équivalents en MRU et les marges restent masqués jusqu’à sa saisie.</p>
                        <p v-if="erreurTaux" role="alert" class="mt-3 text-xs text-red-700">{{ erreurTaux }}</p>
                        <form v-if="tauxAdmin" class="mt-4 flex flex-wrap items-end gap-3" @submit.prevent="enregistrerTaux">
                            <label class="etiquette">1 EUR =
                                <span class="relative mt-1.5 block">
                                    <input v-model.number="tauxSaisi" class="champ w-44 pr-14 tabular-nums" type="number" min="1" max="200" step="0.01" required aria-label="Taux MRU par euro" />
                                    <span class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-semibold text-gray-400">MRU</span>
                                </span>
                            </label>
                            <button class="bouton-principal" :disabled="envoi || chargementTaux || tauxSaisi === null">Enregistrer le taux</button>
                        </form>
                        <p v-else-if="tauxEuroMru !== null" class="mt-4 font-titre text-xl font-bold text-gray-900">1 EUR = {{ nombreFormate(tauxEuroMru) }} MRU</p>
                        <p v-if="tauxEuroMru !== null" class="mt-4 text-xs text-gray-500">Taux enregistré : <strong class="text-gray-700">1 EUR = {{ nombreFormate(tauxEuroMru) }} MRU</strong>. Les conversions sont estimatives et ne comprennent pas les frais bancaires.</p>
                    </div>
                </section>

                <section class="carte overflow-hidden xl:col-span-3" aria-labelledby="tarification-ue">
                    <header class="panneau-entete">
                        <div>
                            <h2 id="tarification-ue" class="titre-section">Tarifs convenus</h2>
                            <p class="mt-0.5 text-xs text-gray-500">L’INSEC facture en MRU et règle l’INTEC en euros. Marge calculée au taux enregistré.</p>
                        </div>
                    </header>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[34rem] text-sm">
                            <thead>
                                <tr class="border-b border-gray-100 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                    <th scope="col" class="px-5 py-3 sm:px-6">Prestation</th>
                                    <th scope="col" class="px-3 py-3 text-right whitespace-nowrap">INTEC</th>
                                    <th scope="col" class="px-3 py-3 text-right whitespace-nowrap">Tarif INSEC</th>
                                    <th scope="col" class="px-5 py-3 text-right whitespace-nowrap sm:px-6">Marge</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                <tr v-for="ligne in lignesTarifs" :key="ligne.cle" :class="ligne.premiereValidation ? 'border-t-2 border-gray-100' : ''">
                                    <th scope="row" class="px-5 py-3 text-left font-normal sm:px-6">
                                        <span v-if="ligne.premiereValidation" class="mb-1.5 block text-xs font-semibold tracking-wide text-gray-500 uppercase">Validation des acquis · frais d’instruction</span>
                                        <span class="flex items-center gap-2">
                                            <span class="pastille" :class="ligne.validation ? 'bg-gray-100 text-gray-700 ring-gray-200' : 'bg-insec-600 text-white ring-insec-600'">{{ ligne.libelle }}</span>
                                            <span class="text-xs text-gray-500">{{ ligne.unite }}</span>
                                        </span>
                                    </th>
                                    <td class="px-3 py-3 text-right font-semibold whitespace-nowrap text-gray-900 tabular-nums">{{ ligne.euro }} €</td>
                                    <td class="px-3 py-3 text-right font-semibold whitespace-nowrap text-gray-900 tabular-nums">{{ montant(ligne.mru) }} <span class="text-xs font-medium text-gray-400">MRU</span></td>
                                    <td class="px-5 py-3 text-right font-semibold whitespace-nowrap tabular-nums sm:px-6" :class="ligne.marge !== null && ligne.marge < 0 ? 'text-red-700' : 'text-emerald-700'">
                                        <template v-if="ligne.marge === null">—</template>
                                        <template v-else>{{ montant(ligne.marge) }} <span class="text-xs font-medium text-gray-400">MRU</span></template>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <DocumentsFinanciers v-if="anneeSynthese && (peutModifier || voitAdmin)" :annee-id="anneeSynthese" :libelle-annee="carte?.libelle ?? anneeSynthese" />

            <p v-if="totauxFinanciers.diplomesAControler" class="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                <i class="fa-solid fa-triangle-exclamation mt-0.5 text-amber-500"></i>
                <span>{{ totauxFinanciers.diplomesAControler }} inscription(s) a(ont) un diplôme non reconnu dans le barème; leur coût n’est pas estimé.</span>
            </p>
            <section v-if="anneeSynthese === '2024-2025' && voitAdmin" class="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><i class="fa-solid fa-circle-check text-sm"></i></span>
                <div>
                    <h2 class="titre-section text-emerald-900">Règlement BUMEX — 2024–2025</h2>
                    <p class="mt-1 text-sm text-emerald-800">Les 11 inscriptions historiques, soit 41 UE et 656 000 MRU, ont été marquées réglées selon la confirmation de la direction. Cela représente un financement interne de l’INSEC; aucun versement étudiant ni reçu fictif n’est créé.</p>
                </div>
            </section>

            <section class="carte overflow-hidden">
                <header class="panneau-entete">
                    <div>
                        <h2 class="titre-section">Détail des inscriptions · {{ carte?.libelle ?? anneeSynthese }}</h2>
                        <p class="mt-0.5 text-xs text-gray-500">Coûts calculés à partir des UE inscrites et du barème du diplôme. Seules les inscriptions de l’année sélectionnée apparaissent ici.</p>
                    </div>
                </header>
                <div class="overflow-x-auto">
                    <table class="tableau">
                        <thead><tr><th>Étudiant / diplôme</th><th class="text-right">UE</th><th class="text-right">Facture INTEC</th><th class="text-right">Tarif en MRU</th><th class="text-right">Encaissement / statut</th><th>Effet pour l’INSEC</th></tr></thead>
                        <tbody>
                            <tr v-for="ligne in detailsFinanciers" :key="ligne.id">
                                <td><span class="block font-semibold text-gray-900">{{ ligne.nom }}</span><span class="block text-xs text-gray-500">{{ ligne.code }}</span></td>
                                <td class="text-right whitespace-nowrap tabular-nums">{{ ligne.unites }}</td>
                                <td class="text-right whitespace-nowrap tabular-nums">{{ ligne.coutIntecEuro === null ? 'Barème à vérifier' : euros(ligne.coutIntecEuro) }}<span class="block text-xs text-gray-500">{{ ligne.coutIntecMru === null ? '≈ — MRU' : `≈ ${montant(ligne.coutIntecMru)} MRU` }}</span></td>
                                <td class="text-right whitespace-nowrap tabular-nums">{{ ligne.tarifMru === null ? '—' : `${montant(ligne.tarifMru)} MRU` }}<span class="block text-xs text-gray-500">{{ ligne.financeurBumex ? 'Financement interne BUMEX' : 'À la charge de l’étudiant' }}</span></td>
                                <td class="text-right whitespace-nowrap tabular-nums">
                                    <template v-if="ligne.financeurBumex">
                                        <strong class="font-semibold text-amber-800">{{ ligne.coutIntecEuro === null ? 'Barème à vérifier' : euros(ligne.coutIntecEuro) }}</strong>
                                        <span class="block text-xs text-gray-500">{{ ligne.coutIntecMru === null ? '≈ — MRU' : `≈ ${montant(ligne.coutIntecMru)} MRU` }}</span>
                                        <span class="block text-xs text-gray-500">{{ ligne.bumexRegle ? 'Financement BUMEX indiqué comme réglé' : 'Financement BUMEX à suivre' }}</span>
                                    </template>
                                    <template v-else>
                                        <strong class="font-semibold text-gray-900">{{ montant(ligne.encaisse ?? 0) }} MRU encaissés</strong>
                                        <span class="block text-xs text-gray-500">{{ montant(ligne.restant ?? 0) }} MRU restant dus</span>
                                    </template>
                                </td>
                                <td class="min-w-48 text-sm text-gray-600">
                                    <template v-if="ligne.financeurBumex">Charge financée en interne; aucune marge externe n’est comptabilisée.</template>
                                    <template v-else-if="ligne.margeTheorique === null">Saisissez le taux EUR/MRU pour estimer la marge.</template>
                                    <template v-else><strong class="font-semibold text-emerald-700 tabular-nums">{{ montant(ligne.margeTheorique) }} MRU</strong><span class="block text-xs text-gray-500">Marge théorique avant les autres charges</span></template>
                                </td>
                            </tr>
                            <tr v-if="!detailsFinanciers.length"><td colspan="6" class="py-12 text-center text-sm text-gray-400">Aucune inscription enregistrée pour {{ carte?.libelle ?? anneeSynthese }}.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </Chargement>
</template>
