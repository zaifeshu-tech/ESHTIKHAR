import {
  getGoogleAccessToken,
  getGoogleUser,
  getOrCreateLPGFolder,
  uploadOrUpdateFileInDrive,
  DESIGNATED_DRIVE_EMAIL,
} from './googleDriveService';
import {
  generateCustomerRegisterBlob,
  generateDatabaseBackupBlob,
  generateDuplicateReportBlob,
  generateStandardRecordsBlob,
  buildDuplicateReportExportRows,
  buildStandardExportRows,
} from './exportFiles';
import {
  buildDailyDuplicationReport,
  formatIST,
} from './deduplication';
import type { DatabaseSchema } from '../store/database';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'error';
  summary: string;
  details?: string;
  fileCount: number;
}

export interface AutoSyncState {
  enabled: boolean;
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncTimestamp: string | null;
  lastSyncDetails: string | null;
  lastError: string | null;
  logs: SyncLogEntry[];
  designatedEmail: string;
  isDesignatedUserConnected: boolean;
}

const AUTOSYNC_ENABLED_KEY = 'lpg_drive_autosync_enabled';
const AUTOSYNC_LOG_KEY = 'lpg_drive_autosync_logs_v1';
const MAX_LOGS = 30;

let autoSyncEnabled = (() => {
  try {
    const val = localStorage.getItem(AUTOSYNC_ENABLED_KEY);
    return val !== null ? val === 'true' : true; // Default to TRUE
  } catch {
    return true;
  }
})();

let syncStatus: 'idle' | 'syncing' | 'synced' | 'error' = 'idle';
let lastSyncTimestamp: string | null = null;
let lastSyncDetails: string | null = null;
let lastError: string | null = null;

let syncLogs: SyncLogEntry[] = (() => {
  try {
    const raw = localStorage.getItem(AUTOSYNC_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
})();

const listeners = new Set<() => void>();

function notifySubscribers() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('AutoSync listener error:', e);
    }
  });
}

function persistLogs() {
  try {
    localStorage.setItem(AUTOSYNC_LOG_KEY, JSON.stringify(syncLogs.slice(0, MAX_LOGS)));
  } catch {
    // ignore
  }
}

export function subscribeAutoSync(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getAutoSyncState(): AutoSyncState {
  const user = getGoogleUser();
  const token = getGoogleAccessToken();
  const isDesignatedUser =
    Boolean(user?.email && user.email.toLowerCase() === DESIGNATED_DRIVE_EMAIL.toLowerCase());

  return {
    enabled: autoSyncEnabled,
    status: token ? syncStatus : 'idle',
    lastSyncTimestamp,
    lastSyncDetails,
    lastError,
    logs: syncLogs,
    designatedEmail: DESIGNATED_DRIVE_EMAIL,
    isDesignatedUserConnected: isDesignatedUser,
  };
}

export function setAutoSyncEnabled(enabled: boolean): void {
  autoSyncEnabled = enabled;
  try {
    localStorage.setItem(AUTOSYNC_ENABLED_KEY, String(enabled));
  } catch {
    // ignore
  }
  notifySubscribers();
}

export function clearAutoSyncLogs(): void {
  syncLogs = [];
  try {
    localStorage.removeItem(AUTOSYNC_LOG_KEY);
  } catch {
    // ignore
  }
  notifySubscribers();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Triggers a debounced auto-sync to Google Drive.
 * Delays execution to batch rapid user inputs (e.g. fast consecutive entries).
 */
export function triggerDebouncedDriveSync(
  db: DatabaseSchema,
  deliveryMenMap?: Record<string, string>,
  usersMap?: Record<string, string>,
  delayMs = 2500
): void {
  if (!autoSyncEnabled) return;
  const token = getGoogleAccessToken();
  if (!token) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  syncStatus = 'idle';
  notifySubscribers();

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    performDriveAutoSync(db, deliveryMenMap, usersMap).catch((err) => {
      console.warn('Background auto-sync failed:', err);
    });
  }, delayMs);
}

/**
 * Executes a full automatic sync of live LPG agency records to Google Drive.
 * Files synced in-place inside dedicated LPG Drive folder:
 * 1. LPG_Database_Backup_Latest.json (full database schema & state)
 * 2. LPG_Live_Today_Entries.xlsx (live delivery entries for today)
 * 3. LPG_Live_Customer_Master.xlsx (full customer register)
 * 4. LPG_Live_Daily_Duplication.xlsx (daily duplication report)
 */
export async function performDriveAutoSync(
  db: DatabaseSchema,
  deliveryMenMap?: Record<string, string>,
  usersMap?: Record<string, string>,
  options?: { force?: boolean }
): Promise<{ success: boolean; filesUpdated: string[]; error?: string }> {
  const token = getGoogleAccessToken();
  if (!token) {
    return { success: false, filesUpdated: [], error: 'Not authenticated with Google Drive' };
  }

  if (!autoSyncEnabled && !options?.force) {
    return { success: false, filesUpdated: [], error: 'Auto-sync is disabled' };
  }

  syncStatus = 'syncing';
  lastError = null;
  notifySubscribers();

  const ist = formatIST();
  const dmMap =
    deliveryMenMap ||
    db.delivery_men.reduce((acc, dm) => {
      acc[dm.id] = dm.name;
      return acc;
    }, {} as Record<string, string>);

  const uMap =
    usersMap ||
    db.users.reduce((acc, u) => {
      acc[u.id] = u.name;
      return acc;
    }, {} as Record<string, string>);

  const filesUpdated: string[] = [];

  try {
    const folderId = await getOrCreateLPGFolder();

    // 1. Live Database JSON Backup
    const backup = generateDatabaseBackupBlob(db);
    const dbFile = await uploadOrUpdateFileInDrive({
      fileName: 'LPG_Database_Backup_Latest.json',
      mimeType: backup.mimeType,
      data: backup.blob,
      folderId,
      description: `Live full agency database auto-synced on ${ist.timestampIST} to ${DESIGNATED_DRIVE_EMAIL}`,
    });
    filesUpdated.push(`LPG_Database_Backup_Latest.json (${dbFile.isUpdate ? 'updated' : 'created'})`);

    // 2. Today's Consumer Entries Spreadsheet
    const todayEntries = db.consumer_entries.filter((e) => e.entry_date_ist === ist.dateIST);
    const todayRows = buildStandardExportRows(todayEntries, dmMap, uMap);
    const todayBlob = generateStandardRecordsBlob(
      todayRows,
      'xlsx',
      'LPG_Live_Today_Entries',
      "Today's Consumer Entries (Live)",
      db.settings.agencyName
    );
    const entriesFile = await uploadOrUpdateFileInDrive({
      fileName: 'LPG_Live_Today_Entries.xlsx',
      mimeType: todayBlob.mimeType,
      data: todayBlob.blob,
      folderId,
      description: `Today's (${ist.dateIST}) live delivery log (${todayEntries.length} entries) auto-synced on ${ist.timestampIST}`,
    });
    filesUpdated.push(`LPG_Live_Today_Entries.xlsx (${entriesFile.isUpdate ? 'updated' : 'created'})`);

    // 3. Customer Master Register Spreadsheet
    const custBlob = generateCustomerRegisterBlob(db.customers, db.settings.agencyName);
    const custFile = await uploadOrUpdateFileInDrive({
      fileName: 'LPG_Live_Customer_Master.xlsx',
      mimeType: custBlob.mimeType,
      data: custBlob.blob,
      folderId,
      description: `Master Customer Register (${db.customers.length} consumers) auto-synced on ${ist.timestampIST}`,
    });
    filesUpdated.push(`LPG_Live_Customer_Master.xlsx (${custFile.isUpdate ? 'updated' : 'created'})`);

    // 4. Daily Duplication Report
    const dupReport = buildDailyDuplicationReport(todayEntries, dmMap, uMap);
    const dupRows = buildDuplicateReportExportRows(dupReport.groups);
    const dupBlob = generateDuplicateReportBlob(
      dupRows,
      'xlsx',
      'LPG_Live_Daily_Duplication',
      'Daily Duplication Analysis (Live)',
      db.settings.agencyName
    );
    const dupFile = await uploadOrUpdateFileInDrive({
      fileName: 'LPG_Live_Daily_Duplication.xlsx',
      mimeType: dupBlob.mimeType,
      data: dupBlob.blob,
      folderId,
      description: `Daily duplication report (${dupReport.groups.length} duplicate groups) auto-synced on ${ist.timestampIST}`,
    });
    filesUpdated.push(`LPG_Live_Daily_Duplication.xlsx (${dupFile.isUpdate ? 'updated' : 'created'})`);

    // Success State
    syncStatus = 'synced';
    lastSyncTimestamp = ist.timestampIST;
    lastSyncDetails = `${filesUpdated.length} files updated: Database, Today's Log (${todayEntries.length} entries), Customer Master (${db.customers.length} records), Duplication Report`;
    lastError = null;

    const logEntry: SyncLogEntry = {
      id: `sync_${Date.now()}`,
      timestamp: ist.timestampIST,
      status: 'success',
      summary: `Auto-updated 4 files to Google Drive (${DESIGNATED_DRIVE_EMAIL})`,
      details: filesUpdated.join(', '),
      fileCount: filesUpdated.length,
    };
    syncLogs = [logEntry, ...syncLogs].slice(0, MAX_LOGS);
    persistLogs();

    notifySubscribers();
    return { success: true, filesUpdated };
  } catch (err: any) {
    console.error('Google Drive AutoSync failed:', err);
    syncStatus = 'error';
    lastError = err.message || 'Auto-sync to Google Drive failed';

    const logEntry: SyncLogEntry = {
      id: `sync_${Date.now()}`,
      timestamp: ist.timestampIST,
      status: 'error',
      summary: `Auto-sync failed: ${err.message || 'Unknown network error'}`,
      details: err.message,
      fileCount: 0,
    };
    syncLogs = [logEntry, ...syncLogs].slice(0, MAX_LOGS);
    persistLogs();

    notifySubscribers();
    return { success: false, filesUpdated, error: err.message };
  }
}
