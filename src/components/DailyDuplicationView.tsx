import React, { useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import {
  addDaysIST,
  buildDailyDuplicationReport,
  dmyToYmd,
  ymdToDmy,
  type ConsumerEntryRecord,
  type DailyDuplicateGroup,
} from '../utils/deduplication';
import {
  buildDuplicateReportExportRows,
  exportDuplicateReportFile,
  type ExportFormat,
} from '../utils/exportFiles';

interface DailyDuplicationViewProps {
  entries: ConsumerEntryRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
  agencyName: string;
  canExport: boolean;
}

type DateFilterMode = 'today' | 'yesterday' | 'select_date' | 'date_range';

export const DailyDuplicationView: React.FC<DailyDuplicationViewProps> = ({
  entries,
  todayIST,
  deliveryMenMap,
  usersMap,
  agencyName,
  canExport,
}) => {
  const yesterdayIST = addDaysIST(todayIST, -1);
  const [filterMode, setFilterMode] = useState<DateFilterMode>('today');
  const [selectedDateYmd, setSelectedDateYmd] = useState(dmyToYmd(todayIST));
  const [rangeStartYmd, setRangeStartYmd] = useState(dmyToYmd(addDaysIST(todayIST, -7)));
  const [rangeEndYmd, setRangeEndYmd] = useState(dmyToYmd(todayIST));
  const [selectedGroup, setSelectedGroup] = useState<DailyDuplicateGroup | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const entryYmd = dmyToYmd(entry.entry_date_ist);
    if (filterMode === 'today') {
      return entry.entry_date_ist === todayIST;
    }
    if (filterMode === 'yesterday') {
      return entry.entry_date_ist === yesterdayIST;
    }
    if (filterMode === 'select_date') {
      return entryYmd === selectedDateYmd;
    }
    if (filterMode === 'date_range') {
      return entryYmd >= rangeStartYmd && entryYmd <= rangeEndYmd;
    }
    return true;
  });

  const report = buildDailyDuplicationReport(filteredEntries, deliveryMenMap, usersMap);

  const activeDateLabel =
    filterMode === 'today'
      ? todayIST
      : filterMode === 'yesterday'
      ? yesterdayIST
      : filterMode === 'select_date'
      ? ymdToDmy(selectedDateYmd)
      : `${ymdToDmy(rangeStartYmd)} to ${ymdToDmy(rangeEndYmd)}`;

  const handleExport = (format: ExportFormat) => {
    const rows = buildDuplicateReportExportRows(report.groups);
    exportDuplicateReportFile(
      rows,
      format,
      `Daily_Duplication_Report_${activeDateLabel}`,
      `Daily Duplication Report (${activeDateLabel})`,
      agencyName
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Daily Duplication Summary – {activeDateLabel}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Displays only Consumer Numbers entered two or more times on the same IST date. Click any Consumer Number to view all entries made that day.
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

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterMode('today')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today ({todayIST})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('yesterday')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'yesterday' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday ({yesterdayIST})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('select_date')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'select_date' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Select Date
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('date_range')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'date_range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Date Range
            </button>
          </div>

          {filterMode === 'select_date' && (
            <div className="flex items-center gap-2">
              <label htmlFor="daily-dup-date" className="text-xs font-medium text-slate-600">
                Date:
              </label>
              <input
                id="daily-dup-date"
                type="date"
                value={selectedDateYmd}
                onChange={(e) => setSelectedDateYmd(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          )}

          {filterMode === 'date_range' && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="daily-dup-start" className="text-xs font-medium text-slate-600">
                From:
              </label>
              <input
                id="daily-dup-start"
                type="date"
                value={rangeStartYmd}
                onChange={(e) => setRangeStartYmd(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
              <label htmlFor="daily-dup-end" className="text-xs font-medium text-slate-600">
                To:
              </label>
              <input
                id="daily-dup-end"
                type="date"
                value={rangeEndYmd}
                onChange={(e) => setRangeEndYmd(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Section 12: Daily Duplication Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Entries</div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {report.totalEntries}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Unique Consumers</div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {report.uniqueConsumers}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Duplicate Consumers</div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 font-mono tabular-nums mt-1">
            {report.duplicateConsumers}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Duplicate Entries</div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {report.totalDuplicateEntries}
          </div>
        </div>
      </div>

      {/* Delivery-Man-wise Duplicate Count */}
      {report.deliveryManDuplicateCounts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Delivery-Man-wise Duplicate Count</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.deliveryManDuplicateCounts.map((dm) => (
              <div key={dm.deliveryManId} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm font-bold text-slate-900">{dm.deliveryManName}</div>
                <div className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
                  {dm.duplicateConsumersCount} consumer(s) · {dm.duplicateEntriesCount} duplicate entries
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 11: Repeated Consumer Numbers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Repeated Consumer Numbers (2+ Entries on Same Date)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {report.groups.length} duplicate group(s)
          </span>
        </div>

        {report.groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No Consumer Numbers were entered two or more times for {activeDateLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-3 pr-3 font-medium">S.No.</th>
                  {filterMode === 'date_range' && <th className="py-3 px-3 font-medium">Date</th>}
                  <th className="py-3 px-3 font-medium">Consumer Number</th>
                  <th className="py-3 px-3 font-medium text-right">Entries</th>
                  <th className="py-3 px-3 font-medium">First Time</th>
                  <th className="py-3 px-3 font-medium">Last Time</th>
                  <th className="py-3 px-3 font-medium">Delivery Man</th>
                  <th className="py-3 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.groups.map((group, idx) => (
                  <tr
                    key={`${group.dateIST}-${group.consumerNumber}`}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 pr-3 font-mono text-slate-500 tabular-nums">{idx + 1}</td>
                    {filterMode === 'date_range' && (
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">{group.dateIST}</td>
                    )}
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedGroup(group)}
                        className="font-mono font-bold text-slate-900 hover:text-red-700 underline underline-offset-4 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{group.consumerNumber}</span>
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-red-600 text-right tabular-nums">
                      {group.entryCount}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">{group.firstTime}</td>
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">{group.lastTime}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{group.deliveryManSummary}</td>
                    <td className="py-3 pl-3 font-mono font-bold text-xs text-red-600 whitespace-nowrap">
                      {group.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down Modal when clicking a Consumer Number */}
      {selectedGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consumer-drilldown-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 id="consumer-drilldown-title" className="text-lg font-bold text-slate-900 font-mono">
                  Consumer No. {selectedGroup.consumerNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  All entries recorded on {selectedGroup.dateIST}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close Consumer Entry Details"
                onClick={() => setSelectedGroup(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              {selectedGroup.entries.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 font-mono text-xs sm:text-sm"
                >
                  <div>
                    <span className="font-bold text-slate-900">{index + 1}.</span>{' '}
                    <span>{item.dateIST}</span> – <span className="font-semibold">{item.timeIST}</span> –{' '}
                    <span className="font-sans font-bold text-slate-900">{item.deliveryManName}</span>
                  </div>
                  <span className="font-sans text-[11px] text-slate-500">by {item.createdByName}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 font-mono">
                Total: {selectedGroup.entryCount} entries
              </span>
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
