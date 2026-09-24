/**
 * Envoi des e-mails transactionnels (SMTP) avec journalisation dans `journal_emails`.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { journalEmails } from "@/db/schema";

export type Notification = {
  email: string;
  nom?: string | null;
  type: string;
  sujet: string;
  titre: string;
  message: string;
  details?: Record<string, string>;
  url?: string | null;
  label?: string | null;
};

type Envoyeur = (n: Notification, html: string) => Promise<void>;

let envoyeurDeTest: Envoyeur | null = null;
let transport: Transporter | null = null;

/** Permet aux tests de remplacer l'envoi réel. */
export function definirEnvoyeurDeTest(fn: Envoyeur | null) {
  envoyeurDeTest = fn;
}

function smtpConfigure(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transport;
}

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function gabaritHtml(n: Notification): string {
  const details = Object.entries(n.details ?? {});
  const lignes = details
    .map(
      ([cle, valeur]) =>
        `<tr><td style="padding:9px 12px;color:#777">${echapper(cle)}</td><td style="padding:9px 12px;text-align:right;font-weight:bold">${echapper(valeur)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#293241"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 15px"><table width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:#1E2761;color:#fff;padding:22px 30px"><strong style="font-size:22px">INSEC</strong><span style="color:#D4AF37;margin-left:10px">Centre associé INTEC CNAM</span></td></tr><tr><td style="padding:30px"><h1 style="font-size:22px;color:#1E2761;margin-top:0">${echapper(n.titre)}</h1><p style="line-height:1.6">${echapper(n.message)}</p>${
    details.length ? `<table width="100%" style="background:#f8f9fb;border-radius:8px;margin:20px 0">${lignes}</table>` : ""
  }${
    n.url
      ? `<p style="margin-top:25px"><a href="${echapper(n.url)}" style="background:#1E2761;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px">${echapper(n.label || "Consulter")}</a></p>`
      : ""
  }<p style="font-size:12px;color:#999;margin-top:30px">Message automatique de la plateforme INSEC.</p></td></tr></table></td></tr></table></body></html>`;
}

/**
 * Envoie un e-mail et consigne le résultat. Ne lève jamais d'exception : un échec d'envoi
 * ne doit pas annuler l'opération métier qui l'a déclenché.
 */
export async function envoyerNotification(db: Db, n: Notification): Promise<{ statut: string }> {
  const [journal] = await db
    .insert(journalEmails)
    .values({ destinataire: n.email, nomDestinataire: n.nom ?? null, type: n.type, sujet: n.sujet })
    .returning({ id: journalEmails.id });

  const html = gabaritHtml(n);
  try {
    if (envoyeurDeTest) {
      await envoyeurDeTest(n, html);
    } else if (!smtpConfigure()) {
      await db
        .update(journalEmails)
        .set({ statut: "En attente", erreur: "Aucun serveur SMTP n’est configuré (SMTP_HOST)." })
        .where(eq(journalEmails.id, journal.id));
      return { statut: "En attente" };
    } else {
      const from = process.env.MAIL_FROM_ADDRESS || "contact@insec.mr";
      const fromName = process.env.MAIL_FROM_NAME || "INSEC";
      await getTransport().sendMail({
        from: { name: fromName, address: from },
        to: n.nom ? { name: n.nom, address: n.email } : n.email,
        subject: n.sujet,
        html,
      });
    }
    await db
      .update(journalEmails)
      .set({ statut: "Envoyé", envoyeAt: new Date(), erreur: null })
      .where(eq(journalEmails.id, journal.id));
    return { statut: "Envoyé" };
  } catch (e) {
    console.error("Échec d’envoi d’e-mail", e);
    await db
      .update(journalEmails)
      .set({ statut: "Échec", erreur: String((e as Error)?.message ?? e).slice(0, 2000) })
      .where(eq(journalEmails.id, journal.id));
    return { statut: "Échec" };
  }
}

/** Envoie une série d'e-mails avec une concurrence limitée. */
export async function envoyerPlusieurs(db: Db, notifications: Notification[], concurrence = 4) {
  const file = [...notifications];
  const travailleurs = Array.from({ length: Math.min(concurrence, file.length) }, async () => {
    while (file.length) {
      const n = file.shift()!;
      await envoyerNotification(db, n);
    }
  });
  await Promise.all(travailleurs);
}

export function urlApplication(chemin = "/"): string {
  const base = (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
  return `${base}${chemin}`;
}
