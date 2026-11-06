import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, controlerModificationConcurrente, exiger, libererUnique, verifierUnique, type Doc } from '../lib/donnees.js';
import { bucket, db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, valeursAttendues, z } from '../lib/validation.js';
import { montantDuSelonTarif, ROLES_ADMIN, STATUTS_ETUDIANT, STATUTS_INSCRIPTION, uesEnDoublonVes, VALIDATIONS_ACQUIS } from '../shared/domaine.js';

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
    anneeParcours: s.entier(1, 10),
    dateInscription: s.dateOptionnelle(),
    numeroIntec: s.texteOptionnel(100),
    ueIds: z.array(s.id()).max(50),
    financeur: s.choix(['etudiant', 'bumex'] as const).optional(),
    validationAcquis: s.choix(VALIDATIONS_ACQUIS).optional(),
    ueDispenseesIds: z.array(s.id()).max(50).optional(),
});
type ChampsInscription = z.output<typeof champsInscription>;

export const cleEmailEtudiant = (email: string) => `etudiant-email:${email}`;

/**
 * Vérifie que l'année académique existe et que les UE choisies appartiennent au diplôme
 * (lectures uniquement). Un étudiant peut suivre des UE de plusieurs années du diplôme la même
 * année scolaire (choix permis par l'INTEC) ; l'année de parcours indique son année principale.
 * Les UE dispensées par VES appartiennent aussi au diplôme et ne peuvent pas être suivies la même année (non-cumul).
 * Renvoie le montant dû au tarif (UE suivies × tarif + validation des acquis), 0 si le diplôme n'a pas de tarif.
 */
export async function controlerInscription(tx: Transaction, v: ChampsInscription): Promise<number> {
    const dispensees = v.ueDispenseesIds ?? [];
    if (!v.ueIds.length && (v.validationAcquis ?? 'aucune') === 'aucune') {
        erreurChamp('ueIds', 'Sélectionnez au moins une UE, ou indiquez une validation des acquis (VES / VAPP).');
    }
    if (new Set(v.ueIds).size !== v.ueIds.length) erreurChamp('ueIds', 'Une UE est sélectionnée plusieurs fois.');
    if (new Set(dispensees).size !== dispensees.length) erreurChamp('ueDispenseesIds', 'Une UE dispensée est sélectionnée plusieurs fois.');
    if (uesEnDoublonVes(v.ueIds, dispensees).length) {
        erreurChamp('ueDispenseesIds', 'Une UE dispensée par VES ne peut pas être suivie la même année : retirez-la des UE suivies.');
    }
    const toutesUes = [...v.ueIds, ...dispensees];
    const [formation, annee, ...ues] = await tx.getAll(
        col.formations().doc(v.formationId),
        col.annees().doc(v.anneeId),
        ...toutesUes.map((id) => col.ues().doc(id)),
    );
    if (!formation.exists) erreurChamp('formationId', 'Diplôme inconnu.');
    if (!annee.exists) erreurChamp('anneeId', 'Année académique inconnue.');
    if (v.anneeParcours > (formation.get('dureeAnnees') ?? 1)) {
        erreurChamp('anneeParcours', 'L’année de parcours dépasse la durée du diplôme.');
    }
    const conformes = ues.filter((ue) => ue.exists && ue.get('formationId') === v.formationId);
    if (conformes.length !== toutesUes.length) erreurChamp('ueIds', 'Les UE choisies doivent appartenir au diplôme sélectionné.');
    return montantDuSelonTarif(formation.get('code') ?? v.formationId, v.ueIds.length, v.validationAcquis) ?? 0;
}

export function attributsInscription(v: ChampsInscription, statut: string) {
    return {
        formationId: v.formationId,
        anneeId: v.anneeId,
        anneeParcours: v.anneeParcours,
        dateInscription: v.dateInscription,
        numeroIntec: v.numeroIntec,
        statut,
        ueIds: v.ueIds,
        financeur: v.financeur ?? 'etudiant',
        validationAcquis: v.validationAcquis ?? 'aucune',
        ueDispenseesIds: v.ueDispenseesIds ?? [],
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
        const montantDu = await controlerInscription(tx, v);
        const inscription = {
            etudiantId: etudiantRef.id,
            ...attributsInscription(v, 'active'),
            montantDu, montantRemise: 0, noteFinanciere: v.noteFinanciere, totalVerse: 0, echeances: [], ordre: 1,
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
    const v = valider(identite.extend({ id: s.id(), attendu: valeursAttendues }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.etudiants().doc(v.id);
        const avant = await exiger(tx, ref, 'Étudiant introuvable.');
        controlerModificationConcurrente(avant, v.attendu);
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

/**
 * Supprime un étudiant et ses inscriptions. Avec des versements, la suppression est refusée, sauf au
 * super-administrateur qui la force avec un motif (dossier de test, doublon) : les versements sont alors
 * supprimés aussi, chacun tracé dans le journal d'audit avec le motif.
 */
export const supprimerEtudiant = operation('supprimerEtudiant', ROLES_ADMIN, async (donnees, acteur) => {
    const { id, forcer, motif } = valider(z.object({
        id: s.id(),
        forcer: z.boolean().optional(),
        motif: z.string().trim().max(500).optional(),
    }), donnees);
    const chemins: string[] = [];
    let versementsSupprimes = 0;
    await db.runTransaction(async (tx) => {
        const ref = col.etudiants().doc(id);
        const etudiant = await exiger(tx, ref, 'Étudiant introuvable.');
        const versements = await tx.get(col.versements().where('etudiantId', '==', id));
        if (!versements.empty) {
            if (!forcer) refuser('Impossible de supprimer cet étudiant : un historique financier existe.');
            if (acteur.role !== 'super_admin') {
                throw new HttpsError('permission-denied', 'Seul le super-administrateur peut supprimer un étudiant qui a des versements.');
            }
            if (!motif || motif.length < 5) erreurChamp('motif', 'Indiquez le motif de la suppression (5 caractères au moins).');
        }
        const [inscriptions, resultats, pieces, comptes] = await Promise.all([
            tx.get(col.inscriptions().where('etudiantId', '==', id)),
            tx.get(col.resultats().where('etudiantId', '==', id)),
            tx.get(col.pieces().where('etudiantId', '==', id)),
            tx.get(col.utilisateurs().where('etudiantId', '==', id)),
        ]);
        // Un historique d'examen (présence pointée ou note) ne doit jamais disparaître avec la fiche.
        if (resultats.docs.some((r) => r.get('presence') !== 'Convoqué' || (r.get('note') !== null && r.get('note') !== undefined))) {
            refuser('Impossible de supprimer cet étudiant : il a un historique d’examen (présence ou note). Annulez plutôt son inscription.');
        }
        for (const v of versements.docs) {
            tx.delete(v.ref);
            auditerModele(tx, acteur, 'Versement', v.id, 'deleted', { ...v.data(), motifSuppression: motif }, null);
        }
        versementsSupprimes = versements.size;
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
        comptes.docs.forEach((c) => tx.update(c.ref, { etudiantId: null }));
        if (etudiant.email) libererUnique(tx, cleEmailEtudiant(etudiant.email));
        tx.delete(ref);
        auditerModele(tx, acteur, 'Etudiant', id, 'deleted', versementsSupprimes ? { ...etudiant, motifSuppression: motif } : etudiant, null);
    });
    await Promise.all(chemins.map((c) => bucket().file(c).delete({ ignoreNotFound: true })));
    return { message: versementsSupprimes ? `Étudiant supprimé, avec ses ${versementsSupprimes} versement(s).` : 'Étudiant supprimé.' };
});

export const creerInscription = operation('creerInscription', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(champsInscription.extend({ etudiantId: s.id() }), donnees);
    const ref = col.inscriptions().doc();
    await db.runTransaction(async (tx) => {
        const etudiantRef = col.etudiants().doc(v.etudiantId);
        await exiger(tx, etudiantRef, 'Étudiant introuvable.');
        const montantDu = await controlerInscription(tx, v);
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
            ...attributsInscription(v, 'active'),
            montantDu, montantRemise: 0, noteFinanciere: null, totalVerse: 0, echeances: [],
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
    const v = valider(champsInscription.extend({ id: s.id(), statut: s.choix(STATUTS_INSCRIPTION), attendu: valeursAttendues }), donnees);
    let etudiantId = '';
    await db.runTransaction(async (tx) => {
        const ref = col.inscriptions().doc(v.id);
        const avant = await exiger(tx, ref, 'Inscription introuvable.');
        controlerModificationConcurrente(avant, v.attendu);
        etudiantId = avant.etudiantId;
        const montantTarif = await controlerInscription(tx, v);
        if ((avant.financeur ?? 'etudiant') !== (v.financeur ?? 'etudiant') && (avant.totalVerse ?? 0) > 0) {
            erreurChamp('financeur', 'Le financeur ne peut pas être changé : des versements sont déjà enregistrés sur cette inscription.');
        }
        const [autres, convocations] = await Promise.all([
            tx.get(col.inscriptions().where('etudiantId', '==', etudiantId)),
            tx.get(col.resultats().where('inscriptionId', '==', v.id)),
        ]);
        const doublonActif = v.statut === 'active' && autres.docs.some((inscription) =>
            inscription.id !== v.id
            && inscription.get('statut') === 'active'
            && inscription.get('formationId') === v.formationId
            && inscription.get('anneeId') === v.anneeId,
        );
        if (doublonActif) {
            erreurChamp('formationId', 'Une inscription active existe déjà pour ce diplôme et cette année scolaire.');
        }
        // Le montant suit le tarif quand les UE changent, sauf s'il a été fixé à la main par la finance.
        const ancienTarif = montantDuSelonTarif(avant.formationId, (avant.ueIds ?? []).length, avant.validationAcquis) ?? 0;
        const montantAuTarif = (avant.montantDu ?? 0) === 0 || avant.montantDu === ancienTarif;
        const apres = {
            ...attributsInscription(v, v.statut),
            ...(montantAuTarif && montantTarif !== (avant.montantDu ?? 0) ? { montantDu: montantTarif } : {}),
        };
        const toutes = autres.docs.map((d) => (d.id === v.id ? { ...avant, ...apres } : { id: d.id, ...d.data() }));
        // Une inscription qui n'est plus active, ou une UE retirée, ne doit plus être convoquée aux épreuves à venir.
        const convocationsARetirer = convocations.docs.filter((r) =>
            r.get('presence') === 'Convoqué' && r.get('note') === null && r.get('statutExamen') === 'Planifié'
            && (v.statut !== 'active' || !v.ueIds.includes(r.get('ueId'))),
        );
        tx.update(ref, { ...apres, ...trace(acteur) });
        tx.update(col.etudiants().doc(etudiantId), { ...resumeInscriptions(toutes), ...trace(acteur) });
        convocationsARetirer.forEach((r) => {
            tx.delete(r.ref);
            tx.update(col.examens().doc(r.get('examenId')), { nbConvoques: FieldValue.increment(-1) });
        });
        auditerModele(tx, acteur, 'Inscription', v.id, 'updated', avant, {
            ...apres, ...(convocationsARetirer.length ? { convocationsRetirees: convocationsARetirer.map((r) => r.id) } : {}),
        });
    });
    return { etudiantId, message: 'Inscription mise à jour.' };
});
