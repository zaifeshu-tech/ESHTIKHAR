import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider with Google Drive Scopes
const provider = new GoogleAuthProvider();
export const DESIGNATED_DRIVE_EMAIL = 'zaifeshu@gmail.com';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.readonly',
];

DRIVE_SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
  login_hint: DESIGNATED_DRIVE_EMAIL,
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache access token in memory ONLY (never localStorage / sessionStorage)
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

/**
 * Initialize auth state listener. Call on app load.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Trigger Google Sign In Popup with Drive Scopes.
 * Defaults to DESIGNATED_DRIVE_EMAIL (zaifeshu@gmail.com).
 */
export const googleSignIn = async (
  hintEmail: string = DESIGNATED_DRIVE_EMAIL
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    if (hintEmail) {
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: hintEmail,
      });
    } else {
      provider.setCustomParameters({
        prompt: 'select_account',
      });
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google access token from credentials.');
    }
    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Get current cached user
 */
export const getGoogleUser = (): User | null => {
  return cachedUser;
};

/**
 * Sign out from Google Drive session
 */
export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
};

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

export const LPG_DRIVE_FOLDER_NAME = 'LPG Consumer Deduplication System';

/**
 * Helper to ensure user is authenticated with token
 */
function requireToken(): string {
  if (!cachedAccessToken) {
    throw new Error('Please sign in with Google to access Google Drive.');
  }
  return cachedAccessToken;
}

/**
 * Find or create the dedicated LPG Agency folder in Google Drive
 */
export async function getOrCreateLPGFolder(): Promise<string> {
  const token = requireToken();

  // Search if folder already exists
  const query = encodeURIComponent(
    `name = '${LPG_DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(`${DRIVE_API_URL}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const errData = await searchRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to search Google Drive folders');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: LPG_DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'LPG Consumer Deduplication Checklist Backups and Customer Data',
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to create LPG folder on Google Drive');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * List files from Google Drive (optionally inside the LPG folder or all sheets/excels)
 */
export async function listDriveFiles(options?: {
  folderId?: string;
  onlySpreadsheets?: boolean;
  pageSize?: number;
}): Promise<DriveFileItem[]> {
  const token = requireToken();
  const conditions: string[] = ['trashed = false'];

  if (options?.folderId) {
    conditions.push(`'${options.folderId}' in parents`);
  }

  if (options?.onlySpreadsheets) {
    conditions.push(
      `(mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'text/csv' or mimeType = 'application/vnd.google-apps.spreadsheet')`
    );
  }

  const query = encodeURIComponent(conditions.join(' and '));
  const pageSize = options?.pageSize || 40;
  const url = `${DRIVE_API_URL}/files?q=${query}&pageSize=${pageSize}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to list files from Google Drive');
  }

  const data = await res.json();
  return (data.files || []) as DriveFileItem[];
}

/**
 * Upload a binary / text file to Google Drive using multipart upload
 */
export async function uploadFileToDrive(params: {
  fileName: string;
  mimeType: string;
  data: Blob | Uint8Array | string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> {
  const token = requireToken();

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: params.mimeType,
    description: params.description || 'Uploaded from LPG Deduplication App',
  };

  if (params.folderId) {
    metadata.parents = [params.folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let fileBlob: Blob;
  if (params.data instanceof Blob) {
    fileBlob = params.data;
  } else if (typeof params.data === 'string') {
    fileBlob = new Blob([params.data], { type: params.mimeType });
  } else {
    fileBlob = new Blob([params.data as unknown as BlobPart], { type: params.mimeType });
  }

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const fileHeader = `${delimiter}Content-Type: ${params.mimeType}\r\n\r\n`;

  const bodyBlob = new Blob([metadataPart, fileHeader, fileBlob, closeDelimiter]);

  const res = await fetch(
    `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime,modifiedTime`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to upload file to Google Drive');
  }

  return (await res.json()) as DriveFileItem;
}

/**
 * Download a file from Google Drive as an ArrayBuffer
 */
export async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const token = requireToken();
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to download file from Google Drive');
  }

  return await res.arrayBuffer();
}

/**
 * Delete a file on Google Drive (must be preceded by user confirmation dialog)
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = requireToken();
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to delete file from Google Drive');
  }
}

/**
 * Find existing file by exact name inside a specific Drive folder
 */
export async function findFileByNameInFolder(
  fileName: string,
  folderId: string
): Promise<DriveFileItem | null> {
  const token = requireToken();
  const escapedName = fileName.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${escapedName}' and '${folderId}' in parents and trashed = false`
  );
  const url = `${DRIVE_API_URL}/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveFileItem;
  }
  return null;
}

/**
 * Automatically uploads or updates an existing file with the same name on Google Drive.
 * If file already exists in the target folder, issues a multipart PATCH to update contents in-place,
 * preventing duplicate files from cluttering Google Drive.
 */
export async function uploadOrUpdateFileInDrive(params: {
  fileName: string;
  mimeType: string;
  data: Blob | Uint8Array | string;
  folderId?: string;
  description?: string;
}): Promise<{ file: DriveFileItem; isUpdate: boolean }> {
  const token = requireToken();
  const targetFolderId = params.folderId || (await getOrCreateLPGFolder());

  // Check if file already exists in folder
  const existing = await findFileByNameInFolder(params.fileName, targetFolderId);

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let fileBlob: Blob;
  if (params.data instanceof Blob) {
    fileBlob = params.data;
  } else if (typeof params.data === 'string') {
    fileBlob = new Blob([params.data], { type: params.mimeType });
  } else {
    fileBlob = new Blob([params.data as unknown as BlobPart], { type: params.mimeType });
  }

  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: params.mimeType,
    description: params.description || 'Auto-updated from LPG Deduplication System',
  };

  // Only assign parent folder on initial creation
  if (!existing) {
    metadata.parents = [targetFolderId];
  }

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const fileHeader = `${delimiter}Content-Type: ${params.mimeType}\r\n\r\n`;
  const bodyBlob = new Blob([metadataPart, fileHeader, fileBlob, closeDelimiter]);

  const endpoint = existing
    ? `${DRIVE_UPLOAD_URL}/files/${existing.id}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime,modifiedTime`
    : `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime,modifiedTime`;

  const method = existing ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: bodyBlob,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.error?.message ||
        `Failed to ${existing ? 'update' : 'upload'} "${params.fileName}" on Google Drive`
    );
  }

  const resultItem = (await res.json()) as DriveFileItem;
  return { file: resultItem, isUpdate: !!existing };
}

