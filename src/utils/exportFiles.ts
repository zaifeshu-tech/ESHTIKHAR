import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatEntryDuplicateStatus,
  formatIST,
  type ConsumerEntryRecord,
  type DailyDuplicateGroup,
} from './deduplication';

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface StandardExportRow {
  'S.No.': number;
  Date: string;
  Time: string;
  'Consumer Number': string;
  'Delivery Man': string;
  'Duplicate Status': string;
  'Entered By': string;
}

export interface DuplicateReportExportRow {
  'S.No.': number;
  'Consumer Number': string;
  'First Entry': string;
  'Last Entry': string;
  'Number of Entries': number;
  'Delivery Man': string;
  Status: string;
}

export function buildStandardExportRows(
  entries: ConsumerEntryRecord[],
  deliveryMenMap: Record<string, string>,
  usersMap: Record<string, string>
): StandardExportRow[] {
  return entries.map((entry, idx) => ({
    'S.No.': idx + 1,
    Date: entry.entry_date_ist,
    Time: entry.entry_time_ist,
    'Consumer Number': String(entry.consumer_number),
    'Delivery Man': deliveryMenMap[entry.delivery_man_id] || 'Unknown',
    'Duplicate Status': formatEntryDuplicateStatus(entry),
    'Entered By': usersMap[entry.created_by] || 'Unknown',
  }));
}

export function buildDuplicateReportExportRows(groups: DailyDuplicateGroup[]): DuplicateReportExportRow[] {
  return groups.map((g, idx) => ({
    'S.No.': idx + 1,
    'Consumer Number': String(g.consumerNumber),
    'First Entry': `${g.dateIST} ${g.firstTime}`,
    'Last Entry': `${g.dateIST} ${g.lastTime}`,
    'Number of Entries': g.entryCount,
    'Delivery Man': g.deliveryManSummary,
    Status: g.status,
  }));
}

export function exportStandardRecordsFile(
  rows: StandardExportRow[],
  format: ExportFormat,
  filenameBase: string,
  reportTitle: string,
  agencyName: string
): void {
  const safeBase = filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Force Consumer Number column (D) cells to be explicit string type 's' so Excel preserves leading zeros
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:G1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ c: 3, r: R });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = 's';
        worksheet[cellRef].z = '@';
      }
    }
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LPG Entries');
    XLSX.writeFile(workbook, `${safeBase}.xlsx`);
    return;
  }

  if (format === 'csv') {
    const headers = ['S.No.', 'Date', 'Time', 'Consumer Number', 'Delivery Man', 'Duplicate Status', 'Entered By'];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r['S.No.'],
          `"${r.Date}"`,
          `"${r.Time}"`,
          `"\t${r['Consumer Number']}"`, // Tab prefix inside quotes prevents spreadsheet leading-zero stripping
          `"${r['Delivery Man'].replace(/"/g, '""')}"`,
          `"${r['Duplicate Status']}"`,
          `"${r['Entered By'].replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeBase}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`${agencyName} — ${reportTitle}`, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated in IST (Asia/Kolkata): ${formatIST().timestampIST} | Total Rows: ${rows.length}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['S.No.', 'Date (IST)', 'Time (IST)', 'Consumer Number', 'Delivery Man', 'Duplicate Status', 'Entered By']],
      body: rows.map((r) => [
        r['S.No.'],
        r.Date,
        r.Time,
        r['Consumer Number'],
        r['Delivery Man'],
        r['Duplicate Status'],
        r['Entered By'],
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    });

    doc.save(`${safeBase}.pdf`);
  }
}

export function exportDuplicateReportFile(
  rows: DuplicateReportExportRow[],
  format: ExportFormat,
  filenameBase: string,
  reportTitle: string,
  agencyName: string
): void {
  const safeBase = filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Force Consumer Number column (B) to text type 's'
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:G1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = 's';
        worksheet[cellRef].z = '@';
      }
    }
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Duplicate Report');
    XLSX.writeFile(workbook, `${safeBase}.xlsx`);
    return;
  }

  if (format === 'csv') {
    const headers = [
      'S.No.',
      'Consumer Number',
      'First Entry',
      'Last Entry',
      'Number of Entries',
      'Delivery Man',
      'Status',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r['S.No.'],
          `"\t${r['Consumer Number']}"`,
          `"${r['First Entry']}"`,
          `"${r['Last Entry']}"`,
          r['Number of Entries'],
          `"${r['Delivery Man'].replace(/"/g, '""')}"`,
          `"${r.Status}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeBase}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`${agencyName} — ${reportTitle}`, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated in IST (Asia/Kolkata): ${formatIST().timestampIST} | Duplicate Groups: ${rows.length}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['S.No.', 'Consumer Number', 'First Entry', 'Last Entry', 'Number of Entries', 'Delivery Man', 'Status']],
      body: rows.map((r) => [
        r['S.No.'],
        r['Consumer Number'],
        r['First Entry'],
        r['Last Entry'],
        r['Number of Entries'],
        r['Delivery Man'],
        r.Status,
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [185, 28, 28], textColor: 255 },
    });

    doc.save(`${safeBase}.pdf`);
  }
}

/**
 * Generate Blob for standard records (for Google Drive upload)
 */
export function generateStandardRecordsBlob(
  rows: StandardExportRow[],
  format: ExportFormat,
  filenameBase: string,
  reportTitle: string,
  agencyName: string
): { blob: Blob; mimeType: string; fileName: string } {
  const safeBase = filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:G1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ c: 3, r: R });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = 's';
        worksheet[cellRef].z = '@';
      }
    }
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LPG Entries');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return {
      blob,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${safeBase}.xlsx`,
    };
  }

  if (format === 'csv') {
    const headers = ['S.No.', 'Date', 'Time', 'Consumer Number', 'Delivery Man', 'Duplicate Status', 'Entered By'];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r['S.No.'],
          `"${r.Date}"`,
          `"${r.Time}"`,
          `"\t${r['Consumer Number']}"`,
          `"${r['Delivery Man'].replace(/"/g, '""')}"`,
          `"${r['Duplicate Status']}"`,
          `"${r['Entered By'].replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    return {
      blob,
      mimeType: 'text/csv',
      fileName: `${safeBase}.csv`,
    };
  }

  // PDF
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`${agencyName} — ${reportTitle}`, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated in IST (Asia/Kolkata): ${formatIST().timestampIST} | Total Rows: ${rows.length}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [['S.No.', 'Date (IST)', 'Time (IST)', 'Consumer Number', 'Delivery Man', 'Duplicate Status', 'Entered By']],
    body: rows.map((r) => [
      r['S.No.'],
      r.Date,
      r.Time,
      r['Consumer Number'],
      r['Delivery Man'],
      r['Duplicate Status'],
      r['Entered By'],
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const pdfOutput = doc.output('blob');
  return {
    blob: pdfOutput,
    mimeType: 'application/pdf',
    fileName: `${safeBase}.pdf`,
  };
}

/**
 * Generate Blob for duplicate reports (for Google Drive upload)
 */
export function generateDuplicateReportBlob(
  rows: DuplicateReportExportRow[],
  format: ExportFormat,
  filenameBase: string,
  reportTitle: string,
  agencyName: string
): { blob: Blob; mimeType: string; fileName: string } {
  const safeBase = filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:G1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = 's';
        worksheet[cellRef].z = '@';
      }
    }
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Duplicate Report');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return {
      blob,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${safeBase}.xlsx`,
    };
  }

  if (format === 'csv') {
    const headers = [
      'S.No.',
      'Consumer Number',
      'First Entry',
      'Last Entry',
      'Number of Entries',
      'Delivery Man',
      'Status',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r['S.No.'],
          `"\t${r['Consumer Number']}"`,
          `"${r['First Entry']}"`,
          `"${r['Last Entry']}"`,
          r['Number of Entries'],
          `"${r['Delivery Man'].replace(/"/g, '""')}"`,
          `"${r.Status}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    return {
      blob,
      mimeType: 'text/csv',
      fileName: `${safeBase}.csv`,
    };
  }

  // PDF
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`${agencyName} — ${reportTitle}`, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated in IST (Asia/Kolkata): ${formatIST().timestampIST} | Duplicate Groups: ${rows.length}`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [['S.No.', 'Consumer Number', 'First Entry', 'Last Entry', 'Number of Entries', 'Delivery Man', 'Status']],
    body: rows.map((r) => [
      r['S.No.'],
      r['Consumer Number'],
      r['First Entry'],
      r['Last Entry'],
      r['Number of Entries'],
      r['Delivery Man'],
      r.Status,
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [185, 28, 28], textColor: 255 },
  });

  const pdfOutput = doc.output('blob');
  return {
    blob: pdfOutput,
    mimeType: 'application/pdf',
    fileName: `${safeBase}.pdf`,
  };
}

/**
 * Generate Blob for Customer Register Excel (.xlsx)
 */
export function generateCustomerRegisterBlob(
  customers: Array<{ consumer_number: string; customer_name: string; mobile?: string; address?: string }>,
  agencyName: string
): { blob: Blob; mimeType: string; fileName: string } {
  const nowIST = formatIST();
  const dateStr = nowIST.dateIST.replace(/-/g, '_');
  const safeBase = `LPG_Customer_Register_${dateStr}`;

  const rows = customers.map((c, idx) => ({
    'S.No.': idx + 1,
    'Consumer Number': c.consumer_number,
    'Customer Name': c.customer_name,
    'Mobile Number': c.mobile || '',
    'Address / Area': c.address || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:E1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
    if (worksheet[cellRef]) {
      worksheet[cellRef].t = 's';
      worksheet[cellRef].z = '@';
    }
  }
  worksheet['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 30 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `${safeBase}.xlsx`,
  };
}

/**
 * Generate complete database JSON backup Blob for Google Drive
 */
export function generateDatabaseBackupBlob(dbData: any): { blob: Blob; mimeType: string; fileName: string } {
  const nowIST = formatIST();
  const timestampStr = nowIST.dateIST.replace(/-/g, '_') + '_' + nowIST.timeIST.replace(/[: ]/g, '_');
  const fileName = `LPG_Deduplication_Backup_${timestampStr}.json`;
  const jsonContent = JSON.stringify(dbData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  return {
    blob,
    mimeType: 'application/json',
    fileName,
  };
}
