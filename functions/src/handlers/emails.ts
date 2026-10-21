import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { expedier, SMTP_PASSWORD, transportSmtp, type Email } from '../lib/email.js';
import { REGION } from '../lib/firebase.js';

/** Envoie chaque e-mail mis en file dans journalEmails et consigne le résultat (Envoyé / Échec). */
export const envoyerEmail = onDocumentCreated(
    { document: 'journalEmails/{id}', region: REGION, secrets: [SMTP_PASSWORD], retry: false },
    async (evenement) => {
        const donnees = evenement.data?.data() as (Email & { statut: string; envoiDirect?: boolean }) | undefined;
        if (!donnees || donnees.statut !== 'En attente' || donnees.envoiDirect) return;
        await expedier(evenement.params.id, donnees, transportSmtp());
    },
);
