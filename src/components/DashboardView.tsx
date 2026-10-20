import React, { useMemo } from 'react';
import {
  PlusCircle,
  CopyCheck,
  CalendarRange,
  CalendarClock,
  Search,
  Download,
  Truck,
  Users,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  UserCheck,
  Cloud,
} from 'lucide-react';
import {
  autoFetchCustomer,
  buildDailyDuplicationReport,
  calculateCalendarDaysBetweenIST,
  formatEntryDuplicateStatus,
  getMonthYearFromDateIST,
  normalizeConsumerNumber,
  type ConsumerEntryRecord,
  type CustomerRecord,
  type DeliveryManRecord,
  type PermissionKey,
  type UserRecord,
} from '../utils/deduplication';

export type NavSection =
  | 'dashboard'
  | 'new_entry'
  | 'customer_register'
  | 'records'
  | 'search_consumer'
  | 'daily_duplication'
  | 'report_30_day'
  | 'monthly_report'
  | 'export'
  | 'download_app'
  | 'google_drive'
  | 'gemini_chat'
  | 'three_3d'
  | 'science_lab'
  | 'delivery_men'
  | 'staff_management'
  | 'settings';

interface DashboardViewProps {
  currentUser: UserRecord;
  hasPermission: (perm: PermissionKey) => boolean;
  onNavigate: (section: NavSection) => void;
  entries: ConsumerEntryRecord[];
  customers: CustomerRecord[];
  deliveryMen: DeliveryManRecord[];
  users: UserRecord[];
  todayIST: string;
  currentTimestampIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  hasPermission,
  onNavigate,
  entries,
  customers,
  deliveryMen,
  users,
  todayIST,
  currentTimestampIST,
  deliveryMenMap,
  usersMap,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const currentMonthYear = getMonthYearFromDateIST(todayIST);

  // Memoized customer map for 0ms lookup even with 50,000+ customers
  const customerMap = useMemo(() => {
    const map = new Map<string, CustomerRecord>();
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      map.set(normalizeConsumerNumber(c.consumer_number), c);
    }
    return map;
  }, [customers]);

  // 1. Today's stats
  const todayEntries = entries.filter((e) => e.entry_date_ist === todayIST);
  const todayReport = buildDailyDuplicationReport(todayEntries, deliveryMenMap, usersMap);

  // 2. Current month's stats
  const monthEntries = entries.filter((e) => getMonthYearFromDateIST(e.entry_date_ist) === currentMonthYear);
  const monthConsumerCounts = new Map<string, number>();
  for (const e of monthEntries) {
    const norm = normalizeConsumerNumber(e.consumer_number);
    monthConsumerCounts.set(norm, (monthConsumerCounts.get(norm) || 0) + 1);
  }
  let monthDuplicateConsumers = 0;
  for (const count of monthConsumerCounts.values()) {
    if (count >= 2) monthDuplicateConsumers += 1;
  }

  // 3. Consumers entered within the last 30 days
  const last30DayConsumers = new Set<string>();
  for (const e of entries) {
    const diff = calculateCalendarDaysBetweenIST(e.entry_date_ist, todayIST);
    if (!Number.isNaN(diff) && diff >= 0 && diff <= 30) {
      last30DayConsumers.add(normalizeConsumerNumber(e.consumer_number));
    }
  }

  const totalDeliveryMen = deliveryMen.length;
  const activeDeliveryMenCount = deliveryMen.filter((d) => d.active).length;
  const totalStaffUsers = users.filter((u) => u.role === 'STAFF').length;

  const recentEntries = [...entries]
    .sort((a, b) => b.iso_ist.localeCompare(a.iso_ist))
    .slice(0, 6);

  // Staff Simplified Dashboard
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Staff Welcome & Large Mobile-First + NEW ENTRY Hero Button */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                IST Date: {todayIST} · Logged in as {currentUser.name} (Staff)
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Staff Operations Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Tap <strong>+ NEW ENTRY</strong> below to start recording Consumer Numbers (BH-0, CX, DX, or numeric) with auto-fetched Customer details.
              </p>
            </div>
          </div>

          {hasPermission('new_entry') && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onNavigate('new_entry')}
                className="w-full min-h-[64px] px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-lg sm:text-xl flex items-center justify-center gap-3 shadow-sm transition-all cursor-pointer"
              >
                <PlusCircle className="w-6 h-6 text-amber-400 shrink-0" />
                <span className="whitespace-nowrap">+ NEW ENTRY</span>
              </button>
            </div>
          )}
        </div>

        {/* Today's Quick Summary for Staff */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Today’s Total Entries</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {todayReport.totalEntries}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Today’s Unique Consumers</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {todayReport.uniqueConsumers}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Today’s Duplicate Consumers</div>
            <div className="text-2xl font-bold text-red-600 font-mono tabular-nums mt-1">
              {todayReport.duplicateConsumers}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">My Entries Today</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {todayEntries.filter((e) => e.created_by === currentUser.id).length}
            </div>
          </div>
        </div>

        {/* Permitted Staff Quick Buttons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Authorized Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {hasPermission('customer_register') && (
              <button
                type="button"
                onClick={() => onNavigate('customer_register')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                  Upload Excel (Bulk Customers)
                </span>
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              </button>
            )}
            {hasPermission('view_records') && (
              <button
                type="button"
                onClick={() => onNavigate('records')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Records</span>
                <FileSpreadsheet className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}
            {hasPermission('search_consumer') && (
              <button
                type="button"
                onClick={() => onNavigate('search_consumer')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Search Consumer</span>
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}
            {hasPermission('daily_duplication') && (
              <button
                type="button"
                onClick={() => onNavigate('daily_duplication')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Daily Duplication</span>
                <CopyCheck className="w-4 h-4 text-red-600 shrink-0" />
              </button>
            )}
            {hasPermission('report_30_day') && (
              <button
                type="button"
                onClick={() => onNavigate('report_30_day')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">30-Day Report</span>
                <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
              </button>
            )}
            {hasPermission('monthly_report') && (
              <button
                type="button"
                onClick={() => onNavigate('monthly_report')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Monthly Report</span>
                <CalendarRange className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}
            {hasPermission('export_reports') && (
              <button
                type="button"
                onClick={() => onNavigate('export')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Export</span>
                <Download className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}
            {hasPermission('manage_delivery_men') && (
              <button
                type="button"
                onClick={() => onNavigate('delivery_men')}
                className="min-h-[52px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Delivery Men</span>
                <Truck className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('download_app')}
              className="min-h-[52px] px-4 py-3 rounded-xl border border-orange-200 bg-orange-50/50 hover:bg-orange-100 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Download App (PWA)</span>
              <Download className="w-4 h-4 text-orange-600 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('google_drive')}
              className="min-h-[52px] px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">Google Drive Sync</span>
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD (Section 2)
  return (
    <div className="space-y-6">
      {/* Header Banner + Primary CTAs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>IST Clock: {currentTimestampIST} · Admin: {currentUser.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Admin Control & Deduplication Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Real-time overview of today’s consumer entries, duplicate alerts, Customer Register ({customers.length.toLocaleString()} registered), and agency workforce.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('download_app')}
            className="min-h-[52px] px-4 py-3 rounded-xl border border-orange-300 bg-orange-50/80 hover:bg-orange-100 text-orange-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="whitespace-nowrap">Download App (PWA)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('google_drive')}
            className="min-h-[52px] px-4 py-3 rounded-xl border border-blue-300 bg-blue-50/80 hover:bg-blue-100 text-blue-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="whitespace-nowrap">Google Drive Sync</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('customer_register')}
            className="min-h-[52px] px-4 py-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="whitespace-nowrap">Upload Excel Sheet (Bulk Customers)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('new_entry')}
            className="min-h-[52px] px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="whitespace-nowrap">+ New Entry</span>
          </button>
        </div>
      </div>

      {/* 9 Mandatory Admin KPI Metrics Grid */}
      <section aria-label="Dashboard Key Metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Today’s Total Entries</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {todayReport.totalEntries}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{todayIST}</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Today’s Unique Consumers</div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums mt-1.5">
              {todayReport.uniqueConsumers}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Distinct consumer numbers</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Today’s Duplicate Consumers</div>
            <div className="text-2xl sm:text-3xl font-bold text-red-600 font-mono tabular-nums mt-1.5">
              {todayReport.duplicateConsumers}
            </div>
            <div className="text-[11px] text-red-700 mt-1">Entered 2+ times today</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Today’s Duplicate Entries</div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1.5">
              {todayReport.totalDuplicateEntries}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Total rows in duplicate groups</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Current Month’s Total Entries</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {monthEntries.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">Month {currentMonthYear}</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Current Month’s Duplicate Consumers</div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums mt-1.5">
              {monthDuplicateConsumers}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Repeated in {currentMonthYear}</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Consumers in Last 30 Days</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {last30DayConsumers.size}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {customers.length} in Customer Register
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Total Delivery Men</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {totalDeliveryMen}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{activeDeliveryMenCount} active in dropdown</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-medium text-slate-500">Total Staff Users</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
              {totalStaffUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Admin: {currentUser.name}</div>
          </div>
        </div>
      </section>

      {/* Quick Action Buttons Required by Section 2 + Customer Register */}
      <section aria-label="Quick Actions" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Quick Operations & Reports</h2>
          <span className="text-xs text-slate-500">Direct single-tap navigation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('new_entry')}
            className="min-h-[54px] px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">+ New Entry</span>
            <PlusCircle className="w-4 h-4 text-amber-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('customer_register')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Upload Excel (Bulk Customers)</span>
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('daily_duplication')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Daily Duplication</span>
            <CopyCheck className="w-4 h-4 text-red-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('monthly_report')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Monthly Report</span>
            <CalendarRange className="w-4 h-4 text-slate-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('report_30_day')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">30-Day Report</span>
            <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('search_consumer')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Search Consumer</span>
            <Search className="w-4 h-4 text-slate-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('export')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Export</span>
            <Download className="w-4 h-4 text-slate-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('google_drive')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Google Drive</span>
            <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('delivery_men')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Delivery Men</span>
            <Truck className="w-4 h-4 text-slate-600 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('staff_management')}
            className="min-h-[54px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-2 font-semibold text-sm transition-colors cursor-pointer"
          >
            <span className="whitespace-nowrap">Staff Management</span>
            <Users className="w-4 h-4 text-slate-600 shrink-0" />
          </button>
        </div>
      </section>

      {/* Today's Duplicate Alert Preview & Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Today's Duplicate Consumers */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Today’s Duplicate Alerts ({todayIST})</h2>
              <button
                type="button"
                onClick={() => onNavigate('daily_duplication')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <span>Full Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayReport.groups.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No duplicate consumer entries recorded today ({todayIST}).
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayReport.groups.map((g) => {
                  const cust = autoFetchCustomer(g.consumerNumber, customers);
                  return (
                    <div key={g.consumerNumber} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono font-bold text-sm text-slate-900">
                          {g.consumerNumber}
                          {cust ? (
                            <span className="font-sans font-semibold text-xs text-slate-600 ml-1.5">
                              · {cust.customer_name}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {g.deliveryManSummary} · First {g.firstTime} · Last {g.lastTime}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs font-bold text-red-600 shrink-0">
                        {g.entryCount} entries
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Latest Consumer Entries */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">Recent Consumer Entries</h2>
            <button
              type="button"
              onClick={() => onNavigate('records')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <span>All Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-2.5 pr-3 font-medium">Consumer No.</th>
                  <th className="py-2.5 px-3 font-medium">Customer Name</th>
                  <th className="py-2.5 px-3 font-medium">Date & Time (IST)</th>
                  <th className="py-2.5 px-3 font-medium">Delivery Man</th>
                  <th className="py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEntries.map((entry) => {
                  const statusText = formatEntryDuplicateStatus(entry);
                  const isDup = entry.duplicate_today || entry.duplicate_30_days || entry.duplicate_month;
                  const custName =
                    entry.customer_name ||
                    autoFetchCustomer(entry.consumer_number, customers, customerMap)?.customer_name ||
                    '—';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">
                        {entry.consumer_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {custName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {entry.entry_date_ist} · {entry.entry_time_ist}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                        {deliveryMenMap[entry.delivery_man_id] || 'Unknown'}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-xs font-semibold whitespace-nowrap ${
                          entry.duplicate_today
                            ? 'text-red-600'
                            : isDup
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {statusText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
