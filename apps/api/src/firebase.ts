import * as admin from 'firebase-admin';

export function initFirebaseAdmin() {
  const useEmulators = process.env.USE_EMULATORS === 'true';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'mdavelctf-local';

  if (useEmulators) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST =
      process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  }

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

  if (!admin.apps.length) {
    // Production: use service account JSON from env var
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson && !useEmulators) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
          storageBucket,
        });
        console.log('[Firebase] Initialized with service account credentials');
      } catch (err) {
        console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err);
        admin.initializeApp({ projectId, storageBucket });
      }
    } else {
      admin.initializeApp({ projectId, storageBucket });
    }
  }
}

export function getAuth() {
  return admin.auth();
}

export function getDb() {
  return admin.firestore();
}

export function getStorage() {
  return admin.storage();
}
