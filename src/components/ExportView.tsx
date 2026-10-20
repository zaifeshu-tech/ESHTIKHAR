import React, { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, FileText, Cloud, RefreshCw } from 'lucide-react';
import {
  addDaysIST,
  buildDailyDuplicationReport,
  dmyToYmd,
  getMonthYearFromDateIST,
  ymdToDmy,
  type ConsumerEntryRecord,
  type DeliveryManRecord,
} from '../utils/deduplication';
import {
  buildDuplicateReportExportRows,
  buildStandardExportRows,
  exportDuplicateReportFile,
  exportStandardRecordsFile,
  generateDuplicateReportBlob,
  generateStandardRecordsBlob,
  type ExportFormat,
} from '../utils/exportFiles';
import {
  getGoogleAccessToken,
  googleSignIn,
  getOrCreateLPGFolder,
  uploadFileToDrive,
} from '../utils/googleDriveService';

type ExportCategory =
  | 'date_wise'
  | 'date_range'
  | 'monthly'
  | 'delivery_man_wise'
  | 'duplicate_only'
  | 'daily_duplication_report';

interface ExportViewProps {
  entries: ConsumerEntryRecord[];
  deliveryMen: DeliveryManRecord[];
  todayIST: string;
  deliveryMenMap: Record<string, string>;
  usersMap: Record<string, string>;
  agencyName: string;
}

export const ExportView: React.FC<ExportViewProps> = ({
  entries,
  deliveryMen,
  todayIST,
  deliveryMenMap,
  usersMap,
  agencyName,
}) => {
  const [, defaultMonth, defaultYear] = todayIST.split('-');

  const [category, setCategory] = useState<ExportCategory>('date_wise');
  const [singleDateYmd, setSingleDateYmd] = useState(dmyToYmd(todayIST));
  const [rangeStartYmd, setRangeStartYmd] = useState(dmyToYmd(addDaysIST(todayIST, -15)));
  const [rangeEndYmd, setRangeEndYmd] = useState(dmyToYmd(todayIST));
  const [monthVal, setMonthVal] = useState(defaultMonth || '10');
  const [yearVal, setYearVal] = useState(defaultYear || '2026');
  const [selectedDeliveryManId, setSelectedDeliveryManId] = useState(
    deliveryMen[0]?.id || 'ALL'
  );
  const [dmScope, setDmScope] = useState<'month' | 'date'>('month');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Filter entries according to selected export mode
  const matchingEntries = entries
    .filter((entry) => {
      const entryYmd = dmyToYmd(entry.entry_date_ist);
      const entryMonthKey = getMonthYearFromDateIST(entry.entry_date_ist);

      if (category === 'date_wise' || category === 'daily_duplication_report') {
        return entryYmd === singleDateYmd;
      }
      if (category === 'date_range') {
        return entryYmd >= rangeStartYmd && entryYmd <= rangeEndYmd;
      }
      if (category === 'monthly') {
        return entryMonthKey === `${monthVal}-${yearVal}`;
      }
      if (category === 'delivery_man_wise') {
        const dmMatch =
          selectedDeliveryManId === 'ALL' || entry.delivery_man_id === selectedDeliveryManId;
        if (!dmMatch) return false;
        if (dmScope === 'date') return entryYmd === singleDateYmd;
        return entryMonthKey === `${monthVal}-${yearVal}`;
      }
      if (category === 'duplicate_only') {
        return entry.duplicate_today || entry.duplicate_30_days || entry.duplicate_month;
      }
      return true;
    })
    .sort((a, b) => a.iso_ist.localeCompare(b.iso_ist));

  const isDailyDupReportMode = category === 'daily_duplication_report';
  const dailyReport = buildDailyDuplicationReport(matchingEntries, deliveryMenMap, usersMap);

  const standardRows = buildStandardExportRows(matchingEntries, deliveryMenMap, usersMap);
  const duplicateGroupRows = buildDuplicateReportExportRows(dailyReport.groups);

  const getExportTitleAndFilename = (): { title: string; filename: string } => {
    switch (category) {
      case 'date_wise':
        return {
          title: `Date-Wise Records (${ymdToDmy(singleDateYmd)})`,
          filename: `LPG_Records_Date_${ymdToDmy(singleDateYmd)}`,
        };
      case 'date_range':
        return {
          title: `Date Range Records (${ymdToDmy(rangeStartYmd)} to ${ymdToDmy(rangeEndYmd)})`,
          filename: `LPG_Records_Range_${ymdToDmy(rangeStartYmd)}_to_${ymdToDmy(rangeEndYmd)}`,
        };
      case 'monthly':
        return {
          title: `Monthly Records (${monthVal}-${yearVal})`,
          filename: `LPG_Records_Month_${monthVal}_${yearVal}`,
        };
      case 'delivery_man_wise': {
        const dmName =
          selectedDeliveryManId === 'ALL'
            ? 'All_Delivery_Men'
            : deliveryMenMap[selectedDeliveryManId] || 'DeliveryMan';
        return {
          title: `Delivery-Man Report - ${dmName}`,
          filename: `LPG_DeliveryMan_${dmName}_${dmScope === 'date' ? ymdToDmy(singleDateYmd) : `${monthVal}_${yearVal}`}`,
        };
      }
      case 'duplicate_only':
        return {
          title: 'All Duplicate Consumer Entries',
          filename: `LPG_Duplicate_Entries_${todayIST}`,
        };
      case 'daily_duplication_report':
        return {
          title: `Daily Duplication Report (${ymdToDmy(singleDateYmd)})`,
          filename: `LPG_Daily_Duplication_Report_${ymdToDmy(singleDateYmd)}`,
        };
    }
  };

  const handleDownload = (format: ExportFormat) => {
    const { title, filename } = getExportTitleAndFilename();
    if (isDailyDupReportMode) {
      exportDuplicateReportFile(duplicateGroupRows, format, filename, title, agencyName);
      setExportNotice(
        `Exported ${duplicateGroupRows.length} duplicate group(s) as ${filename}.${format}`
      );
    } else {
      exportStandardRecordsFile(standardRows, format, filename, title, agencyName);
      setExportNotice(`Exported ${standardRows.length} record(s) as ${filename}.${format}`);
    }
  };

  const [isUploadingDrive, setIsUploadingDrive] = useState(false);

  const handleUploadToDrive = async () => {
    let token = getGoogleAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        if (!res?.accessToken) {
          setExportNotice('Google sign-in was cancelled or failed.');
          return;
        }
        token = res.accessToken;
      } catch (err: any) {
        setExportNotice(err.message || 'Google sign-in failed.');
        return;
      }
    }

    setIsUploadingDrive(true);
    setExportNotice(null);
    try {
      const { title, filename } = getExportTitleAndFilename();
      const folderId = await getOrCreateLPGFolder();

      let uploadResult;
      if (isDailyDupReportMode) {
        const { blob, mimeType, fileName } = generateDuplicateReportBlob(
          duplicateGroupRows,
          'xlsx',
          filename,
          title,
          agencyName
        );
        uploadResult = await uploadFileToDrive({
          fileName,
          mimeType,
          data: blob,
          folderId,
          description: `${title} exported directly to Google Drive.`,
        });
      } else {
        const { blob, mimeType, fileName } = generateStandardRecordsBlob(
          standardRows,
          'xlsx',
          filename,
          title,
          agencyName
        );
        uploadResult = await uploadFileToDrive({
          fileName,
          mimeType,
          data: blob,
          folderId,
          description: `${title} exported directly to Google Drive.`,
        });
      }

      setExportNotice(`Saved to Google Drive: "${uploadResult.name}" inside "LPG Consumer Deduplication System" folder!`);
    } catch (err: any) {
      setExportNotice(err.message || 'Failed to upload report to Google Drive.');
    } finally {
      setIsUploadingDrive(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Export Operational Data & Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Download formatted Excel (.xlsx), CSV, or PDF files. Consumer Numbers are strictly preserved as text strings with leading zeros intact.
          </p>
        </div>

        {exportNotice && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-emerald-900"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* 6 Export Option Tabs */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2">1. Select Export Type</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'date_wise', label: 'Date-wise' },
              { id: 'date_range', label: 'Date Range' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'delivery_man_wise', label: 'Delivery-Man-wise' },
              { id: 'duplicate_only', label: 'Duplicate-only' },
              { id: 'daily_duplication_report', label: 'Daily Duplication Report' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setCategory(opt.id as ExportCategory);
                  setExportNotice(null);
                }}
                className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  category === opt.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Parameter Selectors */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-700">2. Configure Filter Parameters</div>

          {(category === 'date_wise' || category === 'daily_duplication_report') && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="export-single-date" className="text-xs font-semibold text-slate-700">
                Select Date (IST):
              </label>
              <input
                id="export-single-date"
                type="date"
                value={singleDateYmd}
                onChange={(e) => setSingleDateYmd(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
              <span className="text-xs font-mono text-slate-500">
                Formatted: {ymdToDmy(singleDateYmd)}
              </span>
            </div>
          )}

          {category === 'date_range' && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="export-range-start" className="text-xs font-semibold text-slate-700">
                From Date:
              </label>
              <input
                id="export-range-start"
                type="date"
                value={rangeStartYmd}
                onChange={(e) => setRangeStartYmd(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
              <label htmlFor="export-range-end" className="text-xs font-semibold text-slate-700">
                To Date:
              </label>
              <input
                id="export-range-end"
                type="date"
                value={rangeEndYmd}
                onChange={(e) => setRangeEndYmd(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          )}

          {category === 'monthly' && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="export-month-select" className="text-xs font-semibold text-slate-700">
                Month:
              </label>
              <select
                id="export-month-select"
                value={monthVal}
                onChange={(e) => setMonthVal(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {[
                  ['01', 'January'],
                  ['02', 'February'],
                  ['03', 'March'],
                  ['04', 'April'],
                  ['05', 'May'],
                  ['06', 'June'],
                  ['07', 'July'],
                  ['08', 'August'],
                  ['09', 'September'],
                  ['10', 'October'],
                  ['11', 'November'],
                  ['12', 'December'],
                ].map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl} ({val})
                  </option>
                ))}
              </select>

              <label htmlFor="export-year-select" className="text-xs font-semibold text-slate-700">
                Year:
              </label>
              <select
                id="export-year-select"
                value={yearVal}
                onChange={(e) => setYearVal(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              >
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
          )}

          {category === 'delivery_man_wise' && (
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="export-dm-select" className="text-xs font-semibold text-slate-700">
                Delivery Man:
              </label>
              <select
                id="export-dm-select"
                value={selectedDeliveryManId}
                onChange={(e) => setSelectedDeliveryManId(e.target.value)}
                className="min-h-[42px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Delivery Men</option>
                {deliveryMen.map((dm) => (
                  <option key={dm.id} value={dm.id}>
                    {dm.name} {dm.active ? '' : '(Inactive)'}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDmScope('month')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                    dmScope === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  By Month ({monthVal}-{yearVal})
                </button>
                <button
                  type="button"
                  onClick={() => setDmScope('date')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                    dmScope === 'date' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  By Date ({ymdToDmy(singleDateYmd)})
                </button>
              </div>
            </div>
          )}

          {category === 'duplicate_only' && (
            <div className="text-xs text-slate-600">
              Includes all records flagged as Duplicate Today, 30-Day Duplicate, or Monthly Duplicate across the agency database.
            </div>
          )}
        </div>

        {/* 3. Format Download Buttons */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2">3. Download or Cloud Sync File Format</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleDownload('xlsx')}
              className="min-h-[52px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Download Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('csv')}
              className="min-h-[52px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Download CSV (.csv)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload('pdf')}
              className="min-h-[52px] px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-red-600 shrink-0" />
              <span>Download PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleUploadToDrive}
              disabled={isUploadingDrive}
              className="min-h-[52px] px-5 py-3 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-950 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUploadingDrive ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span>Saving to Drive...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Save to Google Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Export Format Preview Table (Section 18) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Export Preview ({getExportTitleAndFilename().title})
            </h2>
            <p className="text-xs text-slate-500">
              {isDailyDupReportMode
                ? 'Format: S.No. | Consumer Number | First Entry | Last Entry | Number of Entries | Delivery Man | Status'
                : 'Format: S.No. | Date | Time | Consumer Number | Delivery Man | Duplicate Status | Entered By'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-700">
            {isDailyDupReportMode ? duplicateGroupRows.length : standardRows.length} row(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          {isDailyDupReportMode ? (
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-2.5 pr-3 font-medium">S.No.</th>
                  <th className="py-2.5 px-3 font-medium">Consumer Number</th>
                  <th className="py-2.5 px-3 font-medium">First Entry</th>
                  <th className="py-2.5 px-3 font-medium">Last Entry</th>
                  <th className="py-2.5 px-3 font-medium text-right">Number of Entries</th>
                  <th className="py-2.5 px-3 font-medium">Delivery Man</th>
                  <th className="py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duplicateGroupRows.map((row) => (
                  <tr key={row['S.No.']}>
                    <td className="py-2.5 pr-3 font-mono text-slate-500">{row['S.No.']}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {row['Consumer Number']}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row['First Entry']}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row['Last Entry']}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-red-600 text-right">
                      {row['Number of Entries']}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row['Delivery Man']}</td>
                    <td className="py-2.5 pl-3 font-mono font-bold text-xs text-red-600">{row.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-2.5 pr-3 font-medium">S.No.</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Time</th>
                  <th className="py-2.5 px-3 font-medium">Consumer Number</th>
                  <th className="py-2.5 px-3 font-medium">Delivery Man</th>
                  <th className="py-2.5 px-3 font-medium">Duplicate Status</th>
                  <th className="py-2.5 pl-3 font-medium">Entered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standardRows.map((row) => (
                  <tr key={row['S.No.']}>
                    <td className="py-2.5 pr-3 font-mono text-slate-500">{row['S.No.']}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row.Date}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row.Time}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {row['Consumer Number']}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{row['Delivery Man']}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-slate-800">
                      {row['Duplicate Status']}
                    </td>
                    <td className="py-2.5 pl-3 text-xs text-slate-600">{row['Entered By']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
