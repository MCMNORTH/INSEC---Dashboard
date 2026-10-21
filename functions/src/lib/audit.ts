import type { Transaction, WriteBatch } from 'firebase-admin/firestore';
import type { Acteur } from './contexte.js';
import { db, FieldValue, Timestamp } from './firebase.js';

export type Ecrivain = Transaction | WriteBatch;
type Donnees = Record<string, unknown>;

const IGNORES = new Set(['motDePasse', 'password', 'creeLe', 'modifieLe', 'creePar', 'modifiePar']);
const LIBELLES_ACTION: Record<string, string> = { created: 'Création', updated: 'Modification', deleted: 'Suppression' };

export function nettoyer(donnees: Donnees | undefined | null): Donnees {
    const resultat: Donnees = {};
    for (const [cle, valeur] of Object.entries(donnees ?? {})) {
        if (IGNORES.has(cle) || valeur === undefined) continue;
        resultat[cle] = valeur instanceof Timestamp ? valeur.toDate().toISOString() : valeur;
    }
    return resultat;
}

interface Entree {
    action: string;
    description: string;
    modele?: string | null;
    modeleId?: string | null;
    avant?: Donnees | null;
    apres?: Donnees | null;
}

function donneesAudit(acteur: Acteur, entree: Entree) {
    const avant = nettoyer(entree.avant);
    const apres = nettoyer(entree.apres);
    return {
        acteurId: acteur.uid,
        acteur: acteur.nom,
        action: entree.action,
        modele: entree.modele ?? null,
        modeleId: entree.modeleId ?? null,
        description: entree.description,
        avant: Object.keys(avant).length ? avant : null,
        apres: Object.keys(apres).length ? apres : null,
        adresseIp: acteur.ip,
        userAgent: acteur.userAgent,
        operation: acteur.operation,
        creeLe: FieldValue.serverTimestamp(),
    };
}

/** Ajoute une entrée d'audit dans la même transaction que la modification auditée. */
export function auditer(ecrivain: Ecrivain, acteur: Acteur, entree: Entree): void {
    (ecrivain as WriteBatch).set(db.collection('journalAudit').doc(), donneesAudit(acteur, entree));
}

export async function auditerDirect(acteur: Acteur, entree: Entree): Promise<void> {
    await db.collection('journalAudit').add(donneesAudit(acteur, entree));
}

/** Audit d'une création, modification ou suppression de document, avec le détail des champs modifiés. */
export function auditerModele(
    ecrivain: Ecrivain,
    acteur: Acteur,
    modele: string,
    id: string,
    action: 'created' | 'updated' | 'deleted',
    avant: Donnees | null,
    apres: Donnees | null,
): void {
    let a = avant;
    let b = apres;
    if (action === 'updated' && avant && apres) {
        a = {};
        b = {};
        for (const cle of Object.keys(apres)) {
            if (IGNORES.has(cle)) continue;
            if (JSON.stringify(avant[cle] ?? null) !== JSON.stringify(apres[cle] ?? null)) {
                a[cle] = avant[cle] ?? null;
                b[cle] = apres[cle];
            }
        }
        if (Object.keys(b).length === 0) return;
    }
    auditer(ecrivain, acteur, {
        action,
        modele,
        modeleId: id,
        description: `${LIBELLES_ACTION[action]} ${modele} #${id}`,
        avant: a,
        apres: b,
    });
}

/** Horodatage et auteur communs à toutes les écritures. */
export function trace(acteur: Acteur, creation = false) {
    return creation
        ? { creeLe: FieldValue.serverTimestamp(), modifieLe: FieldValue.serverTimestamp(), creePar: acteur.uid, modifiePar: acteur.uid }
        : { modifieLe: FieldValue.serverTimestamp(), modifiePar: acteur.uid };
}
