import { randomUUID } from 'node:crypto';
import type { HttpsError } from 'firebase-functions/v2/https';
import { expect } from 'vitest';
import type { Gestionnaire } from '../src/lib/contexte.js';
import { bucket, db } from '../src/lib/firebase.js';
import type { Role } from '../src/shared/domaine.js';

const PROJET = 'demo-insec';

export async function reinitialiser(): Promise<void> {
    const firestore = process.env.FIRESTORE_EMULATOR_HOST;
    const authentification = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (!firestore || !authentification) throw new Error('Les tests doivent être lancés avec les émulateurs (npm test).');
    await fetch(`http://${firestore}/emulator/v1/projects/${PROJET}/databases/(default)/documents`, { method: 'DELETE' });
    await fetch(`http://${authentification}/emulator/v1/projects/${PROJET}/accounts`, { method: 'DELETE' });
    await bucket().deleteFiles({ force: true }).catch(() => undefined);
}

export async function referentiel(): Promise<void> {
    const lot = db.batch();
    lot.set(db.collection('formations').doc('DGC'), { code: 'DGC', nom: 'DGC', libelle: 'Diplôme de gestion et de comptabilité', dureeAnnees: 3, active: true });
    lot.set(db.collection('formations').doc('DSGC'), { code: 'DSGC', nom: 'DSGC', libelle: 'Diplôme supérieur de gestion et de comptabilité', dureeAnnees: 2, active: true });
    const ues: [string, string, number, number][] = [
        ['TEC111', 'DGC', 1, 14], ['TEC119', 'DGC', 1, 14], ['TEC112', 'DGC', 2, 14], ['TEC211', 'DSGC', 1, 20],
    ];
    ues.forEach(([code, formationId, anneeParcours, credits], ordre) =>
        lot.set(db.collection('ues').doc(code), { code, libelle: `UE ${code}`, formationId, anneeParcours, credits, ordre, active: true }),
    );
    ['2025-2026', '2026-2027'].forEach((libelle) => lot.set(db.collection('annees').doc(libelle), { libelle }));
    await lot.commit();
}

export interface ActeurTest {
    uid: string;
    role: Role | null;
    etudiantId?: string;
    enseignantId?: string;
    authTime?: number;
}

export async function acteur(role: Role | null, lien: { etudiantId?: string; enseignantId?: string } = {}): Promise<ActeurTest> {
    const uid = `u-${randomUUID()}`;
    await db.collection('utilisateurs').doc(uid).set({ nom: `Test ${role}`, email: `${uid}@insec.test`, role, actif: true, ...lien });
    return { uid, role, ...lien };
}

type Operation = { executer: (req: any) => Promise<any> } & object;

export function appeler<T = any>(operation: Operation, donnees: unknown, qui: ActeurTest | null): Promise<T> {
    const token = qui
        ? {
              name: `Test ${qui.role}`, email: `${qui.uid}@insec.test`, role: qui.role, etudiantId: qui.etudiantId,
              enseignantId: qui.enseignantId, auth_time: qui.authTime ?? Math.floor(Date.now() / 1000),
          }
        : undefined;
    return operation.executer({
        data: donnees,
        auth: qui ? { uid: qui.uid, token } : undefined,
        rawRequest: { headers: { 'user-agent': 'vitest', 'x-forwarded-for': '10.0.0.1' }, ip: '10.0.0.1' },
    });
}

export async function attendreErreur(promesse: Promise<unknown>, code: string, champ?: string): Promise<HttpsError> {
    try {
        await promesse;
    } catch (erreur) {
        const e = erreur as HttpsError;
        expect(e.code).toBe(code);
        if (champ) expect(Object.keys((e.details as { champs?: object })?.champs ?? {})).toContain(champ);
        return e;
    }
    throw new Error(`Une erreur ${code} était attendue.`);
}

export async function doc(chemin: string) {
    return (await db.doc(chemin).get()).data();
}

export async function liste(collection: string) {
    return (await db.collection(collection).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, any>);
}

export type { Gestionnaire };
