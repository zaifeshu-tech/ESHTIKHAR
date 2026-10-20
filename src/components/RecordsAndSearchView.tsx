import React, { useMemo, useState } from 'react';
import { Edit2, Search, Trash2, X } from 'lucide-react';
import {
  CONSUMER_PREFIXES,
  addDaysIST,
  autoFetchCustomer,
  buildConsumerSearchHistory,
  dmyToYmd,
  formatEntryDuplicateStatus,
  getMonthYearFromDateIST,
  normalizeConsumerNumber,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type DeliveryManRecord,
} from '../utils/deduplication';

type RecordsFilterType =
  | 'today'
  | 'yesterday'
  | 'specific_date'
  | 'date_range'
  | 'current_month'
  | 'previous_month'
  | 'custom_month';

interface RecordsViewProps {
  entries: ConsumerEntryRecord[];
  customers: CustomerRecord[];
  deliveryMen: DeliveryManRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
  isAdmin: boolean;
  onEditEntry: (id: string, newConsumerNumber: string, newDeliveryManId: string) => void;
  onDeleteEntry: (id: string) => void;
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  entries,
  customers,
  deliveryMen,
  todayIST,
  deliveryMenMap,
  usersMap,
  isAdmin,
  onEditEntry,
  onDeleteEntry,
}) => {
  // Memoized customer map for 0ms lookup even with 50,000+ customers
  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerRecord>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      map.set(normalizeConsumerNumber(c.consumer_number), c);
    }
    return map;
  }, [customers]);

  const yesterdayIST = addDaysIST(todayIST, -1);
  const [, curMonth, curYear] = todayIST.split('-');
  const prevMonthNum = parseInt(curMonth || '10', 10) - 1;
  const prevMonthKey =
    prevMonthNum >= 1
      ? `${String(prevMonthNum).padStart(2, '0')}-${curYear}`
      : `12-${parseInt(curYear || '2026', 10) - 1}`;

  const [filterType, setFilterType] = useState<RecordsFilterType>('today');
  const [specificDateYmd, setSpecificDateYmd] = useState(dmyToYmd(todayIST));
  const [rangeStartYmd, setRangeStartYmd] = useState(dmyToYmd(addDaysIST(todayIST, -7)));
  const [rangeEndYmd, setRangeEndYmd] = useState(dmyToYmd(todayIST));
  const [customMonth, setCustomMonth] = useState(curMonth || '10');
  const [customYear, setCustomYear] = useState(curYear || '2026');
  const [deliveryManFilter, setDeliveryManFilter] = useState('ALL');

  // Admin Edit & Delete Modals
  const [editingEntry, setEditingEntry] = useState<ConsumerEntryRecord | null>(null);
  const [editConsumerNumber, setEditConsumerNumber] = useState('');
  const [editDeliveryManId, setEditDeliveryManId] = useState('');
  const [deletingEntry, setDeletingEntry] = useState<ConsumerEntryRecord | null>(null);

  const filteredEntries = entries
    .filter((entry) => {
      if (deliveryManFilter !== 'ALL' && entry.delivery_man_id !== deliveryManFilter) {
        return false;
      }
      const entryYmd = dmyToYmd(entry.entry_date_ist);
      const entryMonthKey = getMonthYearFromDateIST(entry.entry_date_ist);

      switch (filterType) {
        case 'today':
          return entry.entry_date_ist === todayIST;
        case 'yesterday':
          return entry.entry_date_ist === yesterdayIST;
        case 'specific_date':
          return entryYmd === specificDateYmd;
        case 'date_range':
          return entryYmd >= rangeStartYmd && entryYmd <= rangeEndYmd;
        case 'current_month':
          return entryMonthKey === `${curMonth}-${curYear}`;
        case 'previous_month':
          return entryMonthKey === prevMonthKey;
        case 'custom_month':
          return entryMonthKey === `${customMonth}-${customYear}`;
        default:
          return true;
      }
    })
    .sort((a, b) => b.iso_ist.localeCompare(a.iso_ist));

  const openEditModal = (entry: ConsumerEntryRecord) => {
    setEditingEntry(entry);
    setEditConsumerNumber(entry.consumer_number);
    setEditDeliveryManId(entry.delivery_man_id);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const norm = normalizeConsumerNumber(editConsumerNumber);
    if (!norm || !editDeliveryManId) return;
    onEditEntry(editingEntry.id, norm, editDeliveryManId);
    setEditingEntry(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Date-Wise Consumer Records</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Filter by Today, Yesterday, Specific Date, Date Range, Current Month, Previous Month, or Custom Month.
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700">
            Showing {filteredEntries.length} record(s)
          </div>
        </div>

        {/* 7 Filter Mode Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl">
          {[
            { id: 'today', label: `Today (${todayIST})` },
            { id: 'yesterday', label: `Yesterday (${yesterdayIST})` },
            { id: 'specific_date', label: 'Specific Date' },
            { id: 'date_range', label: 'Date Range' },
            { id: 'current_month', label: 'Current Month' },
            { id: 'previous_month', label: 'Previous Month' },
            { id: 'custom_month', label: 'Custom Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as RecordsFilterType)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Secondary Filter Controls */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
          {filterType === 'specific_date' && (
            <div className="flex items-center gap-2">
              <label htmlFor="records-specific-date" className="text-xs font-semibold text-slate-700">
                Select Date:
              </label>
              <input
                id="records-specific-date"
                type="date"
                value={specificDateYmd}
                onChange={(e) => setSpecificDateYmd(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          )}

          {filterType === 'date_range' && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="records-range-start" className="text-xs font-semibold text-slate-700">
                From:
              </label>
              <input
                id="records-range-start"
                type="date"
                value={rangeStartYmd}
                onChange={(e) => setRangeStartYmd(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
              <label htmlFor="records-range-end" className="text-xs font-semibold text-slate-700">
                To:
              </label>
              <input
                id="records-range-end"
                type="date"
                value={rangeEndYmd}
                onChange={(e) => setRangeEndYmd(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              />
            </div>
          )}

          {filterType === 'custom_month' && (
            <div className="flex items-center gap-2">
              <label htmlFor="records-custom-month" className="text-xs font-semibold text-slate-700">
                Month:
              </label>
              <select
                id="records-custom-month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {[
                  ['01', 'Jan'],
                  ['02', 'Feb'],
                  ['03', 'Mar'],
                  ['04', 'Apr'],
                  ['05', 'May'],
                  ['06', 'Jun'],
                  ['07', 'Jul'],
                  ['08', 'Aug'],
                  ['09', 'Sep'],
                  ['10', 'Oct'],
                  ['11', 'Nov'],
                  ['12', 'Dec'],
                ].map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl} ({val})
                  </option>
                ))}
              </select>
              <label htmlFor="records-custom-year" className="text-xs font-semibold text-slate-700">
                Year:
              </label>
              <select
                id="records-custom-year"
                value={customYear}
                onChange={(e) => setCustomYear(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="records-dm-filter" className="text-xs font-semibold text-slate-700">
              Delivery Man:
            </label>
            <select
              id="records-dm-filter"
              value={deliveryManFilter}
              onChange={(e) => setDeliveryManFilter(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
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

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No consumer records match the selected date filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-3 pr-3 font-medium">Date</th>
                  <th className="py-3 px-3 font-medium">Time</th>
                  <th className="py-3 px-3 font-medium">Consumer Number</th>
                  <th className="py-3 px-3 font-medium">Customer Name</th>
                  <th className="py-3 px-3 font-medium">Delivery Man</th>
                  <th className="py-3 px-3 font-medium">Duplicate Status</th>
                  <th className="py-3 px-3 font-medium">Entered By</th>
                  {isAdmin && <th className="py-3 pl-3 font-medium text-right">Admin Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const statusText = formatEntryDuplicateStatus(entry);
                  const isDup =
                    entry.duplicate_today || entry.duplicate_30_days || entry.duplicate_month;
                  const dmObj = deliveryMen.find((d) => d.id === entry.delivery_man_id);
                  const custName =
                    entry.customer_name ||
                    autoFetchCustomer(entry.consumer_number, customers, customerMap)?.customer_name ||
                    '—';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-mono text-slate-700 whitespace-nowrap">
                        {entry.entry_date_ist}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {entry.entry_time_ist}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {entry.consumer_number}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {custName}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                        {deliveryMenMap[entry.delivery_man_id] || 'Unknown'}
                        {dmObj && !dmObj.active ? (
                          <span className="text-[11px] text-slate-400 ml-1">(Inactive)</span>
                        ) : null}
                      </td>
                      <td
                        className={`py-3 px-3 text-xs font-semibold whitespace-nowrap ${
                          entry.duplicate_today
                            ? 'text-red-600'
                            : isDup
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {statusText}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                        {usersMap[entry.created_by] || 'Unknown'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit entry ${entry.consumer_number}`}
                              onClick={() => openEditModal(entry)}
                              className="min-h-[36px] min-w-[36px] px-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 inline-flex items-center justify-center cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete entry ${entry.consumer_number}`}
                              onClick={() => setDeletingEntry(entry)}
                              className="min-h-[36px] min-w-[36px] px-2 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Edit Entry Modal */}
      {editingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-entry-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="edit-entry-title" className="text-lg font-bold text-slate-900">
                Correct Consumer Entry (Audit Logged)
              </h3>
              <button
                type="button"
                aria-label="Close Edit Modal"
                onClick={() => setEditingEntry(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-consumer-num" className="block text-xs font-semibold text-slate-700 mb-1">
                  Consumer Number (BH-0, CX, DX or Numeric)
                </label>
                <input
                  id="edit-consumer-num"
                  type="text"
                  value={editConsumerNumber}
                  onChange={(e) => setEditConsumerNumber(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 font-mono font-bold text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="edit-dm-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery Man
                </label>
                <select
                  id="edit-dm-select"
                  value={editDeliveryManId}
                  onChange={(e) => setEditDeliveryManId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                >
                  {deliveryMen.map((dm) => (
                    <option key={dm.id} value={dm.id}>
                      {dm.name} {dm.active ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Entry Confirmation Modal */}
      {deletingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-entry-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 id="delete-entry-title" className="text-lg font-bold text-slate-900">
              Confirm Delete Record
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Are you sure you want to delete Consumer Number{' '}
              <strong className="font-mono text-slate-900">{deletingEntry.consumer_number}</strong> recorded on{' '}
              <span className="font-mono">{deletingEntry.timestamp_ist}</span>? This action will be permanently recorded in the Audit Log.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteEntry(deletingEntry.id);
                  setDeletingEntry(null);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SearchConsumerViewProps {
  entries: ConsumerEntryRecord[];
  customers: CustomerRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
}

export const SearchConsumerView: React.FC<SearchConsumerViewProps> = ({
  entries,
  customers,
  todayIST,
  deliveryMenMap,
  usersMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized customer map for 0ms lookup even with 50,000+ customers
  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerRecord>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      map.set(normalizeConsumerNumber(c.consumer_number), c);
    }
    return map;
  }, [customers]);

  const results = buildConsumerSearchHistory(
    searchQuery,
    entries,
    todayIST,
    deliveryMenMap,
    usersMap,
    false
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Search Consumer History</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Enter a Consumer Number (BH-0, CX, DX or numeric) to view all previous entries, Customer Name, IST timestamps, Delivery Man, duplicate status, and days since previous entry.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Prefix:</span>
            {CONSUMER_PREFIXES.map((prefix) => (
              <button
                key={prefix}
                type="button"
                onClick={() => setSearchQuery(prefix)}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-mono font-bold text-xs cursor-pointer"
              >
                {prefix}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="search-consumer-input"
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Consumer Number (e.g. BH-01001, CX2001, DX3001, 0012345678)"
            className="w-full min-h-[54px] pl-12 pr-10 py-3 text-base sm:text-lg font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:border-slate-900 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear Search Query"
              onClick={() => setSearchQuery('')}
              className="min-h-[44px] min-w-[44px] absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Quick Consumer Lookup Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Quick Lookup:</span>
          {['BH-01001', 'CX2001', 'DX3001', '0012345678', '1234567890', '0045678901'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setSearchQuery(num)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-semibold cursor-pointer"
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            {searchQuery
              ? `Matching History for "${normalizeConsumerNumber(searchQuery)}"`
              : 'Enter a Consumer Number Above'}
          </h2>
          {searchQuery && (
            <span className="text-xs font-mono font-semibold text-slate-600">
              {results.length} matching entry(s)
            </span>
          )}
        </div>

        {!searchQuery ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Type any full or partial Consumer Number above (or tap a Quick Lookup number) to inspect its complete delivery and duplicate history.
          </div>
        ) : results.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No previous entries found for Consumer Number <strong className="font-mono">{normalizeConsumerNumber(searchQuery)}</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-3 pr-3 font-medium">Consumer Number</th>
                  <th className="py-3 px-3 font-medium">Customer Name</th>
                  <th className="py-3 px-3 font-medium">Date (IST)</th>
                  <th className="py-3 px-3 font-medium">Time (IST)</th>
                  <th className="py-3 px-3 font-medium">Delivery Man</th>
                  <th className="py-3 px-3 font-medium">Entered By (Staff)</th>
                  <th className="py-3 px-3 font-medium">Duplicate Status</th>
                  <th className="py-3 pl-3 font-medium text-right">Days Since Previous Entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((item) => {
                  const statusLabel = formatEntryDuplicateStatus(item.entry);
                  const isDup =
                    item.entry.duplicate_today ||
                    item.entry.duplicate_30_days ||
                    item.entry.duplicate_month;
                  const custName =
                    item.entry.customer_name ||
                    autoFetchCustomer(item.entry.consumer_number, customers, customerMap)?.customer_name ||
                    '—';
                  return (
                    <tr key={item.entry.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-mono font-bold text-slate-900">
                        {item.entry.consumer_number}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {custName}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800 whitespace-nowrap">
                        {item.entry.entry_date_ist}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {item.entry.entry_time_ist}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {item.deliveryManName}
                      </td>
                      <td className="py-3 px-3 text-slate-700">{item.enteredByName}</td>
                      <td
                        className={`py-3 px-3 text-xs font-semibold whitespace-nowrap ${
                          item.entry.duplicate_today
                            ? 'text-red-600'
                            : isDup
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {statusLabel}
                      </td>
                      <td className="py-3 pl-3 font-mono text-right tabular-nums whitespace-nowrap">
                        {item.daysSincePreviousEntry === null ? (
                          <span className="text-slate-500">First entry ({item.daysAgoFromToday}d ago)</span>
                        ) : item.daysSincePreviousEntry === 0 ? (
                          <span className="font-bold text-red-600">0 days (Same Day)</span>
                        ) : (
                          <span className="font-bold text-amber-800">
                            {item.daysSincePreviousEntry} days after previous
                          </span>
                        )}
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
