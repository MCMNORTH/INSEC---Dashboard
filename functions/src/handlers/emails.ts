import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { enregistrerEchecPreparationEmail, expedier, SMTP_PASSWORD, transportSmtp, type Email, type PieceJointeEmail } from '../lib/email.js';
import { db, FieldValue, REGION } from '../lib/firebase.js';
import { genererRecuPdfPourEmail } from './pdf.js';

/** Réserve une notification en attente, génère ses pièces jointes puis l'expédie. */
export async function envoyerJournalEmail(id: string, transport = transportSmtp()): Promise<void> {
    const ref = db.collection('journalEmails').doc(id);
    const donnees = await db.runTransaction(async (tx) => {
        const actuelle = await tx.get(ref);
        if (!actuelle.exists || actuelle.get('statut') !== 'En attente' || actuelle.get('envoiDirect')) return null;
        tx.update(ref, { statut: 'En cours', tentativeLe: FieldValue.serverTimestamp() });
        return actuelle.data() as (Email & { statut: string; envoiDirect?: boolean }) | undefined;
    });
    if (!donnees) return;

    let piecesJointes: PieceJointeEmail[] = [];
    try {
        piecesJointes = donnees.versementPdfId
            ? [await genererRecuPdfPourEmail(donnees.versementPdfId)]
            : [];
    } catch (erreur) {
        logger.error('echec_preparation_piece_jointe_email', { id, erreur });
        await enregistrerEchecPreparationEmail(id, erreur);
        return;
    }
    await expedier(id, donnees, transport, piecesJointes);
}

/** Envoie chaque e-mail mis en file dans journalEmails et consigne le résultat (Envoyé / Échec). */
export const envoyerEmail = onDocumentCreated(
    { document: 'journalEmails/{id}', region: REGION, secrets: [SMTP_PASSWORD], retry: false },
    async (evenement) => {
        await envoyerJournalEmail(evenement.params.id);
    },
);
