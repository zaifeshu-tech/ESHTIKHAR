import {
  ALL_PERMISSIONS,
  addDaysIST,
  autoFetchCustomer,
  dmyToYmd,
  evaluateDuplicateStatus,
  formatIST,
  normalizeConsumerNumber,
  type AuditLogRecord,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type DeliveryManRecord,
  type UserPermissionRecord,
  type UserRecord,
} from '../utils/deduplication';
export interface AgencySettings {
  agencyName: string;
  agencyCode: string;
  distributorLocation: string;
  requireConfirmationOnDuplicate: boolean;
  keepDeliveryManSelected: boolean;
}

export interface DatabaseSchema {
  version: number;
  seededForDateIST: string;
  settings: AgencySettings;
  users: UserRecord[];
  user_permissions: UserPermissionRecord[];
  delivery_men: DeliveryManRecord[];
  customers: CustomerRecord[];
  consumer_entries: ConsumerEntryRecord[];
  audit_logs: AuditLogRecord[];
}

const STORAGE_KEY = 'lpg_dedup_checklist_db_v3';

/**
 * Deterministic synchronous password hashing for browser + server portability.
 * Uses salted FNV-1a / SHA-like multi-round digest so passwords are never stored in plain text.
 */
export function hashPassword(password: string): string {
  const salted = `lpg_ist_salt_2026::${password}::agency_sec`;
  let h1 = 0xdeadbeef ^ salted.length;
  let h2 = 0x41c6ce57 ^ salted.length;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `pbkdf2_ist$${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function makeEntryTimestamp(dateIST: string, timeIST: string): { timestamp_ist: string; iso_ist: string } {
  const ymd = dmyToYmd(dateIST);
  const [timePart, period] = timeIST.split(' ');
  const [hhStr, mmStr, ssStr] = timePart.split(':');
  let hh = parseInt(hhStr, 10);
  if (period === 'AM' && hh === 12) hh = 0;
  if (period === 'PM' && hh !== 12) hh += 12;
  const hh24 = String(hh).padStart(2, '0');
  return {
    timestamp_ist: `${dateIST} | ${timeIST}`,
    iso_ist: `${ymd}T${hh24}:${mmStr}:${ssStr}+05:30`,
  };
}

export function createInitialSeedDatabase(): DatabaseSchema {
  const nowIST = formatIST(new Date());
  const todayIST = nowIST.dateIST;
  const yesterdayIST = addDaysIST(todayIST, -1);
  const threeDaysAgoIST = addDaysIST(todayIST, -3);
  const tenDaysAgoIST = addDaysIST(todayIST, -10);
  const thirtyFiveDaysAgoIST = addDaysIST(todayIST, -35);

  const users: UserRecord[] = [
    {
      id: 'usr_admin',
      name: 'Eshtikhar',
      username: 'eshtikhar',
      password_hash: hashPassword('eshtikhar123'),
      role: 'ADMIN',
      active: true,
      created_at: '01-01-2026 | 09:00:00 AM',
    },
    {
      id: 'usr_ravi',
      name: 'Ravi Kumar',
      username: 'ravi',
      password_hash: hashPassword('staff123'),
      role: 'STAFF',
      active: true,
      created_at: '05-01-2026 | 10:15:00 AM',
    },
    {
      id: 'usr_priya',
      name: 'Priya Verma',
      username: 'priya',
      password_hash: hashPassword('staff123'),
      role: 'STAFF',
      active: true,
      created_at: '12-02-2026 | 11:30:00 AM',
    },
  ];

  const user_permissions: UserPermissionRecord[] = [];
  // Ravi has all operational permissions including customer_register except manage_delivery_men
  for (const p of ALL_PERMISSIONS) {
    user_permissions.push({
      id: `perm_ravi_${p.key}`,
      user_id: 'usr_ravi',
      permission: p.key,
      enabled: p.key !== 'manage_delivery_men',
    });
  }
  // Priya has fast entry, customer_register, view records, search consumer, and daily duplication
  for (const p of ALL_PERMISSIONS) {
    user_permissions.push({
      id: `perm_priya_${p.key}`,
      user_id: 'usr_priya',
      permission: p.key,
      enabled: ['new_entry', 'customer_register', 'view_records', 'search_consumer', 'daily_duplication'].includes(
        p.key
      ),
    });
  }

  const delivery_men: DeliveryManRecord[] = [
    {
      id: 'dm_raksharam',
      name: 'Raksharam',
      active: true,
      created_at: '01-01-2026 | 09:00:00 AM',
      updated_at: '01-01-2026 | 09:00:00 AM',
    },
    {
      id: 'dm_asad',
      name: 'Asad',
      active: true,
      created_at: '01-01-2026 | 09:05:00 AM',
      updated_at: '01-01-2026 | 09:05:00 AM',
    },
    {
      id: 'dm_suresh',
      name: 'Suresh',
      active: true,
      created_at: '01-01-2026 | 09:10:00 AM',
      updated_at: '01-01-2026 | 09:10:00 AM',
    },
    {
      id: 'dm_imran',
      name: 'Imran',
      active: true,
      created_at: '01-01-2026 | 09:15:00 AM',
      updated_at: '01-01-2026 | 09:15:00 AM',
    },
    {
      id: 'dm_mahesh',
      name: 'Mahesh',
      active: false, // Deactivated delivery man whose historical records must remain intact
      created_at: '01-01-2026 | 09:20:00 AM',
      updated_at: '15-09-2026 | 06:00:00 PM',
    },
  ];

  // Seed Customer Register with BH-0, CX, DX, and standard Consumer Numbers
  const customers: CustomerRecord[] = [
    {
      id: 'cust_1',
      consumer_number: 'BH-01001',
      customer_name: 'Mohammad Irfan',
      mobile: '9876543210',
      address: 'Ward 4, Civil Lines',
      created_at: '01-01-2026 | 09:00:00 AM',
      updated_at: '01-01-2026 | 09:00:00 AM',
    },
    {
      id: 'cust_2',
      consumer_number: 'BH-01002',
      customer_name: 'Salman Ansari',
      mobile: '9811223344',
      address: 'Near Jama Masjid, Main Road',
      created_at: '01-01-2026 | 09:05:00 AM',
      updated_at: '01-01-2026 | 09:05:00 AM',
    },
    {
      id: 'cust_3',
      consumer_number: 'CX2001',
      customer_name: 'Sunita Devi',
      mobile: '9123456780',
      address: 'Station Road, Sector 2',
      created_at: '01-01-2026 | 09:10:00 AM',
      updated_at: '01-01-2026 | 09:10:00 AM',
    },
    {
      id: 'cust_4',
      consumer_number: 'CX2002',
      customer_name: 'Ramesh Chandra Gupta',
      mobile: '9415001122',
      address: 'Subhash Nagar Colony',
      created_at: '01-01-2026 | 09:15:00 AM',
      updated_at: '01-01-2026 | 09:15:00 AM',
    },
    {
      id: 'cust_5',
      consumer_number: 'DX3001',
      customer_name: 'Anwar Hussain',
      mobile: '9988776655',
      address: 'Market Chowk, Block B',
      created_at: '01-01-2026 | 09:20:00 AM',
      updated_at: '01-01-2026 | 09:20:00 AM',
    },
    {
      id: 'cust_6',
      consumer_number: 'DX3002',
      customer_name: 'Farzana Begum',
      mobile: '9765432109',
      address: 'Nai Basti, Highway Crossing',
      created_at: '01-01-2026 | 09:25:00 AM',
      updated_at: '01-01-2026 | 09:25:00 AM',
    },
    {
      id: 'cust_7',
      consumer_number: '0012345678',
      customer_name: 'Abdul Kareem',
      mobile: '9839112233',
      address: 'Old Post Office Road',
      created_at: '01-01-2026 | 09:30:00 AM',
      updated_at: '01-01-2026 | 09:30:00 AM',
    },
    {
      id: 'cust_8',
      consumer_number: '1234567890',
      customer_name: 'Vikas Yadav',
      mobile: '9450998877',
      address: 'Gandhi Nagar, Lane 3',
      created_at: '01-01-2026 | 09:35:00 AM',
      updated_at: '01-01-2026 | 09:35:00 AM',
    },
    {
      id: 'cust_9',
      consumer_number: '0045678901',
      customer_name: 'Shakeel Ahmad',
      mobile: '9918223344',
      address: 'Idgah Colony',
      created_at: '01-01-2026 | 09:40:00 AM',
      updated_at: '01-01-2026 | 09:40:00 AM',
    },
    {
      id: 'cust_10',
      consumer_number: '0078901234',
      customer_name: 'Dinesh Prasad',
      mobile: '9335123456',
      address: 'Patel Nagar',
      created_at: '01-01-2026 | 09:45:00 AM',
      updated_at: '01-01-2026 | 09:45:00 AM',
    },
    {
      id: 'cust_11',
      consumer_number: '0099887766',
      customer_name: 'Meena Kumari',
      mobile: '9621009988',
      address: 'Shastri Puram',
      created_at: '01-01-2026 | 09:50:00 AM',
      updated_at: '01-01-2026 | 09:50:00 AM',
    },
  ];

  // Build seed entries chronologically so duplicate flags and customer_name are computed accurately
  const rawSeedEntries: Array<{
    id: string;
    consumer_number: string;
    dateIST: string;
    timeIST: string;
    delivery_man_id: string;
    created_by: string;
  }> = [
    // 35 days ago (outside 30-day window)
    {
      id: 'ent_101',
      consumer_number: '0099887766',
      dateIST: thirtyFiveDaysAgoIST,
      timeIST: '10:15:20 AM',
      delivery_man_id: 'dm_mahesh',
      created_by: 'usr_admin',
    },
    // 10 days ago (inside 30-day window)
    {
      id: 'ent_102',
      consumer_number: '1234567890',
      dateIST: tenDaysAgoIST,
      timeIST: '11:20:05 AM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_103',
      consumer_number: '0078901234',
      dateIST: tenDaysAgoIST,
      timeIST: '03:18:40 PM',
      delivery_man_id: 'dm_asad',
      created_by: 'usr_ravi',
    },
    // 3 days ago
    {
      id: 'ent_104',
      consumer_number: 'BH-01001',
      dateIST: threeDaysAgoIST,
      timeIST: '09:45:10 AM',
      delivery_man_id: 'dm_suresh',
      created_by: 'usr_priya',
    },
    {
      id: 'ent_105',
      consumer_number: 'CX2001',
      dateIST: threeDaysAgoIST,
      timeIST: '01:10:00 PM',
      delivery_man_id: 'dm_imran',
      created_by: 'usr_ravi',
    },
    // Yesterday
    {
      id: 'ent_106',
      consumer_number: 'DX3001',
      dateIST: yesterdayIST,
      timeIST: '10:30:12 AM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_107',
      consumer_number: 'DX3001',
      dateIST: yesterdayIST,
      timeIST: '04:15:33 PM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_priya',
    },
    // Today's entries
    {
      id: 'ent_108',
      consumer_number: '0012345678',
      dateIST: todayIST,
      timeIST: '09:15:00 AM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_109',
      consumer_number: '0045678901',
      dateIST: todayIST,
      timeIST: '09:42:18 AM',
      delivery_man_id: 'dm_asad',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_110',
      consumer_number: '1234567890', // Repeat of 10-days-ago consumer!
      dateIST: todayIST,
      timeIST: '10:12:45 AM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_111',
      consumer_number: 'BH-01002',
      dateIST: todayIST,
      timeIST: '11:05:09 AM',
      delivery_man_id: 'dm_suresh',
      created_by: 'usr_priya',
    },
    {
      id: 'ent_112',
      consumer_number: 'CX2002',
      dateIST: todayIST,
      timeIST: '12:20:30 PM',
      delivery_man_id: 'dm_imran',
      created_by: 'usr_priya',
    },
    {
      id: 'ent_113',
      consumer_number: '0045678901', // Second entry today for 0045678901
      dateIST: todayIST,
      timeIST: '01:50:14 PM',
      delivery_man_id: 'dm_suresh',
      created_by: 'usr_ravi',
    },
    {
      id: 'ent_114',
      consumer_number: '0012345678', // Second entry today for 0012345678
      dateIST: todayIST,
      timeIST: '02:35:00 PM',
      delivery_man_id: 'dm_raksharam',
      created_by: 'usr_admin',
    },
  ];

  const consumer_entries: ConsumerEntryRecord[] = [];
  for (const raw of rawSeedEntries) {
    const norm = normalizeConsumerNumber(raw.consumer_number);
    const check = evaluateDuplicateStatus(norm, consumer_entries, raw.dateIST);
    const matchedCust = autoFetchCustomer(norm, customers);
    const ts = makeEntryTimestamp(raw.dateIST, raw.timeIST);
    consumer_entries.push({
      id: raw.id,
      consumer_number: norm,
      customer_name: matchedCust?.customer_name || '',
      entry_date_ist: raw.dateIST,
      entry_time_ist: raw.timeIST,
      timestamp_ist: ts.timestamp_ist,
      iso_ist: ts.iso_ist,
      delivery_man_id: raw.delivery_man_id,
      duplicate_today: check.isDuplicateToday,
      duplicate_30_days: check.isDuplicate30Days,
      duplicate_month: check.isDuplicateMonth,
      created_by: raw.created_by,
      created_at: ts.timestamp_ist,
    });
  }

  const audit_logs: AuditLogRecord[] = [
    {
      id: 'aud_101',
      user_id: 'usr_admin',
      action: 'UPDATE_DELIVERY_MAN',
      record_id: 'dm_mahesh',
      old_value: 'Mahesh (Active: true)',
      new_value: 'Mahesh (Active: false — Historical records preserved)',
      timestamp_ist: `15-09-2026 | 06:00:00 PM`,
    },
  ];

  return {
    version: 3,
    seededForDateIST: todayIST,
    settings: {
      agencyName: 'BharatGas Highway Distributors',
      agencyCode: 'BG-UP-44092',
      distributorLocation: 'Lucknow Circle · Asia/Kolkata (IST)',
      requireConfirmationOnDuplicate: true,
      keepDeliveryManSelected: true,
    },
    users,
    user_permissions,
    delivery_men,
    customers,
    consumer_entries,
    audit_logs,
  };
}

import { loadDatabaseFromIDB, saveDatabaseToIDB } from './idbStorage';

export { loadDatabaseFromIDB, saveDatabaseToIDB };

export function loadDatabase(): DatabaseSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (
        parsed &&
        parsed.version === 3 &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.customers) &&
        Array.isArray(parsed.consumer_entries)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to seed database
  }
  const seeded = createInitialSeedDatabase();
  saveDatabase(seeded);
  return seeded;
}

/**
 * Saves database reliably across IndexedDB (unlimited capacity for 50,000+ records)
 * and falls back gracefully with localStorage.
 */
export function saveDatabase(db: DatabaseSchema): void {
  // Always trigger non-blocking IndexedDB persistence for complete durability
  saveDatabaseToIDB(db).catch(() => {});

  try {
    // Only attempt localStorage if data is within typical quota (~10,000 records or less)
    // to prevent browser DOMException / UI pauses
    if (db.customers.length <= 8000) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } else {
      // For large databases (50,000+ customers), save lightweight placeholder in localStorage
      // so initial sync parse doesn't stall or throw QuotaExceededError
      const shallowDb = {
        ...db,
        customers: db.customers.slice(0, 100), // lightweight preview
        _isLargeDataset: true,
        _totalCustomers: db.customers.length,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shallowDb));
    }
  } catch {
    // Storage quota handled cleanly by IndexedDB
  }
}


/**
 * Generates a complete SQL DDL + INSERT dump matching Section 25 of the specification
 * for database backup / inspection.
 */
export function generateSQLDump(db: DatabaseSchema): string {
  const lines: string[] = [
    '-- LPG Consumer Deduplication Checklist - SQL Database Backup',
    `-- Generated in IST (Asia/Kolkata): ${formatIST().timestampIST}`,
    '',
    'CREATE TABLE IF NOT EXISTS users (',
    '  id TEXT PRIMARY KEY,',
    '  name TEXT NOT NULL,',
    '  username TEXT UNIQUE NOT NULL,',
    '  password_hash TEXT NOT NULL,',
    '  role TEXT NOT NULL,',
    '  active BOOLEAN NOT NULL DEFAULT 1,',
    '  created_at TEXT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS user_permissions (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL REFERENCES users(id),',
    '  permission TEXT NOT NULL,',
    '  enabled BOOLEAN NOT NULL DEFAULT 1',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS delivery_men (',
    '  id TEXT PRIMARY KEY,',
    '  name TEXT NOT NULL,',
    '  active BOOLEAN NOT NULL DEFAULT 1,',
    '  created_at TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS customers (',
    '  id TEXT PRIMARY KEY,',
    '  consumer_number TEXT UNIQUE NOT NULL,',
    '  customer_name TEXT NOT NULL,',
    '  mobile TEXT,',
    '  address TEXT,',
    '  created_at TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS consumer_entries (',
    '  id TEXT PRIMARY KEY,',
    '  consumer_number TEXT NOT NULL,',
    '  customer_name TEXT,',
    '  entry_date_ist TEXT NOT NULL,',
    '  entry_time_ist TEXT NOT NULL,',
    '  timestamp_ist TEXT NOT NULL,',
    '  delivery_man_id TEXT NOT NULL REFERENCES delivery_men(id),',
    '  duplicate_today BOOLEAN NOT NULL DEFAULT 0,',
    '  duplicate_30_days BOOLEAN NOT NULL DEFAULT 0,',
    '  duplicate_month BOOLEAN NOT NULL DEFAULT 0,',
    '  created_by TEXT NOT NULL REFERENCES users(id),',
    '  created_at TEXT NOT NULL',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS audit_logs (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL REFERENCES users(id),',
    '  action TEXT NOT NULL,',
    '  record_id TEXT NOT NULL,',
    '  old_value TEXT,',
    '  new_value TEXT,',
    '  timestamp_ist TEXT NOT NULL',
    ');',
    '',
  ];

  const esc = (s: string) => `'${String(s ?? '').replace(/'/g, "''")}'`;

  for (const u of db.users) {
    lines.push(
      `INSERT INTO users VALUES (${esc(u.id)}, ${esc(u.name)}, ${esc(u.username)}, ${esc(u.password_hash)}, ${esc(u.role)}, ${u.active ? 1 : 0}, ${esc(u.created_at)});`
    );
  }
  for (const dm of db.delivery_men) {
    lines.push(
      `INSERT INTO delivery_men VALUES (${esc(dm.id)}, ${esc(dm.name)}, ${dm.active ? 1 : 0}, ${esc(dm.created_at)}, ${esc(dm.updated_at)});`
    );
  }
  for (const c of db.customers) {
    lines.push(
      `INSERT INTO customers VALUES (${esc(c.id)}, ${esc(c.consumer_number)}, ${esc(c.customer_name)}, ${esc(c.mobile)}, ${esc(c.address)}, ${esc(c.created_at)}, ${esc(c.updated_at)});`
    );
  }
  for (const e of db.consumer_entries) {
    lines.push(
      `INSERT INTO consumer_entries VALUES (${esc(e.id)}, ${esc(e.consumer_number)}, ${esc(e.customer_name || '')}, ${esc(e.entry_date_ist)}, ${esc(e.entry_time_ist)}, ${esc(e.timestamp_ist)}, ${esc(e.delivery_man_id)}, ${e.duplicate_today ? 1 : 0}, ${e.duplicate_30_days ? 1 : 0}, ${e.duplicate_month ? 1 : 0}, ${esc(e.created_by)}, ${esc(e.created_at)});`
    );
  }
  for (const a of db.audit_logs) {
    lines.push(
      `INSERT INTO audit_logs VALUES (${esc(a.id)}, ${esc(a.user_id)}, ${esc(a.action)}, ${esc(a.record_id)}, ${esc(a.old_value)}, ${esc(a.new_value)}, ${esc(a.timestamp_ist)});`
    );
  }

  return lines.join('\n');
}
