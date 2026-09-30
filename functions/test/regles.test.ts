import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const jeton = (role: string, lien: Record<string, string> = {}) => ({ role, ...lien });

beforeAll(async () => {
    const [hote, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    const [hoteStockage, portStockage] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({
        projectId: 'demo-insec',
        firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: hote, port: Number(port) },
        storage: { rules: readFileSync('../storage.rules', 'utf8'), host: hoteStockage, port: Number(portStockage) },
    });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'formations/DGC'), { code: 'DGC' });
        await setDoc(doc(db, 'ues/TEC111'), { code: 'TEC111' });
        await setDoc(doc(db, 'etudiants/e1'), { nom: 'Ba' });
        await setDoc(doc(db, 'etudiants/e2'), { nom: 'Diallo' });
        await setDoc(doc(db, 'inscriptions/i1'), { etudiantId: 'e1' });
        await setDoc(doc(db, 'inscriptions/i2'), { etudiantId: 'e2' });
        await setDoc(doc(db, 'resultats/r1'), { etudiantId: 'e1' });
        await setDoc(doc(db, 'enseignants/p1'), { nom: 'Sidi' });
        await setDoc(doc(db, 'affectations/p1_TEC111'), { enseignantId: 'p1', ueId: 'TEC111' });
        await setDoc(doc(db, 'journalAudit/a1'), { action: 'created' });
        await setDoc(doc(db, 'sauvegardes/s1'), { statut: 'Terminée' });
        await setDoc(doc(db, 'uniques/etudiant-email:awa@example.com'), { proprietaire: 'e1' });
        await setDoc(doc(db, 'utilisateurs/u-etudiant/alertes/a1'), { titre: 'Alerte', lueLe: null, archiveeLe: null, active: true });
    });
});

describe('Règles Firestore', () => {
    it('expose le référentiel public mais aucune donnée personnelle aux visiteurs', async () => {
        const visiteur = env.unauthenticatedContext().firestore();
        await assertSucceeds(getDoc(doc(visiteur, 'formations/DGC')));
        await assertFails(getDoc(doc(visiteur, 'ues/TEC111')));
        await assertFails(getDoc(doc(visiteur, 'etudiants/e1')));
        await assertFails(getDoc(doc(visiteur, 'candidatures/ADM-1')));
    });

    it('interdit toute écriture directe, même à un administrateur', async () => {
        const admin = env.authenticatedContext('u-admin', jeton('admin')).firestore();
        await assertFails(setDoc(doc(admin, 'etudiants/e3'), { nom: 'X' }));
        await assertFails(updateDoc(doc(admin, 'inscriptions/i1'), { totalVerse: 999999 }));
        await assertFails(setDoc(doc(admin, 'journalAudit/a2'), { action: 'faux' }));
    });

    it('limite l’étudiant à son propre dossier', async () => {
        const eleve = env.authenticatedContext('u-etudiant', jeton('etudiant', { etudiantId: 'e1' })).firestore();
        await assertSucceeds(getDoc(doc(eleve, 'etudiants/e1')));
        await assertFails(getDoc(doc(eleve, 'etudiants/e2')));
        await assertSucceeds(getDocs(query(collection(eleve, 'inscriptions'), where('etudiantId', '==', 'e1'))));
        await assertFails(getDocs(collection(eleve, 'inscriptions')));
        await assertFails(getDoc(doc(eleve, 'inscriptions/i2')));
        await assertSucceeds(getDoc(doc(eleve, 'resultats/r1')));
        await assertFails(getDoc(doc(eleve, 'journalAudit/a1')));
    });

    it('limite l’enseignant à sa fiche et à ses affectations', async () => {
        const prof = env.authenticatedContext('u-prof', jeton('enseignant', { enseignantId: 'p1' })).firestore();
        await assertSucceeds(getDoc(doc(prof, 'enseignants/p1')));
        await assertSucceeds(getDocs(query(collection(prof, 'affectations'), where('enseignantId', '==', 'p1'))));
        await assertFails(getDoc(doc(prof, 'etudiants/e1')));
        await assertFails(getDoc(doc(prof, 'resultats/r1')));
    });

    it('ouvre les finances au rôle finance sans les journaux ni les sauvegardes', async () => {
        const finance = env.authenticatedContext('u-finance', jeton('finance')).firestore();
        await assertSucceeds(getDocs(collection(finance, 'inscriptions')));
        await assertSucceeds(getDoc(doc(finance, 'etudiants/e2')));
        await assertFails(getDoc(doc(finance, 'resultats/r1')));
        await assertFails(getDoc(doc(finance, 'journalAudit/a1')));
    });

    it('réserve les sauvegardes au super-administrateur et masque les index techniques', async () => {
        await assertFails(getDoc(doc(env.authenticatedContext('u-admin', jeton('admin')).firestore(), 'sauvegardes/s1')));
        const superAdmin = env.authenticatedContext('u-super', jeton('super_admin')).firestore();
        await assertSucceeds(getDoc(doc(superAdmin, 'sauvegardes/s1')));
        await assertFails(getDoc(doc(superAdmin, 'uniques/etudiant-email:awa@example.com')));
    });

    it('permet à l’utilisateur de marquer ses alertes comme lues ou archivées, et rien d’autre', async () => {
        const eleve = env.authenticatedContext('u-etudiant', jeton('etudiant', { etudiantId: 'e1' })).firestore();
        const alerte = doc(eleve, 'utilisateurs/u-etudiant/alertes/a1');
        await assertSucceeds(updateDoc(alerte, { lueLe: serverTimestamp() }));
        await assertSucceeds(updateDoc(alerte, { archiveeLe: serverTimestamp() }));
        await assertFails(updateDoc(alerte, { titre: 'Modifiée' }));
        await assertFails(updateDoc(alerte, { lueLe: new Date('2000-01-01') }));
        const intrus = env.authenticatedContext('u-autre', jeton('etudiant', { etudiantId: 'e2' })).firestore();
        await assertFails(getDoc(doc(intrus, 'utilisateurs/u-etudiant/alertes/a1')));
        await assertFails(updateDoc(doc(intrus, 'utilisateurs/u-etudiant/alertes/a1'), { lueLe: serverTimestamp() }));
    });
});

describe('Règles Storage', () => {
    const pdf = new Uint8Array([37, 80, 68, 70]);

    it('autorise le dépôt de pièces PDF/images par l’administration uniquement', async () => {
        const admin = env.authenticatedContext('u-admin', jeton('admin')).storage();
        await assertSucceeds(uploadBytes(ref(admin, 'dossiers/e1/piece.pdf'), pdf, { contentType: 'application/pdf' }));
        await assertFails(uploadBytes(ref(admin, 'dossiers/e1/page.html'), pdf, { contentType: 'text/html' }));
        await assertFails(uploadBytes(ref(admin, 'autre/piece.pdf'), pdf, { contentType: 'application/pdf' }));
        const eleve = env.authenticatedContext('u-etudiant', jeton('etudiant', { etudiantId: 'e1' })).storage();
        await assertFails(uploadBytes(ref(eleve, 'dossiers/e1/piece.pdf'), pdf, { contentType: 'application/pdf' }));
    });
});
