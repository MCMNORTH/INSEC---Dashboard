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
export async function provisionnerCompte(profil: ProfilCompte, motDePasse?: string): Promise<string> {
    let uid: string;
    try {
        ({ uid } = await auth.createUser({
            email: profil.email,
            ...(motDePasse ? { password: motDePasse } : {}),
            displayName: profil.nom,
        }));
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
    const v = valider(z.object({ nom: s.texte(255), email: s.email(), role: s.choix(ROLES_CREABLES) }), donnees);
    if (v.role === 'admin' && acteur.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Seul le super-administrateur peut créer un compte administrateur.');
    }
    const profil = { nom: v.nom, email: v.email, role: v.role, etudiantId: null, enseignantId: null };
    // Aucun mot de passe n'est choisi par l'administrateur : la personne définit le sien
    // grâce à l'e-mail de réinitialisation envoyé par Firebase Authentication.
    const uid = await provisionnerCompte(profil);
    const lot = db.batch();
    lot.set(col.utilisateurs().doc(uid), { ...profil, actif: true, ...trace(acteur, true) });
    auditerModele(lot, acteur, 'User', uid, 'created', null, { ...profil, actif: true });
    await lot.commit();
    return { uid, email: v.email, message: 'Compte créé. Un e-mail va permettre à la personne de définir son mot de passe.' };
});

export const basculerCompte = operation('basculerCompte', ROLES_ADMIN, async (donnees, acteur) => {
    const { uid } = valider(z.object({ uid: s.id() }), donnees);
    if (uid === acteur.uid) refuser('Vous ne pouvez pas désactiver votre propre compte.');
    const ref = col.utilisateurs().doc(uid);
    const compte = await exiger(null, ref, 'Compte introuvable.');
    if ((compte.role === 'super_admin' || compte.role === 'admin') && acteur.role !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Seul le super-administrateur peut activer ou désactiver un compte administrateur.');
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
