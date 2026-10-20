import React, { useState } from 'react';
import { Download } from 'lucide-react';
import {
  build30DayDuplicateReport,
  buildDailyDuplicationReport,
  dmyToYmd,
  formatEntryDuplicateStatus,
  getMonthYearFromDateIST,
  normalizeConsumerNumber,
  ymdToDmy,
  type ConsumerEntryRecord,
  type DeliveryManRecord,
} from '../utils/deduplication';
import {
  buildStandardExportRows,
  exportStandardRecordsFile,
  type ExportFormat,
} from '../utils/exportFiles';

interface ThirtyDayReportProps {
  entries: ConsumerEntryRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
}

export const ThirtyDayReportView: React.FC<ThirtyDayReportProps> = ({
  entries,
  todayIST,
  deliveryMenMap,
}) => {
  const [selectedDateYmd, setSelectedDateYmd] = useState(dmyToYmd(todayIST));
  const [windowMode, setWindowMode] = useState<'window_30_days' | 'on_date'>('window_30_days');

  const referenceDateIST = ymdToDmy(selectedDateYmd);
  const rows = build30DayDuplicateReport(entries, referenceDateIST, deliveryMenMap, windowMode);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              30-Day Duplicate Report ({referenceDateIST})
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Consumer Numbers re-entered within 30 calendar days of a previous entry. Entries 31 or more days apart do not trigger the 30-day duplicate warning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label htmlFor="report-30d-date" className="text-xs font-semibold text-slate-700">
                Reference Date:
              </label>
              <input
                id="report-30d-date"
                type="date"
                value={selectedDateYmd}
                onChange={(e) => setSelectedDateYmd(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setWindowMode('window_30_days')}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                  windowMode === 'window_30_days'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30-Day Window
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('on_date')}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                  windowMode === 'on_date'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                On {referenceDateIST} Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">30-Day Duplicate Matches</div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {rows.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Prior-Day Repeats (1–30 Days)</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {rows.filter((r) => r.daysSincePrevious > 0).length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Same-Day Repeats (0 Days)</div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 font-mono tabular-nums mt-1">
            {rows.filter((r) => r.daysSincePrevious === 0).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Consumers Entered Within Previous 30 Calendar Days
          </h2>
          <span className="text-xs font-mono text-slate-500">{rows.length} record(s)</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No 30-day duplicate entries found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-3 pr-3 font-medium">Consumer Number</th>
                  <th className="py-3 px-3 font-medium">Entry Date & Time</th>
                  <th className="py-3 px-3 font-medium">Previous Date</th>
                  <th className="py-3 px-3 font-medium">Previous Time</th>
                  <th className="py-3 px-3 font-medium">Delivery Man</th>
                  <th className="py-3 px-3 font-medium text-right">Days Since Previous Entry</th>
                  <th className="py-3 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.entryId} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-mono font-bold text-slate-900">
                      {row.consumerNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {row.entryDateIST} · {row.entryTimeIST}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.previousDateIST}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {row.previousTimeIST}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {row.deliveryManName}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-800 text-right tabular-nums whitespace-nowrap">
                      {row.daysSincePrevious === 0 ? '0 days (Same Day)' : `${row.daysSincePrevious} days`}
                    </td>
                    <td
                      className={`py-3 pl-3 font-mono font-bold text-xs whitespace-nowrap ${
                        row.daysSincePrevious === 0 ? 'text-red-600' : 'text-amber-700'
                      }`}
                    >
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface MonthlyReportProps {
  entries: ConsumerEntryRecord[];
  deliveryMen: DeliveryManRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
  agencyName: string;
  canExport: boolean;
}

const MONTH_NAMES = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const MonthlyReportView: React.FC<MonthlyReportProps> = ({
  entries,
  deliveryMen,
  todayIST,
  deliveryMenMap,
  usersMap,
  agencyName,
  canExport,
}) => {
  const [, defaultMonth, defaultYear] = todayIST.split('-');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth || '10');
  const [selectedYear, setSelectedYear] = useState(defaultYear || '2026');
  const [selectedDeliveryManId, setSelectedDeliveryManId] = useState('ALL');

  const targetMonthKey = `${selectedMonth}-${selectedYear}`;

  const monthEntries = entries
    .filter((e) => {
      const mKey = getMonthYearFromDateIST(e.entry_date_ist);
      if (mKey !== targetMonthKey) return false;
      if (selectedDeliveryManId !== 'ALL' && e.delivery_man_id !== selectedDeliveryManId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.iso_ist.localeCompare(a.iso_ist));

  // Compute monthly unique & duplicate consumers across the month
  const consumerCountMap = new Map<string, number>();
  const dateCountMap = new Map<string, number>();
  const dmCountMap = new Map<string, number>();

  for (const e of monthEntries) {
    const norm = normalizeConsumerNumber(e.consumer_number);
    consumerCountMap.set(norm, (consumerCountMap.get(norm) || 0) + 1);
    dateCountMap.set(e.entry_date_ist, (dateCountMap.get(e.entry_date_ist) || 0) + 1);
    dmCountMap.set(e.delivery_man_id, (dmCountMap.get(e.delivery_man_id) || 0) + 1);
  }

  let duplicateConsumers = 0;
  let totalDuplicateEntries = 0;
  for (const count of consumerCountMap.values()) {
    if (count >= 2) {
      duplicateConsumers += 1;
      totalDuplicateEntries += count;
    }
  }

  const dateBreakdown = Array.from(dateCountMap.entries()).sort((a, b) =>
    dmyToYmd(b[0]).localeCompare(dmyToYmd(a[0]))
  );

  const dmBreakdown = Array.from(dmCountMap.entries())
    .map(([dmId, count]) => ({
      dmId,
      name: deliveryMenMap[dmId] || 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const monthLabel = `${MONTH_NAMES.find((m) => m.value === selectedMonth)?.label || selectedMonth} ${selectedYear}`;

  const handleExport = (format: ExportFormat) => {
    const rows = buildStandardExportRows(monthEntries, deliveryMenMap, usersMap);
    exportStandardRecordsFile(
      rows,
      format,
      `Monthly_Report_${selectedMonth}_${selectedYear}`,
      `Monthly Report (${monthLabel})`,
      agencyName
    );
  };

  // Also check same-day duplicates in this month
  const dailySummaryInMonth = buildDailyDuplicationReport(monthEntries, deliveryMenMap, usersMap);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Monthly Report – {monthLabel}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Complete monthly consumer entries, duplicate analysis, date-wise counts, and delivery-man-wise counts.
            </p>
          </div>

          {canExport && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                className="min-h-[42px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="min-h-[42px] px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls: Month, Year, Delivery Man */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label htmlFor="monthly-select-month" className="block text-xs font-semibold text-slate-700 mb-1">
              Month
            </label>
            <select
              id="monthly-select-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            >
              {MONTH_NAMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} ({m.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="monthly-select-year" className="block text-xs font-semibold text-slate-700 mb-1">
              Year
            </label>
            <select
              id="monthly-select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div>
            <label htmlFor="monthly-select-dm" className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Man
            </label>
            <select
              id="monthly-select-dm"
              value={selectedDeliveryManId}
              onChange={(e) => setSelectedDeliveryManId(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="ALL">All Delivery Men</option>
              {deliveryMen.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.name} {dm.active ? '' : '(Inactive)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Monthly Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Entries</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {monthEntries.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Unique Consumers</div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {consumerCountMap.size}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Duplicate Consumers</div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 font-mono tabular-nums mt-1">
            {duplicateConsumers}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Duplicate Entries</div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {totalDuplicateEntries}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ({dailySummaryInMonth.duplicateConsumers} same-day dup groups)
          </div>
        </div>
      </div>

      {/* Date-wise & Delivery-man-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Date-wise Entry Count ({monthLabel})</h2>
          {dateBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">No entries in {monthLabel}.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dateBreakdown.map(([dateStr, count]) => (
                <div key={dateStr} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-mono font-semibold text-slate-800">{dateStr}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">{count} entries</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Delivery-Man-wise Entry Count ({monthLabel})</h2>
          {dmBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">No entries in {monthLabel}.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dmBreakdown.map((item) => (
                <div key={item.dmId} className="py-2.5 flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">{item.count} entries</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Entries for Selected Month */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">All Entries for {monthLabel}</h2>
          <span className="text-xs font-mono text-slate-500">{monthEntries.length} row(s)</span>
        </div>

        {monthEntries.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No consumer entries found for {monthLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-3 pr-3 font-medium">S.No.</th>
                  <th className="py-3 px-3 font-medium">Date</th>
                  <th className="py-3 px-3 font-medium">Time</th>
                  <th className="py-3 px-3 font-medium">Consumer Number</th>
                  <th className="py-3 px-3 font-medium">Delivery Man</th>
                  <th className="py-3 px-3 font-medium">Duplicate Status</th>
                  <th className="py-3 pl-3 font-medium">Entered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthEntries.map((entry, idx) => {
                  const norm = normalizeConsumerNumber(entry.consumer_number);
                  const monthOccurrences = consumerCountMap.get(norm) || 1;
                  const statusLabel = formatEntryDuplicateStatus(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {entry.entry_date_ist}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {entry.entry_time_ist}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {entry.consumer_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {deliveryMenMap[entry.delivery_man_id] || 'Unknown'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-xs font-semibold whitespace-nowrap ${
                          entry.duplicate_today
                            ? 'text-red-600'
                            : monthOccurrences >= 2 || entry.duplicate_30_days
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {statusLabel}
                        {monthOccurrences >= 2 ? ` (${monthOccurrences}x in month)` : ''}
                      </td>
                      <td className="py-2.5 pl-3 text-xs text-slate-500">
                        {usersMap[entry.created_by] || 'Unknown'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
