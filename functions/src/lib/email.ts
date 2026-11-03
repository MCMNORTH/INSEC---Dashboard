import { readFileSync } from 'node:fs';
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
    /** Chemin dans l'application (ex. /finances), complété avec APP_URL à l'envoi. */
    lien?: string | null;
    libelleLien?: string | null;
}

/**
 * Met un e-mail en file d'attente ; le déclencheur `envoyerEmail` l'expédie et met à jour son statut.
 * Un identifiant fixe (`id`) empêche d'envoyer deux fois le même message (ex. une relance par jour).
 */
export function mettreEnFileEmail(ecrivain: Ecrivain, email: Email, id?: string): void {
    const ref = id ? db.collection('journalEmails').doc(id) : db.collection('journalEmails').doc();
    (ecrivain as FirebaseFirestore.WriteBatch).set(ref, {
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

// Logo officiel joint à chaque e-mail et affiché via son identifiant (cid) : visible même quand les images distantes sont bloquées.
const CID_LOGO = 'logo-insec@insec';
const LOGO_EMAIL: PieceJointeEmail & { cid: string } = {
    filename: 'insec.png',
    content: readFileSync(new URL('../../assets/logo-insec.png', import.meta.url)),
    contentType: 'image/png',
    cid: CID_LOGO,
};

// Mêmes couleurs que les documents PDF (logo INSEC).
const MARINE = '#002057';
const ROUGE = '#d90014';
const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function rendreEmail(email: Email, baseUrl: string): string {
    const lignes = Object.entries(email.details ?? {});
    const details = lignes
        .map(
            ([cle, valeur], i) =>
                `<tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;${i ? 'border-top:1px solid #e5e7eb;' : ''}">${echapper(cle)}</td>`
                + `<td align="right" style="padding:12px 16px;font-size:14px;font-weight:600;color:#111827;${i ? 'border-top:1px solid #e5e7eb;' : ''}">${echapper(String(valeur))}</td></tr>`,
        )
        .join('');
    const lien = email.lien
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td style="background:${MARINE};border-radius:10px">`
          + `<a href="${echapper(baseUrl.replace(/\/$/, '') + email.lien)}" style="display:inline-block;padding:13px 22px;font-family:${POLICE};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${echapper(email.libelleLien || 'Consulter')}</a>`
          + '</td></tr></table>'
        : '';
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>'
        + `<body style="margin:0;padding:0;background:#f3f4f6;font-family:${POLICE};color:#111827">`
        // Aperçu affiché dans la liste des messages.
        + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${echapper(email.message)}</div>`
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:32px 12px">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">'
        // Filet d’accent marine puis rouge, comme en haut des PDF.
        + `<tr><td style="padding:0;font-size:0;line-height:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="72%" height="5" style="background:${MARINE};font-size:0;line-height:0">&nbsp;</td><td width="28%" height="5" style="background:${ROUGE};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`
        + `<tr><td style="padding:28px 32px 0"><img src="cid:${CID_LOGO}" width="112" alt="INSEC" style="display:block;width:112px;height:auto;border:0"></td></tr>`
        + '<tr><td style="padding:28px 32px 32px">'
        + `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280">${echapper(email.type)}</p>`
        + `<h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:${MARINE}">${echapper(email.titre)}</h1>`
        + `<p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#374151">${echapper(email.message)}</p>`
        + (details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px">${details}</table>` : '')
        + lien
        + '</td></tr>'
        + '<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#fafafa">'
        + `<p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280"><strong style="color:${MARINE}">INSEC</strong> · Centre associé de l’INTEC – CNAM Paris · Nouakchott, Mauritanie</p>`
        + '<p style="margin:4px 0 0;font-size:12px;line-height:1.6;color:#9ca3af">Message automatique envoyé par la plateforme de l’INSEC.</p>'
        + '</td></tr></table></td></tr></table></body></html>';
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
            attachments: [LOGO_EMAIL, ...piecesJointes],
        });
        await ref.update({ statut: 'Envoyé', erreur: null, envoyeLe: FieldValue.serverTimestamp() });
        return 'Envoyé';
    } catch (erreur) {
        await ref.update({ statut: 'Échec', erreur: String((erreur as Error)?.message ?? erreur).slice(0, 2000) });
        return 'Échec';
    }
}
