/**
 * IndexedDB storage engine for LPG Deduplication Checklist
 * Provides high-capacity (hundreds of MBs / GBs), non-blocking persistent storage
 * for handling 50,000+ customer records and large historical logs without
 * localStorage 5MB quota errors.
 */

import type { DatabaseSchema } from './database';

const DB_NAME = 'LPG_Deduplication_IndexedDB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const RECORD_KEY = 'current_database';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Saves the database to IndexedDB. Non-blocking, handles 50,000+ customers easily.
 */
export async function saveDatabaseToIDB(data: DatabaseSchema): Promise<boolean> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, RECORD_KEY);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('IndexedDB save error:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('saveDatabaseToIDB failed:', err);
    return false;
  }
}

/**
 * Loads the database from IndexedDB.
 */
export async function loadDatabaseFromIDB(): Promise<DatabaseSchema | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);

      req.onsuccess = () => {
        const result = req.result as DatabaseSchema | undefined;
        if (
          result &&
          result.version === 3 &&
          Array.isArray(result.users) &&
          Array.isArray(result.customers) &&
          Array.isArray(result.consumer_entries)
        ) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        console.warn('IndexedDB load error:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('loadDatabaseFromIDB failed:', err);
    return null;
  }
}
