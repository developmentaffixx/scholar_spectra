import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHEETS_DIR = path.join(__dirname, 'data', 'sheets');
if (!fs.existsSync(SHEETS_DIR)) {
  fs.mkdirSync(SHEETS_DIR, { recursive: true });
}

export const MASTER_EXCEL_FILE = path.join(SHEETS_DIR, 'scholar_spectra_master.xlsx');

export const SHEET_NAMES = {
  ENQUIRIES: 'Admission Enquiries',           // Sheet 1
  SSAT: 'SSAT Registrations',                 // Sheet 2
  PAYMENTS: 'Fee Payments',                   // Sheet 3
  PARTNERSHIPS: 'School Partnerships (SIP)', // Sheet 4
  CAREERS: 'Careers & Faculty'                // Sheet 5
};

// Initial column definitions for each sheet tab
const SHEET_HEADERS = {
  [SHEET_NAMES.ENQUIRIES]: [
    'Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Course', 
    'Target Class', 'Hostel Needed', 'City', 'Source', 'Status', 'Notes', 'Submitted At'
  ],
  [SHEET_NAMES.SSAT]: [
    'Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Class', 
    'Course Stream', 'Test Mode', 'Exam Slot', 'City', 'Status', 'Registered At'
  ],
  [SHEET_NAMES.PAYMENTS]: [
    'Reference ID', 'Student Name', 'Mobile', 'Email', 'Fee Category', 'Amount (INR)', 
    '12-Digit UTR Number', 'Payment Date', 'Receipt File', 'City', 'Status', 'Submitted At'
  ],
  [SHEET_NAMES.PARTNERSHIPS]: [
    'Reference ID', 'Principal / Contact Name', 'Mobile', 'Email', 'Target Program', 
    'Current Class', 'City', 'Source', 'Status', 'Notes', 'Submitted At'
  ],
  [SHEET_NAMES.CAREERS]: [
    'Reference ID', 'Applicant Name', 'Mobile', 'Email', 'Position Applied', 
    'Subject Specialization', 'Total Experience', 'Highest Qualification', 
    'Current City', 'Resume URL', 'Cover Note', 'Status', 'Applied At'
  ]
};

/**
 * Initialize or read existing master multi-sheet workbook
 */
function getWorkbook() {
  if (fs.existsSync(MASTER_EXCEL_FILE)) {
    try {
      return XLSX.readFile(MASTER_EXCEL_FILE);
    } catch (err) {
      console.warn(`[Excel Warning] Recreating workbook:`, err.message);
    }
  }

  const wb = XLSX.utils.book_new();

  // Create all 4 sheets with headers
  Object.entries(SHEET_HEADERS).forEach(([sheetName, headers]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, MASTER_EXCEL_FILE);
  return wb;
}

/**
 * Reset local master Excel workbook with empty sheets containing only headers
 */
export function resetLocalMasterSheet() {
  const wb = XLSX.utils.book_new();
  Object.entries(SHEET_HEADERS).forEach(([sheetName, headers]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, MASTER_EXCEL_FILE);
  return wb;
}

/**
 * Append row to local Excel workbook with 4 tabs
 */
export function appendToLocalSheet(sheetName, rowArray) {
  try {
    const wb = getWorkbook();
    let ws = wb.Sheets[sheetName];

    if (!ws) {
      const headers = SHEET_HEADERS[sheetName] || [];
      ws = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Convert sheet to json array of arrays
    const currentData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    currentData.push(rowArray);

    const updatedWs = XLSX.utils.aoa_to_sheet(currentData);
    wb.Sheets[sheetName] = updatedWs;

    XLSX.writeFile(wb, MASTER_EXCEL_FILE);
    console.log(`📊 [Excel] Appended 1 row to "${sheetName}" in scholar_spectra_master.xlsx`);
    return true;
  } catch (err) {
    console.error(`❌ [Excel Error] Could not write to ${sheetName}:`, err);
    return false;
  }
}

/**
 * Sync row to live Google Spreadsheet
 * (via Google Apps Script Webhook connected to Sheet ID 15kXdBbpO4CHN7_k4n--6zCt7ZxION5svmHtJKqeikSc)
 */
export async function syncToGoogleSheet(sheetName, rowData) {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(`ℹ️ [Google Sheet] GOOGLE_SHEET_WEBHOOK_URL not set in .env. Saved to master Excel workbook tab: "${sheetName}".`);
    return { success: true, mode: 'local_excel_saved' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetName,
        data: rowData,
        timestamp: new Date().toISOString()
      })
    });
    const result = await res.json();
    console.log(`🌐 [Google Sheet Synced] Appended to "${sheetName}":`, result);
    return { success: true, result };
  } catch (err) {
    console.warn(`⚠️ [Google Sheet Webhook Warning] Could not sync to cloud Google Sheet: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to record any form submission across Excel and Google Sheets
 */
export async function recordSubmission(sheetName, rowArray, rowObject = {}) {
  // 1. Write to local multi-sheet Excel
  appendToLocalSheet(sheetName, rowArray);

  // 2. Dispatch to cloud Google Spreadsheet
  syncToGoogleSheet(sheetName, rowObject);
}
