import { HttpsError } from 'firebase-functions/v2/https';
import { auditerModele, trace } from '../lib/audit.js';
import { operation, refuser } from '../lib/contexte.js';
import { col, exiger } from '../lib/donnees.js';
import { auth, db } from '../lib/firebase.js';
import { erreurChamp, s, valider, z } from '../lib/validation.js';
import { ROLES_ADMIN, ROLES_CREABLES, type Role } from '../shared/domaine.js';

export interface ProfilCompte {
    nom: string;
    email: string;
    role: Role;
    etudiantId: string | null;
    enseignantId: string | null;
}

/** Crée l'utilisateur Firebase Auth, ses droits (custom claims) et son profil Firestore. */
export async function provisionnerCompte(profil: ProfilCompte, motDePasse: string): Promise<string> {
    let uid: string;
    try {
        ({ uid } = await auth.createUser({ email: profil.email, password: motDePasse, displayName: profil.nom }));
    } catch (erreur) {
        if ((erreur as { code?: string }).code === 'auth/email-already-exists') erreurChamp('email', 'Un compte existe déjà avec cet e-mail.');
        throw erreur;
    }
    await auth.setCustomUserClaims(uid, {
        role: profil.role,
        ...(profil.etudiantId ? { etudiantId: profil.etudiantId } : {}),
        ...(profil.enseignantId ? { enseignantId: profil.enseignantId } : {}),
    });
    return uid;
}

export const creerCompte = operation('creerCompte', ROLES_ADMIN, async (donnees, acteur) => {
    const v = valider(
        z.object({
            nom: s.texte(255),
            email: s.email(),
            motDePasse: z.string().min(8, 'au moins 8 caractères.').max(128),
            role: s.choix(ROLES_CREABLES),
            etudiantId: s.texteOptionnel(200),
            enseignantId: s.texteOptionnel(200),
        }),
        donnees,
    );
    const etudiantId = v.role === 'etudiant' ? v.etudiantId : null;
    const enseignantId = v.role === 'enseignant' ? v.enseignantId : null;
    if (v.role === 'etudiant' && !etudiantId) erreurChamp('etudiantId', 'Un dossier étudiant est obligatoire.');
    if (v.role === 'enseignant' && !enseignantId) erreurChamp('enseignantId', 'Un dossier enseignant est obligatoire.');
    if (etudiantId) {
        await exiger(null, col.etudiants().doc(etudiantId), 'Dossier étudiant introuvable.');
        if (!(await col.utilisateurs().where('etudiantId', '==', etudiantId).limit(1).get()).empty) {
            erreurChamp('etudiantId', 'Ce dossier étudiant est déjà rattaché à un compte.');
        }
    }
    if (enseignantId) {
        await exiger(null, col.enseignants().doc(enseignantId), 'Dossier enseignant introuvable.');
        if (!(await col.utilisateurs().where('enseignantId', '==', enseignantId).limit(1).get()).empty) {
            erreurChamp('enseignantId', 'Ce dossier enseignant est déjà rattaché à un compte.');
        }
    }
    const profil = { nom: v.nom, email: v.email, role: v.role, etudiantId, enseignantId };
    const uid = await provisionnerCompte(profil, v.motDePasse);
    const lot = db.batch();
    lot.set(col.utilisateurs().doc(uid), { ...profil, actif: true, ...trace(acteur, true) });
    auditerModele(lot, acteur, 'User', uid, 'created', null, { ...profil, actif: true });
    await lot.commit();
    return { uid, message: 'Compte utilisateur créé.' };
});

export const basculerCompte = operation('basculerCompte', ROLES_ADMIN, async (donnees, acteur) => {
    const { uid } = valider(z.object({ uid: s.id() }), donnees);
    if (uid === acteur.uid) refuser('Vous ne pouvez pas désactiver votre propre compte.');
    const ref = col.utilisateurs().doc(uid);
    const compte = await exiger(null, ref, 'Compte introuvable.');
    if (compte.role === 'super_admin' && acteur.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Seul un super-administrateur peut modifier ce compte.');
    }
    const actif = !compte.actif;
    await auth.updateUser(uid, { disabled: !actif });
    if (!actif) await auth.revokeRefreshTokens(uid);
    const lot = db.batch();
    lot.update(ref, { actif, ...trace(acteur) });
    auditerModele(lot, acteur, 'User', uid, 'updated', { actif: compte.actif }, { actif });
    await lot.commit();
    return { actif, message: actif ? 'Compte activé.' : 'Compte désactivé.' };
});
