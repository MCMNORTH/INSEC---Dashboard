import type { Transaction } from 'firebase-admin/firestore';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, libererUnique, verifierUnique, type Doc } from '../lib/donnees.js';
import { bucket, db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { ROLES_ADMIN, STATUTS_ETUDIANT, STATUTS_INSCRIPTION } from '../shared/domaine.js';

const emailOptionnel = z.preprocess(
    (valeur) => (typeof valeur === 'string' && valeur.trim() === '' ? null : valeur),
    z.string().trim().toLowerCase().max(255).pipe(z.email('adresse e-mail invalide.')).nullish(),
).transform((valeur) => valeur ?? null);

const identite = z.object({
    nom: s.texte(255),
    prenom: s.texte(255),
    email: emailOptionnel,
    dateNaissance: s.dateOptionnelle(),
    telephone: s.texteOptionnel(30),
    statut: s.choix(STATUTS_ETUDIANT),
});

const champsInscription = z.object({
    formationId: s.id(),
    anneeId: s.id(),
    dateInscription: s.dateOptionnelle(),
    numeroIntec: s.texteOptionnel(100),
    ueIds: z.array(s.id()).min(1, 'sélectionnez au moins une UE.').max(50),
    financeur: s.choix(['etudiant', 'bumex'] as const).optional(),
});
type ChampsInscription = z.output<typeof champsInscription>;

export const cleEmailEtudiant = (email: string) => `etudiant-email:${email}`;

/**
 * Vérifie que l'année académique existe et que les UE choisies appartiennent au diplôme
 * et aux années de parcours définies sur chacune des UE (lectures uniquement).
 */
export async function controlerInscription(tx: Transaction, v: ChampsInscription): Promise<number | null> {
    if (new Set(v.ueIds).size !== v.ueIds.length) erreurChamp('ueIds', 'Une UE est sélectionnée plusieurs fois.');
    const [formation, annee, ...ues] = await tx.getAll(
        col.formations().doc(v.formationId),
        col.annees().doc(v.anneeId),
        ...v.ueIds.map((id) => col.ues().doc(id)),
    );
    if (!formation.exists) erreurChamp('formationId', 'Diplôme inconnu.');
    if (!annee.exists) erreurChamp('anneeId', 'Année académique inconnue.');
    const conformes = ues.filter((ue) => ue.exists && ue.get('formationId') === v.formationId);
    const parcoursValides = conformes.filter((ue) => {
        const parcours = ue.get('anneeParcours');
        return Number.isInteger(parcours) && parcours >= 1 && parcours <= (formation.get('dureeAnnees') ?? 1);
    });
    if (conformes.length !== v.ueIds.length || parcoursValides.length !== v.ueIds.length) {
        erreurChamp('ueIds', 'Chaque UE choisie doit appartenir au diplôme et avoir une année de parcours valide.');
    }
    const parcours = [...new Set(parcoursValides.map((ue) => ue.get('anneeParcours') as number))];
    return parcours.length === 1 ? parcours[0] : null;
}

export function attributsInscription(v: ChampsInscription, statut: string, anneeParcours: number | null) {
    return {
        formationId: v.formationId,
        anneeId: v.anneeId,
        anneeParcours,
        dateInscription: v.dateInscription,
        numeroIntec: v.numeroIntec,
        statut,
        ueIds: v.ueIds,
        financeur: v.financeur ?? 'etudiant',
    };
}

/** Résumé de la dernière inscription et index de recherche stockés sur la fiche étudiant. */
export function resumeInscriptions(inscriptions: (Doc & { id: string })[]) {
    const triees = [...inscriptions].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    const derniere = triees.at(-1);
    return {
        derniere: derniere
            ? { inscriptionId: derniere.id, formationId: derniere.formationId, anneeId: derniere.anneeId, statut: derniere.statut }
            : null,
        formationIds: [...new Set(triees.map((i) => i.formationId))],
        anneeIds: [...new Set(triees.map((i) => i.anneeId))],
        nbInscriptions: triees.length,
    };
}

export const creerEtudiant = operation('creerEtudiant', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(identite.extend(champsInscription.shape).extend({ noteFinanciere: s.texteOptionnel(2000) }), donnees);
    const etudiantRef = col.etudiants().doc();
    const inscriptionRef = col.inscriptions().doc();
    await db.runTransaction(async (tx) => {
        const reserver = v.email
            ? await verifierUnique(tx, cleEmailEtudiant(v.email), etudiantRef.id, 'Cet e-mail est déjà utilisé par un autre étudiant.', 'email')
            : () => {};
        const anneeParcours = await controlerInscription(tx, v);
        const inscription = {
            etudiantId: etudiantRef.id,
            ...attributsInscription(v, 'active', anneeParcours),
            montantDu: 0, montantRemise: 0, noteFinanciere: v.noteFinanciere, totalVerse: 0, echeances: [], ordre: 1,
        };
        const etudiant = {
            nom: v.nom, prenom: v.prenom, email: v.email, dateNaissance: v.dateNaissance, telephone: v.telephone, statut: v.statut,
            ...resumeInscriptions([{ id: inscriptionRef.id, ...inscription }]),
        };
        reserver();
        tx.set(etudiantRef, { ...etudiant, ...trace(acteur, true) });
        tx.set(inscriptionRef, { ...inscription, ...trace(acteur, true) });
        auditerModele(tx, acteur, 'Etudiant', etudiantRef.id, 'created', null, etudiant);
        auditerModele(tx, acteur, 'Inscription', inscriptionRef.id, 'created', null, inscription);
    });
    return { id: etudiantRef.id, message: 'Étudiant et première inscription enregistrés.' };
});

export const modifierEtudiant = operation('modifierEtudiant', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(identite.extend({ id: s.id() }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.etudiants().doc(v.id);
        const avant = await exiger(tx, ref, 'Étudiant introuvable.');
        const reserver = v.email
            ? await verifierUnique(tx, cleEmailEtudiant(v.email), v.id, 'Cet e-mail est déjà utilisé par un autre étudiant.', 'email')
            : () => {};
        const apres = { nom: v.nom, prenom: v.prenom, email: v.email, dateNaissance: v.dateNaissance, telephone: v.telephone, statut: v.statut };
        if (avant.email && avant.email !== v.email) libererUnique(tx, cleEmailEtudiant(avant.email));
        reserver();
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Etudiant', v.id, 'updated', avant, apres);
    });
    return { message: 'Identité mise à jour sans modifier l’historique.' };
});

export const supprimerEtudiant = operation('supprimerEtudiant', ROLES_ADMIN, async (donnees, acteur) => {
    const { id } = valider(z.object({ id: s.id() }), donnees);
    const chemins: string[] = [];
    await db.runTransaction(async (tx) => {
        const ref = col.etudiants().doc(id);
        const etudiant = await exiger(tx, ref, 'Étudiant introuvable.');
        const versements = await tx.get(col.versements().where('etudiantId', '==', id).limit(1));
        if (!versements.empty) refuser('Impossible de supprimer cet étudiant : un historique financier existe.');
        const [inscriptions, resultats, pieces, candidatures, comptes] = await Promise.all([
            tx.get(col.inscriptions().where('etudiantId', '==', id)),
            tx.get(col.resultats().where('etudiantId', '==', id)),
            tx.get(col.pieces().where('etudiantId', '==', id)),
            tx.get(col.candidatures().where('etudiantId', '==', id)),
            tx.get(col.utilisateurs().where('etudiantId', '==', id)),
        ]);
        const examensTouches = new Map<string, number>();
        resultats.docs.forEach((r) => examensTouches.set(r.get('examenId'), (examensTouches.get(r.get('examenId')) ?? 0) + 1));
        for (const i of inscriptions.docs) {
            tx.delete(i.ref);
            auditerModele(tx, acteur, 'Inscription', i.id, 'deleted', i.data(), null);
        }
        resultats.docs.forEach((r) => tx.delete(r.ref));
        examensTouches.forEach((n, examenId) => tx.update(col.examens().doc(examenId), { nbConvoques: FieldValue.increment(-n) }));
        pieces.docs.forEach((p) => {
            chemins.push(p.get('chemin'));
            tx.delete(p.ref);
        });
        candidatures.docs.forEach((c) => tx.update(c.ref, { etudiantId: null }));
        comptes.docs.forEach((c) => tx.update(c.ref, { etudiantId: null }));
        if (etudiant.email) libererUnique(tx, cleEmailEtudiant(etudiant.email));
        tx.delete(ref);
        auditerModele(tx, acteur, 'Etudiant', id, 'deleted', etudiant, null);
    });
    await Promise.all(chemins.map((c) => bucket().file(c).delete({ ignoreNotFound: true })));
    return { message: 'Étudiant supprimé.' };
});

export const creerInscription = operation('creerInscription', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(champsInscription.extend({ etudiantId: s.id() }), donnees);
    const ref = col.inscriptions().doc();
    await db.runTransaction(async (tx) => {
        const etudiantRef = col.etudiants().doc(v.etudiantId);
        await exiger(tx, etudiantRef, 'Étudiant introuvable.');
        const anneeParcours = await controlerInscription(tx, v);
        const existantes = await tx.get(col.inscriptions().where('etudiantId', '==', v.etudiantId));
        const doublonActif = existantes.docs.some((inscription) =>
            inscription.get('statut') === 'active'
            && inscription.get('formationId') === v.formationId
            && inscription.get('anneeId') === v.anneeId,
        );
        if (doublonActif) {
            erreurChamp('formationId', 'Une inscription active existe déjà pour ce diplôme et cette année scolaire.');
        }
        const inscription = {
            etudiantId: v.etudiantId,
            ...attributsInscription(v, 'active', anneeParcours),
            montantDu: 0, montantRemise: 0, noteFinanciere: null, totalVerse: 0, echeances: [],
            ordre: existantes.size + 1,
        };
        const toutes = [...existantes.docs.map((d) => ({ id: d.id, ...d.data() })), { id: ref.id, ...inscription }];
        tx.set(ref, { ...inscription, ...trace(acteur, true) });
        tx.update(etudiantRef, { ...resumeInscriptions(toutes), ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', ref.id, 'created', null, inscription);
    });
    return { id: ref.id, message: 'Nouvelle inscription ajoutée ; l’historique précédent est conservé.' };
});

export const modifierInscription = operation('modifierInscription', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(champsInscription.extend({ id: s.id(), statut: s.choix(STATUTS_INSCRIPTION) }), donnees);
    let etudiantId = '';
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.id);
        const avant = await exiger(tx, ref, 'Inscription introuvable.');
        etudiantId = avant.etudiantId;
        const anneeParcours = await controlerInscription(tx, v);
        const autres = await tx.get(col.inscriptions().where('etudiantId', '==', etudiantId));
        const doublonActif = v.statut === 'active' && autres.docs.some((inscription) =>
            inscription.id !== v.id
            && inscription.get('statut') === 'active'
            && inscription.get('formationId') === v.formationId
            && inscription.get('anneeId') === v.anneeId,
        );
        if (doublonActif) {
            erreurChamp('formationId', 'Une inscription active existe déjà pour ce diplôme et cette année scolaire.');
        }
        const apres = attributsInscription(v, v.statut, anneeParcours);
        const toutes = autres.docs.map((d) => (d.id === v.id ? { ...avant, ...apres } : { id: d.id, ...d.data() }));
        tx.update(ref, { ...apres, ...trace(acteur) });
        tx.update(col.etudiants().doc(etudiantId), { ...resumeInscriptions(toutes), ...trace(acteur) });
        auditerModele(tx, acteur, 'Inscription', v.id, 'updated', avant, apres);
    });
    return { etudiantId, message: 'Inscription mise à jour.' };
});
