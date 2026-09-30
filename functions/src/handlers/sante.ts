import { onRequest } from 'firebase-functions/v2/https';
import { col } from '../lib/donnees.js';
import { bucket, REGION } from '../lib/firebase.js';

type Etat = 'ok' | 'warning' | 'failed';
interface Controle { status: Etat; message: string }

const controle = (ok: boolean, succes: string, echec: string): Controle => ({ status: ok ? 'ok' : 'failed', message: ok ? succes : echec });

async function sauvegardeRecente(): Promise<Controle> {
    const derniere = await col.sauvegardes().where('statut', '==', 'Terminée').orderBy('creeLe', 'desc').limit(1).get();
    if (derniere.empty) return { status: 'warning', message: 'Aucune sauvegarde disponible.' };
    const heures = (Date.now() - derniere.docs[0].get('creeLe').toMillis()) / 3_600_000;
    return heures <= 48
        ? { status: 'ok', message: 'Dernière sauvegarde récente.' }
        : { status: 'warning', message: 'La dernière sauvegarde date de plus de 48 heures.' };
}

export async function verifierDisponibilite() {
    const checks: Record<string, Controle> = {};
    try {
        await col.compteurs().limit(1).get();
        checks.database = controle(true, 'Connexion à Firestore disponible', '');
    } catch {
        checks.database = controle(false, '', 'Firestore indisponible.');
    }
    try {
        const sonde = bucket().file(`sante/sonde-${Date.now()}`);
        await sonde.save('ok');
        await sonde.delete();
        checks.storage = controle(true, 'Cloud Storage accessible en écriture', '');
    } catch {
        checks.storage = controle(false, '', 'Cloud Storage n’est pas accessible en écriture.');
    }
    try {
        checks.backup = await sauvegardeRecente();
    } catch {
        checks.backup = { status: 'warning', message: 'État des sauvegardes inconnu.' };
    }
    const etats = Object.values(checks).map((c) => c.status);
    const status: Etat = etats.includes('failed') ? 'failed' : etats.includes('warning') ? 'warning' : 'ok';
    return { status, checks, checked_at: new Date().toISOString() };
}

/** Sondes de supervision exposées par Firebase Hosting sur /health/live et /health/ready. */
export const sante = onRequest({ region: REGION, cors: false, maxInstances: 2 }, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.path.endsWith('/live')) {
        res.json({ status: 'ok', checked_at: new Date().toISOString() });
        return;
    }
    if (req.path.endsWith('/ready')) {
        const rapport = await verifierDisponibilite();
        res.status(rapport.status === 'failed' ? 503 : 200).json(rapport);
        return;
    }
    res.status(404).json({ status: 'failed', message: 'Sonde inconnue.' });
});
