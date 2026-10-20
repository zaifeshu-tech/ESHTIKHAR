import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Cloud,
  CloudUpload,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HardDrive,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Zap,
  Check,
  Clock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  deleteDriveFile,
  downloadDriveFile,
  getGoogleAccessToken,
  getGoogleUser,
  getOrCreateLPGFolder,
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
  listDriveFiles,
  uploadFileToDrive,
  type DriveFileItem,
  LPG_DRIVE_FOLDER_NAME,
  DESIGNATED_DRIVE_EMAIL,
} from '../utils/googleDriveService';
import {
  getAutoSyncState,
  performDriveAutoSync,
  setAutoSyncEnabled,
  subscribeAutoSync,
  clearAutoSyncLogs,
  type AutoSyncState,
} from '../utils/driveAutoSync';
import {
  saveToCloudFirestore,
  loadFromCloudFirestore,
} from '../utils/firestoreService';
import {
  generateCustomerRegisterBlob,
  generateDatabaseBackupBlob,
  generateDuplicateReportBlob,
  generateStandardRecordsBlob,
  buildDuplicateReportExportRows,
  buildStandardExportRows,
} from '../utils/exportFiles';
import {
  buildDailyDuplicationReport,
  formatIST,
  normalizeConsumerNumber,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type DeliveryManRecord,
  type UserRecord,
} from '../utils/deduplication';
import type { DatabaseSchema } from '../store/database';

interface GoogleDriveViewProps {
  db: DatabaseSchema;
  currentUser: UserRecord;
  onBulkImportCustomers: (
    customers: Array<{ consumer_number: string; customer_name: string; mobile?: string; address?: string }>
  ) => { added: number; updated: number };
  onRestoreDatabase?: (newDb: DatabaseSchema) => void;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  db,
  currentUser,
  onBulkImportCustomers,
  onRestoreDatabase,
  deliveryMenMap,
  usersMap,
}) => {
  const [googleUser, setGoogleUser] = useState<any>(getGoogleUser());
  const [token, setToken] = useState<string | null>(getGoogleAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Auto-sync state from driveAutoSync engine
  const [autoSyncState, setAutoSyncState] = useState<AutoSyncState>(() => getAutoSyncState());
  const [manualSyncing, setManualSyncing] = useState(false);

  // File explorer states
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileFilter, setFileFilter] = useState('');

  // Drive spreadsheet picker states (for importing customers from Drive)
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveFileItem[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Upload progress for manual card operations
  const [uploadingAction, setUploadingAction] = useState<string | null>(null);

  // Destructive Delete Confirmation Modal state (Mandatory per Workspace Integration Skill)
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, tok) => {
        setGoogleUser(user);
        setToken(tok);
      },
      () => {
        setGoogleUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to AutoSync engine updates
  useEffect(() => {
    const unsub = subscribeAutoSync(() => {
      setAutoSyncState(getAutoSyncState());
    });
    return () => unsub();
  }, []);

  // When token is available, ensure LPG folder exists, trigger initial sync, and load files
  useEffect(() => {
    if (token) {
      loadDriveData();
      if (autoSyncState.enabled) {
        performDriveAutoSync(db, deliveryMenMap, usersMap).catch(() => {});
      }
    } else {
      setFiles([]);
      setFolderId(null);
    }
  }, [token]);

  const loadDriveData = async () => {
    setLoadingFiles(true);
    setStatusMessage(null);
    try {
      const fId = await getOrCreateLPGFolder();
      setFolderId(fId);
      const fileList = await listDriveFiles({ folderId: fId, pageSize: 50 });
      setFiles(fileList);
    } catch (err: any) {
      console.error('Error loading Drive folder:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to connect to Google Drive folder.',
      });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSignIn = async (hintEmail = DESIGNATED_DRIVE_EMAIL) => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn(hintEmail);
      if (result) {
        setGoogleUser(result.user);
        setToken(result.accessToken);
        setStatusMessage({
          type: 'success',
          text: `Connected to Google Drive as ${result.user.email || result.user.displayName}!`,
        });
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Google Drive sign-in was cancelled or encountered an error.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setToken(null);
      setFiles([]);
      setDriveSpreadsheets([]);
      setStatusMessage({
        type: 'info',
        text: 'Signed out of Google Drive session.',
      });
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleSwitchToDesignated = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setToken(null);
      await handleSignIn(DESIGNATED_DRIVE_EMAIL);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to switch Google account',
      });
    }
  };

  // Trigger Immediate Auto-Sync
  const handleTriggerManualAutoSync = async () => {
    if (!token) return;
    setManualSyncing(true);
    setStatusMessage(null);
    try {
      const res = await performDriveAutoSync(db, deliveryMenMap, usersMap, { force: true });
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Auto-update complete! 4 live files synchronized to Google Drive (${DESIGNATED_DRIVE_EMAIL}).`,
        });
        await loadDriveData();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Auto-sync failed.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Auto-sync failed.',
      });
    } finally {
      setManualSyncing(false);
    }
  };

  const handleToggleAutoSync = () => {
    const nextState = !autoSyncState.enabled;
    setAutoSyncEnabled(nextState);
    if (nextState && token) {
      performDriveAutoSync(db, deliveryMenMap, usersMap).then(() => loadDriveData());
    }
  };

  const [firestoreSyncing, setFirestoreSyncing] = useState(false);

  // Save current agency database state to Cloud Firestore
  const handleSaveToFirestore = async () => {
    setFirestoreSyncing(true);
    setStatusMessage(null);
    try {
      const res = await saveToCloudFirestore(db);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Agency database state successfully saved to Firebase Cloud Firestore!',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to save to Cloud Firestore.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Cloud Firestore sync failed.',
      });
    } finally {
      setFirestoreSyncing(false);
    }
  };

  // Restore agency database from Cloud Firestore
  const handleRestoreFromFirestore = async () => {
    if (!onRestoreDatabase) return;
    setFirestoreSyncing(true);
    setStatusMessage(null);
    try {
      const cloudDb = await loadFromCloudFirestore();
      if (cloudDb) {
        onRestoreDatabase(cloudDb);
        setStatusMessage({
          type: 'success',
          text: `Restored database from Cloud Firestore (${cloudDb.consumer_entries?.length || 0} entries, ${cloudDb.customers?.length || 0} customers)!`,
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'No database document found in Cloud Firestore.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to restore from Cloud Firestore.',
      });
    } finally {
      setFirestoreSyncing(false);
    }
  };

  // Upload full system backup JSON to Google Drive
  const handleBackupDatabaseToDrive = async () => {
    if (!token) return;
    setUploadingAction('backup_db');
    setStatusMessage(null);
    try {
      const fId = folderId || (await getOrCreateLPGFolder());
      setFolderId(fId);
      const { blob, mimeType, fileName } = generateDatabaseBackupBlob(db);
      const uploaded = await uploadFileToDrive({
        fileName,
        mimeType,
        data: blob,
        folderId: fId,
        description: `Full LPG agency system database backup created on ${formatIST().timestampIST}`,
      });
      setStatusMessage({
        type: 'success',
        text: `Database backup "${uploaded.name}" saved to Google Drive successfully!`,
      });
      await loadDriveData();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to upload database backup to Google Drive.',
      });
    } finally {
      setUploadingAction(null);
    }
  };

  // Upload Customer Register Excel to Google Drive
  const handleUploadCustomersToDrive = async () => {
    if (!token) return;
    setUploadingAction('customers_excel');
    setStatusMessage(null);
    try {
      const fId = folderId || (await getOrCreateLPGFolder());
      setFolderId(fId);
      const { blob, mimeType, fileName } = generateCustomerRegisterBlob(
        db.customers,
        db.settings.agencyName
      );
      const uploaded = await uploadFileToDrive({
        fileName,
        mimeType,
        data: blob,
        folderId: fId,
        description: `LPG Customer Register (${db.customers.length} customers) uploaded on ${formatIST().timestampIST}`,
      });
      setStatusMessage({
        type: 'success',
        text: `Customer Register "${uploaded.name}" (${db.customers.length} records) uploaded to Google Drive!`,
      });
      await loadDriveData();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to upload Customer Register to Google Drive.',
      });
    } finally {
      setUploadingAction(null);
    }
  };

  // Upload Today's Entries Excel to Google Drive
  const handleUploadTodayEntriesToDrive = async () => {
    if (!token) return;
    setUploadingAction('today_entries');
    setStatusMessage(null);
    try {
      const todayIST = formatIST().dateIST;
      const todayEntries = db.consumer_entries.filter((e) => e.entry_date_ist === todayIST);
      const rows = buildStandardExportRows(todayEntries, deliveryMenMap, usersMap);
      const fId = folderId || (await getOrCreateLPGFolder());
      setFolderId(fId);
      const { blob, mimeType, fileName } = generateStandardRecordsBlob(
        rows,
        'xlsx',
        `LPG_Today_Entries_${todayIST.replace(/-/g, '_')}`,
        "Today's Consumer Entries",
        db.settings.agencyName
      );
      const uploaded = await uploadFileToDrive({
        fileName,
        mimeType,
        data: blob,
        folderId: fId,
        description: `Today's ${todayEntries.length} entries uploaded to Google Drive on ${formatIST().timestampIST}`,
      });
      setStatusMessage({
        type: 'success',
        text: `Today's Entries file "${uploaded.name}" saved to Google Drive!`,
      });
      await loadDriveData();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || "Failed to upload today's entries to Google Drive.",
      });
    } finally {
      setUploadingAction(null);
    }
  };

  // Upload Today's Daily Duplication Report Excel to Google Drive
  const handleUploadDuplicationReportToDrive = async () => {
    if (!token) return;
    setUploadingAction('duplicate_report');
    setStatusMessage(null);
    try {
      const todayIST = formatIST().dateIST;
      const todayEntries = db.consumer_entries.filter((e) => e.entry_date_ist === todayIST);
      const rep = buildDailyDuplicationReport(todayEntries, deliveryMenMap, usersMap);
      const rows = buildDuplicateReportExportRows(rep.groups);
      const fId = folderId || (await getOrCreateLPGFolder());
      setFolderId(fId);
      const { blob, mimeType, fileName } = generateDuplicateReportBlob(
        rows,
        'xlsx',
        `LPG_Daily_Duplication_${todayIST.replace(/-/g, '_')}`,
        'Daily Duplication Report',
        db.settings.agencyName
      );
      const uploaded = await uploadFileToDrive({
        fileName,
        mimeType,
        data: blob,
        folderId: fId,
        description: `Daily Duplication Report for ${todayIST} uploaded to Google Drive on ${formatIST().timestampIST}`,
      });
      setStatusMessage({
        type: 'success',
        text: `Daily Duplication Report "${uploaded.name}" (${rep.groups.length} duplicate groups) uploaded to Google Drive!`,
      });
      await loadDriveData();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to upload Daily Duplication Report to Google Drive.',
      });
    } finally {
      setUploadingAction(null);
    }
  };

  // Load all user spreadsheets from Drive for customer bulk import
  const handleSearchDriveSpreadsheets = async () => {
    if (!token) return;
    setLoadingSpreadsheets(true);
    setStatusMessage(null);
    try {
      const results = await listDriveFiles({ onlySpreadsheets: true, pageSize: 30 });
      setDriveSpreadsheets(results);
      if (results.length === 0) {
        setStatusMessage({
          type: 'info',
          text: 'No Excel or CSV spreadsheets found in your Google Drive.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to search spreadsheets in Google Drive.',
      });
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  // Import customers directly from a Google Drive spreadsheet
  const handleImportFromDriveFile = async (driveFile: DriveFileItem) => {
    if (!token) return;
    setImportingFileId(driveFile.id);
    setStatusMessage(null);
    try {
      const buffer = await downloadDriveFile(driveFile.id);
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('The selected spreadsheet contains no data rows.');
      }

      // Column name matchers
      const findKey = (row: any, candidates: string[]): string | null => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
          const match = keys.find(
            (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cand.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (match) return match;
        }
        return null;
      };

      const firstRow = rawRows[0];
      const consumerCol = findKey(firstRow, [
        'consumer_number',
        'consumer number',
        'consumer no',
        'consumer',
        'consumerno',
        'customer id',
        'customer no',
        'c_no',
        'cons_no',
      ]);
      const nameCol = findKey(firstRow, [
        'customer_name',
        'customer name',
        'name',
        'consumer name',
        'party name',
        'holder',
      ]);
      const mobileCol = findKey(firstRow, ['mobile', 'mobile number', 'phone', 'contact', 'cell', 'mobile_no']);
      const addressCol = findKey(firstRow, ['address', 'address / area', 'area', 'location', 'city', 'colony']);

      if (!consumerCol) {
        throw new Error(
          'Could not identify a "Consumer Number" column in this spreadsheet. Please ensure there is a column named Consumer Number or Consumer No.'
        );
      }

      const importedCustomers: Array<{
        consumer_number: string;
        customer_name: string;
        mobile?: string;
        address?: string;
      }> = [];

      for (const row of rawRows) {
        const rawNum = String(row[consumerCol] || '').trim();
        if (!rawNum) continue;
        const normalizedNum = normalizeConsumerNumber(rawNum);
        if (!normalizedNum) continue;

        const customerName = nameCol ? String(row[nameCol] || '').trim() : '';
        const mobile = mobileCol ? String(row[mobileCol] || '').trim() : '';
        const address = addressCol ? String(row[addressCol] || '').trim() : '';

        importedCustomers.push({
          consumer_number: normalizedNum,
          customer_name: customerName || 'Registered Customer',
          mobile,
          address,
        });
      }

      if (importedCustomers.length === 0) {
        throw new Error('No valid consumer numbers were parsed from this spreadsheet.');
      }

      const stats = onBulkImportCustomers(importedCustomers);
      setStatusMessage({
        type: 'success',
        text: `Successfully imported from "${driveFile.name}": Added ${stats.added} new customer(s), updated ${stats.updated} existing customer(s)!`,
      });
      setDriveSpreadsheets([]);
    } catch (err: any) {
      console.error('Import from Drive failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to import customer records from Google Drive file.',
      });
    } finally {
      setImportingFileId(null);
    }
  };

  // Confirm and perform file deletion from Google Drive
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setStatusMessage({
        type: 'success',
        text: `File "${fileToDelete.name}" was permanently removed from Google Drive.`,
      });
      setFileToDelete(null);
      await loadDriveData();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to delete file from Google Drive.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(fileFilter.toLowerCase())
  );

  const isConnectedToDesignated =
    Boolean(googleUser?.email && googleUser.email.toLowerCase() === DESIGNATED_DRIVE_EMAIL.toLowerCase());

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <Cloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Google Drive Cloud Integration
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                  Auto-Update Enabled
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Target Cloud Account: <strong className="font-mono text-slate-900 font-semibold">{DESIGNATED_DRIVE_EMAIL}</strong>
              </p>
            </div>
          </div>

          {token && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadDriveData}
                disabled={loadingFiles}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                Refresh Drive
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Status banner */}
        {statusMessage && (
          <div
            className={`mt-4 p-4 rounded-xl text-sm font-medium flex items-start gap-3 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Cloud className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">{statusMessage.text}</div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Designated Cloud Drive Account Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
                Target Cloud Drive
              </span>
              <span className="text-xs text-blue-200">Agency Primary Backup Storage</span>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight font-mono text-white flex items-center gap-2">
              {DESIGNATED_DRIVE_EMAIL}
              {isConnectedToDesignated && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-sans font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Active & Verified
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              All daily checklist entries, full database snapshots, and consumer registers are automatically synchronized directly into this Google Drive account in real time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {!token ? (
              <button
                type="button"
                onClick={() => handleSignIn(DESIGNATED_DRIVE_EMAIL)}
                disabled={isSigningIn}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {/* Official Google 4-color SVG Icon */}
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-4 h-4 shrink-0 block"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting...' : 'Connect zaifeshu@gmail.com Drive'}</span>
              </button>
            ) : !isConnectedToDesignated ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSwitchToDesignated}
                  disabled={isSigningIn}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Switch to zaifeshu@gmail.com
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerManualAutoSync}
                  disabled={manualSyncing || autoSyncState.status === 'syncing'}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      manualSyncing || autoSyncState.status === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  {manualSyncing || autoSyncState.status === 'syncing' ? 'Syncing...' : 'Sync Now to Drive'}
                </button>
              </div>
            )}
          </div>
        </div>

        {token && !isConnectedToDesignated && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              You are currently signed in as <strong>{googleUser?.email}</strong>. For full automated synchronization with the agency's primary account, please click "Switch to zaifeshu@gmail.com".
            </span>
          </div>
        )}
      </div>

      {/* Auth Card if NOT logged in */}
      {!token ? (
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-white rounded-2xl border-2 border-blue-200 p-6 sm:p-10 text-center shadow-sm">
          <div className="max-w-xl mx-auto space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-blue-100 flex items-center justify-center mx-auto text-blue-600">
              <Cloud className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Connect Cloud Drive of zaifeshu@gmail.com
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Connect your Google Drive account once. After connection, all consumer entry records, customer registers, and daily duplication logs will automatically update in real-time to Google Drive.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => handleSignIn(DESIGNATED_DRIVE_EMAIL)}
                disabled={isSigningIn}
                className="min-h-[50px] inline-flex items-center gap-3.5 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm text-slate-700 font-semibold text-base transition-all hover:shadow hover:border-slate-400 active:scale-[0.98] cursor-pointer"
              >
                {/* Official Google 4-color SVG Icon */}
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-5 h-5 shrink-0 block"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with zaifeshu@gmail.com'}</span>
              </button>
            </div>

            <div className="pt-2 text-xs text-slate-500">
              Authenticated via official Google OAuth. Only your dedicated folder "{LPG_DRIVE_FOLDER_NAME}" is accessed.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Automatic Live Sync Control Center */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-5 border-b border-slate-200">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    autoSyncState.status === 'syncing' || manualSyncing
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : autoSyncState.enabled
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <Zap
                    className={`w-6 h-6 ${
                      autoSyncState.status === 'syncing' || manualSyncing ? 'animate-bounce' : ''
                    }`}
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Live Automatic Drive Synchronization
                    </h2>
                    {autoSyncState.status === 'syncing' || manualSyncing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Syncing in Progress...
                      </span>
                    ) : autoSyncState.enabled ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active & Auto-Updating
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Continuously syncs 4 live files whenever entries, customers, or delivery records are created or updated.
                  </p>
                </div>
              </div>

              {/* Master Auto-Sync Switch and Sync Now Button */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    autoSyncState.enabled
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      autoSyncState.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <span>Auto-Sync: {autoSyncState.enabled ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerManualAutoSync}
                  disabled={manualSyncing || autoSyncState.status === 'syncing'}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      manualSyncing || autoSyncState.status === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Sync Now</span>
                </button>
              </div>
            </div>

            {/* Live Auto-Updated Files Grid */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-bold text-blue-700 uppercase">Live Database</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 truncate">
                  LPG_Database_Backup_Latest.json
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Full schema, {db.consumer_entries.length} entries, {db.customers.length} consumers
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
                <div className="flex items-center justify-between">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">Today's Log</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 truncate">
                  LPG_Live_Today_Entries.xlsx
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Today's live checklist with IST timestamps
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
                <div className="flex items-center justify-between">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Master Register</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 truncate">
                  LPG_Live_Customer_Master.xlsx
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Complete directory of {db.customers.length} consumer accounts
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Duplicate Audit</span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 truncate">
                  LPG_Live_Daily_Duplication.xlsx
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Live daily multi-entry duplicate analysis
                </div>
              </div>
            </div>

            {/* Last Sync Info Bar */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Last synchronized:{' '}
                  <strong className="text-slate-900 font-mono">
                    {autoSyncState.lastSyncTimestamp || 'Just now / Pending changes'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Target Folder:</span>
                <span className="font-mono font-bold text-slate-800">{LPG_DRIVE_FOLDER_NAME}</span>
                {folderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${folderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 ml-1"
                  >
                    Open Drive Folder <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Cloud Firestore Database & Auth Synchronization Card */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-white rounded-2xl border border-amber-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                  🔥
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">
                      Firebase Cloud Firestore Persistence & Auth
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Real-time Cloud DB
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Synchronize agency customers, delivery logs, and users directly with Firebase Firestore.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveToFirestore}
                  disabled={firestoreSyncing}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${firestoreSyncing ? 'animate-spin' : ''}`} />
                  <span>Save to Firestore</span>
                </button>

                {onRestoreDatabase && (
                  <button
                    type="button"
                    onClick={handleRestoreFromFirestore}
                    disabled={firestoreSyncing}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Restore from Firestore</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Manual Cloud Backups & Export Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Upload Full DB Backup Snapshot */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Snapshot Database</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Generate and save a timestamped database snapshot JSON into Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBackupDatabaseToDrive}
                disabled={uploadingAction !== null}
                className="mt-4 w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {uploadingAction === 'backup_db' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" /> Save Timestamped Snapshot
                  </>
                )}
              </button>
            </div>

            {/* 2. Customer Register Excel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Customer Register</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Save all {db.customers.length} customer records (BH-0, CX, DX) to Excel in Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUploadCustomersToDrive}
                disabled={uploadingAction !== null}
                className="mt-4 w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {uploadingAction === 'customers_excel' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" /> Upload Customers (.xlsx)
                  </>
                )}
              </button>
            </div>

            {/* 3. Today's Entries Excel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Today's Entries</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Save today's checklist log with Consumer Numbers and Delivery Men to Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUploadTodayEntriesToDrive}
                disabled={uploadingAction !== null}
                className="mt-4 w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {uploadingAction === 'today_entries' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" /> Upload Today's Log (.xlsx)
                  </>
                )}
              </button>
            </div>

            {/* 4. Daily Duplication Report */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-amber-300 transition">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Duplication Report</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Export and store today's multi-entry duplicate consumers report into Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUploadDuplicationReportToDrive}
                disabled={uploadingAction !== null}
                className="mt-4 w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {uploadingAction === 'duplicate_report' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" /> Upload Duplicates (.xlsx)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Auto-Sync Activity Log Section */}
          {autoSyncState.logs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Auto-Update Live Activity History ({autoSyncState.logs.length} events)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={clearAutoSyncLogs}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Clear History
                </button>
              </div>

              <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {autoSyncState.logs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          log.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 truncate">{log.summary}</span>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px] shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Customers Directly from Google Drive Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Import Customer Register from Google Drive
                  </h2>
                  <p className="text-xs text-slate-600">
                    Select any Excel (.xlsx, .xls) or CSV sheet in your Google Drive to load bulk customers into the app
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSearchDriveSpreadsheets}
                disabled={loadingSpreadsheets}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Search className={`w-4 h-4 ${loadingSpreadsheets ? 'animate-spin' : ''}`} />
                {loadingSpreadsheets ? 'Searching Drive...' : 'Search Spreadsheets on Drive'}
              </button>
            </div>

            {/* List of spreadsheets found on Drive */}
            {driveSpreadsheets.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Select a spreadsheet from your Drive:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                  {driveSpreadsheets.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-emerald-300 flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImportFromDriveFile(file)}
                        disabled={importingFileId !== null}
                        className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {importingFileId === file.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importing...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" /> Import
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drive File Manager Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  LPG Agency Files on Google Drive
                </h2>
                <p className="text-xs text-slate-600">
                  Stored inside folder <span className="font-mono font-semibold">"{LPG_DRIVE_FOLDER_NAME}"</span> ({files.length} items)
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {loadingFiles ? (
              <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                Loading files from Google Drive...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No files found in Google Drive folder. Use the quick buttons or click "Sync Now" to auto-sync records.
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Last Modified</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFiles.map((file) => {
                      const isExcel =
                        file.name.endsWith('.xlsx') ||
                        file.name.endsWith('.xls') ||
                        file.mimeType.includes('spreadsheet');
                      const isPdf = file.name.endsWith('.pdf');
                      const isJson = file.name.endsWith('.json');
                      const isLiveAutoSync =
                        file.name.startsWith('LPG_Live_') || file.name.includes('Backup_Latest');
                      const fileSizeKb = file.size
                        ? `${(parseInt(file.size, 10) / 1024).toFixed(1)} KB`
                        : '—';

                      return (
                        <tr key={file.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              {isExcel ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : isPdf ? (
                                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : isJson ? (
                                <Database className="w-4 h-4 text-blue-600 shrink-0" />
                              ) : (
                                <HardDrive className="w-4 h-4 text-slate-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                                  {file.name}
                                </div>
                                {isLiveAutoSync && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                    <Zap className="w-2.5 h-2.5" /> Auto-Updated Live File
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {isJson ? 'JSON Database' : isExcel ? 'Excel Sheet' : isPdf ? 'PDF' : 'File'}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">{fileSizeKb}</td>
                          <td className="py-3 px-3 text-slate-600">
                            {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {currentUser.role === 'ADMIN' && (
                                <button
                                  type="button"
                                  onClick={() => setFileToDelete(file)}
                                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                                  title="Delete from Google Drive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Mandatory User Confirmation Dialog for Destructive Delete (Workspace Integration Guideline) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Confirm Delete from Google Drive
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold font-mono text-slate-900">
                "{fileToDelete.name}"
              </span>{' '}
              from your Google Drive? This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Yes, Delete File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
