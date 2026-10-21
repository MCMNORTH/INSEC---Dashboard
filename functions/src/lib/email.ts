import { defineSecret, defineString } from 'firebase-functions/params';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Ecrivain } from './audit.js';
import { db, FieldValue } from './firebase.js';

export const APP_URL = defineString('APP_URL', { default: 'http://localhost:5173', description: 'URL publique du dashboard' });
export const SMTP_HOST = defineString('SMTP_HOST', { default: '', description: 'Serveur SMTP (vide = envoi désactivé)' });
export const SMTP_PORT = defineString('SMTP_PORT', { default: '587' });
export const SMTP_USER = defineString('SMTP_USER', { default: '' });
export const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');
export const MAIL_FROM_ADDRESS = defineString('MAIL_FROM_ADDRESS', { default: 'contact@insec.mr' });
export const MAIL_FROM_NAME = defineString('MAIL_FROM_NAME', { default: 'INSEC' });

export interface Email {
    destinataire: string;
    nomDestinataire: string | null;
    type: string;
    sujet: string;
    titre: string;
    message: string;
    details?: Record<string, string>;
    /** Chemin dans l'application (ex. /portail/etudiant), complété avec APP_URL à l'envoi. */
    lien?: string | null;
    libelleLien?: string | null;
}

/** Met un e-mail en file d'attente ; le déclencheur `envoyerEmail` l'expédie et met à jour son statut. */
export function mettreEnFileEmail(ecrivain: Ecrivain, email: Email): void {
    (ecrivain as FirebaseFirestore.WriteBatch).set(db.collection('journalEmails').doc(), {
        destinataire: email.destinataire,
        nomDestinataire: email.nomDestinataire,
        type: email.type,
        sujet: email.sujet,
        titre: email.titre,
        message: email.message,
        details: email.details ?? {},
        lien: email.lien ?? null,
        libelleLien: email.libelleLien ?? null,
        statut: 'En attente',
        erreur: null,
        envoyeLe: null,
        creeLe: FieldValue.serverTimestamp(),
    });
}

const echapper = (v: string) =>
    v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function rendreEmail(email: Email, baseUrl: string): string {
    const details = Object.entries(email.details ?? {})
        .map(
            ([cle, valeur]) =>
                `<tr><td style="padding:9px 12px;color:#777">${echapper(cle)}</td><td style="padding:9px 12px;text-align:right;font-weight:bold">${echapper(String(valeur))}</td></tr>`,
        )
        .join('');
    const lien = email.lien
        ? `<p style="margin-top:25px"><a href="${echapper(baseUrl.replace(/\/$/, '') + email.lien)}" style="background:#1E2761;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px">${echapper(email.libelleLien || 'Consulter')}</a></p>`
        : '';
    return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#293241"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 15px"><table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:#1E2761;color:#fff;padding:22px 30px"><strong style="font-size:22px">INSEC</strong><span style="color:#D4AF37;margin-left:10px">Centre associé INTEC CNAM</span></td></tr><tr><td style="padding:30px"><h1 style="font-size:22px;color:#1E2761;margin-top:0">${echapper(email.titre)}</h1><p style="line-height:1.6">${echapper(email.message)}</p>${details ? `<table width="100%" style="background:#f8f9fb;border-radius:8px;margin:20px 0">${details}</table>` : ''}${lien}<p style="font-size:12px;color:#999;margin-top:30px">Message automatique de la plateforme INSEC.</p></td></tr></table></td></tr></table></body></html>`;
}

export function transportSmtp(): Transporter | null {
    const hote = SMTP_HOST.value();
    if (!hote) {
        // En local (émulateurs), les e-mails sont simulés et journalisés.
        return process.env.FUNCTIONS_EMULATOR === 'true' ? nodemailer.createTransport({ jsonTransport: true }) : null;
    }
    const port = Number(SMTP_PORT.value() || 587);
    return nodemailer.createTransport({
        host: hote,
        port,
        secure: port === 465,
        auth: SMTP_USER.value() ? { user: SMTP_USER.value(), pass: SMTP_PASSWORD.value() } : undefined,
    });
}

export interface PieceJointeEmail {
    filename: string;
    content: Buffer;
    contentType: string;
}

export async function expedier(
    id: string,
    email: Email,
    transport: Transporter | null,
    piecesJointes: PieceJointeEmail[] = [],
): Promise<'Envoyé' | 'Échec'> {
    const ref = db.collection('journalEmails').doc(id);
    if (!transport) {
        await ref.update({ statut: 'Échec', erreur: 'Aucun serveur SMTP n’est configuré (SMTP_HOST).' });
        return 'Échec';
    }
    try {
        await transport.sendMail({
            from: { name: MAIL_FROM_NAME.value(), address: MAIL_FROM_ADDRESS.value() },
            to: email.nomDestinataire ? { name: email.nomDestinataire, address: email.destinataire } : email.destinataire,
            subject: email.sujet,
            html: rendreEmail(email, APP_URL.value()),
            ...(piecesJointes.length ? { attachments: piecesJointes } : {}),
        });
        await ref.update({ statut: 'Envoyé', erreur: null, envoyeLe: FieldValue.serverTimestamp() });
        return 'Envoyé';
    } catch (erreur) {
        await ref.update({ statut: 'Échec', erreur: String((erreur as Error)?.message ?? erreur).slice(0, 2000) });
        return 'Échec';
    }
}
