import type { Role } from '@shared/domaine';
import {
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    type User,
} from 'firebase/auth';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { reactive } from 'vue';
import { auth, db } from './firebase';

export const session = reactive({
    pret: false,
    uid: null as string | null,
    nom: '',
    email: '',
    role: null as Role | null,
    etudiantId: null as string | null,
    enseignantId: null as string | null,
    messageDeconnexion: '',
});

let arreterProfil: Unsubscribe | null = null;
let resoudrePret: () => void;
const pret = new Promise<void>((r) => (resoudrePret = r));

async function appliquer(utilisateur: User | null) {
    arreterProfil?.();
    arreterProfil = null;
    if (!utilisateur) {
        Object.assign(session, { uid: null, nom: '', email: '', role: null, etudiantId: null, enseignantId: null });
        return;
    }
    const jeton = await utilisateur.getIdTokenResult();
    Object.assign(session, {
        uid: utilisateur.uid,
        nom: utilisateur.displayName ?? utilisateur.email ?? '',
        email: utilisateur.email ?? '',
        role: (jeton.claims.role as Role | undefined) ?? null,
        etudiantId: (jeton.claims.etudiantId as string | undefined) ?? null,
        enseignantId: (jeton.claims.enseignantId as string | undefined) ?? null,
    });
    // Déconnexion immédiate si le compte est désactivé pendant la session.
    arreterProfil = onSnapshot(doc(db, 'utilisateurs', utilisateur.uid), (profil) => {
        if (profil.exists() && profil.get('actif') === false) void deconnexion('Ce compte est désactivé.');
    }, () => undefined);
}

onAuthStateChanged(auth, async (utilisateur) => {
    await appliquer(utilisateur);
    session.pret = true;
    resoudrePret();
});

export const sessionPrete = () => pret;

export function aRole(...roles: readonly Role[]): boolean {
    return !!session.role && roles.includes(session.role);
}

export function accueil(role: Role | null = session.role): string {
    switch (role) {
        case 'admin':
        case 'super_admin':
            return '/admin/tableau-de-bord';
        case 'finance':
            return '/finances';
        case 'enseignant':
        case 'etudiant':
            return '/acces-refuse';
        default:
            return '/acces-refuse';
    }
}

const MESSAGES_AUTH: Record<string, string> = {
    'auth/invalid-credential': 'Ces identifiants ne correspondent pas à nos enregistrements.',
    'auth/wrong-password': 'Ces identifiants ne correspondent pas à nos enregistrements.',
    'auth/user-not-found': 'Ces identifiants ne correspondent pas à nos enregistrements.',
    'auth/user-disabled': 'Ce compte est désactivé.',
    'auth/too-many-requests': 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.',
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/network-request-failed': 'Connexion réseau indisponible.',
};

export const messageAuth = (erreur: unknown) =>
    MESSAGES_AUTH[(erreur as { code?: string })?.code ?? ''] ?? 'La connexion a échoué. Veuillez réessayer.';

export async function connexion(email: string, motDePasse: string): Promise<void> {
    session.messageDeconnexion = '';
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), motDePasse);
    await appliquer(user);
}

export async function deconnexion(message = ''): Promise<void> {
    await signOut(auth);
    session.messageDeconnexion = message;
}

export function envoyerLienReinitialisation(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email.trim(), { url: `${window.location.origin}/connexion` });
}

/** Confirme le mot de passe avant une opération critique (restauration). */
export async function reauthentifier(motDePasse: string): Promise<void> {
    const utilisateur = auth.currentUser;
    if (!utilisateur?.email) throw new Error('Session invalide.');
    await reauthenticateWithCredential(utilisateur, EmailAuthProvider.credential(utilisateur.email, motDePasse));
    await utilisateur.getIdToken(true);
}
