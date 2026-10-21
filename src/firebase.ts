import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const env = import.meta.env;
export const avecEmulateurs = env.VITE_UTILISER_EMULATEURS === 'true' || (env.DEV && !env.VITE_FIREBASE_API_KEY);

async function configuration(): Promise<FirebaseOptions> {
    if (avecEmulateurs) {
        return { apiKey: 'demo-cle', authDomain: 'demo-insec.firebaseapp.com', projectId: 'demo-insec', storageBucket: 'demo-insec.appspot.com', appId: 'demo-app' };
    }
    if (env.VITE_FIREBASE_API_KEY) {
        return {
            apiKey: env.VITE_FIREBASE_API_KEY,
            authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
            appId: env.VITE_FIREBASE_APP_ID,
        };
    }
    // Sur Firebase Hosting, la configuration du projet est servie automatiquement.
    const reponse = await fetch('/__/firebase/init.json');
    if (!reponse.ok) throw new Error('Configuration Firebase introuvable.');
    return reponse.json();
}

export const app = initializeApp(await configuration());
// Clé de site publique, limitée au domaine de production par reCAPTCHA Enterprise.
const cleSiteAppCheck = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
    || '6LfSH9otAAAAACNkXZUF2pjo4N32XQW2U_5f2Rgx';
if (!avecEmulateurs && !env.DEV) {
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(cleSiteAppCheck),
        isTokenAutoRefreshEnabled: true,
    });
}
export const auth = getAuth(app);
auth.languageCode = 'fr';
export const db = getFirestore(app);
export const stockage = getStorage(app);
export const fonctions = getFunctions(app, 'europe-west1');

if (avecEmulateurs) {
    const hote = '127.0.0.1';
    connectAuthEmulator(auth, `http://${hote}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, hote, 8080);
    connectStorageEmulator(stockage, hote, 9199);
    connectFunctionsEmulator(fonctions, hote, 5001);
}
