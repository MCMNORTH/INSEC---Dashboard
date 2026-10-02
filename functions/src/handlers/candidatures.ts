import { randomInt } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger, nomComplet, refUnique, verifierUnique } from '../lib/donnees.js';
import { mettreEnFileEmail } from '../lib/email.js';
import { db, FieldValue } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { dateDuJour, DECISIONS_CANDIDATURE, ROLES_ADMIN } from '../shared/domaine.js';
import { cleEmailEtudiant, resumeInscriptions } from './etudiants.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function genererReference(date = new Date()): string {
    const jour = date.toISOString().slice(2, 10).replace(/-/g, '');
    const suffixe = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `ADM-${jour}-${suffixe}`;
}

export const deposerCandidature = operation('deposerCandidature', 'public', async (donnees, acteur) => {
    const v = valider(
        z.object({
            nom: s.texte(100), prenom: s.texte(100), email: s.email(), telephone: s.texte(40),
            dateNaissance: s.dateOptionnelle(), dernierDiplome: s.texte(150), formationId: s.id(), anneeId: s.id(),
            motivation: s.texteOptionnel(2000),
        }),
        donnees,
    );
    if (v.dateNaissance && v.dateNaissance >= dateDuJour()) erreurChamp('dateNaissance', 'La date de naissance doit être antérieure à aujourd’hui.');
    const reference = genererReference();
    await db.runTransaction(async (tx) => {
        const [formation, annee] = await tx.getAll(col.formations().doc(v.formationId), col.annees().doc(v.anneeId));
        if (!formation.exists || formation.get('active') === false) erreurChamp('formationId', 'Diplôme inconnu.');
        if (!annee.exists) erreurChamp('anneeId', 'Année académique inconnue.');
        const reserver = await verifierUnique(
            tx, `candidature:${v.anneeId}:${v.email}`, reference,
            'Une candidature existe déjà avec cet e-mail pour cette année académique.', 'anneeId',
        );
        const candidature = { reference, ...v, statut: 'Nouvelle', noteInterne: null, etudiantId: null, traiteeLe: null };
        reserver();
        tx.set(col.candidatures().doc(reference), { ...candidature, ...trace(acteur, true) });
        auditerModele(tx, acteur, 'Candidature', reference, 'created', null, candidature);
        mettreEnFileEmail(tx, {
            destinataire: v.email, nomDestinataire: nomComplet(v), type: 'Candidature',
            sujet: 'Votre candidature INSEC a bien été reçue', titre: 'Candidature enregistrée',
            message: 'Votre demande de préinscription est maintenant enregistrée et sera étudiée par notre équipe.',
            details: { Référence: reference, Diplôme: formation.get('code'), Année: annee.get('libelle') },
        });
    });
    return { reference };
}, { enforceAppCheck: true });

export const confirmationCandidature = operation('confirmationCandidature', 'public', async (donnees) => {
    const { reference } = valider(z.object({ reference: z.string().regex(/^ADM-\d{6}-[A-Z0-9]{6}$/, 'référence invalide.') }), donnees);
    const snap = await col.candidatures().doc(reference).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Candidature introuvable.');
    return { reference, email: snap.get('email') as string };
}, { enforceAppCheck: true });

export const deciderCandidature = operation('deciderCandidature', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(z.object({ id: s.id(), statut: s.choix(DECISIONS_CANDIDATURE), noteInterne: s.texteOptionnel(2000) }), donnees);
    await db.runTransaction(async (tx) => {
        const ref = col.candidatures().doc(v.id);
        const avant = await exiger(tx, ref, 'Candidature introuvable.');
        if (avant.statut === 'Inscrite') refuser('Cette candidature est déjà convertie.');
        const formation = await exiger(tx, col.formations().doc(avant.formationId), 'Diplôme introuvable.');
        const apres = { statut: v.statut, noteInterne: v.noteInterne };
        tx.update(ref, { ...apres, traiteeLe: FieldValue.serverTimestamp(), ...trace(acteur) });
        auditerModele(tx, acteur, 'Candidature', v.id, 'updated', avant, apres);
        if (avant.statut !== v.statut) {
            mettreEnFileEmail(tx, {
                destinataire: avant.email, nomDestinataire: nomComplet(avant), type: 'Admission',
                sujet: 'Mise à jour de votre candidature INSEC', titre: 'Décision d’admission',
                message: 'Le statut de votre candidature a été mis à jour.',
                details: { Référence: avant.reference, 'Nouveau statut': v.statut, Diplôme: formation.code },
            });
        }
    });
    return { message: 'Décision enregistrée.' };
});

export const convertirCandidature = operation('convertirCandidature', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({ id: s.id(), anneeParcours: s.entier(1, 3), dateInscription: s.date(), numeroIntec: s.texteOptionnel(100), montantDu: s.entier(0) }),
        donnees,
    );
    let etudiantId = '';
    await db.runTransaction(async (tx) => {
        const ref = col.candidatures().doc(v.id);
        const candidature = await exiger(tx, ref, 'Candidature introuvable.');
        if (candidature.statut !== 'Admissible') refuser('La candidature doit être admissible avant inscription.');
        const [formation, annee] = await tx.getAll(col.formations().doc(candidature.formationId), col.annees().doc(candidature.anneeId));
        if (v.anneeParcours > (formation.get('dureeAnnees') ?? 1)) erreurChamp('anneeParcours', 'Année de parcours incompatible.');
        const ues = await tx.get(
            col.ues().where('formationId', '==', candidature.formationId).where('anneeParcours', '==', v.anneeParcours).where('active', '==', true),
        );
        if (ues.empty) refuser('Aucune UE active pour cette année de parcours.');

        // Rattache la candidature au dossier existant portant le même e-mail, sinon en crée un.
        const unique = await tx.get(refUnique(cleEmailEtudiant(candidature.email)));
        const existantId = unique.exists ? (unique.get('proprietaire') as string) : null;
        const etudiantRef = existantId ? col.etudiants().doc(existantId) : col.etudiants().doc();
        etudiantId = etudiantRef.id;
        const inscriptionsExistantes = existantId ? await tx.get(col.inscriptions().where('etudiantId', '==', existantId)) : null;

        const inscriptionRef = col.inscriptions().doc();
        const inscription = {
            etudiantId, formationId: candidature.formationId, anneeId: candidature.anneeId, anneeParcours: v.anneeParcours,
            dateInscription: v.dateInscription, numeroIntec: v.numeroIntec, statut: 'active',
            ueIds: ues.docs.sort((a, b) => (a.get('ordre') ?? 0) - (b.get('ordre') ?? 0)).map((u) => u.id),
            montantDu: v.montantDu, montantRemise: 0, noteFinanciere: null, totalVerse: 0, echeances: [],
            ordre: (inscriptionsExistantes?.size ?? 0) + 1,
        };
        const toutes = [...(inscriptionsExistantes?.docs.map((d) => ({ id: d.id, ...d.data() })) ?? []), { id: inscriptionRef.id, ...inscription }];
        if (existantId) {
            tx.update(etudiantRef, { ...resumeInscriptions(toutes), ...trace(acteur) });
        } else {
            const etudiant = {
                nom: candidature.nom, prenom: candidature.prenom, email: candidature.email, telephone: candidature.telephone,
                statut: 'Actif', ...resumeInscriptions(toutes),
            };
            tx.set(refUnique(cleEmailEtudiant(candidature.email)), { proprietaire: etudiantId });
            tx.set(etudiantRef, { ...etudiant, ...trace(acteur, true) });
            auditerModele(tx, acteur, 'Etudiant', etudiantId, 'created', null, etudiant);
        }
        tx.set(inscriptionRef, { ...inscription, ...trace(acteur, true) });
        auditerModele(tx, acteur, 'Inscription', inscriptionRef.id, 'created', null, inscription);
        tx.update(ref, { statut: 'Inscrite', etudiantId, traiteeLe: FieldValue.serverTimestamp(), ...trace(acteur) });
        auditerModele(tx, acteur, 'Candidature', v.id, 'updated', candidature, { statut: 'Inscrite', etudiantId });
        mettreEnFileEmail(tx, {
            destinataire: candidature.email, nomDestinataire: nomComplet(candidature), type: 'Inscription',
            sujet: 'Votre inscription INSEC est confirmée', titre: 'Inscription définitive confirmée',
            message: 'Votre dossier étudiant et votre inscription ont été créés avec succès.',
            details: { Diplôme: formation.get('code'), 'Année académique': annee.get('libelle'), 'N° INTEC': v.numeroIntec ?? 'En attente' },
        });
    });
    return { etudiantId, message: 'Candidature convertie en étudiant et inscription créée.' };
});
