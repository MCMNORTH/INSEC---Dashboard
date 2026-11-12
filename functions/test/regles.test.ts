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
        await setDoc(doc(db, 'examens/x1'), { ueId: 'TEC111' });
        await setDoc(doc(db, 'candidatures/ADM-1'), { email: 'ancien@example.com' });
        await setDoc(doc(db, 'enseignants/p1'), { nom: 'Sidi' });
        await setDoc(doc(db, 'journalAudit/a1'), { action: 'created' });
        await setDoc(doc(db, 'sauvegardes/s1'), { statut: 'Terminée' });
        await setDoc(doc(db, 'uniques/etudiant-email:awa@example.com'), { proprietaire: 'e1' });
        await setDoc(doc(db, 'utilisateurs/u-etudiant/alertes/a1'), { titre: 'Alerte', lueLe: null, archiveeLe: null, active: true });
        await setDoc(doc(db, 'versements/v1'), { etudiantId: 'e1', montant: 1000 });
        await setDoc(doc(db, 'pieces/p1'), { etudiantId: 'e1', type: 'Pièce d’identité' });
        await setDoc(doc(db, 'journalEmails/m1'), { destinataire: 'awa@example.com' });
        // Profils des comptes : les règles lisent le rôle et l'état « actif » dans le profil.
        for (const [uid, role] of [['u-admin', 'admin'], ['u-super', 'super_admin'], ['u-finance', 'finance'], ['u-consult', 'consultation'], ['u-lecture', 'admin_lecture'], ['u-etudiant', 'etudiant'], ['u-prof', 'enseignant']]) {
            await setDoc(doc(db, `utilisateurs/${uid}`), { role, actif: true });
        }
        await setDoc(doc(db, 'utilisateurs/u-desactive'), { role: 'admin', actif: false });
        await setDoc(doc(db, 'utilisateurs/u-retrograde'), { role: 'consultation', actif: true });
    });
});

describe('Règles Firestore', () => {
    it('n’expose rien aux visiteurs non connectés, pas même le référentiel', async () => {
        const visiteur = env.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(visiteur, 'formations/DGC')));
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

    it('refuse tout accès aux anciens comptes étudiant et enseignant', async () => {
        const eleve = env.authenticatedContext('u-etudiant', jeton('etudiant', { etudiantId: 'e1' })).firestore();
        const prof = env.authenticatedContext('u-prof', jeton('enseignant', { enseignantId: 'p1' })).firestore();
        for (const ctx of [eleve, prof]) {
            for (const chemin of ['etudiants/e1', 'inscriptions/i1', 'resultats/r1', 'examens/x1', 'formations/DGC', 'enseignants/p1', 'candidatures/ADM-1']) {
                await assertFails(getDoc(doc(ctx, chemin)));
            }
        }
        await assertFails(getDocs(query(collection(eleve, 'inscriptions'), where('etudiantId', '==', 'e1'))));
    });

    it('ferme les anciennes collections candidatures et enseignants, même à l’administration', async () => {
        const admin = env.authenticatedContext('u-admin', jeton('admin')).firestore();
        await assertSucceeds(getDoc(doc(admin, 'examens/x1')));
        await assertSucceeds(getDoc(doc(admin, 'formations/DGC')));
        await assertFails(getDoc(doc(admin, 'candidatures/ADM-1')));
        await assertFails(getDoc(doc(admin, 'enseignants/p1')));
    });

    it('ouvre les finances au rôle finance sans les journaux ni les sauvegardes', async () => {
        const finance = env.authenticatedContext('u-finance', jeton('finance')).firestore();
        await assertSucceeds(getDocs(collection(finance, 'inscriptions')));
        await assertSucceeds(getDoc(doc(finance, 'etudiants/e2')));
        await assertSucceeds(getDoc(doc(finance, 'formations/DGC')));
        // Les résultats figurent sur la fiche de l'étudiant, désormais ouverte au rôle finance.
        await assertSucceeds(getDoc(doc(finance, 'resultats/r1')));
        await assertFails(getDoc(doc(finance, 'examens/x1')));
        await assertFails(getDoc(doc(finance, 'journalAudit/a1')));
        await assertFails(getDoc(doc(finance, 'pieces/p1')));
    });

    it('ouvre au rôle consultation la lecture des étudiants et des finances, sans pièces, journaux ni comptes', async () => {
        const consult = env.authenticatedContext('u-consult', jeton('consultation')).firestore();
        for (const chemin of ['etudiants/e1', 'inscriptions/i1', 'versements/v1', 'resultats/r1', 'formations/DGC', 'ues/TEC111']) {
            await assertSucceeds(getDoc(doc(consult, chemin)));
        }
        await assertSucceeds(getDocs(collection(consult, 'etudiants')));
        for (const chemin of ['pieces/p1', 'examens/x1', 'journalAudit/a1', 'journalEmails/m1', 'sauvegardes/s1', 'utilisateurs/u-admin']) {
            await assertFails(getDoc(doc(consult, chemin)));
        }
        await assertFails(setDoc(doc(consult, 'versements/v2'), { montant: 1 }));
        await assertFails(updateDoc(doc(consult, 'inscriptions/i1'), { totalVerse: 0 }));
        // Son propre profil reste lisible (l'application y détecte une désactivation).
        await assertSucceeds(getDoc(doc(consult, 'utilisateurs/u-consult')));
    });

    it('ouvre à l’administration en lecture seule tout ce que lit un administrateur, sans aucune écriture', async () => {
        const lecteur = env.authenticatedContext('u-lecture', jeton('admin_lecture')).firestore();
        for (const chemin of ['etudiants/e1', 'inscriptions/i1', 'versements/v1', 'resultats/r1', 'formations/DGC', 'ues/TEC111',
            'pieces/p1', 'examens/x1', 'journalAudit/a1', 'journalEmails/m1', 'utilisateurs/u-admin']) {
            await assertSucceeds(getDoc(doc(lecteur, chemin)));
        }
        await assertSucceeds(getDocs(collection(lecteur, 'utilisateurs')));
        // Sauvegardes : super-administrateur seulement ; collections techniques jamais exposées.
        await assertFails(getDoc(doc(lecteur, 'sauvegardes/s1')));
        await assertFails(getDoc(doc(lecteur, 'uniques/etudiant-email:awa@example.com')));
        await assertFails(setDoc(doc(lecteur, 'etudiants/e3'), { nom: 'Sy' }));
        await assertFails(updateDoc(doc(lecteur, 'inscriptions/i1'), { totalVerse: 0 }));
        await assertFails(updateDoc(doc(lecteur, 'utilisateurs/u-lecture'), { role: 'admin' }));
        await assertFails(setDoc(doc(lecteur, 'journalAudit/a2'), { action: 'created' }));
    });

    it('coupe immédiatement l’accès d’un compte désactivé ou sans profil, même avec un jeton valide', async () => {
        const desactive = env.authenticatedContext('u-desactive', jeton('admin')).firestore();
        const sansProfil = env.authenticatedContext('u-inconnu', jeton('admin')).firestore();
        for (const ctx of [desactive, sansProfil]) {
            await assertFails(getDoc(doc(ctx, 'etudiants/e1')));
            await assertFails(getDoc(doc(ctx, 'journalAudit/a1')));
        }
        await assertSucceeds(getDoc(doc(desactive, 'utilisateurs/u-desactive')));
    });

    it('applique le rôle du profil plutôt que celui du jeton après un changement de rôle', async () => {
        // Jeton encore « admin », profil passé en « consultation ».
        const retrograde = env.authenticatedContext('u-retrograde', jeton('admin')).firestore();
        await assertSucceeds(getDoc(doc(retrograde, 'etudiants/e1')));
        await assertFails(getDoc(doc(retrograde, 'journalAudit/a1')));
        await assertFails(getDoc(doc(retrograde, 'pieces/p1')));
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

    it('autorise la finance à déposer un PDF financier dans son propre dossier uniquement', async () => {
        const finance = env.authenticatedContext('u-finance', jeton('finance')).storage();
        await assertSucceeds(uploadBytes(ref(finance, 'finances/2026-2027/facture-intec/u-finance/f.pdf'), pdf, { contentType: 'application/pdf' }));
        await assertFails(uploadBytes(ref(finance, 'finances/2026-2027/facture-intec/u-autre/f.pdf'), pdf, { contentType: 'application/pdf' }));
        await assertFails(uploadBytes(ref(finance, 'finances/2026-2027/autre-type/u-finance/f.pdf'), pdf, { contentType: 'application/pdf' }));
        await assertFails(uploadBytes(ref(finance, 'finances/2026-2027/facture-intec/u-finance/f.png'), pdf, { contentType: 'image/png' }));
        const eleve = env.authenticatedContext('u-etudiant', jeton('etudiant', { etudiantId: 'e1' })).storage();
        await assertFails(uploadBytes(ref(eleve, 'finances/2026-2027/facture-intec/u-etudiant/f.pdf'), pdf, { contentType: 'application/pdf' }));
    });

    it('refuse tout dépôt à l’administration en lecture seule', async () => {
        const lecteur = env.authenticatedContext('u-lecture', jeton('admin_lecture')).storage();
        await assertFails(uploadBytes(ref(lecteur, 'dossiers/e1/piece.pdf'), pdf, { contentType: 'application/pdf' }));
        await assertFails(uploadBytes(ref(lecteur, 'finances/2026-2027/facture-intec/u-lecture/f.pdf'), pdf, { contentType: 'application/pdf' }));
    });
});
