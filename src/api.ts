import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { fonctions } from './firebase';

export class ErreurApi extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly champs: Record<string, string> = {},
    ) {
        super(message);
    }
}

const MESSAGES: Record<string, string> = {
    'functions/unavailable': 'Le service est momentanément indisponible. Réessayez dans un instant.',
    'functions/deadline-exceeded': 'L’opération a pris trop de temps. Réessayez.',
    'functions/internal': 'Une erreur inattendue est survenue.',
    'functions/unauthenticated': 'Votre session a expiré. Veuillez vous reconnecter.',
};

/** Appelle une Cloud Function (opération métier) et normalise les erreurs de validation. */
export async function appeler<T = { message?: string }>(nom: string, donnees: object = {}): Promise<T> {
    try {
        const resultat = await httpsCallable(fonctions, nom, { timeout: 540_000 })(donnees);
        return resultat.data as T;
    } catch (erreur) {
        if (erreur instanceof FirebaseError) {
            const details = (erreur as FirebaseError & { details?: { champs?: Record<string, string> } }).details;
            const message = erreur.code === 'functions/internal' || !erreur.message || erreur.message === 'INTERNAL'
                ? MESSAGES[erreur.code] ?? MESSAGES['functions/internal']
                : erreur.message;
            throw new ErreurApi(message, erreur.code, details?.champs ?? {});
        }
        throw new ErreurApi(MESSAGES['functions/internal'], 'inconnue');
    }
}

export function messageErreur(erreur: unknown): string {
    if (erreur instanceof ErreurApi) return erreur.message;
    if (erreur instanceof FirebaseError) {
        if (erreur.code === 'permission-denied') return 'Accès refusé.';
        if (erreur.code === 'failed-precondition') return 'Un index Firestore est manquant ou en cours de création.';
        return erreur.message;
    }
    return 'Une erreur inattendue est survenue.';
}
