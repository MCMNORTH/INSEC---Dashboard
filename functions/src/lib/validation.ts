import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

z.config(z.locales.fr());

const LIBELLES: Record<string, string> = {
    nom: 'Nom', prenom: 'Prénom', email: 'E-mail', telephone: 'Téléphone', statut: 'Statut',
    formationId: 'Diplôme', anneeId: 'Année académique', anneeParcours: 'Année de parcours',
    dateInscription: 'Date d’inscription', numeroIntec: 'N° INTEC', ueIds: 'UE', montantDu: 'Montant dû',
    montantRemise: 'Remise', noteFinanciere: 'Note financière', montant: 'Montant', dateVersement: 'Date du versement',
    modePaiement: 'Mode de paiement', reference: 'Référence', note: 'Note', libelle: 'Libellé', dateEcheance: 'Date d’échéance',
    ueId: 'UE', session: 'Session', dateExamen: 'Date de l’examen', salle: 'Salle', noteSur: 'Note sur',
    seuilValidation: 'Seuil de validation', presence: 'Présence', commentaire: 'Commentaire', specialite: 'Spécialité',
    nombreEtudiants: 'Nombre d’étudiants', dateNaissance: 'Date de naissance', dernierDiplome: 'Dernier diplôme',
    motivation: 'Motivation', noteInterne: 'Note interne', role: 'Rôle', motDePasse: 'Mot de passe',
    etudiantId: 'Dossier étudiant', enseignantId: 'Dossier enseignant', type: 'Type', dateExpiration: 'Date d’expiration',
    confirmation: 'Confirmation', mode: 'Mode',
};

export function valider<S extends z.ZodType>(schema: S, donnees: unknown): z.output<S> {
    const resultat = schema.safeParse(donnees ?? {});
    if (resultat.success) return resultat.data;
    const champs: Record<string, string> = {};
    for (const probleme of resultat.error.issues) {
        const chemin = probleme.path.join('.') || '_';
        const cle = String(probleme.path[0] ?? '');
        champs[chemin] ??= `${LIBELLES[cle] ?? cle} : ${probleme.message}`.replace(/^ : /, '');
    }
    throw new HttpsError('invalid-argument', Object.values(champs)[0] ?? 'Données invalides.', { champs });
}

export function erreurChamp(champ: string, message: string): never {
    throw new HttpsError('invalid-argument', message, { champs: { [champ]: message } });
}

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const s = {
    texte: (max: number) => z.string().trim().min(1, 'ce champ est obligatoire.').max(max),
    texteOptionnel: (max: number) =>
        z.preprocess(vide, z.string().trim().max(max).nullish()).transform((v) => v ?? null),
    email: () => z.string().trim().toLowerCase().pipe(z.email('adresse e-mail invalide.')).pipe(z.string().max(255)),
    date: () =>
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date invalide.').refine((v) => !Number.isNaN(Date.parse(v)), 'date invalide.'),
    dateOptionnelle: () =>
        z.preprocess(vide, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date invalide.').nullish()).transform((v) => v ?? null),
    entier: (min = 0, max = Number.MAX_SAFE_INTEGER) => z.coerce.number().int('nombre entier attendu.').min(min).max(max),
    nombre: (min = 0, max = Number.MAX_SAFE_INTEGER) => z.coerce.number().min(min).max(max),
    id: () => z.string().trim().min(1, 'ce champ est obligatoire.').max(200).regex(/^[^/]+$/, 'identifiant invalide.'),
    choix: <T extends readonly [string, ...string[]]>(valeurs: T) => z.enum(valeurs, { error: 'valeur non autorisée.' }),
};

export { z };
