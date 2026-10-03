import type { WriteBatch } from 'firebase-admin/firestore';
import { auditer, auditerModele, trace } from '../lib/audit.js';
import { operation } from '../lib/contexte.js';
import { col, exiger, nomComplet } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FUSEAU, Timestamp } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { PRESENCES, resultatValide, ROLES_ADMIN, SESSIONS_EXAMEN, STATUTS_EXAMEN } from '../shared/domaine.js';

export const formaterDateHeure = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', ' à ');

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
    const etudiants = eligibles.empty ? [] : await db.getAll(...eligibles.docs.map((i) => col.etudiants().doc(i.get('etudiantId'))));
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

    const convocations = eligibles.docs.map((inscription, index) => ({ inscription, etudiant: etudiants[index], numero: premier + index }));
    await ecrireParLots(convocations, (lot, { inscription, etudiant, numero }) => {
        lot.set(col.resultats().doc(`${ref.id}_${inscription.id}`), {
            examenId: ref.id, inscriptionId: inscription.id, etudiantId: inscription.get('etudiantId'),
            ueId: v.ueId, formationId: examen.formationId, anneeId: v.anneeId, session: v.session, dateExamen,
            salle: v.salle, noteSur: v.noteSur, seuilValidation: v.seuilValidation, statutExamen: v.statut,
            presence: 'Convoqué', note: null, commentaire: null, valide: false, numeroConvocation: numero,
            ...trace(acteur, true),
        });
        if (etudiant?.exists) {
            mettreEnFileEmail(lot, {
                destinataire: etudiant.get('email'), nomDestinataire: nomComplet(etudiant.data()), type: 'Convocation',
                sujet: 'Convocation à un examen INSEC', titre: 'Nouvelle convocation',
                message: 'Vous êtes convoqué(e) à l’examen ci-dessous.',
                details: { UE: ue.get('code'), Session: v.session, Date: formaterDateHeure(dateExamen.toDate()), Salle: v.salle || 'À confirmer' },
            });
        }
    });
    const lotAudit = db.batch();
    auditer(lotAudit, acteur, {
        action: 'created', modele: 'Examen', modeleId: ref.id,
        description: `Convocation de ${eligibles.size} étudiant(s) à l’examen ${ue.get('code')}`,
        apres: { convocations: eligibles.size },
    });
    await lotAudit.commit();
    return { id: ref.id, message: 'Examen créé et étudiants éligibles convoqués.' };
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
