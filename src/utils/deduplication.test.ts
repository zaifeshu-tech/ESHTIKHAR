import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConsumerNumber,
  autoFetchCustomer,
  suggestCustomers,
  formatIST,
  calculateCalendarDaysBetweenIST,
  evaluateDuplicateStatus,
  buildDailyDuplicationReport,
  build30DayDuplicateReport,
  buildConsumerSearchHistory,
  type ConsumerEntryRecord,
  type CustomerRecord,
} from './deduplication.ts';

const mockDeliveryMen: Record<string, string> = {
  dm1: 'Raksharam',
  dm2: 'Asad',
  dm3: 'Suresh',
  dm4: 'Imran',
};

const mockUsers: Record<string, string> = {
  u1: 'Eshtikhar',
  u2: 'Ravi Kumar',
};

test('Consumer Number normalization preserves leading zeros, strips spaces, and normalizes BH-0, CX, DX prefixes', () => {
  assert.equal(normalizeConsumerNumber('0012345678'), '0012345678');
  assert.equal(normalizeConsumerNumber('  0012 3456 78  '), '0012345678');
  assert.equal(normalizeConsumerNumber('70000123456789012'), '70000123456789012');
  assert.equal(normalizeConsumerNumber(' bh-0 10234 '), 'BH-010234');
  assert.equal(normalizeConsumerNumber('cx005566'), 'CX005566');
  assert.equal(normalizeConsumerNumber('dx-998800'), 'DX-998800');
});

test('Auto-fetch customer matches BH-0, CX, DX and standard consumer numbers accurately', () => {
  const sampleCustomers: CustomerRecord[] = [
    {
      id: 'c1',
      consumer_number: 'BH-01001',
      customer_name: 'Mohammad Irfan',
      mobile: '9876543210',
      address: 'Ward 4, Civil Lines',
      created_at: '01-01-2026',
      updated_at: '01-01-2026',
    },
    {
      id: 'c2',
      consumer_number: 'CX2001',
      customer_name: 'Sunita Devi',
      mobile: '9123456780',
      address: 'Station Road',
      created_at: '01-01-2026',
      updated_at: '01-01-2026',
    },
    {
      id: 'c3',
      consumer_number: 'DX3001',
      customer_name: 'Anwar Hussain',
      mobile: '9988776655',
      address: 'Market Chowk',
      created_at: '01-01-2026',
      updated_at: '01-01-2026',
    },
  ];

  const matchBH = autoFetchCustomer('bh-01001', sampleCustomers);
  assert.equal(matchBH?.customer_name, 'Mohammad Irfan');

  const matchCX = autoFetchCustomer('CX 2001', sampleCustomers);
  assert.equal(matchCX?.customer_name, 'Sunita Devi');

  const matchDX = autoFetchCustomer('DX3001', sampleCustomers);
  assert.equal(matchDX?.customer_name, 'Anwar Hussain');

  const suggestions = suggestCustomers('BH-0', sampleCustomers);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].consumer_number, 'BH-01001');
});

test('IST date and time formatting uses Asia/Kolkata (UTC+05:30)', () => {
  // 2026-10-05T12:12:18Z is 2026-10-05 05:42:18 PM IST
  const utcDate = new Date('2026-10-05T12:12:18.000Z');
  const ist = formatIST(utcDate);
  assert.equal(ist.dateIST, '05-10-2026');
  assert.equal(ist.ymdIST, '2026-10-05');
  assert.equal(ist.monthKeyIST, '10-2026');
  assert.equal(ist.timeIST, '05:42:18 PM');
  assert.equal(ist.timestampIST, '05-10-2026 | 05:42:18 PM');
});

test('Calendar day difference in IST works accurately across month boundaries', () => {
  assert.equal(calculateCalendarDaysBetweenIST('25-09-2026', '05-10-2026'), 10);
  assert.equal(calculateCalendarDaysBetweenIST('04-09-2026', '05-10-2026'), 31);
  assert.equal(calculateCalendarDaysBetweenIST('05-10-2026', '05-10-2026'), 0);
});

test('Duplicate detection rules: New Consumer, Duplicate Today, 10-Day Duplicate, 31+ Days (No 30-Day warning), and Monthly Duplicate', () => {
  const sampleEntries: ConsumerEntryRecord[] = [
    {
      id: 'e1',
      consumer_number: '0012345678',
      entry_date_ist: '05-10-2026',
      entry_time_ist: '09:15:00 AM',
      timestamp_ist: '05-10-2026 | 09:15:00 AM',
      iso_ist: '2026-10-05T09:15:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-05T09:15:00+05:30',
    },
    {
      id: 'e2',
      consumer_number: '1234567890',
      entry_date_ist: '25-09-2026',
      entry_time_ist: '11:20:00 AM',
      timestamp_ist: '25-09-2026 | 11:20:00 AM',
      iso_ist: '2026-09-25T11:20:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-09-25T11:20:00+05:30',
    },
    {
      id: 'e3',
      consumer_number: '9999900001',
      entry_date_ist: '01-09-2026', // 34 days before 05-10-2026
      entry_time_ist: '10:00:00 AM',
      timestamp_ist: '01-09-2026 | 10:00:00 AM',
      iso_ist: '2026-09-01T10:00:00+05:30',
      delivery_man_id: 'dm2',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-09-01T10:00:00+05:30',
    },
    {
      id: 'e4',
      consumer_number: '5555544444',
      entry_date_ist: '02-10-2026', // Same month (October 2026) and 3 days before 05-10-2026
      entry_time_ist: '03:10:00 PM',
      timestamp_ist: '02-10-2026 | 03:10:00 PM',
      iso_ist: '2026-10-02T15:10:00+05:30',
      delivery_man_id: 'dm3',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u2',
      created_at: '2026-10-02T15:10:00+05:30',
    },
  ];

  // Case 1: Brand new consumer number -> no duplicates
  const checkNew = evaluateDuplicateStatus('8888877777', sampleEntries, '05-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(checkNew.hasAnyDuplicate, false);
  assert.equal(checkNew.isDuplicateToday, false);
  assert.equal(checkNew.isDuplicate30Days, false);
  assert.equal(checkNew.isDuplicateMonth, false);

  // Case 2: Same consumer number entered today (with spaces around it) -> Duplicate Today, 30-Days, and Month
  const checkToday = evaluateDuplicateStatus(' 0012345678 ', sampleEntries, '05-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(checkToday.isDuplicateToday, true);
  assert.equal(checkToday.todayMatches.length, 1);
  assert.equal(checkToday.latestTodayMatch?.deliveryManName, 'Raksharam');

  // Case 3: Consumer entered 10 days ago (25-09-2026 vs 05-10-2026) -> 30-Day warning only
  const check10Days = evaluateDuplicateStatus('1234567890', sampleEntries, '05-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(check10Days.isDuplicateToday, false);
  assert.equal(check10Days.isDuplicate30Days, true);
  assert.equal(check10Days.isDuplicateMonth, false);
  assert.equal(check10Days.latest30DaysMatch?.daysAgo, 10);
  assert.equal(check10Days.latest30DaysMatch?.deliveryManName, 'Raksharam');

  // Case 4: Consumer entered 34 days ago (01-09-2026 vs 05-10-2026) -> No 30-Day warning
  const check34Days = evaluateDuplicateStatus('9999900001', sampleEntries, '05-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(check34Days.hasAnyDuplicate, false);
  assert.equal(check34Days.isDuplicate30Days, false);

  // Case 5: Consumer entered earlier in same calendar month (02-10-2026 vs 05-10-2026) -> Monthly + 30-Day warning
  const checkMonth = evaluateDuplicateStatus('5555544444', sampleEntries, '05-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(checkMonth.isDuplicateToday, false);
  assert.equal(checkMonth.isDuplicateMonth, true);
  assert.equal(checkMonth.isDuplicate30Days, true);
});

test('Daily Duplication Report shows only Consumer Numbers entered 2 or more times on the same date', () => {
  const dayEntries: ConsumerEntryRecord[] = [
    {
      id: 'd1',
      consumer_number: '1234567890',
      entry_date_ist: '05-10-2026',
      entry_time_ist: '09:15:00 AM',
      timestamp_ist: '05-10-2026 | 09:15:00 AM',
      iso_ist: '2026-10-05T09:15:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-05T09:15:00+05:30',
    },
    {
      id: 'd2',
      consumer_number: '1234567890',
      entry_date_ist: '05-10-2026',
      entry_time_ist: '02:35:00 PM',
      timestamp_ist: '05-10-2026 | 02:35:00 PM',
      iso_ist: '2026-10-05T14:35:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: true,
      duplicate_30_days: true,
      duplicate_month: true,
      created_by: 'u1',
      created_at: '2026-10-05T14:35:00+05:30',
    },
    {
      id: 'd3',
      consumer_number: '0011223344',
      entry_date_ist: '05-10-2026',
      entry_time_ist: '10:00:00 AM',
      timestamp_ist: '05-10-2026 | 10:00:00 AM',
      iso_ist: '2026-10-05T10:00:00+05:30',
      delivery_man_id: 'dm2',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-05T10:00:00+05:30',
    },
  ];

  const report = buildDailyDuplicationReport(dayEntries, mockDeliveryMen, mockUsers);
  assert.equal(report.totalEntries, 3);
  assert.equal(report.uniqueConsumers, 2);
  assert.equal(report.duplicateConsumers, 1);
  assert.equal(report.totalDuplicateEntries, 2);
  assert.equal(report.groups.length, 1);
  assert.equal(report.groups[0].consumerNumber, '1234567890');
  assert.equal(report.groups[0].entryCount, 2);
  assert.equal(report.groups[0].firstTime, '09:15:00 AM');
  assert.equal(report.groups[0].lastTime, '02:35:00 PM');
  assert.equal(report.groups[0].deliveryManSummary, 'Raksharam');
});

test('30-Day Duplicate Report includes 10-day duplicate and excludes 31+ day gap', () => {
  const entries: ConsumerEntryRecord[] = [
    {
      id: 'a1',
      consumer_number: '1234567890',
      entry_date_ist: '25-09-2026',
      entry_time_ist: '09:00:00 AM',
      timestamp_ist: '25-09-2026 | 09:00:00 AM',
      iso_ist: '2026-09-25T09:00:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-09-25T09:00:00+05:30',
    },
    {
      id: 'a2',
      consumer_number: '1234567890',
      entry_date_ist: '05-10-2026', // 10 days after 25-09-2026
      entry_time_ist: '11:00:00 AM',
      timestamp_ist: '05-10-2026 | 11:00:00 AM',
      iso_ist: '2026-10-05T11:00:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: true,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-05T11:00:00+05:30',
    },
    {
      id: 'b1',
      consumer_number: '7777788888',
      entry_date_ist: '01-09-2026',
      entry_time_ist: '09:00:00 AM',
      timestamp_ist: '01-09-2026 | 09:00:00 AM',
      iso_ist: '2026-09-01T09:00:00+05:30',
      delivery_man_id: 'dm2',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-09-01T09:00:00+05:30',
    },
    {
      id: 'b2',
      consumer_number: '7777788888',
      entry_date_ist: '05-10-2026', // 34 days after 01-09-2026 -> NOT a 30-day duplicate
      entry_time_ist: '12:00:00 PM',
      timestamp_ist: '05-10-2026 | 12:00:00 PM',
      iso_ist: '2026-10-05T12:00:00+05:30',
      delivery_man_id: 'dm2',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-05T12:00:00+05:30',
    },
  ];

  const rows = build30DayDuplicateReport(entries, '05-10-2026', mockDeliveryMen, 'window_30_days');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].consumerNumber, '1234567890');
  assert.equal(rows[0].daysSincePrevious, 10);
  assert.equal(rows[0].previousDateIST, '25-09-2026');
});

test('Search Consumer calculates daysSincePreviousEntry accurately', () => {
  const entries: ConsumerEntryRecord[] = [
    {
      id: 's1',
      consumer_number: '0055667788',
      entry_date_ist: '10-10-2026',
      entry_time_ist: '10:00:00 AM',
      timestamp_ist: '10-10-2026 | 10:00:00 AM',
      iso_ist: '2026-10-10T10:00:00+05:30',
      delivery_man_id: 'dm1',
      duplicate_today: false,
      duplicate_30_days: false,
      duplicate_month: false,
      created_by: 'u1',
      created_at: '2026-10-10T10:00:00+05:30',
    },
    {
      id: 's2',
      consumer_number: '0055667788',
      entry_date_ist: '20-10-2026',
      entry_time_ist: '02:00:00 PM',
      timestamp_ist: '20-10-2026 | 02:00:00 PM',
      iso_ist: '2026-10-20T14:00:00+05:30',
      delivery_man_id: 'dm2',
      duplicate_today: false,
      duplicate_30_days: true,
      duplicate_month: true,
      created_by: 'u2',
      created_at: '2026-10-20T14:00:00+05:30',
    },
  ];

  const history = buildConsumerSearchHistory('0055667788', entries, '20-10-2026', mockDeliveryMen, mockUsers);
  assert.equal(history.length, 2);
  // Newest first
  assert.equal(history[0].entry.id, 's2');
  assert.equal(history[0].daysSincePreviousEntry, 10);
  assert.equal(history[1].entry.id, 's1');
  assert.equal(history[1].daysSincePreviousEntry, null);
});
