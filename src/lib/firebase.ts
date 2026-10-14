import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  terminate,
  type Firestore
} from 'firebase/firestore';

/**
 * La configurazione arriva dalle variabili d'ambiente al momento della build
 * (.env.local in locale, variabili del repository in GitHub Actions).
 * Non è un segreto, ma non la scriviamo nel codice per tenere il repo neutro.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function ensure() {
  if (!isFirebaseConfigured) throw new Error('Firebase non è configurato in questa build.');
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    // Cache locale persistente: l'app funziona anche offline. In cache ci sono
    // solo i blob cifrati, mai dati in chiaro.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) })
    });
  }
  return { auth: auth!, db: db! };
}

export function getDb(): Firestore {
  return ensure().db;
}

export function watchUser(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(ensure().auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(ensure().auth, provider);
}

/**
 * Uscita: oltre al logout cancella la cache locale di Firestore, così su un
 * dispositivo condiviso non restano nemmeno i blob cifrati e il sale.
 */
export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const { auth: a, db: d } = ensure();
  await signOut(a);
  await terminate(d);
  await clearIndexedDbPersistence(d).catch(() => undefined);
  app = undefined;
  auth = undefined;
  db = undefined;
}
