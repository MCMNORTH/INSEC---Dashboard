import type { WriteBatch } from 'firebase-admin/firestore';
import { auditer, auditerModele, trace } from '../lib/audit.js';
import { operation } from '../lib/contexte.js';
import { col, exiger, nomComplet } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, Timestamp } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { PRESENCES, resultatValide, ROLES_ADMIN, SESSIONS_EXAMEN, STATUTS_EXAMEN } from '../shared/domaine.js';

export const formaterDateHeure = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', ' à ');

/** Exécute des écritures par lots de 400 (limite Firestore : 500 opérations par lot). */
export async function ecrireParLots<T>(elements: T[], ecrire: (lot: WriteBatch, element: T) => void): Promise<void> {
    for (let i = 0; i < elements.length; i += 400) {
        const lot = db.batch();
        elements.slice(i, i + 400).forEach((e) => ecrire(lot, e));
        await lot.commit();
    }
}

export const creerExamen = operation('creerExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            ueId: s.id(),
            anneeId: s.id(),
            session: s.choix(SESSIONS_EXAMEN),
            dateExamen: z.iso.datetime({ offset: true, error: 'date et heure invalides.' }),
            salle: s.texteOptionnel(100),
            noteSur: z.coerce.number().gt(0).max(100),
            seuilValidation: s.nombre(0, 100),
            statut: s.choix(STATUTS_EXAMEN),
        }),
        donnees,
    );
    if (v.seuilValidation > v.noteSur) erreurChamp('seuilValidation', 'Le seuil de validation ne peut pas dépasser la note maximale.');
    const [ue, annee] = await db.getAll(col.ues().doc(v.ueId), col.annees().doc(v.anneeId));
    if (!ue.exists) erreurChamp('ueId', 'UE inconnue.');
    if (!annee.exists) erreurChamp('anneeId', 'Année académique inconnue.');

    const eligibles = await col.inscriptions().where('anneeId', '==', v.anneeId).where('ueIds', 'array-contains', v.ueId).get();
    const dateExamen = Timestamp.fromDate(new Date(v.dateExamen));
    const ref = col.examens().doc();

    // Réserve une plage de numéros de convocation.
    const premier = await db.runTransaction(async (tx) => {
        const compteur = col.compteurs().doc('convocations');
        const valeur = ((await tx.get(compteur)).get('valeur') as number | undefined) ?? 0;
        tx.set(compteur, { valeur: valeur + eligibles.size });
        return valeur + 1;
    });

    const examen = {
        ueId: v.ueId, formationId: ue.get('formationId'), anneeId: v.anneeId, session: v.session, dateExamen,
        salle: v.salle, noteSur: v.noteSur, seuilValidation: v.seuilValidation, statut: v.statut, nbConvoques: eligibles.size,
    };
    const lotExamen = db.batch();
    lotExamen.set(ref, { ...examen, ...trace(acteur, true) });
    auditerModele(lotExamen, acteur, 'Examen', ref.id, 'created', null, examen);
    await lotExamen.commit();

    const convocations = eligibles.docs.map((inscription, index) => ({ inscription, numero: premier + index }));
    await ecrireParLots(convocations, (lot, { inscription, numero }) => {
        lot.set(col.resultats().doc(`${ref.id}_${inscription.id}`), {
            examenId: ref.id, inscriptionId: inscription.id, etudiantId: inscription.get('etudiantId'),
            ueId: v.ueId, formationId: examen.formationId, anneeId: v.anneeId, session: v.session, dateExamen,
            salle: v.salle, noteSur: v.noteSur, seuilValidation: v.seuilValidation, statutExamen: v.statut,
            presence: 'Convoqué', note: null, commentaire: null, valide: false, numeroConvocation: numero,
            ...trace(acteur, true),
        });
    });
    const lotAudit = db.batch();
    auditer(lotAudit, acteur, {
        action: 'created', modele: 'Examen', modeleId: ref.id,
        description: 'Planification de l’examen ' + ue.get('code') + ' pour ' + eligibles.size + ' étudiant(s). Aucun e-mail envoyé.',
        apres: { candidatsAjoutes: eligibles.size, convocationsEnvoyees: 0 },
    });
    await lotAudit.commit();
    return { id: ref.id, message: 'Examen planifié avec ' + eligibles.size + ' étudiant(s). Aucun e-mail n’a été envoyé.' };
});

export const enregistrerResultat = operation('enregistrerResultat', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            presence: s.choix(PRESENCES),
            note: z.preprocess((x) => (x === '' || x === undefined ? null : x), z.coerce.number().min(0).nullable()),
            commentaire: s.texteOptionnel(1000),
        }),
        donnees,
    );
    await db.runTransaction(async (tx) => {
        const ref = col.resultats().doc(v.id);
        const avant = await exiger(tx, ref, 'Résultat introuvable.');
        if (v.presence === 'Présent' && v.note === null) erreurChamp('note', 'Une note est obligatoire pour un étudiant présent.');
        if (v.note !== null && v.note > avant.noteSur) erreurChamp('note', `La note ne peut pas dépasser ${avant.noteSur}.`);
        const note = v.presence === 'Présent' ? v.note : null;
        const apres = {
            presence: v.presence, note, commentaire: v.commentaire,
            valide: resultatValide({ presence: v.presence, note, seuilValidation: avant.seuilValidation }),
        };
        let etudiant = null;
        let ue = null;
        if (note !== null) {
            etudiant = await exiger(tx, col.etudiants().doc(avant.etudiantId), 'Étudiant introuvable.');
            ue = await exiger(tx, col.ues().doc(avant.ueId), 'UE introuvable.');
        }
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'ResultatExamen', v.id, 'updated', avant, apres);
        if (etudiant && ue) {
            mettreEnFileEmail(tx, {
                destinataire: etudiant.email, nomDestinataire: nomComplet(etudiant), type: 'Résultat',
                sujet: 'Publication d’un résultat INSEC', titre: 'Votre résultat est disponible',
                message: 'Une note vient d’être publiée dans votre dossier académique.',
                details: { UE: ue.code, Note: `${note}/${avant.noteSur}`, Décision: apres.valide ? 'Validée' : 'Non validée' },
                lien: '/portail/etudiant', libelleLien: 'Consulter mon espace',
            });
        }
    });
    return { message: 'Résultat enregistré.' };
});


export const enregistrerPresencesExamen = operation('enregistrerPresencesExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            presences: z.array(z.object({ resultatId: s.id(), presence: s.choix(PRESENCES) })).min(1).max(400),
        }),
        donnees,
    );
    const ids = v.presences.map((p) => p.resultatId);
    if (new Set(ids).size !== ids.length) erreurChamp('presences', 'Un étudiant ne peut apparaître qu’une seule fois dans cette opération.');

    const examen = await exiger(null, col.examens().doc(v.id), 'Examen introuvable.');
    if (examen.statut === 'Annulé') erreurChamp('id', 'Les présences ne peuvent pas être modifiées pour un examen annulé.');

    const refs = v.presences.map((p) => col.resultats().doc(p.resultatId));
    const documents = await db.getAll(...refs);
    documents.forEach((doc, index) => {
        if (!doc.exists || doc.get('examenId') !== v.id) {
            erreurChamp('presences', 'Un résultat ne correspond pas à cette épreuve.');
        }
        if (v.presences[index].presence !== 'Présent' && doc.get('note') !== null && doc.get('note') !== undefined) {
            erreurChamp('presences', 'Une note existe déjà pour un résultat. Modifiez ce statut individuellement pour protéger la note.');
        }
    });

    const changements = v.presences
        .map((presence, index) => ({ presence, ref: refs[index], avant: documents[index].data()! }))
        .filter(({ presence, avant }) => presence.presence !== avant.presence);
    if (!changements.length) return { message: 'Aucune présence à mettre à jour.' };

    const lot = db.batch();
    changements.forEach(({ presence, ref, avant }) => {
        const note = presence.presence === 'Présent' ? (avant.note ?? null) : null;
        const apres = {
            presence: presence.presence,
            note,
            valide: resultatValide({ presence: presence.presence, note, seuilValidation: avant.seuilValidation }),
        };
        lot.update(ref, { ...apres, ...trace(acteur) });
    });
    auditer(lot, acteur, {
        action: 'updated',
        modele: 'Examen',
        modeleId: v.id,
        description: `Présences enregistrées pour ${changements.length} étudiant(s) à l’examen.`,
        avant: { resultats: changements.map(({ ref, avant }) => ({ id: ref.id, presence: avant.presence, note: avant.note ?? null })) },
        apres: {
            resultats: changements.map(({ presence, ref, avant }) => ({
                id: ref.id,
                presence: presence.presence,
                note: presence.presence === 'Présent' ? (avant.note ?? null) : null,
            })),
        },
    });
    await lot.commit();
    return { message: `Présences enregistrées pour ${changements.length} étudiant(s). Aucune note ni aucun e-mail n’a été envoyé.` };
});


const quantiteOptionnelle = z.preprocess(
    (valeur) => (valeur === '' || valeur === undefined || valeur === null ? null : valeur),
    z.coerce.number().int().min(0).max(500).nullable(),
);

export const mettreAJourPreparationExamen = operation('mettreAJourPreparationExamen', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            id: s.id(),
            sujetsRecusLe: s.dateOptionnelle(),
            nombreSujetsRecus: quantiteOptionnelle,
            salleConfirmee: z.boolean(),
            surveillanceConfirmee: z.boolean(),
            nombreCopiesRassemblees: quantiteOptionnelle,
            copiesEnvoyeesLe: s.dateOptionnelle(),
            referenceEnvoiCopies: s.texteOptionnel(120),
        }),
        donnees,
    );

    await db.runTransaction(async (tx) => {
        const ref = col.examens().doc(v.id);
        const avant = await exiger(tx, ref, 'Examen introuvable.');
        const apres = {
            sujetsRecusLe: v.sujetsRecusLe,
            nombreSujetsRecus: v.nombreSujetsRecus,
            salleConfirmee: v.salleConfirmee,
            surveillanceConfirmee: v.surveillanceConfirmee,
            nombreCopiesRassemblees: v.nombreCopiesRassemblees,
            copiesEnvoyeesLe: v.copiesEnvoyeesLe,
            referenceEnvoiCopies: v.referenceEnvoiCopies,
        };
        tx.update(ref, { ...apres, ...trace(acteur) });
        auditerModele(tx, acteur, 'Examen', v.id, 'updated', avant, apres);
    });

    return { message: 'Suivi de préparation de l’examen enregistré.' };
});
