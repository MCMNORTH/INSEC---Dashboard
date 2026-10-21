import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth();
export const storage = getStorage();
export const bucket = () => storage.bucket();
export { FieldValue, Timestamp };

export const REGION = 'europe-west1';
setGlobalOptions({ region: REGION, maxInstances: 10 });
export const FUSEAU = 'Africa/Nouakchott';
