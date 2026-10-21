import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, libererUnique, verifierUnique } from '../lib/donnees.js';
import { db, FieldValue } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';
import { ROLES_ADMIN } from '../shared/domaine.js';

const fiche = z.object({
    nom: s.texte(255),
    prenom: s.texte(255),
    specialite: s.texte(255),
    email: s.email(),
    telephone: s.texteOptionnel(30),
});
const cleEmail = (email: string) => `enseignant-email:${email}`;
const MESSAGE_EMAIL = 'Cet e-mail est déjà utilisé par un autre enseignant.';

export const creerEnseignant = operation('creerEnseignant', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(fiche, donnees);
    const ref = col.enseignants().doc();
    await db.runTransaction(async (tx) => {
        const reserver = await verifierUnique(tx, cleEmail(v.email), ref.id, MESSAGE_EMAIL, 'email');
        reserver();
        tx.set(ref, { ...v, nbUe: 0, nbEtudiants: 0, ...trace(acteur, true) });
        auditerModele(tx, acteur, 'Enseignant', ref.id, 'created', null, v);
    });
    return { id: ref.id, message: 'Enseignant ajouté avec succès.' };
});

export const modifierEnseignant = operation('modifierEnseignant', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(fiche.extend({ id: s.id() }), donnees);
    const { id, ...apres } = v;
    await db.runTransaction(async (tx) => {
        const ref = col.enseignants().doc(id);
        const avant = await exiger(tx, ref, 'Enseignant introuvable.');
        const reserver = await verifierUnique(tx, cleEmail(v.email), id, MESSAGE_EMAIL, 'email');
        if (avant.email !== v.email) libererUnique(tx, cleEmail(avant.email));
        reserver();
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Enseignant', id, 'updated', avant, apres);
    });
    return { message: 'Enseignant modifié avec succès.' };
});

export const supprimerEnseignant = operation('supprimerEnseignant', ROLES_ADMIN, async (donnees, acteur) => {
    const { id } = valider(z.object({ id: s.id() }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.enseignants().doc(id);
        const enseignant = await exiger(tx, ref, 'Enseignant introuvable.');
        const [affectations, comptes] = await Promise.all([
            tx.get(col.affectations().where('enseignantId', '==', id)),
            tx.get(col.utilisateurs().where('enseignantId', '==', id)),
        ]);
        affectations.docs.forEach((a) => {
            tx.delete(a.ref);
            auditerModele(tx, acteur, 'AffectationEnseignant', a.id, 'deleted', a.data(), null);
        });
        comptes.docs.forEach((c) => tx.update(c.ref, { enseignantId: null }));
        libererUnique(tx, cleEmail(enseignant.email));
        tx.delete(ref);
        auditerModele(tx, acteur, 'Enseignant', id, 'deleted', enseignant, null);
    });
    return { message: 'Enseignant supprimé avec succès.' };
});

export const affecterUe = operation('affecterUe', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(z.object({ enseignantId: s.id(), ueId: s.id(), nombreEtudiants: s.entier(0) }), donnees);
    const id = `${v.enseignantId}_${v.ueId}`;
    const cree = await db.runTransaction(async (tx) => {
        const enseignantRef = col.enseignants().doc(v.enseignantId);
        await exiger(tx, enseignantRef, 'Enseignant introuvable.');
        await exiger(tx, col.ues().doc(v.ueId), 'UE introuvable.');
        const ref = col.affectations().doc(id);
        if ((await tx.get(ref)).exists) return false;
        const affectation = { enseignantId: v.enseignantId, ueId: v.ueId, nombreEtudiants: v.nombreEtudiants };
        tx.set(ref, { ...affectation, ...trace(acteur, true) });
        tx.update(enseignantRef, { nbUe: FieldValue.increment(1), nbEtudiants: FieldValue.increment(v.nombreEtudiants) });
        auditerModele(tx, acteur, 'AffectationEnseignant', id, 'created', null, affectation);
        return true;
    });
    if (!cree) refuser('Cette UE est déjà affectée à cet enseignant.');
    return { message: 'UE affectée avec succès.' };
});

export const retirerAffectation = operation('retirerAffectation', ROLES_ADMIN, async (donnees, acteur) => {
    const { id } = valider(z.object({ id: s.id() }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.affectations().doc(id);
        const affectation = await exiger(tx, ref, 'Affectation introuvable.');
        tx.delete(ref);
        tx.update(col.enseignants().doc(affectation.enseignantId), {
            nbUe: FieldValue.increment(-1),
            nbEtudiants: FieldValue.increment(-(affectation.nombreEtudiants ?? 0)),
        });
        auditerModele(tx, acteur, 'AffectationEnseignant', id, 'deleted', affectation, null);
    });
    return { message: 'Affectation retirée avec succès.' };
});
