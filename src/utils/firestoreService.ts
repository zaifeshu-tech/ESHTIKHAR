import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { DatabaseSchema } from '../store/database';
import { formatIST } from './deduplication';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

const FIRESTORE_BACKUP_DOC = 'agency_live_state';

export interface FirestoreSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

/**
 * Save current database snapshot to Cloud Firestore
 */
export async function saveToCloudFirestore(db: DatabaseSchema): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(firestore, 'agency_databases', FIRESTORE_BACKUP_DOC);
    await setDoc(docRef, {
      ...db,
      updated_at_ist: formatIST().timestampIST,
      client_timestamp: Date.now(),
    });
    return { success: true };
  } catch (err: any) {
    console.error('Firestore save error:', err);
    return { success: false, error: err.message || 'Firestore write failed' };
  }
}

/**
 * Load latest database state from Cloud Firestore
 */
export async function loadFromCloudFirestore(): Promise<DatabaseSchema | null> {
  try {
    const docRef = doc(firestore, 'agency_databases', FIRESTORE_BACKUP_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DatabaseSchema;
    }
    return null;
  } catch (err: any) {
    console.error('Firestore load error:', err);
    return null;
  }
}

/**
 * Sign in using Firebase Google Auth
 */
export async function signInWithFirebaseAuth(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: 'zaifeshu@gmail.com',
  });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Sign out of Firebase Auth
 */
export async function signOutFirebaseAuth(): Promise<void> {
  await signOut(auth);
}
