import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { pool } from './db.js';
import { MASTER_EXCEL_FILE, SHEET_NAMES } from './googleSheetService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SSAT_FILE = path.join(DATA_DIR, 'ssat.json');
const PAYMENT_FILE = path.join(DATA_DIR, 'payments.json');
const CAREERS_FILE = path.join(DATA_DIR, 'careers.json');

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

async function clearAllDummyData() {
  console.log('🧹 Clearing all dummy data from backend & database...');

  // 1. Clear JSON files
  fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
  fs.writeFileSync(SSAT_FILE, JSON.stringify([], null, 2));
  fs.writeFileSync(PAYMENT_FILE, JSON.stringify([], null, 2));
  fs.writeFileSync(CAREERS_FILE, JSON.stringify([], null, 2));
  console.log('✅ JSON data files reset to empty array []');

  // 2. Truncate MySQL tables (if connected)
  if (pool) {
    try {
      await pool.query('TRUNCATE TABLE enquiries');
      console.log('✅ Truncated MySQL table: enquiries');

      await pool.query('TRUNCATE TABLE ssat_registrations');
      console.log('✅ Truncated MySQL table: ssat_registrations');

      await pool.query('TRUNCATE TABLE fee_payments');
      console.log('✅ Truncated MySQL table: fee_payments');

      await pool.query('TRUNCATE TABLE career_applications');
      console.log('✅ Truncated MySQL table: career_applications');
    } catch (err) {
      console.warn('⚠️ MySQL truncation error:', err.message);
    }
  }

  // 3. Reset Master Excel Workbook with ONLY column headers and NO dummy rows
  console.log('📊 Rebuilding clean Master Excel Workbook (headers only)...');
  const wb = XLSX.utils.book_new();
  Object.entries(SHEET_HEADERS).forEach(([sheetName, headers]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, MASTER_EXCEL_FILE);
  console.log(`✅ Master Excel file reset cleanly at: ${MASTER_EXCEL_FILE}`);

  console.log('✨ Dummy data removal completed successfully!');
  process.exit(0);
}

clearAllDummyData();
