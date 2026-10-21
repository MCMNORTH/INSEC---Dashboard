import { logger } from 'firebase-functions';
import { HttpsError, onCall, type CallableOptions, type CallableRequest } from 'firebase-functions/v2/https';
import { ZodError } from 'zod';
import type { Role } from '../shared/domaine.js';
import { db, REGION } from './firebase.js';

export interface Acteur {
    uid: string | null;
    nom: string | null;
    email: string | null;
    role: Role | null;
    etudiantId: string | null;
    enseignantId: string | null;
    ip: string | null;
    userAgent: string | null;
    operation: string;
    /** Date de la dernière authentification (secondes), utilisée pour les opérations critiques. */
    authTime: number | null;
}

export type Autorisation = 'public' | 'connecte' | readonly Role[];

export function acteurDepuis(req: Pick<CallableRequest, 'auth' | 'rawRequest'>, operation: string): Acteur {
    const token: Record<string, unknown> = req.auth?.token ?? {};
    const brut = req.rawRequest;
    const ip = (brut?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || brut?.ip || null;
    return {
        uid: req.auth?.uid ?? null,
        nom: (token.name as string | undefined) ?? (token.email as string | undefined) ?? null,
        email: (token.email as string | undefined) ?? null,
        role: (token.role as Role | undefined) ?? null,
        etudiantId: (token.etudiantId as string | undefined) ?? null,
        enseignantId: (token.enseignantId as string | undefined) ?? null,
        ip,
        userAgent: ((brut?.headers?.['user-agent'] as string | undefined) ?? '').slice(0, 1000) || null,
        operation,
        authTime: (token.auth_time as number | undefined) ?? null,
    };
}

export async function autoriser(acteur: Acteur, autorisation: Autorisation): Promise<void> {
    if (autorisation === 'public') return;
    if (!acteur.uid) throw new HttpsError('unauthenticated', 'Veuillez vous connecter.');
    // Un compte désactivé perd l'accès immédiatement, même si son jeton est encore valide.
    const profil = await db.collection('utilisateurs').doc(acteur.uid).get();
    if (!profil.exists || profil.get('actif') === false) {
        throw new HttpsError('permission-denied', 'Ce compte est désactivé.');
    }
    if (autorisation === 'connecte') return;
    if (!acteur.role || !autorisation.includes(acteur.role)) {
        throw new HttpsError('permission-denied', 'Accès refusé pour votre rôle.');
    }
}

export type Gestionnaire<T> = (donnees: unknown, acteur: Acteur) => Promise<T>;

/**
 * Déclare une opération appelable depuis l'application (équivalent d'une action de contrôleur).
 * Le gestionnaire est exposé séparément pour les tests.
 */
export function operation<T>(nom: string, autorisation: Autorisation, gestionnaire: Gestionnaire<T>, options: CallableOptions = {}) {
    const executer = async (req: Pick<CallableRequest, 'auth' | 'rawRequest' | 'data'>): Promise<T> => {
        const acteur = acteurDepuis(req, nom);
        await autoriser(acteur, autorisation);
        try {
            return await gestionnaire(req.data, acteur);
        } catch (erreur) {
            if (erreur instanceof HttpsError) throw erreur;
            if (erreur instanceof ZodError) throw new HttpsError('invalid-argument', 'Données invalides.');
            logger.error(`Échec de l'opération ${nom}`, erreur);
            throw new HttpsError('internal', 'Une erreur inattendue est survenue.');
        }
    };
    const fonction = onCall({ region: REGION, ...options }, (req) => executer(req));
    return Object.assign(fonction, { executer });
}

export function introuvable(message = 'Élément introuvable.'): never {
    throw new HttpsError('not-found', message);
}

export function refuser(message: string, champs?: Record<string, string>): never {
    throw new HttpsError('failed-precondition', message, champs ? { champs } : undefined);
}
