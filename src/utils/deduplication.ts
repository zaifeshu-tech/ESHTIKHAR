/**
 * Pure domain logic for LPG Consumer Deduplication Checklist.
 * All date/time calculations strictly enforce Indian Standard Time (IST / Asia/Kolkata).
 */

export type UserRole = 'ADMIN' | 'STAFF';

export type PermissionKey =
  | 'new_entry'
  | 'customer_register'
  | 'view_records'
  | 'search_consumer'
  | 'daily_duplication'
  | 'report_30_day'
  | 'monthly_report'
  | 'export_reports'
  | 'manage_delivery_men';

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'new_entry', label: 'New Entry', description: 'Create new consumer delivery entries' },
  { key: 'customer_register', label: 'Customer Register', description: 'Manage customer master list & Excel upload' },
  { key: 'view_records', label: 'View Records', description: 'Browse date-wise and monthly entry logs' },
  { key: 'search_consumer', label: 'Search Consumer', description: 'Lookup full history for any Consumer Number' },
  { key: 'daily_duplication', label: 'Daily Duplication', description: 'Access same-day duplicate consumer report' },
  { key: 'report_30_day', label: '30-Day Report', description: 'Access 30-day rolling duplicate report' },
  { key: 'monthly_report', label: 'Monthly Report', description: 'Access monthly summary and delivery man breakdown' },
  { key: 'export_reports', label: 'Export', description: 'Download Excel (.xlsx), CSV, and PDF reports' },
  { key: 'manage_delivery_men', label: 'Delivery Men', description: 'Add, edit, or activate/deactivate delivery men' },
];

export const CONSUMER_PREFIXES = ['BH-0', 'CX', 'DX'] as const;

export interface CustomerRecord {
  id: string;
  consumer_number: string; // e.g. BH-010234, CX50012, DX80019, 0012345678
  customer_name: string;
  mobile: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface UserPermissionRecord {
  id: string;
  user_id: string;
  permission: PermissionKey;
  enabled: boolean;
}

export interface DeliveryManRecord {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsumerEntryRecord {
  id: string;
  consumer_number: string; // Stored strictly as TEXT/STRING to preserve leading zeros and prefixes (BH-0, CX, DX)
  customer_name?: string;  // Auto-fetched from Customer Register on entry
  entry_date_ist: string;  // DD-MM-YYYY in Asia/Kolkata
  entry_time_ist: string;  // HH:MM:SS AM/PM in Asia/Kolkata
  timestamp_ist: string;   // DD-MM-YYYY | HH:MM:SS AM/PM
  iso_ist: string;         // YYYY-MM-DDTHH:mm:ss+05:30 for chronological sorting
  delivery_man_id: string;
  duplicate_today: boolean;
  duplicate_30_days: boolean;
  duplicate_month: boolean;
  created_by: string;      // user_id
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id: string;
  action:
    | 'EDIT_ENTRY'
    | 'DELETE_ENTRY'
    | 'CREATE_USER'
    | 'UPDATE_USER'
    | 'RESET_PASSWORD'
    | 'UPDATE_PERMISSIONS'
    | 'CREATE_DELIVERY_MAN'
    | 'UPDATE_DELIVERY_MAN'
    | 'IMPORT_CUSTOMERS'
    | 'UPSERT_CUSTOMER'
    | 'DELETE_CUSTOMER';
  record_id: string;
  old_value: string;
  new_value: string;
  timestamp_ist: string;
}

/**
 * Normalizes a Consumer Number string:
 * - Preserves leading zeros, prefixes (BH-0, CX, DX), hyphens, and exact characters
 * - Removes all spaces, trims invisible whitespace, and normalizes letters to uppercase
 */
export function normalizeConsumerNumber(input: string): string {
  if (typeof input !== 'string') {
    return String(input ?? '').replace(/\s+/g, '').toUpperCase();
  }
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Auto-fetches a customer from the Customer Register by exact Consumer Number match.
 * Optimized with Map/index lookup when available for 0ms instantaneous lookup among 50,000+ customers.
 */
export function autoFetchCustomer(
  rawConsumerNumber: string,
  customers: CustomerRecord[],
  customerMap?: Map<string, CustomerRecord>
): CustomerRecord | null {
  const norm = normalizeConsumerNumber(rawConsumerNumber);
  if (!norm) return null;
  if (customerMap) {
    return customerMap.get(norm) || null;
  }
  return customers.find((c) => normalizeConsumerNumber(c.consumer_number) === norm) || null;
}

/**
 * Returns up to `limit` matching suggestions from the Customer Register as the user types.
 * High-performance early-exit algorithm designed for 50,000+ records with zero UI lag.
 */
export function suggestCustomers(
  rawInput: string,
  customers: CustomerRecord[],
  limit = 5
): CustomerRecord[] {
  const norm = normalizeConsumerNumber(rawInput);
  if (!norm || norm.length < 2) return [];

  const exactFirst: CustomerRecord[] = [];
  const startsWith: CustomerRecord[] = [];
  const contains: CustomerRecord[] = [];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const cNorm = normalizeConsumerNumber(c.consumer_number);
    if (cNorm === norm) {
      exactFirst.push(c);
      if (exactFirst.length >= limit) break;
    } else if (cNorm.startsWith(norm)) {
      startsWith.push(c);
      if (exactFirst.length + startsWith.length >= limit * 2) {
        break; // Early exit: plenty of high-relevance prefix matches
      }
    } else if (exactFirst.length + startsWith.length < limit) {
      const nameUpper = c.customer_name.toUpperCase();
      if (cNorm.includes(norm) || nameUpper.includes(norm)) {
        contains.push(c);
      }
    }
  }

  return [...exactFirst, ...startsWith, ...contains].slice(0, limit);
}


/**
 * Formats any Date object or epoch timestamp into Indian Standard Time (Asia/Kolkata).
 * Returns:
 * - dateIST: DD-MM-YYYY (e.g. "05-10-2026")
 * - ymdIST: YYYY-MM-DD (e.g. "2026-10-05")
 * - monthKeyIST: MM-YYYY (e.g. "10-2026")
 * - timeIST: HH:MM:SS AM/PM (e.g. "05:42:18 PM")
 * - timestampIST: "DD-MM-YYYY | HH:MM:SS AM/PM"
 * - isoIST: "YYYY-MM-DDTHH:MM:SS+05:30"
 */
export function formatIST(dateInput: Date | number = new Date()): {
  dateIST: string;
  ymdIST: string;
  monthKeyIST: string;
  timeIST: string;
  timestampIST: string;
  isoIST: string;
} {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }

  const day = (map.day || '01').padStart(2, '0');
  const month = (map.month || '01').padStart(2, '0');
  const year = map.year || '2026';
  const hour12 = (map.hour || '12').padStart(2, '0');
  const minute = (map.minute || '00').padStart(2, '0');
  const second = (map.second || '00').padStart(2, '0');
  const dayPeriod = (map.dayPeriod || 'AM').toUpperCase();

  // Compute 24-hour for sortable ISO string
  let h24 = parseInt(hour12, 10);
  if (dayPeriod === 'AM' && h24 === 12) h24 = 0;
  if (dayPeriod === 'PM' && h24 !== 12) h24 += 12;
  const hour24Str = String(h24).padStart(2, '0');

  const dateIST = `${day}-${month}-${year}`;
  const ymdIST = `${year}-${month}-${day}`;
  const monthKeyIST = `${month}-${year}`;
  const timeIST = `${hour12}:${minute}:${second} ${dayPeriod}`;
  const timestampIST = `${dateIST} | ${timeIST}`;
  const isoIST = `${ymdIST}T${hour24Str}:${minute}:${second}+05:30`;

  return {
    dateIST,
    ymdIST,
    monthKeyIST,
    timeIST,
    timestampIST,
    isoIST,
  };
}

/**
 * Converts DD-MM-YYYY to YYYY-MM-DD
 */
export function dmyToYmd(dmy: string): string {
  const parts = dmy.trim().split('-');
  if (parts.length !== 3) return dmy;
  if (parts[0].length === 4) return dmy; // already YYYY-MM-DD
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Converts YYYY-MM-DD to DD-MM-YYYY
 */
export function ymdToDmy(ymd: string): string {
  const parts = ymd.trim().split('-');
  if (parts.length !== 3) return ymd;
  if (parts[2].length === 4) return ymd; // already DD-MM-YYYY
  const [yyyy, mm, dd] = parts;
  return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy}`;
}

/**
 * Parses a DD-MM-YYYY or YYYY-MM-DD string into UTC midnight milliseconds
 * representing that exact calendar date in IST, allowing exact integer calendar-day diffs.
 */
export function parseISTCalendarDateToEpochDays(dateStr: string): number {
  const ymd = dmyToYmd(dateStr);
  const [yyyy, mm, dd] = ymd.split('-').map(Number);
  if (!yyyy || !mm || !dd) return NaN;
  const utcMs = Date.UTC(yyyy, mm - 1, dd);
  return Math.floor(utcMs / 86_400_000);
}

/**
 * Calculates calendar days elapsed between an earlier IST date and a target IST date.
 * Returns targetDays - earlierDays (e.g. 10 if earlier was 10 days before target).
 */
export function calculateCalendarDaysBetweenIST(earlierDateIST: string, targetDateIST: string): number {
  const startDays = parseISTCalendarDateToEpochDays(earlierDateIST);
  const endDays = parseISTCalendarDateToEpochDays(targetDateIST);
  if (Number.isNaN(startDays) || Number.isNaN(endDays)) return NaN;
  return endDays - startDays;
}

/**
 * Returns the DD-MM-YYYY date string offset by `offsetDays` from a given DD-MM-YYYY date.
 */
export function addDaysIST(dateIST: string, offsetDays: number): string {
  const ymd = dmyToYmd(dateIST);
  const [yyyy, mm, dd] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd + offsetDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${d}-${m}-${y}`;
}

/**
 * Extracts MM-YYYY from a DD-MM-YYYY date string.
 */
export function getMonthYearFromDateIST(dateIST: string): string {
  const dmy = ymdToDmy(dateIST);
  const parts = dmy.split('-');
  if (parts.length !== 3) return '';
  return `${parts[1]}-${parts[2]}`;
}

export interface DuplicateMatchEntry {
  entry: ConsumerEntryRecord;
  deliveryManName: string;
  createdByName: string;
  daysAgo: number;
}

export interface DuplicateCheckResult {
  normalizedConsumerNumber: string;
  hasAnyDuplicate: boolean;
  isDuplicateToday: boolean;
  isDuplicate30Days: boolean;
  isDuplicateMonth: boolean;
  todayMatches: DuplicateMatchEntry[];
  last30DaysMatches: DuplicateMatchEntry[];
  monthMatches: DuplicateMatchEntry[];
  latestTodayMatch: DuplicateMatchEntry | null;
  latest30DaysMatch: DuplicateMatchEntry | null;
}

/**
 * Evaluates all 3 duplicate rules for a Consumer Number against existing entries
 * relative to `targetDateIST` (DD-MM-YYYY in Asia/Kolkata).
 *
 * Rules:
 * 1. Daily: Consumer Number + IST Date already exists -> Duplicate Today
 * 2. 30 Days: An existing entry for the same Consumer Number falls within the previous 30 calendar days
 *    (0 <= daysAgo <= 30; entries 31+ days ago do NOT trigger the 30-day warning)
 * 3. Monthly: An existing entry for the same Consumer Number exists within the current calendar month (MM-YYYY)
 */
export function evaluateDuplicateStatus(
  rawConsumerNumber: string,
  entries: ConsumerEntryRecord[],
  targetDateIST: string,
  deliveryMenMap: Record<string, string> = {},
  usersMap: Record<string, string> = {}
): DuplicateCheckResult {
  const normalized = normalizeConsumerNumber(rawConsumerNumber);
  const targetDmy = ymdToDmy(targetDateIST);
  const targetMonthYear = getMonthYearFromDateIST(targetDmy);

  if (!normalized) {
    return {
      normalizedConsumerNumber: '',
      hasAnyDuplicate: false,
      isDuplicateToday: false,
      isDuplicate30Days: false,
      isDuplicateMonth: false,
      todayMatches: [],
      last30DaysMatches: [],
      monthMatches: [],
      latestTodayMatch: null,
      latest30DaysMatch: null,
    };
  }

  // Filter matching consumer entries sorted newest first
  const matchingEntries = entries
    .filter((e) => normalizeConsumerNumber(e.consumer_number) === normalized)
    .sort((a, b) => b.iso_ist.localeCompare(a.iso_ist));

  const todayMatches: DuplicateMatchEntry[] = [];
  const last30DaysMatches: DuplicateMatchEntry[] = [];
  const monthMatches: DuplicateMatchEntry[] = [];

  for (const entry of matchingEntries) {
    const entryDmy = ymdToDmy(entry.entry_date_ist);
    const daysAgo = calculateCalendarDaysBetweenIST(entryDmy, targetDmy);
    const entryMonthYear = getMonthYearFromDateIST(entryDmy);

    const enriched: DuplicateMatchEntry = {
      entry,
      deliveryManName: deliveryMenMap[entry.delivery_man_id] || 'Unknown',
      createdByName: usersMap[entry.created_by] || 'Unknown',
      daysAgo,
    };

    if (entryDmy === targetDmy) {
      todayMatches.push(enriched);
    }

    // Previous 30 calendar days: 0 <= daysAgo <= 30 (31+ days ago is NOT included)
    if (!Number.isNaN(daysAgo) && daysAgo >= 0 && daysAgo <= 30) {
      last30DaysMatches.push(enriched);
    }

    if (entryMonthYear === targetMonthYear) {
      monthMatches.push(enriched);
    }
  }

  const isDuplicateToday = todayMatches.length > 0;
  const isDuplicate30Days = last30DaysMatches.length > 0;
  const isDuplicateMonth = monthMatches.length > 0;

  // Prefer showing a prior-day match in the 30-day card if available, otherwise today's match
  const priorDay30Match = last30DaysMatches.find((m) => m.daysAgo > 0) || last30DaysMatches[0] || null;

  return {
    normalizedConsumerNumber: normalized,
    hasAnyDuplicate: isDuplicateToday || isDuplicate30Days || isDuplicateMonth,
    isDuplicateToday,
    isDuplicate30Days,
    isDuplicateMonth,
    todayMatches,
    last30DaysMatches,
    monthMatches,
    latestTodayMatch: todayMatches[0] || null,
    latest30DaysMatch: priorDay30Match,
  };
}

export interface DailyDuplicateGroup {
  dateIST: string;
  consumerNumber: string;
  entryCount: number;
  firstTime: string;
  lastTime: string;
  deliveryMenNames: string[];
  deliveryManSummary: string;
  status: 'DUPLICATE';
  entries: Array<{
    id: string;
    dateIST: string;
    timeIST: string;
    deliveryManId: string;
    deliveryManName: string;
    createdByName: string;
  }>;
}

export interface DailyDuplicationReportData {
  totalEntries: number;
  uniqueConsumers: number;
  duplicateConsumers: number;
  totalDuplicateEntries: number;
  deliveryManDuplicateCounts: Array<{
    deliveryManId: string;
    deliveryManName: string;
    duplicateEntriesCount: number;
    duplicateConsumersCount: number;
  }>;
  groups: DailyDuplicateGroup[];
}

/**
 * Computes the Daily Duplication Report and Summary for entries matching the selected date filter.
 * Only Consumer Numbers entered two or more times on the same IST date are listed in `groups`.
 */
export function buildDailyDuplicationReport(
  filteredEntries: ConsumerEntryRecord[],
  deliveryMenMap: Record<string, string>,
  usersMap: Record<string, string>
): DailyDuplicationReportData {
  const totalEntries = filteredEntries.length;
  const uniqueConsumerSet = new Set<string>();

  // Group by (entry_date_ist + consumer_number) so same-day duplicates are accurately grouped
  const byDateAndConsumer = new Map<string, ConsumerEntryRecord[]>();

  for (const entry of filteredEntries) {
    const norm = normalizeConsumerNumber(entry.consumer_number);
    uniqueConsumerSet.add(norm);
    const key = `${entry.entry_date_ist}__${norm}`;
    const list = byDateAndConsumer.get(key) || [];
    list.push(entry);
    byDateAndConsumer.set(key, list);
  }

  const groups: DailyDuplicateGroup[] = [];
  let totalDuplicateEntries = 0;
  const dupConsumerSet = new Set<string>();

  // Track delivery-man-wise duplicate counts
  const dmDupEntries = new Map<string, number>();
  const dmDupConsumers = new Map<string, Set<string>>();

  for (const [, list] of byDateAndConsumer.entries()) {
    if (list.length >= 2) {
      // Sort chronologically ascending (first entry to last entry)
      const sortedAsc = [...list].sort((a, b) => a.iso_ist.localeCompare(b.iso_ist));
      const consumerNumber = normalizeConsumerNumber(sortedAsc[0].consumer_number);
      const dateIST = sortedAsc[0].entry_date_ist;

      dupConsumerSet.add(consumerNumber);
      totalDuplicateEntries += sortedAsc.length;

      const dmNamesSet = new Set<string>();
      for (const item of sortedAsc) {
        const dmName = deliveryMenMap[item.delivery_man_id] || 'Unknown';
        dmNamesSet.add(dmName);

        dmDupEntries.set(item.delivery_man_id, (dmDupEntries.get(item.delivery_man_id) || 0) + 1);
        if (!dmDupConsumers.has(item.delivery_man_id)) {
          dmDupConsumers.set(item.delivery_man_id, new Set());
        }
        dmDupConsumers.get(item.delivery_man_id)!.add(consumerNumber);
      }

      const deliveryMenNames = Array.from(dmNamesSet);

      groups.push({
        dateIST,
        consumerNumber,
        entryCount: sortedAsc.length,
        firstTime: sortedAsc[0].entry_time_ist,
        lastTime: sortedAsc[sortedAsc.length - 1].entry_time_ist,
        deliveryMenNames,
        deliveryManSummary: deliveryMenNames.join(', '),
        status: 'DUPLICATE',
        entries: sortedAsc.map((e) => ({
          id: e.id,
          dateIST: e.entry_date_ist,
          timeIST: e.entry_time_ist,
          deliveryManId: e.delivery_man_id,
          deliveryManName: deliveryMenMap[e.delivery_man_id] || 'Unknown',
          createdByName: usersMap[e.created_by] || 'Unknown',
        })),
      });
    }
  }

  // Sort groups by date descending, then entryCount descending, then consumerNumber
  groups.sort((a, b) => {
    const ymdA = dmyToYmd(a.dateIST);
    const ymdB = dmyToYmd(b.dateIST);
    if (ymdA !== ymdB) return ymdB.localeCompare(ymdA);
    if (b.entryCount !== a.entryCount) return b.entryCount - a.entryCount;
    return a.consumerNumber.localeCompare(b.consumerNumber);
  });

  const deliveryManDuplicateCounts = Array.from(dmDupEntries.entries())
    .map(([deliveryManId, duplicateEntriesCount]) => ({
      deliveryManId,
      deliveryManName: deliveryMenMap[deliveryManId] || 'Unknown',
      duplicateEntriesCount,
      duplicateConsumersCount: dmDupConsumers.get(deliveryManId)?.size || 0,
    }))
    .sort((a, b) => b.duplicateEntriesCount - a.duplicateEntriesCount);

  return {
    totalEntries,
    uniqueConsumers: uniqueConsumerSet.size,
    duplicateConsumers: dupConsumerSet.size,
    totalDuplicateEntries,
    deliveryManDuplicateCounts,
    groups,
  };
}

export interface ThirtyDayDuplicateRow {
  entryId: string;
  consumerNumber: string;
  entryDateIST: string;
  entryTimeIST: string;
  previousDateIST: string;
  previousTimeIST: string;
  deliveryManId: string;
  deliveryManName: string;
  previousDeliveryManName: string;
  daysSincePrevious: number;
  status: 'DUPLICATE (30 DAYS)' | 'SAME-DAY DUPLICATE';
}

/**
 * Computes the 30-Day Duplicate Report relative to a selected IST date (`referenceDateIST`, DD-MM-YYYY).
 * Evaluates entries and finds every consumer who has a previous entry within 0 to 30 calendar days
 * prior to the entry (or relative to `referenceDateIST`).
 * Specifically:
 * - For entries on `referenceDateIST` (or within the 30-day window ending on `referenceDateIST`),
 *   identifies any previous entry for the same Consumer Number within 0..30 days.
 * - Any previous entry 31 or more days earlier is strictly ignored.
 */
export function build30DayDuplicateReport(
  allEntries: ConsumerEntryRecord[],
  referenceDateIST: string,
  deliveryMenMap: Record<string, string>,
  mode: 'on_date' | 'window_30_days' = 'window_30_days'
): ThirtyDayDuplicateRow[] {
  const refDmy = ymdToDmy(referenceDateIST);
  const sortedAsc = [...allEntries].sort((a, b) => a.iso_ist.localeCompare(b.iso_ist));
  const historyByConsumer = new Map<string, ConsumerEntryRecord[]>();
  const rows: ThirtyDayDuplicateRow[] = [];

  for (const entry of sortedAsc) {
    const norm = normalizeConsumerNumber(entry.consumer_number);
    const entryDmy = ymdToDmy(entry.entry_date_ist);
    const daysFromEntryToRef = calculateCalendarDaysBetweenIST(entryDmy, refDmy);

    const priorEntries = historyByConsumer.get(norm) || [];

    if (priorEntries.length > 0) {
      const mostRecentPrior = priorEntries[priorEntries.length - 1];
      const priorDmy = ymdToDmy(mostRecentPrior.entry_date_ist);
      const daysSincePrevious = calculateCalendarDaysBetweenIST(priorDmy, entryDmy);

      // Must be within 0..30 calendar days (31+ days does NOT trigger 30-day duplicate)
      if (!Number.isNaN(daysSincePrevious) && daysSincePrevious >= 0 && daysSincePrevious <= 30) {
        const includeInReport =
          mode === 'on_date'
            ? entryDmy === refDmy
            : !Number.isNaN(daysFromEntryToRef) && daysFromEntryToRef >= 0 && daysFromEntryToRef <= 30;

        if (includeInReport) {
          rows.push({
            entryId: entry.id,
            consumerNumber: norm,
            entryDateIST: entryDmy,
            entryTimeIST: entry.entry_time_ist,
            previousDateIST: priorDmy,
            previousTimeIST: mostRecentPrior.entry_time_ist,
            deliveryManId: entry.delivery_man_id,
            deliveryManName: deliveryMenMap[entry.delivery_man_id] || 'Unknown',
            previousDeliveryManName: deliveryMenMap[mostRecentPrior.delivery_man_id] || 'Unknown',
            daysSincePrevious,
            status: daysSincePrevious === 0 ? 'SAME-DAY DUPLICATE' : 'DUPLICATE (30 DAYS)',
          });
        }
      }
    }

    priorEntries.push(entry);
    historyByConsumer.set(norm, priorEntries);
  }

  return rows.reverse();
}

export interface ConsumerSearchHistoryItem {
  entry: ConsumerEntryRecord;
  deliveryManName: string;
  enteredByName: string;
  daysSincePreviousEntry: number | null;
  daysAgoFromToday: number;
  duplicateLabels: string[];
}

/**
 * Searches a Consumer Number and computes its complete chronological history
 * including `daysSincePreviousEntry` for every entry.
 */
export function buildConsumerSearchHistory(
  queryConsumerNumber: string,
  allEntries: ConsumerEntryRecord[],
  todayIST: string,
  deliveryMenMap: Record<string, string>,
  usersMap: Record<string, string>,
  exactOnly = false
): ConsumerSearchHistoryItem[] {
  const normQuery = normalizeConsumerNumber(queryConsumerNumber);
  if (!normQuery) return [];

  const matched = allEntries.filter((e) => {
    const normEntry = normalizeConsumerNumber(e.consumer_number);
    return exactOnly ? normEntry === normQuery : normEntry.includes(normQuery);
  });

  // Group by consumer number to compute daysSincePreviousEntry accurately per consumer
  const byConsumer = new Map<string, ConsumerEntryRecord[]>();
  for (const e of matched) {
    const norm = normalizeConsumerNumber(e.consumer_number);
    const list = byConsumer.get(norm) || [];
    list.push(e);
    byConsumer.set(norm, list);
  }

  const results: ConsumerSearchHistoryItem[] = [];

  for (const [, list] of byConsumer.entries()) {
    const sortedAsc = [...list].sort((a, b) => a.iso_ist.localeCompare(b.iso_ist));
    for (let i = 0; i < sortedAsc.length; i++) {
      const current = sortedAsc[i];
      const prev = i > 0 ? sortedAsc[i - 1] : null;
      const daysSincePreviousEntry = prev
        ? calculateCalendarDaysBetweenIST(prev.entry_date_ist, current.entry_date_ist)
        : null;
      const daysAgoFromToday = calculateCalendarDaysBetweenIST(current.entry_date_ist, todayIST);

      const duplicateLabels: string[] = [];
      if (current.duplicate_today) duplicateLabels.push('Duplicate Today');
      if (current.duplicate_30_days) duplicateLabels.push('Within 30 Days');
      if (current.duplicate_month) duplicateLabels.push('Duplicate Month');

      results.push({
        entry: current,
        deliveryManName: deliveryMenMap[current.delivery_man_id] || 'Unknown',
        enteredByName: usersMap[current.created_by] || 'Unknown',
        daysSincePreviousEntry,
        daysAgoFromToday,
        duplicateLabels,
      });
    }
  }

  return results.sort((a, b) => b.entry.iso_ist.localeCompare(a.entry.iso_ist));
}

/**
 * Formats duplicate flags on an entry into a human-readable status string for tables/exports.
 */
export function formatEntryDuplicateStatus(entry: ConsumerEntryRecord): string {
  const flags: string[] = [];
  if (entry.duplicate_today) flags.push('DUPLICATE TODAY');
  if (entry.duplicate_30_days && !entry.duplicate_today) flags.push('30-DAY DUPLICATE');
  if (entry.duplicate_month && !entry.duplicate_today) flags.push('MONTHLY DUPLICATE');
  if (flags.length === 0) return 'UNIQUE';
  return flags.join(' · ');
}
