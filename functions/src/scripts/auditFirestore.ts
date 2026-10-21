import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldPath, getFirestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const TAILLE_PAGE = 400;
const MAX_EXEMPLES = 25;
const projet = process.argv[process.argv.indexOf('--project') + 1];
if (!projet || projet !== 'insec-bd390') {
    throw new Error('Spécifiez explicitement --project insec-bd390. Aucun autre projet ne sera inspecté.');
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Cet audit est prévu pour la base réelle; retirez FIRESTORE_EMULATOR_HOST avant de le lancer.');
}
if (!getApps().length) initializeApp({ projectId: projet, storageBucket: `${projet}.firebasestorage.app` });
const db = getFirestore();
const bucket = getStorage().bucket(`${projet}.firebasestorage.app`);

type Document = Record<string, any> & { id: string };
type Anomalie = { type: string; documentId: string; reference?: string };

async function lireCollection(nom: string, champs: string[]): Promise<Document[]> {
    const documents: Document[] = [];
    let dernier: QueryDocumentSnapshot | null = null;
    while (true) {
        let requete: Query = db.collection(nom).select(...champs).orderBy(FieldPath.documentId()).limit(TAILLE_PAGE);
        if (dernier) requete = requete.startAfter(dernier);
        const page = await requete.get();
        documents.push(...page.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (page.size < TAILLE_PAGE) return documents;
        dernier = page.docs.at(-1)!;
    }
}

async function fichiersStockage(prefixe: string): Promise<string[]> {
    const [fichiers] = await bucket.getFiles({ prefix: prefixe });
    return fichiers.map((fichier) => fichier.name);
}

const ensemble = (valeur: unknown) => [...new Set(Array.isArray(valeur) ? valeur.map(String) : [])].sort();
const memeEnsemble = (a: unknown, b: unknown) => JSON.stringify(ensemble(a)) === JSON.stringify(ensemble(b));
const anomalies: Anomalie[] = [];
const compterAnomalie = (type: string, documentId: string, reference?: string) => {
    anomalies.push({ type, documentId, ...(reference ? { reference } : {}) });
};

const collections = await db.listCollections();
const inventaire = await Promise.all(collections.map(async (collection) => ({
    collection: collection.id,
    documents: (await collection.count().get()).data().count,
})));
inventaire.push({
    collection: 'alertes (sous-collections)',
    documents: (await db.collectionGroup('alertes').count().get()).data().count,
});

const [formations, annees, ues, etudiants, inscriptions, resultats, versements, journalAudit, pieces, documentsFinanciers, dossiersStockes, financesStockees, documentsStockes] = await Promise.all([
    lireCollection('formations', ['code']),
    lireCollection('annees', ['libelle']),
    lireCollection('ues', ['code', 'formationId', 'anneeParcours']),
    lireCollection('etudiants', ['email', 'nbInscriptions', 'formationIds', 'anneeIds', 'derniere']),
    lireCollection('inscriptions', ['etudiantId', 'formationId', 'anneeId', 'anneeParcours', 'statut', 'ueIds', 'ordre', 'totalVerse']),
    lireCollection('resultats', ['inscriptionId', 'etudiantId', 'anneeId', 'ueId']),
    lireCollection('versements', ['inscriptionId', 'etudiantId', 'montant', 'statut']),
    lireCollection('journalAudit', ['modele', 'modeleId', 'action', 'operation', 'apres.totalVerse']),
    lireCollection('pieces', ['chemin']),
    lireCollection('documentsFinanciers', ['chemin', 'factureIntec', 'justificatifPaiement']),
    fichiersStockage('dossiers/'),
    fichiersStockage('finances/'),
    fichiersStockage('documents/'),
]);

const documentsInstitutionsConnus = new Set(['documents/convention-intec-2024.pdf']);
const cheminsReferences = new Set<string>([
    ...pieces.map((piece) => String(piece.chemin ?? '')).filter(Boolean),
    ...documentsFinanciers.flatMap((document) => [
        document.chemin,
        document.factureIntec?.chemin,
        document.justificatifPaiement?.chemin,
    ]).filter((chemin): chemin is string => typeof chemin === 'string' && chemin.length > 0),
    ...documentsInstitutionsConnus,
]);
const cheminsStockes = new Set([...dossiersStockes, ...financesStockees, ...documentsStockes]);
const cheminsStockageNonReferences = [...cheminsStockes].filter((chemin) =>
    !cheminsReferences.has(chemin) && !documentsInstitutionsConnus.has(chemin),
);
const cheminsStorageManquants = [...cheminsReferences].filter((chemin) => !cheminsStockes.has(chemin));

const parId = (docs: Document[]) => new Map(docs.map((d) => [d.id, d]));
const formationsParId = parId(formations);
const anneesParId = parId(annees);
const uesParId = parId(ues);
const etudiantsParId = parId(etudiants);
const inscriptionsParId = parId(inscriptions);
const journauxFinanciersParInscription = new Map<string, Document[]>();
for (const journal of journalAudit) {
    if (journal.modele !== 'Inscription' || journal.action !== 'updated' || typeof journal.modeleId !== 'string') continue;
    const historiques = journauxFinanciersParInscription.get(journal.modeleId) ?? [];
    historiques.push(journal);
    journauxFinanciersParInscription.set(journal.modeleId, historiques);
}
const inscriptionsEtudiant = new Map<string, Document[]>();
const inscriptionsActives = new Set<string>();
const paiementsValides = new Map<string, number>();
const observations: Anomalie[] = [];

for (const inscription of inscriptions) {
    const etudiantId = String(inscription.etudiantId ?? '');
    const formationId = String(inscription.formationId ?? '');
    const anneeId = String(inscription.anneeId ?? '');
    if (!etudiantsParId.has(etudiantId)) compterAnomalie('inscription_sans_etudiant', inscription.id, etudiantId);
    if (!formationsParId.has(formationId)) compterAnomalie('inscription_sans_formation', inscription.id, formationId);
    if (!anneesParId.has(anneeId)) compterAnomalie('inscription_sans_annee', inscription.id, anneeId);
    const etudiantInscriptions = inscriptionsEtudiant.get(etudiantId) ?? [];
    etudiantInscriptions.push(inscription);
    inscriptionsEtudiant.set(etudiantId, etudiantInscriptions);
    if (inscription.statut === 'active') {
        const cle = `${etudiantId}|${formationId}|${anneeId}`;
        if (inscriptionsActives.has(cle)) compterAnomalie('inscriptions_actives_en_double', inscription.id, cle);
        inscriptionsActives.add(cle);
    }
    const parcoursUes = new Set<number>();
    let uesCompletes = true;
    for (const ueId of ensemble(inscription.ueIds)) {
        const ue = uesParId.get(ueId);
        if (!ue) {
            uesCompletes = false;
            compterAnomalie('inscription_ue_introuvable', inscription.id, ueId);
        } else if (ue.formationId !== formationId || !Number.isInteger(ue.anneeParcours)) {
            uesCompletes = false;
            compterAnomalie('inscription_ue_incoherente', inscription.id, ueId);
        } else {
            parcoursUes.add(ue.anneeParcours);
        }
    }
    if (uesCompletes && parcoursUes.size > 1) {
        observations.push({ type: 'inscription_ues_multi_annees', documentId: inscription.id });
    }
    if (uesCompletes && parcoursUes.size > 0) {
        const parcoursDerive = parcoursUes.size === 1 ? [...parcoursUes][0] : null;
        const parcoursEnregistre = Number.isInteger(inscription.anneeParcours) ? inscription.anneeParcours : null;
        if (parcoursEnregistre !== parcoursDerive) compterAnomalie('inscription_parcours_derive_incoherent', inscription.id);
    }
}

for (const etudiant of etudiants) {
    const dossiers = inscriptionsEtudiant.get(etudiant.id) ?? [];
    if (Number(etudiant.nbInscriptions ?? 0) !== dossiers.length) {
        compterAnomalie('resume_nombre_inscriptions_incoherent', etudiant.id);
    }
    if (!memeEnsemble(etudiant.formationIds, dossiers.map((i) => i.formationId))) {
        compterAnomalie('resume_formations_incoherent', etudiant.id);
    }
    if (!memeEnsemble(etudiant.anneeIds, dossiers.map((i) => i.anneeId))) {
        compterAnomalie('resume_annees_incoherent', etudiant.id);
    }
    const maximumOrdre = Math.max(0, ...dossiers.map((i) => Number(i.ordre ?? 0)));
    const dernierDossier = dossiers.filter((i) => Number(i.ordre ?? 0) === maximumOrdre);
    if (dernierDossier.length === 1) {
        const dernier = dernierDossier[0];
        const resume = etudiant.derniere ?? null;
        if (!resume || resume.inscriptionId !== dernier.id || resume.formationId !== dernier.formationId
            || resume.anneeId !== dernier.anneeId || resume.statut !== dernier.statut) {
            compterAnomalie('resume_derniere_inscription_incoherent', etudiant.id, dernier.id);
        }
    }
}

for (const resultat of resultats) {
    const inscription = inscriptionsParId.get(String(resultat.inscriptionId ?? ''));
    if (!inscription) compterAnomalie('resultat_sans_inscription', resultat.id, resultat.inscriptionId);
    else {
        if (resultat.etudiantId !== inscription.etudiantId) compterAnomalie('resultat_etudiant_incoherent', resultat.id, resultat.inscriptionId);
        if (resultat.anneeId !== inscription.anneeId) compterAnomalie('resultat_annee_incoherente', resultat.id, resultat.inscriptionId);
        if (!ensemble(inscription.ueIds).includes(String(resultat.ueId ?? ''))) compterAnomalie('resultat_ue_absente_inscription', resultat.id, resultat.ueId);
    }
}

for (const versement of versements) {
    const inscriptionId = String(versement.inscriptionId ?? '');
    const inscription = inscriptionsParId.get(inscriptionId);
    if (!inscription) compterAnomalie('versement_sans_inscription', versement.id, inscriptionId);
    else if (versement.etudiantId !== inscription.etudiantId) compterAnomalie('versement_etudiant_incoherent', versement.id, inscriptionId);
    if (versement.statut === 'Validée' && inscription) {
        paiementsValides.set(inscriptionId, (paiementsValides.get(inscriptionId) ?? 0) + Number(versement.montant ?? 0));
    }
}

for (const inscription of inscriptions) {
    const totalValide = paiementsValides.get(inscription.id) ?? 0;
    if (Math.round(totalValide * 100) !== Math.round(Number(inscription.totalVerse ?? 0) * 100)) {
        const traceHistorique = (journauxFinanciersParInscription.get(inscription.id) ?? []).find((journal) =>
            Math.round(Number(journal.apres?.totalVerse ?? NaN) * 100) === Math.round(Number(inscription.totalVerse ?? 0) * 100));
        if (traceHistorique) {
            observations.push({
                type: 'solde_historique_sans_versement_individuel',
                documentId: inscription.id,
                ...(traceHistorique.operation ? { reference: String(traceHistorique.operation) } : {}),
            });
        } else {
            compterAnomalie('rapprochement_versements_a_verifier', inscription.id, `${inscription.totalVerse ?? 0} != ${totalValide}`);
        }
    }
}

const parType = Object.fromEntries([...new Set(anomalies.map((a) => a.type))].sort().map((type) => [
    type,
    { total: anomalies.filter((a) => a.type === type).length, exemples: anomalies.filter((a) => a.type === type).slice(0, MAX_EXEMPLES) },
]));
const observationsParType = Object.fromEntries([...new Set(observations.map((a) => a.type))].sort().map((type) => [
    type,
    { total: observations.filter((a) => a.type === type).length, exemples: observations.filter((a) => a.type === type).slice(0, MAX_EXEMPLES) },
]));
console.log(JSON.stringify({
    projet,
    base: '(default)',
    lectureSeule: true,
    inventaire: inventaire.sort((a, b) => a.collection.localeCompare(b.collection)),
    documentsVerifies: {
        etudiants: etudiants.length,
        inscriptions: inscriptions.length,
        resultats: resultats.length,
        versements: versements.length,
        pieces: pieces.length,
        documentsFinanciers: documentsFinanciers.length,
        journalAudit: journalAudit.length,
    },
    stockage: {
        bucket: bucket.name,
        objets: { dossiers: dossiersStockes.length, finances: financesStockees.length, documents: documentsStockes.length },
        fichiersSansReference: cheminsStockageNonReferences.slice(0, MAX_EXEMPLES),
        referencesSansFichier: cheminsStorageManquants.slice(0, MAX_EXEMPLES),
        totalFichiersSansReference: cheminsStockageNonReferences.length,
        totalReferencesSansFichier: cheminsStorageManquants.length,
    },
    anomalies: { total: anomalies.length, parType },
    observations: { total: observations.length, parType: observationsParType },
}, null, 2));
