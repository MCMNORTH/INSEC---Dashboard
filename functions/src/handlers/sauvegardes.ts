import { randomBytes } from 'node:crypto';
import firestoreAdmin from '@google-cloud/firestore';
import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { auditerDirect } from '../lib/audit.js';
import { operation, refuser, type Acteur } from '../lib/contexte.js';
import { col, exiger } from '../lib/donnees.js';
import { bucket, db, FieldValue, FUSEAU, REGION, storage, Timestamp } from '../lib/firebase.js';
import { s, valider, z } from '../lib/validation.js';

export const BACKUP_BUCKET = defineString('BACKUP_BUCKET', {
    default: '',
    description: 'Bucket Cloud Storage dédié aux sauvegardes (défaut : <projet>-sauvegardes)',
});
export const RETENTION_JOURS = 30;
const SUPER_ADMIN = ['super_admin'] as const;

const projet = () => process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';
const nomBucket = () => BACKUP_BUCKET.value() || `${projet()}-sauvegardes`;
const cheminBase = () => `projects/${projet()}/databases/(default)`;

function exigerProduction(): void {
    if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST) {
        throw new HttpsError('failed-precondition', 'Les sauvegardes managées Firestore ne sont pas disponibles sur les émulateurs.');
    }
}

/** Collections exportées : toutes sauf le registre des sauvegardes lui-même. */
async function collectionsAExporter(): Promise<string[]> {
    const racines = (await db.listCollections()).map((c) => c.id).filter((id) => id !== 'sauvegardes');
    return [...racines, 'alertes'];
}

async function copierDocuments(source: string, destination: string) {
    const [fichiers] = await bucket().getFiles({ prefix: source });
    const cible = storage.bucket(nomBucket());
    const manifeste: { chemin: string; md5: string; taille: number }[] = [];
    for (const fichier of fichiers) {
        const relatif = fichier.name.slice(source.length);
        await fichier.copy(cible.file(`${destination}${relatif}`));
        manifeste.push({ chemin: relatif, md5: String(fichier.metadata.md5Hash ?? ''), taille: Number(fichier.metadata.size ?? 0) });
    }
    return manifeste;
}

export async function verifier(id: string): Promise<{ integrite: boolean; erreur: string | null }> {
    const sauvegarde = await exiger(null, col.sauvegardes().doc(id), 'Sauvegarde introuvable.');
    const cible = storage.bucket(nomBucket());
    const [metadonnees] = await cible.file(`${id}/firestore/firestore.overall_export_metadata`).exists();
    if (!metadonnees) return { integrite: false, erreur: 'Export Firestore absent ou incomplet.' };
    for (const d of (sauvegarde.documents ?? []) as { chemin: string; md5: string }[]) {
        const [meta] = await cible.file(`${id}/documents/${d.chemin}`).getMetadata().catch(() => [null]);
        if (!meta || meta.md5Hash !== d.md5) return { integrite: false, erreur: `Document altéré ou manquant : ${d.chemin}` };
    }
    return { integrite: true, erreur: null };
}

export async function executerSauvegarde(motif: string): Promise<string> {
    exigerProduction();
    const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const id = `insec-${horodatage}-${randomBytes(3).toString('hex')}`;
    const ref = col.sauvegardes().doc(id);
    await ref.set({ nom: id, motif, statut: 'En cours', integrite: false, erreur: null, bucket: nomBucket(), creeLe: FieldValue.serverTimestamp() });
    try {
        const client = new firestoreAdmin.v1.FirestoreAdminClient();
        const [operationExport] = await client.exportDocuments({
            name: cheminBase(),
            outputUriPrefix: `gs://${nomBucket()}/${id}/firestore`,
            collectionIds: await collectionsAExporter(),
        });
        await operationExport.promise();
        const documents = await copierDocuments('dossiers/', `${id}/documents/`);
        await ref.update({ documents, nbDocuments: documents.length });
        const controle = await verifier(id);
        await ref.update({ statut: controle.integrite ? 'Terminée' : 'Échec', ...controle, termineeLe: FieldValue.serverTimestamp() });
        if (!controle.integrite) throw new Error(controle.erreur ?? 'Contrôle d’intégrité échoué.');
        return id;
    } catch (erreur) {
        await ref.update({ statut: 'Échec', erreur: String((erreur as Error).message ?? erreur).slice(0, 2000) });
        throw erreur;
    }
}

export async function purgerAnciennes(jours = RETENTION_JOURS): Promise<number> {
    const limite = Timestamp.fromMillis(Date.now() - jours * 24 * 3600 * 1000);
    const anciennes = await col.sauvegardes().where('creeLe', '<', limite).get();
    for (const d of anciennes.docs) {
        await storage.bucket(nomBucket()).deleteFiles({ prefix: `${d.id}/` });
        await d.ref.delete();
    }
    return anciennes.size;
}

const OPTIONS_LONGUES = { timeoutSeconds: 540, memory: '1GiB' as const };

export const creerSauvegarde = operation('creerSauvegarde', SUPER_ADMIN, async (_d, acteur) => {
    const id = await executerSauvegarde('Manuelle');
    await auditerDirect(acteur, { action: 'backup', description: `Création de la sauvegarde ${id}` });
    return { id, message: 'Sauvegarde créée et vérifiée.' };
}, OPTIONS_LONGUES);

export const verifierSauvegarde = operation('verifierSauvegarde', SUPER_ADMIN, async (donnees, acteur) => {
    const { id } = valider(z.object({ id: s.id() }), donnees);
    exigerProduction();
    const controle = await verifier(id);
    await col.sauvegardes().doc(id).update({ ...controle, verifieeLe: FieldValue.serverTimestamp() });
    await auditerDirect(acteur, { action: 'backup_verify', description: `Contrôle de la sauvegarde ${id}`, apres: { intégrité: controle.integrite } });
    return { ...controle, message: controle.integrite ? 'Intégrité confirmée.' : 'La sauvegarde est corrompue.' };
}, OPTIONS_LONGUES);

/** Réservé au super-administrateur, qui doit s'être ré-authentifié il y a moins de 5 minutes. */
export const restaurerSauvegarde = operation('restaurerSauvegarde', SUPER_ADMIN, async (donnees, acteur: Acteur) => {
    const v = valider(z.object({ id: s.id(), confirmation: z.literal('RESTAURER', { error: 'tapez RESTAURER pour confirmer.' }) }), donnees);
    if (!acteur.authTime || Date.now() / 1000 - acteur.authTime > 300) {
        throw new HttpsError('unauthenticated', 'Confirmez votre mot de passe avant de restaurer.');
    }
    exigerProduction();
    const sauvegarde = await exiger(null, col.sauvegardes().doc(v.id), 'Sauvegarde introuvable.');
    if (!(await verifier(v.id)).integrite) refuser('Archive invalide ou corrompue.');
    await executerSauvegarde('Sauvegarde automatique avant restauration');
    const client = new firestoreAdmin.v1.FirestoreAdminClient();
    const [operationImport] = await client.importDocuments({ name: cheminBase(), inputUriPrefix: `gs://${nomBucket()}/${v.id}/firestore` });
    await operationImport.promise();
    for (const d of (sauvegarde.documents ?? []) as { chemin: string }[]) {
        if (d.chemin.includes('..')) continue;
        await storage.bucket(nomBucket()).file(`${v.id}/documents/${d.chemin}`).copy(bucket().file(`dossiers/${d.chemin}`));
    }
    await auditerDirect(acteur, { action: 'restore', description: `Restauration depuis ${v.id}` });
    return { message: 'Restauration terminée. Une sauvegarde de précaution a été créée.' };
}, OPTIONS_LONGUES);

export const sauvegardeQuotidienne = onSchedule(
    { schedule: '0 2 * * *', timeZone: FUSEAU, region: REGION, ...OPTIONS_LONGUES },
    async () => {
        const id = await executerSauvegarde('Planifiée');
        const purgees = await purgerAnciennes();
        logger.info(`Sauvegarde ${id} créée ; ${purgees} ancienne(s) sauvegarde(s) supprimée(s).`);
    },
);
