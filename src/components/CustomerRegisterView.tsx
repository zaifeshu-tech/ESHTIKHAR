import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Zap,
  Loader2,
} from 'lucide-react';
import {
  CONSUMER_PREFIXES,
  normalizeConsumerNumber,
  type CustomerRecord,
} from '../utils/deduplication';

interface CustomerRegisterViewProps {
  customers: CustomerRecord[];
  isAdmin: boolean;
  onUpsertCustomer: (params: {
    consumer_number: string;
    customer_name: string;
    mobile: string;
    address: string;
  }) => { ok: boolean; mode: 'created' | 'updated'; error?: string };
  onBulkImportCustomers: (
    rows: Array<{
      consumer_number: string;
      customer_name: string;
      mobile: string;
      address: string;
    }>
  ) => { added: number; updated: number };
  onDeleteCustomer: (id: string) => void;
  onOpenGoogleDrive?: () => void;
}

interface ParsedCustomerRow {
  consumer_number: string;
  customer_name: string;
  mobile: string;
  address: string;
  isExisting: boolean;
}

export const CustomerRegisterView: React.FC<CustomerRegisterViewProps> = ({
  customers,
  isAdmin,
  onUpsertCustomer,
  onBulkImportCustomers,
  onDeleteCustomer,
  onOpenGoogleDrive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const consumerInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Form States
  const [consumerNumber, setConsumerNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [prefixFilter, setPrefixFilter] = useState<'ALL' | 'BH-0' | 'CX' | 'DX' | 'NUMERIC'>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination & Scale Controls (Handles 50,000+ customers smoothly)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Processing & Benchmark States
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingProgressText, setProcessingProgressText] = useState('');
  const [isGeneratingBenchmark, setIsGeneratingBenchmark] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState('');

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Excel Preview Modal States
  const [excelPreviewData, setExcelPreviewData] = useState<{
    fileName: string;
    totalRows: number;
    rows: ParsedCustomerRow[];
    newCount: number;
    updateCount: number;
  } | null>(null);

  // Single-pass prefix counter for 0ms instantaneous tab counts with 50,000+ records
  const prefixCounts = useMemo(() => {
    let bh0 = 0;
    let cx = 0;
    let dx = 0;
    let num = 0;
    for (let i = 0; i < customers.length; i++) {
      const numStr = customers[i].consumer_number;
      if (numStr.startsWith('BH-0')) bh0++;
      else if (numStr.startsWith('CX')) cx++;
      else if (numStr.startsWith('DX')) dx++;
      else num++;
    }
    return { bh0, cx, dx, num, total: customers.length };
  }, [customers]);

  // Apply prefix BH-0, CX, or DX to Consumer Number field
  const handleApplyPrefix = (prefix: string) => {
    setConsumerNumber((prev) => {
      const stripped = prev.trim().replace(/^(BH-0|CX|DX)/i, '');
      return `${prefix}${stripped}`;
    });
    setTimeout(() => consumerInputRef.current?.focus(), 10);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const norm = normalizeConsumerNumber(consumerNumber);
    if (!norm) {
      setErrorMessage('Please enter a Consumer Number (e.g. BH-01005, CX2005, DX3005).');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Please enter the Customer Name.');
      return;
    }

    const res = onUpsertCustomer({
      consumer_number: norm,
      customer_name: customerName.trim(),
      mobile: mobile.trim(),
      address: address.trim(),
    });

    if (!res.ok) {
      setErrorMessage(res.error || 'Could not save customer.');
      return;
    }

    setStatusMessage(
      res.mode === 'created'
        ? `Customer "${customerName.trim()}" (${norm}) added to Customer Register.`
        : `Customer "${customerName.trim()}" (${norm}) updated in Customer Register.`
    );
    setConsumerNumber('');
    setCustomerName('');
    setMobile('');
    setAddress('');
    setTimeout(() => consumerInputRef.current?.focus(), 10);
  };

  // Process Excel File (.xlsx, .xls, .csv) and generate preview (non-blocking for up to 50,000+ rows)
  const processExcelFile = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsProcessingFile(true);
    setProcessingProgressText(`Reading Excel file "${file.name}"...`);

    // Yield to browser event loop so loading spinner renders immediately
    await new Promise((r) => setTimeout(r, 20));

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProcessingProgressText('Parsing worksheet data with SheetJS...');
      await new Promise((r) => setTimeout(r, 10));

      const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setErrorMessage('The uploaded Excel file has no readable sheets.');
        setIsProcessingFile(false);
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        setErrorMessage('The selected sheet is empty. Please upload a sheet with customer records.');
        setIsProcessingFile(false);
        return;
      }

      setProcessingProgressText(`Analyzing ${rawRows.length.toLocaleString()} rows for Consumer Number & Name...`);
      await new Promise((r) => setTimeout(r, 10));

      // Fast Set lookup of existing consumers
      const existingConsumerMap = new Set<string>();
      for (let i = 0; i < customers.length; i++) {
        existingConsumerMap.add(normalizeConsumerNumber(customers[i].consumer_number));
      }

      const parsedRows: ParsedCustomerRow[] = [];
      const seenInBatch = new Set<string>();

      let newCount = 0;
      let updateCount = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const keys = Object.keys(row);
        const findVal = (patterns: RegExp[]): string => {
          for (const pat of patterns) {
            const matchedKey = keys.find((k) => pat.test(k.trim()));
            if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
              return String(row[matchedKey]).trim();
            }
          }
          return '';
        };

        const rawConsumer =
          findVal([/consumer/i, /cons.*no/i, /lpg.*id/i, /^id$/i, /number/i, /sv.*no/i, /connection/i]) ||
          String(Object.values(row)[0] ?? '').trim();
        const rawName =
          findVal([/customer.*name/i, /^name$/i, /consumer.*name/i, /holder/i, /party/i]) ||
          String(Object.values(row)[1] ?? '').trim();
        const rawMobile = findVal([/mobile/i, /phone/i, /contact/i, /cell/i]);
        const rawAddress = findVal([/address/i, /area/i, /village/i, /ward/i, /location/i, /colony/i]);

        const normConsumer = normalizeConsumerNumber(rawConsumer);
        if (normConsumer && rawName && normConsumer !== 'CONSUMERNUMBER' && !seenInBatch.has(normConsumer)) {
          seenInBatch.add(normConsumer);
          const isExisting = existingConsumerMap.has(normConsumer);
          if (isExisting) {
            updateCount++;
          } else {
            newCount++;
          }
          parsedRows.push({
            consumer_number: normConsumer,
            customer_name: rawName,
            mobile: rawMobile,
            address: rawAddress,
            isExisting,
          });
        }
      }

      if (parsedRows.length === 0) {
        setErrorMessage(
          'No valid customer rows found. Please ensure your Excel sheet has columns for "Consumer Number" (e.g. BH-01001, CX2001, DX3001) and "Customer Name".'
        );
        setIsProcessingFile(false);
        return;
      }

      setExcelPreviewData({
        fileName: file.name,
        totalRows: parsedRows.length,
        rows: parsedRows,
        newCount,
        updateCount,
      });
    } catch {
      setErrorMessage('Failed to parse Excel file. Please upload a valid .xlsx, .xls, or .csv sheet.');
    } finally {
      setIsProcessingFile(false);
      setProcessingProgressText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

  };

  const handleExcelFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleConfirmExcelImport = () => {
    if (!excelPreviewData) return;
    const summary = onBulkImportCustomers(
      excelPreviewData.rows.map((r) => ({
        consumer_number: r.consumer_number,
        customer_name: r.customer_name,
        mobile: r.mobile,
        address: r.address,
      }))
    );

    setStatusMessage(
      `Excel Import Complete (${excelPreviewData.fileName}): ${summary.added.toLocaleString()} new customer(s) added, ${summary.updated.toLocaleString()} existing customer(s) updated in Customer Register.`
    );
    setExcelPreviewData(null);
  };

  // Download Sample Excel Template with BH-0, CX, DX examples
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Consumer Number': 'BH-01003',
        'Customer Name': 'Zafar Iqbal',
        Mobile: '9876500011',
        Address: 'Ward 7, Station Road',
      },
      {
        'Consumer Number': 'BH-01004',
        'Customer Name': 'Mohammad Tariq',
        Mobile: '9876500012',
        Address: 'Civil Lines, Gate 2',
      },
      {
        'Consumer Number': 'CX2003',
        'Customer Name': 'Kavita Sharma',
        Mobile: '9876500022',
        Address: 'Civil Lines, Block A',
      },
      {
        'Consumer Number': 'CX2004',
        'Customer Name': 'Pooja Verma',
        Mobile: '9876500023',
        Address: 'Sector 3 Market',
      },
      {
        'Consumer Number': 'DX3003',
        'Customer Name': 'Rashid Ali',
        Mobile: '9876500033',
        Address: 'Mustafabad Crossing',
      },
      {
        'Consumer Number': 'DX3004',
        'Customer Name': 'Shakeel Akhtar',
        Mobile: '9876500034',
        Address: 'Old City Chowk',
      },
      {
        'Consumer Number': '0055443322',
        'Customer Name': 'Pramod Kumar',
        Mobile: '9876500044',
        Address: 'Gandhi Chowk',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk_Customers');
    XLSX.writeFile(wb, 'LPG_Bulk_Customers_Template.xlsx');
  };

  const handleLoadSampleBatch = () => {
    const sampleBatch = [
      {
        consumer_number: 'BH-01003',
        customer_name: 'Zafar Iqbal',
        mobile: '9876500011',
        address: 'Ward 7, Station Road',
      },
      {
        consumer_number: 'CX2003',
        customer_name: 'Kavita Sharma',
        mobile: '9876500022',
        address: 'Civil Lines, Block A',
      },
      {
        consumer_number: 'DX3003',
        customer_name: 'Rashid Ali',
        mobile: '9876500033',
        address: 'Mustafabad Crossing',
      },
      {
        consumer_number: 'BH-01004',
        customer_name: 'Mohammad Tariq',
        mobile: '9876500012',
        address: 'Civil Lines, Gate 2',
      },
      {
        consumer_number: 'CX2004',
        customer_name: 'Pooja Verma',
        mobile: '9876500023',
        address: 'Sector 3 Market',
      },
    ];
    const summary = onBulkImportCustomers(sampleBatch);
    setStatusMessage(
      `Imported sample Excel bulk batch: ${summary.added} added, ${summary.updated} updated (BH-01003, CX2003, DX3003, BH-01004, CX2004).`
    );
  };

  const handleGenerate50kBenchmark = async () => {
    setIsGeneratingBenchmark(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const firstNames = [
      'Ramesh', 'Suresh', 'Pooja', 'Sunita', 'Amit', 'Deepak', 'Kavita', 'Zafar', 'Mohammad', 'Rashid',
      'Vikram', 'Anil', 'Priya', 'Meena', 'Rahul', 'Rajesh', 'Sanjay', 'Manoj', 'Neeraj', 'Geeta',
      'Arun', 'Sneha', 'Fatima', 'Amina', 'Dinesh', 'Kishore', 'Anita', 'Vandana', 'Santosh', 'Ashok',
    ];
    const lastNames = [
      'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Ali', 'Khan', 'Ansari', 'Yadav', 'Tariq',
      'Mishra', 'Pandey', 'Chauhan', 'Patel', 'Iqbal', 'Siddiqui', 'Malik', 'Saxena', 'Agrawal', 'Devi',
      'Joshi', 'Tiwari', 'Bhardwaj', 'Shukla', 'Yousuf', 'Hasan', 'Choudhary', 'Rawat', 'Bhati', 'Mehta',
    ];
    const areas = [
      'Ward 1', 'Ward 2', 'Ward 4', 'Civil Lines', 'Station Road', 'Gandhi Chowk', 'Main Market',
      'Mustafabad', 'Rampur Road', 'Shivaji Nagar', 'Sector 2', 'Sector 4', 'Old City', 'Kashmiri Gate',
      'Subhash Nagar', 'Indira Colony', 'Adarsh Nagar', 'Nehru Colony', 'Govind Nagar', 'Patel Marg',
    ];

    const TOTAL_BENCHMARK = 50000;
    const CHUNK_SIZE = 10000;
    const allRows: Array<{
      consumer_number: string;
      customer_name: string;
      mobile: string;
      address: string;
    }> = [];

    for (let chunkStart = 0; chunkStart < TOTAL_BENCHMARK; chunkStart += CHUNK_SIZE) {
      setBenchmarkProgress(
        `Synthesizing benchmark customers ${(chunkStart + 1).toLocaleString()} to ${(chunkStart + CHUNK_SIZE).toLocaleString()} of 50,000 (BH-0, CX, DX & Numeric)...`
      );
      await new Promise((r) => setTimeout(r, 20));

      for (let i = chunkStart; i < chunkStart + CHUNK_SIZE; i++) {
        let consumer_number: string;
        if (i < 15000) {
          // BH-0 series (15,000 customers)
          consumer_number = `BH-0${(10000 + i).toString()}`;
        } else if (i < 30000) {
          // CX series (15,000 customers)
          consumer_number = `CX${(20000 + (i - 15000)).toString()}`;
        } else if (i < 45000) {
          // DX series (15,000 customers)
          consumer_number = `DX${(30000 + (i - 30000)).toString()}`;
        } else {
          // 10-digit Numeric series (5,000 customers)
          consumer_number = `00${(88000000 + (i - 45000)).toString()}`;
        }

        const fn = firstNames[i % firstNames.length];
        const ln = lastNames[(i * 3) % lastNames.length];
        const area = areas[(i * 7) % areas.length];
        const mob = `98${((10000000 + (i * 13)) % 90000000 + 10000000).toString()}`;

        allRows.push({
          consumer_number,
          customer_name: `${fn} ${ln}`,
          mobile: mob,
          address: `${area}, Plot ${((i % 250) + 1)}`,
        });
      }
    }

    setBenchmarkProgress('Committing 50,000 customers into database & IndexedDB storage engine...');
    await new Promise((r) => setTimeout(r, 40));

    const summary = onBulkImportCustomers(allRows);
    setIsGeneratingBenchmark(false);
    setBenchmarkProgress('');
    setStatusMessage(
      `⚡ Benchmark Complete: Successfully loaded 50,000 customers (+${summary.added.toLocaleString()} added, ${summary.updated.toLocaleString()} updated) into high-performance IndexedDB! 0ms auto-fetch, smooth pagination, and fast prefix filtering active.`
    );
  };

  const handleEditRow = (cust: CustomerRecord) => {
    setConsumerNumber(cust.consumer_number);
    setCustomerName(cust.customer_name);
    setMobile(cust.mobile);
    setAddress(cust.address);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => consumerInputRef.current?.focus(), 50);
  };

  // Reset page to 1 when filter, search, or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [prefixFilter, searchQuery, pageSize]);

  // Memoized filter for 50,000 records
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return customers.filter((c) => {
      const normNum = normalizeConsumerNumber(c.consumer_number);
      if (prefixFilter === 'BH-0' && !normNum.startsWith('BH-0')) return false;
      if (prefixFilter === 'CX' && !normNum.startsWith('CX')) return false;
      if (prefixFilter === 'DX' && !normNum.startsWith('DX')) return false;
      if (
        prefixFilter === 'NUMERIC' &&
        (normNum.startsWith('BH-0') || normNum.startsWith('CX') || normNum.startsWith('DX'))
      ) {
        return false;
      }

      if (!q) return true;
      return (
        normNum.includes(q) ||
        c.customer_name.toUpperCase().includes(q) ||
        c.mobile.toUpperCase().includes(q) ||
        c.address.toUpperCase().includes(q)
      );
    });
  }, [customers, prefixFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Paginated slice: only renders selected page rows (e.g. 50 items) for 60fps smooth UI
  const paginatedCustomers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, safeCurrentPage, pageSize]);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setCurrentPage(target);
      setJumpPageInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelFileInputChange}
        className="hidden"
        id="customer-excel-bulk-upload-input"
      />

      {/* SECTION 1: PROMINENT DEDICATED EXCEL BULK UPLOAD CARD */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-5 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Upload Excel Sheet to Add Bulk Customers
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Import hundreds or thousands of customer records at once from <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> sheets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Download Excel Template</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleBatch}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>+ Sample Batch (5)</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingBenchmark || isProcessingFile}
              onClick={handleGenerate50kBenchmark}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              {isGeneratingBenchmark ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-slate-950 shrink-0 fill-current" />
              )}
              <span>⚡ Generate & Add 50,000 Customers</span>
            </button>

            {onOpenGoogleDrive && (
              <button
                type="button"
                onClick={onOpenGoogleDrive}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50/80 hover:bg-blue-100 text-blue-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Import from Google Drive</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Processing or Benchmark Progress Banner */}
        {(isProcessingFile || isGeneratingBenchmark) && (
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-amber-700 shrink-0" />
            <div className="flex-1">
              <div className="font-bold">
                {isGeneratingBenchmark ? 'Generating 50,000 Customers Dataset' : 'Processing Excel File'}
              </div>
              <div className="text-xs text-amber-800 mt-0.5">
                {benchmarkProgress || processingProgressText || 'Processing records in non-blocking batches...'}
              </div>
            </div>
          </div>
        )}

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-600 bg-emerald-50 scale-[1.01]'
              : 'border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/40 bg-slate-50/60'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900">
                Click to Browse or Drag & Drop Excel Sheet Here
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Select Excel File from Computer / Phone</span>
            </button>
          </div>
        </div>

        {/* Column Requirement Help Pills */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
            <HelpCircle className="w-4 h-4 text-emerald-700" />
            <span>Recognized Excel Sheet Columns (Auto-Detected):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <div className="font-bold text-slate-900">1. Consumer Number *</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Column: <code className="text-emerald-700 font-mono">Consumer Number</code>, <code className="text-emerald-700 font-mono">Cons No</code>, or <code className="text-emerald-700 font-mono">LPG ID</code>. Supports <strong>BH-0</strong>, <strong>CX</strong>, <strong>DX</strong> & numeric with leading zeros.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <div className="font-bold text-slate-900">2. Customer Name *</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Column: <code className="text-emerald-700 font-mono">Customer Name</code>, <code className="text-emerald-700 font-mono">Name</code>, or <code className="text-emerald-700 font-mono">Holder Name</code>.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <div className="font-bold text-slate-900">3. Mobile Number</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Column: <code className="text-emerald-700 font-mono">Mobile</code>, <code className="text-emerald-700 font-mono">Phone</code>, or <code className="text-emerald-700 font-mono">Contact</code> (optional).
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200">
              <div className="font-bold text-slate-900">4. Address / Area</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Column: <code className="text-emerald-700 font-mono">Address</code>, <code className="text-emerald-700 font-mono">Area</code>, <code className="text-emerald-700 font-mono">Village</code>, or <code className="text-emerald-700 font-mono">Ward</code> (optional).
              </div>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-emerald-950"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-300 text-xs sm:text-sm font-semibold text-red-900 flex items-center gap-2.5"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: EXCEL IMPORT PREVIEW & CONFIRMATION MODAL */}
      {excelPreviewData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="excel-preview-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileCheck className="w-6 h-6 text-emerald-700" />
                  <h2 id="excel-preview-title" className="text-lg sm:text-xl font-bold text-slate-900">
                    Confirm Bulk Customer Import from Excel
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  File: <strong className="font-mono text-slate-900">{excelPreviewData.fileName}</strong> · Found{' '}
                  <strong className="text-emerald-800">{excelPreviewData.totalRows} valid customer row(s)</strong>.
                </p>
              </div>

              <button
                type="button"
                aria-label="Cancel Excel Import"
                onClick={() => setExcelPreviewData(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Import Summary Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Total Rows in File</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  {excelPreviewData.totalRows}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-800">New Customers to Add</div>
                <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                  +{excelPreviewData.newCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-xs text-amber-800">Existing to Update</div>
                <div className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                  {excelPreviewData.updateCount}
                </div>
              </div>
            </div>

            {/* Preview Table of First 8 Rows */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">
                Preview of Rows (Showing up to 8 of {excelPreviewData.totalRows}):
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">Consumer Number</th>
                      <th className="py-2.5 px-3 font-semibold">Customer Name</th>
                      <th className="py-2.5 px-3 font-semibold">Mobile</th>
                      <th className="py-2.5 px-3 font-semibold">Address / Area</th>
                      <th className="py-2.5 px-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelPreviewData.rows.slice(0, 8).map((r, i) => (
                      <tr key={r.consumer_number} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {r.consumer_number}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">{r.customer_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{r.mobile || '—'}</td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-[160px]">
                          {r.address || '—'}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              r.isExisting
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {r.isExisting ? 'Update' : 'New'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelPreviewData.totalRows > 8 && (
                <div className="text-[11px] text-slate-500 text-right mt-1.5 font-mono">
                  + {excelPreviewData.totalRows - 8} more customer row(s) in sheet
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setExcelPreviewData(null)}
                className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExcelImport}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Import All {excelPreviewData.totalRows.toLocaleString()} Bulk Customers</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MANUAL ADD / UPDATE SINGLE CUSTOMER FORM */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Add or Update Individual Customer
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                Start Consumer No. with:
              </span>
              {CONSUMER_PREFIXES.map((prefix) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => handleApplyPrefix(prefix)}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-mono font-bold text-xs cursor-pointer"
                >
                  + {prefix}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="cust-reg-number" className="block text-xs font-semibold text-slate-700 mb-1">
                Consumer Number *
              </label>
              <input
                ref={consumerInputRef}
                id="cust-reg-number"
                type="text"
                value={consumerNumber}
                onChange={(e) => setConsumerNumber(e.target.value)}
                placeholder="BH-01005, CX2005, DX3005"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="cust-reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                id="cust-reg-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer full name"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="cust-reg-mobile" className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number
              </label>
              <input
                id="cust-reg-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="cust-reg-address" className="block text-xs font-semibold text-slate-700 mb-1">
                Address / Area
              </label>
              <input
                id="cust-reg-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ward / Village / Colony"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {consumerNumber && (
              <button
                type="button"
                onClick={() => {
                  setConsumerNumber('');
                  setCustomerName('');
                  setMobile('');
                  setAddress('');
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Save Individual Customer</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 4: REGISTERED CUSTOMERS MASTER TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Registered Customers Database ({filteredCustomers.length} of {customers.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers in this register are <strong>automatically auto-fetched</strong> during New Entry.
            </p>
          </div>

          {/* Prefix Filter Buttons using precomputed counts */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'ALL', label: `All (${prefixCounts.total.toLocaleString()})` },
                {
                  id: 'BH-0',
                  label: `BH-0 (${prefixCounts.bh0.toLocaleString()})`,
                },
                {
                  id: 'CX',
                  label: `CX (${prefixCounts.cx.toLocaleString()})`,
                },
                {
                  id: 'DX',
                  label: `DX (${prefixCounts.dx.toLocaleString()})`,
                },
                { id: 'NUMERIC', label: `Standard Numeric (${prefixCounts.num.toLocaleString()})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPrefixFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  prefixFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Page Size Selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Consumer Number (BH-0..., CX..., DX...), Customer Name, Mobile, or Address..."
              className="w-full min-h-[44px] pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear customer search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0 self-end sm:self-auto">
            <span className="font-semibold text-slate-700">Rows per page:</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="py-3 pr-3 font-medium">S.No.</th>
                <th className="py-3 px-3 font-medium">Consumer Number</th>
                <th className="py-3 px-3 font-medium">Customer Name</th>
                <th className="py-3 px-3 font-medium">Mobile</th>
                <th className="py-3 px-3 font-medium">Address / Area</th>
                <th className="py-3 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No customers found matching the search or prefix filter. Upload an Excel sheet above to add bulk customers.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust, index) => {
                  const serialNo = (safeCurrentPage - 1) * pageSize + index + 1;
                  return (
                    <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 pr-3 font-mono text-slate-500 tabular-nums">{serialNo}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {cust.consumer_number}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{cust.customer_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{cust.mobile || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{cust.address || '—'}</td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditRow(cust)}
                            aria-label={`Edit customer ${cust.customer_name}`}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomer(cust.id)}
                              aria-label={`Delete customer ${cust.customer_name}`}
                              className="min-h-[34px] px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCustomers.length > 0 && (
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-slate-600 font-medium">
              Showing{' '}
              <strong className="text-slate-900 font-mono">
                {((safeCurrentPage - 1) * pageSize + 1).toLocaleString()}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900 font-mono">
                {Math.min(safeCurrentPage * pageSize, filteredCustomers.length).toLocaleString()}
              </strong>{' '}
              of{' '}
              <strong className="text-slate-900 font-mono">
                {filteredCustomers.length.toLocaleString()}
              </strong>{' '}
              customers (Page {safeCurrentPage} of {totalPages})
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="First page"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
                <span className="hidden sm:inline">First</span>
              </button>

              <button
                type="button"
                aria-label="Previous page"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="px-3 py-1 font-mono font-bold text-slate-900 bg-slate-100 rounded-lg">
                {safeCurrentPage} / {totalPages}
              </div>

              <button
                type="button"
                aria-label="Next page"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                aria-label="Last page"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Last</span>
                <ChevronsRight className="w-4 h-4" />
              </button>

              {/* Jump to Page Input */}
              {totalPages > 1 && (
                <form onSubmit={handleJumpToPage} className="inline-flex items-center gap-1.5 ml-2">
                  <span className="text-slate-500 font-medium">Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder="Page #"
                    className="w-16 min-h-[36px] px-2 py-1 text-center font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
