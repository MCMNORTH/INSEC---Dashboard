import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './firebase.js';

export const col = {
    formations: () => db.collection('formations'),
    ues: () => db.collection('ues'),
    annees: () => db.collection('annees'),
    etudiants: () => db.collection('etudiants'),
    inscriptions: () => db.collection('inscriptions'),
    versements: () => db.collection('versements'),
    examens: () => db.collection('examens'),
    calendriersIntec: () => db.collection('calendriersIntec'),
    resultats: () => db.collection('resultats'),
    pieces: () => db.collection('pieces'),
    candidatures: () => db.collection('candidatures'),
    enseignants: () => db.collection('enseignants'),
    affectations: () => db.collection('affectations'),
    utilisateurs: () => db.collection('utilisateurs'),
    sauvegardes: () => db.collection('sauvegardes'),
    uniques: () => db.collection('uniques'),
    compteurs: () => db.collection('compteurs'),
};

export type Doc = Record<string, any>;

export function donnees(snap: DocumentSnapshot): Doc & { id: string } {
    return { id: snap.id, ...(snap.data() as Doc) };
}

export async function exiger(tx: Transaction | null, ref: DocumentReference, message: string): Promise<Doc & { id: string }> {
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', message);
    return donnees(snap);
}

/**
 * Contrainte d'unicité (équivalent d'un index UNIQUE SQL). Lecture à faire avant toute écriture de la transaction :
 * retourne une fonction qui réserve la clé.
 */
export const refUnique = (cle: string) => col.uniques().doc(cle.replace(/\\//g, '∕'));

export async function verifierUnique(tx: Transaction, cle: string, proprietaire: string, message: string, champ: string) {
    const ref = refUnique(cle);
    const snap = await tx.get(ref);
    if (snap.exists && snap.get('proprietaire') !== proprietaire) {
        throw new HttpsError('already-exists', message, { champs: { [champ]: message } });
    }
    return () => tx.set(ref, { proprietaire });
}

export function libererUnique(tx: Transaction, cle: string): void {
    tx.delete(refUnique(cle));
}

/** Lit un compteur séquentiel ; appeler la fonction retournée après les lectures pour l'incrémenter. */
export async function prochainNumero(tx: Transaction, nom: string): Promise<[number, () => void]> {
    const ref = col.compteurs().doc(nom);
    const snap = await tx.get(ref);
    const valeur = ((snap.exists ? snap.get('valeur') : 0) as number) + 1;
    return [valeur, () => tx.set(ref, { valeur })];
}

export function nomComplet(e: Doc | null | undefined): string {
    return `${e?.prenom ?? ''} ${e?.nom ?? ''}`.trim();
}
