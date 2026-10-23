import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { sendAdminAlert, sendUserThankYouEmail } from './emailService.js';
import { recordSubmission, SHEET_NAMES, MASTER_EXCEL_FILE, resetLocalMasterSheet } from './googleSheetService.js';
import { 
  verifyLogin, 
  generateAdminToken, 
  authenticateAdmin, 
  initiatePasswordReset, 
  completePasswordReset, 
  getAdminCredentials 
} from './authService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow frontend to load uploaded files & static assets
  contentSecurityPolicy: false // Allow inline scripts/styles for development
}));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in local dev, can be strict in production
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Directories setup
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve brand assets (logo used in emails) statically
const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}
app.use('/assets', express.static(ASSETS_DIR));

// File Upload Handler (Multer) for Payment Receipts & Resumes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${safeBase}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WEBP, PDF, DOC, DOCX files are allowed.'));
    }
  }
});

// Rate Limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes before trying again.' }
});

const formSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 40, // 40 submissions per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Submission limit reached for this hour. Please contact us via phone.' }
});

app.use(generalLimiter);

const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SSAT_FILE = path.join(DATA_DIR, 'ssat.json');
const PAYMENT_FILE = path.join(DATA_DIR, 'payments.json');
const CAREERS_FILE = path.join(DATA_DIR, 'careers.json');
const COUNTERS_FILE = path.join(DATA_DIR, 'counters.json');

// Helper to read JSON safely (fallback)
function readData(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultVal;
  }
}

// Helper to write JSON safely (fallback)
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
    return false;
  }
}

// ── Sequential Reference ID Generator ──
// Produces clean running IDs per form type, e.g. AD-EQ-0001, SSAT-RG-0001, FEE-PAY-0001.
// The next number per prefix is persisted in data/counters.json so IDs never repeat,
// even after a server restart.
const REF_PREFIXES = {
  enquiry: 'AD-EQ',
  ssat: 'SSAT-RG',
  payment: 'FEE-PAY',
  careers: 'FAC-AP'
};

function nextReferenceId(type) {
  const prefix = REF_PREFIXES[type] || 'SS';
  const counters = readData(COUNTERS_FILE, {});
  const current = Number.isInteger(counters[prefix]) ? counters[prefix] : 0;
  const next = current + 1;
  counters[prefix] = next;
  writeData(COUNTERS_FILE, counters);
  // Zero-pad to 4 digits (0001); grows automatically past 9999.
  const padded = String(next).padStart(4, '0');
  return `${prefix}-${padded}`;
}

// ── API ROUTES ──

// 0. API Root — simple status so hitting /api doesn't return "Cannot GET /api/"
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    status: 'success',
    service: 'Scholar Spectra API Server v2.0',
    message: 'API is running',
    docs: {
      health: '/api/health'
    },
    timestamp: new Date().toISOString()
  });
});

// 1. Health & Database Check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'Disconnected / Fallback mode';
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT 1 as val');
      if (rows && rows.length > 0) dbStatus = 'Connected to MySQL (scholar_spectra)';
    } catch (err) {
      dbStatus = `MySQL error: ${err.message}`;
    }
  }

  res.json({
    status: 'ok',
    service: 'Scholar Spectra API Server v2.0',
    database: dbStatus,
    adminEmail: process.env.ADMIN_EMAIL || 'developmentaffixx@gmail.com',
    googleSheetUrl: process.env.GOOGLE_SHEET_URL || 'https://docs.google.com/spreadsheets/d/15kXdBbpO4CHN7_k4n--6zCt7ZxION5svmHtJKqeikSc',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Upload Endpoint for Payment Receipts & Resumes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: 'File uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname,
    fileUrl,
    size: req.file.size
  });
});

// 3. Submit Admission Enquiry (Sheet 1: Admission Enquiries)
app.post('/api/enquiry', formSubmissionLimiter, async (req, res) => {
  const { name, phone, email, course, targetClass, hostelNeeded, city, notes, message, source, studentType } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required.' });
  }

  const refId = nextReferenceId('enquiry');
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanCourse = course || 'Regular NEET for 11th and 12th';
  const cleanCity = city ? city.trim() : 'Puducherry';
  const cleanSource = source || 'Website Modal';
  const cleanClass = targetClass || 'Class 12 Ongoing';
  const cleanHostel = hostelNeeded || 'Day Scholar (No Hostel)';
  const cleanNotes = notes || message || '';
  const cleanType = studentType || 'Student / Parent';
  const nowIso = new Date().toISOString();

  // 1. Always write to local JSON backup
  const leads = readData(LEADS_FILE);
  const newLead = {
    id: refId,
    name: cleanName,
    phone: cleanPhone,
    email: email || '',
    studentType: cleanType,
    course: cleanCourse,
    targetClass: cleanClass,
    hostelNeeded: cleanHostel,
    city: cleanCity,
    status: 'New',
    source: cleanSource,
    notes: cleanNotes,
    timestamp: nowIso
  };
  leads.unshift(newLead);
  writeData(LEADS_FILE, leads);

  // 2. Insert into MySQL if pool is available (includes student_type)
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO enquiries (reference_id, name, phone, email, student_type, course, target_class, hostel_needed, city, source, status, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)`,
        [refId, cleanName, cleanPhone, email || null, cleanType, cleanCourse, cleanClass, cleanHostel, cleanCity, cleanSource, cleanNotes || null]
      );
      console.log(`[MySQL] Inserted enquiry ${refId} for ${cleanName}`);
    } catch (dbErr) {
      // If student_type column is missing in legacy DB, retry without it
      try {
        await pool.query(
          `INSERT INTO enquiries (reference_id, name, phone, email, course, target_class, hostel_needed, city, source, status, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)`,
          [refId, cleanName, cleanPhone, email || null, cleanCourse, cleanClass, cleanHostel, cleanCity, cleanSource, cleanNotes || null]
        );
      } catch (innerErr) {
        console.warn(`[MySQL Warning] Could not insert enquiry into DB: ${innerErr.message}`);
      }
    }
  }

  const isSip = cleanSource.toLowerCase().includes('school-partnership') || 
                cleanSource.toLowerCase().includes('sip') ||
                cleanType.toLowerCase().includes('school') || 
                cleanType.toLowerCase().includes('principal') ||
                cleanCourse.toLowerCase().includes('sip');

  // 3. Record to Master Multi-Tab Excel & Google Spreadsheet
  if (isSip) {
    const sipRow = [
      refId, cleanName, cleanPhone, email || '', cleanCourse,
      cleanClass, cleanCity, cleanSource, 'New', cleanNotes, nowIso
    ];
    recordSubmission(SHEET_NAMES.PARTNERSHIPS, sipRow, newLead);
  } else {
    const rowArray = [
      refId, cleanName, cleanPhone, email || '', cleanCourse,
      cleanClass, cleanHostel, cleanCity, cleanSource, 'New', cleanNotes, nowIso
    ];
    recordSubmission(SHEET_NAMES.ENQUIRIES, rowArray, newLead);
  }

  // 4. Send Gmail SMTP Alerts (Both Admin and User)
  const adminPromise = sendAdminAlert({
    subject: isSip 
      ? `🤝 New School Partnership Enquiry: ${cleanName}`
      : `🎓 New Admission Enquiry: ${cleanName} (${cleanCourse})`,
    title: isSip 
      ? 'New School Integrated Program (SIP) Enquiry Received'
      : 'New Student Admission Enquiry Received',
    badge: isSip ? 'SIP - SCHOOL PARTNERSHIP' : 'LEAD - SHEET 1',
    details: {
      'Reference ID': refId,
      [isSip ? 'Principal / Contact Name' : 'Student Name']: cleanName,
      'Category / Role': cleanType,
      'WhatsApp Mobile': cleanPhone,
      'Email Address': email || 'Not provided',
      'Target Course': cleanCourse,
      'Current Class': cleanClass,
      'Hostel Needed': cleanHostel,
      'City / Town': cleanCity,
      'Message / Notes': cleanNotes,
      'Lead Source': cleanSource,
      'Date & Time': new Date().toLocaleString()
    },
    rawData: newLead
  });

  // 5. Send automated Confirmation / Thank You Email to User
  let userPromise = Promise.resolve();
  if (email && email.includes('@')) {
    userPromise = sendUserThankYouEmail({
      toEmail: email.trim(),
      name: cleanName,
      formType: isSip ? 'school-partnership' : 'enquiry',
      refId: refId,
      details: {
        'Program / Course': cleanCourse,
        'Current Class': cleanClass,
        'Hostel Requirement': cleanHostel,
        'City / Location': cleanCity,
        'Category / Role': cleanType,
        'Contact Mobile': cleanPhone
      }
    });
  }

  try {
    await Promise.allSettled([adminPromise, userPromise]);
  } catch (mErr) {
    console.warn('[Mail Warning]', mErr.message);
  }

  console.log(`[New Lead] ${refId}: ${cleanName} (${cleanPhone}) for ${cleanCourse}`);

  res.status(201).json({
    success: true,
    message: 'Admission enquiry received successfully!',
    lead: newLead
  });
});

// 4. Get All Enquiries (Protected by JWT)
app.get('/api/enquiries', authenticateAdmin, async (req, res) => {
  const { status, course } = req.query;

  if (pool) {
    try {
      let query = 'SELECT * FROM enquiries';
      const params = [];
      const conditions = [];

      if (status && status !== 'All') {
        conditions.push('status = ?');
        params.push(status);
      }
      if (course && course !== 'All') {
        conditions.push('course = ?');
        params.push(course);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC';

      const [rows] = await pool.query(query, params);
      const mapped = rows.map(r => ({
        id: r.reference_id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        studentType: r.student_type || 'Student / Parent',
        course: r.course,
        targetClass: r.target_class,
        hostelNeeded: r.hostel_needed,
        city: r.city,
        status: r.status,
        source: r.source,
        notes: r.notes,
        timestamp: r.created_at
      }));

      return res.json({ success: true, count: mapped.length, source: 'mysql', leads: mapped });
    } catch (dbErr) {
      console.warn('[MySQL Warning] Falling back to JSON leads:', dbErr.message);
    }
  }

  // Fallback to JSON
  let leads = readData(LEADS_FILE);
  if (status && status !== 'All') {
    leads = leads.filter(l => l.status === status);
  }
  if (course && course !== 'All') {
    leads = leads.filter(l => l.course === course);
  }

  res.json({ success: true, count: leads.length, source: 'json_fallback', leads });
});

// 5. Update Lead Status (Protected by JWT)
app.patch('/api/enquiries/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (pool) {
    try {
      await pool.query(
        'UPDATE enquiries SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE reference_id = ?',
        [status || null, notes !== undefined ? notes : null, id]
      );
    } catch (err) {
      console.warn('[MySQL Warning] Could not update enquiry status:', err.message);
    }
  }

  const leads = readData(LEADS_FILE);
  const index = leads.findIndex(l => l.id === id);

  if (index !== -1) {
    if (status) leads[index].status = status;
    if (notes !== undefined) leads[index].notes = notes;
    leads[index].updatedAt = new Date().toISOString();
    writeData(LEADS_FILE, leads);
    return res.json({ success: true, message: 'Lead updated', lead: leads[index] });
  }

  res.json({ success: true, message: 'Lead updated in database' });
});

// 6. Submit SSAT Scholarship Registration (Sheet 2: SSAT Registrations)
app.post('/api/ssat', formSubmissionLimiter, async (req, res) => {
  const { name, phone, email, targetClass, courseStream, testMode, examDate, city } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, error: 'Name and phone are required.' });
  }

  const refId = nextReferenceId('ssat');
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanClass = targetClass || 'Class 12 Passed / Repeater';
  const cleanStream = courseStream || 'NEET Medical Stream';
  const cleanMode = testMode || 'Offline Puducherry Campus';
  const cleanDate = examDate || 'This Sunday (10:00 AM - 1:00 PM)';
  const cleanCity = city ? city.trim() : 'Puducherry';
  const nowIso = new Date().toISOString();

  const ssatList = readData(SSAT_FILE);
  const newRegistration = {
    id: refId,
    name: cleanName,
    phone: cleanPhone,
    email: email ? email.trim() : '',
    targetClass: cleanClass,
    courseStream: cleanStream,
    testMode: cleanMode,
    examDate: cleanDate,
    city: cleanCity,
    status: 'Registered',
    timestamp: nowIso
  };

  ssatList.unshift(newRegistration);
  writeData(SSAT_FILE, ssatList);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO ssat_registrations (reference_id, name, phone, email, target_class, course_stream, test_mode, exam_date, city, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')`,
        [refId, cleanName, cleanPhone, email || null, cleanClass, cleanStream, cleanMode, cleanDate, cleanCity]
      );
      console.log(`[MySQL] Inserted SSAT registration ${refId} for ${cleanName}`);
    } catch (dbErr) {
      console.warn(`[MySQL Warning] Could not insert SSAT registration into DB: ${dbErr.message}`);
    }
  }

  // Record to Master Excel Sheet 2 & Google Spreadsheet
  const rowArray = [
    refId, cleanName, cleanPhone, email || '', cleanClass,
    cleanStream, cleanMode, cleanDate, cleanCity, 'Registered', nowIso
  ];
  recordSubmission(SHEET_NAMES.SSAT, rowArray, newRegistration);

  // Send Gmail SMTP Alert to admin
  const adminPromise = sendAdminAlert({
    subject: `🏆 New SSAT 2026 Registration: ${cleanName}`,
    title: 'New SSAT 2026 Scholarship Exam Registration',
    badge: 'SSAT - SHEET 2',
    details: {
      'Registration ID': refId,
      'Student Name': cleanName,
      'WhatsApp Mobile': cleanPhone,
      'Email Address': email || 'Not provided',
      'Target Stream': cleanStream,
      'Current Class': cleanClass,
      'Exam Mode': cleanMode,
      'Preferred Slot': cleanDate,
      'City / Town': cleanCity,
      'Registered At': new Date().toLocaleString()
    },
    rawData: newRegistration
  });

  // Send automated Confirmation Email to Student / Parent
  let userPromise = Promise.resolve();
  if (email && email.includes('@')) {
    userPromise = sendUserThankYouEmail({
      toEmail: email.trim(),
      name: cleanName,
      formType: 'ssat',
      refId: refId,
      details: {
        'Target Stream': cleanStream,
        'Current Class': cleanClass,
        'Exam Mode': cleanMode,
        'Preferred Slot': cleanDate,
        'City / Town': cleanCity,
        'Registered Mobile': cleanPhone
      }
    });
  }

  try {
    await Promise.allSettled([adminPromise, userPromise]);
  } catch (mErr) {
    console.warn('[Mail Warning]', mErr.message);
  }

  console.log(`[SSAT Registration] ${refId}: ${cleanName} (${cleanPhone})`);

  res.status(201).json({
    success: true,
    message: 'SSAT 2026 registration completed successfully!',
    registration: newRegistration
  });
});

// 7. Get All SSAT Registrations (Protected by JWT)
app.get('/api/ssat', authenticateAdmin, async (req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM ssat_registrations ORDER BY created_at DESC');
      const mapped = rows.map(r => ({
        id: r.reference_id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        targetClass: r.target_class,
        courseStream: r.course_stream,
        testMode: r.test_mode,
        examDate: r.exam_date,
        city: r.city,
        status: r.status,
        timestamp: r.created_at
      }));
      return res.json({ success: true, count: mapped.length, source: 'mysql', registrations: mapped });
    } catch (dbErr) {
      console.warn('[MySQL Warning] Falling back to JSON SSAT:', dbErr.message);
    }
  }

  const ssatList = readData(SSAT_FILE);
  res.json({ success: true, count: ssatList.length, source: 'json_fallback', registrations: ssatList });
});

// 8. Submit Online Fee Payment Verification (Sheet 3: Fee Payments)
app.post('/api/payment', formSubmissionLimiter, async (req, res) => {
  const { name, phone, email, feeType, amount, utrNumber, receiptFile, city, paymentDate } = req.body;

  if (!name || !phone || !utrNumber) {
    return res.status(400).json({ success: false, error: 'Name, phone and UTR number are required.' });
  }

  const refId = nextReferenceId('payment');
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = email ? email.trim() : '';
  const cleanFeeType = feeType || 'Crash Course Fee (NEET / JEE)';
  const cleanAmount = amount || '15,000';
  const numericAmount = parseFloat(String(cleanAmount).replace(/[^0-9.]/g, '')) || 0;
  const cleanUtr = utrNumber.trim();
  const cleanReceipt = receiptFile || 'Attached';
  const cleanCity = city ? city.trim() : 'Puducherry';
  const cleanPayDate = paymentDate || new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const payments = readData(PAYMENT_FILE);
  const newPayment = {
    id: refId,
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    feeType: cleanFeeType,
    amount: cleanAmount,
    numericAmount,
    utrNumber: cleanUtr,
    paymentDate: cleanPayDate,
    receiptFile: cleanReceipt,
    city: cleanCity,
    status: 'Pending Verification',
    timestamp: nowIso
  };

  payments.unshift(newPayment);
  writeData(PAYMENT_FILE, payments);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO fee_payments (reference_id, name, phone, email, fee_type, amount, utr_number, payment_date, receipt_file, city, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification')`,
        [refId, cleanName, cleanPhone, cleanEmail || null, cleanFeeType, numericAmount, cleanUtr, cleanPayDate, cleanReceipt, cleanCity]
      );
      console.log(`[MySQL] Inserted fee payment ${refId} (UTR: ${cleanUtr}) for ${cleanName}`);
    } catch (dbErr) {
      try {
        await pool.query(
          `INSERT INTO fee_payments (reference_id, name, phone, fee_type, amount, utr_number, payment_date, receipt_file, city, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification')`,
          [refId, cleanName, cleanPhone, cleanFeeType, numericAmount, cleanUtr, cleanPayDate, cleanReceipt, cleanCity]
        );
      } catch (innerErr) {
        console.warn(`[MySQL Warning] Could not insert fee payment into DB: ${innerErr.message}`);
      }
    }
  }

  // Record to Master Excel Sheet 3 & Google Spreadsheet
  const rowArray = [
    refId, cleanName, cleanPhone, cleanEmail, cleanFeeType, cleanAmount,
    cleanUtr, cleanPayDate, cleanReceipt, cleanCity, 'Pending Verification', nowIso
  ];
  recordSubmission(SHEET_NAMES.PAYMENTS, rowArray, newPayment);

  // Send Gmail SMTP Alert to admin
  const adminPromise = sendAdminAlert({
    subject: `💳 Fee Payment Received: ₹${cleanAmount} (UTR: ${cleanUtr}) - ${cleanName}`,
    title: 'New Online Fee Transaction Verification Submitted',
    badge: 'PAYMENT - SHEET 3',
    details: {
      'Payment Ref ID': refId,
      'Student Name': cleanName,
      'WhatsApp Mobile': cleanPhone,
      'Email Address': cleanEmail || 'Not provided',
      'Fee Category': cleanFeeType,
      'Amount Paid (₹)': cleanAmount,
      '12-Digit UTR Number': cleanUtr,
      'Payment Date': cleanPayDate,
      'Receipt Attachment': cleanReceipt,
      'City / Town': cleanCity,
      'Submission Time': new Date().toLocaleString()
    },
    rawData: newPayment
  });

  // Send automated Confirmation / Thank You Email to User
  let userPromise = Promise.resolve();
  if (cleanEmail && cleanEmail.includes('@')) {
    userPromise = sendUserThankYouEmail({
      toEmail: cleanEmail,
      name: cleanName,
      formType: 'payment',
      refId: refId,
      details: {
        'Fee Category': cleanFeeType,
        'Amount Paid': `₹${cleanAmount}`,
        '12-Digit UTR Number': cleanUtr,
        'Payment Date': cleanPayDate,
        'Receipt Attachment': cleanReceipt,
        'Registered Mobile': cleanPhone
      }
    });
  }

  try {
    await Promise.allSettled([adminPromise, userPromise]);
  } catch (mErr) {
    console.warn('[Mail Warning]', mErr.message);
  }

  console.log(`[Fee Payment] ${refId}: ${cleanName} (UTR: ${cleanUtr}) for ${cleanFeeType}`);

  res.status(201).json({
    success: true,
    message: 'Payment verification details recorded successfully!',
    payment: newPayment
  });
});

// 9. Get All Fee Payments (Protected by JWT)
app.get('/api/payments', authenticateAdmin, async (req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM fee_payments ORDER BY created_at DESC');
      const mapped = rows.map(r => ({
        id: r.reference_id,
        name: r.name,
        phone: r.phone,
        email: r.email || '',
        feeType: r.fee_type,
        amount: r.amount,
        utrNumber: r.utr_number,
        paymentDate: r.payment_date,
        receiptFile: r.receipt_file,
        city: r.city,
        status: r.status,
        timestamp: r.created_at
      }));
      return res.json({ success: true, count: mapped.length, source: 'mysql', payments: mapped });
    } catch (dbErr) {
      console.warn('[MySQL Warning] Falling back to JSON payments:', dbErr.message);
    }
  }

  const payments = readData(PAYMENT_FILE);
  res.json({ success: true, count: payments.length, source: 'json_fallback', payments });
});

// 10. Submit Faculty & Careers Application (Sheet 4: Careers & Faculty)
app.post('/api/careers', formSubmissionLimiter, async (req, res) => {
  const { name, phone, email, position, subject, experience, qualification, location, resumeUrl, coverNote } = req.body;

  if (!name || !phone || !email) {
    return res.status(400).json({ success: false, error: 'Name, phone, and email are required.' });
  }

  const refId = nextReferenceId('careers');
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim();
  const cleanPosition = position || 'General Faculty Application';
  const cleanSubject = subject || 'Science & Mathematics';
  const cleanExp = experience || '3 - 5 Years';
  const cleanQual = qualification || 'M.Sc / Ph.D';
  const cleanLoc = location ? location.trim() : 'Puducherry';
  const cleanResume = resumeUrl ? resumeUrl.trim() : '';
  const cleanNote = coverNote ? coverNote.trim() : '';
  const nowIso = new Date().toISOString();

  const applications = readData(CAREERS_FILE);
  const newApp = {
    id: refId,
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    position: cleanPosition,
    subject: cleanSubject,
    experience: cleanExp,
    qualification: cleanQual,
    location: cleanLoc,
    resumeUrl: cleanResume,
    coverNote: cleanNote,
    status: 'Applied',
    timestamp: nowIso
  };

  applications.unshift(newApp);
  writeData(CAREERS_FILE, applications);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO career_applications (reference_id, name, phone, email, position, subject, experience, qualification, location, resume_url, cover_note, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Applied')`,
        [refId, cleanName, cleanPhone, cleanEmail, cleanPosition, cleanSubject, cleanExp, cleanQual, cleanLoc, cleanResume || null, cleanNote || null]
      );
      console.log(`[MySQL] Inserted career application ${refId} for ${cleanName}`);
    } catch (dbErr) {
      console.warn(`[MySQL Warning] Could not insert career application into DB: ${dbErr.message}`);
    }
  }

  // Record to Master Excel Sheet 4 & Google Spreadsheet
  const rowArray = [
    refId, cleanName, cleanPhone, cleanEmail, cleanPosition,
    cleanSubject, cleanExp, cleanQual, cleanLoc, cleanResume, cleanNote, 'Applied', nowIso
  ];
  recordSubmission(SHEET_NAMES.CAREERS, rowArray, newApp);

  // Send Gmail SMTP Alert to developmentaffixx@gmail.com
  const adminPromise = sendAdminAlert({
    subject: `💼 New Faculty Application: ${cleanName} — ${cleanPosition}`,
    title: 'New Faculty / Academic Recruitment Application',
    badge: 'CAREERS - SHEET 4',
    details: {
      'Application Ref ID': refId,
      'Applicant Full Name': cleanName,
      'Mobile Number': cleanPhone,
      'Email Address': cleanEmail,
      'Position Applied': cleanPosition,
      'Subject Specialization': cleanSubject,
      'Teaching Experience': cleanExp,
      'Highest Qualification': cleanQual,
      'Current Location': cleanLoc,
      'Resume / Portfolio URL': cleanResume || 'Not linked',
      'Cover Note': cleanNote || 'None',
      'Applied At': new Date().toLocaleString()
    },
    rawData: newApp
  });

  // Send Thank You confirmation to applicant
  let userPromise = Promise.resolve();
  if (cleanEmail && cleanEmail.includes('@')) {
    userPromise = sendUserThankYouEmail({
      toEmail: cleanEmail,
      name: cleanName,
      formType: 'careers',
      refId: refId,
      details: {
        'Position Applied': cleanPosition,
        'Subject Specialization': cleanSubject,
        'Experience': cleanExp,
        'Highest Qualification': cleanQual,
        'Contact Mobile': cleanPhone
      }
    });
  }

  try {
    await Promise.allSettled([adminPromise, userPromise]);
  } catch (mErr) {
    console.warn('[Mail Warning]', mErr.message);
  }

  console.log(`[Career Application] ${refId}: ${cleanName} for ${cleanPosition}`);

  res.status(201).json({
    success: true,
    message: 'Faculty application submitted successfully!',
    application: newApp
  });
});

// 11. Get All Career Applications (Protected by JWT)
app.get('/api/careers', authenticateAdmin, async (req, res) => {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM career_applications ORDER BY created_at DESC');
      const mapped = rows.map(r => ({
        id: r.reference_id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        position: r.position,
        subject: r.subject,
        experience: r.experience,
        qualification: r.qualification,
        location: r.location,
        resumeUrl: r.resume_url,
        coverNote: r.cover_note,
        status: r.status,
        timestamp: r.created_at
      }));
      return res.json({ success: true, count: mapped.length, source: 'mysql', applications: mapped });
    } catch (dbErr) {
      console.warn('[MySQL Warning] Falling back to JSON careers:', dbErr.message);
    }
  }

  const applications = readData(CAREERS_FILE);
  res.json({ success: true, count: applications.length, source: 'json_fallback', applications });
});

// 12. Staff Portal Authentication: Login (Protected with Rate Limiter & JWT)
app.post('/api/admin/login', authLimiter, async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ success: false, error: 'Login ID and password are required.' });
  }

  const authResult = await verifyLogin(loginId, password);
  if (!authResult.isValid) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid Login ID or Password. Please check credentials or use Forgot Password.' 
    });
  }

  const token = generateAdminToken(authResult.user);

  res.json({
    success: true,
    message: 'Staff authentication successful!',
    token,
    user: authResult.user
  });
});

// 13. Staff Portal Authentication: Forgot Password (Sends reset email to developmentaffixx@gmail.com)
app.post('/api/admin/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  const result = await initiatePasswordReset(email);
  res.json(result);
});

// 14. Staff Portal Authentication: Reset Password
app.post('/api/admin/reset-password', authLimiter, (req, res) => {
  const { token, newPassword } = req.body;
  const result = completePasswordReset(token, newPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 15. Institute Leads & Metrics Summary (Protected by JWT)
app.get('/api/stats', authenticateAdmin, async (req, res) => {
  let leadsCount = 0;
  let newLeads = 0;
  let ssatCount = 0;
  let paymentsCount = 0;
  let careersCount = 0;
  let usedMysql = false;

  if (pool) {
    try {
      const [[{ totalLeads }]] = await pool.query('SELECT COUNT(*) as totalLeads FROM enquiries');
      const [[{ totalNew }]] = await pool.query("SELECT COUNT(*) as totalNew FROM enquiries WHERE status = 'New'");
      const [[{ totalSsat }]] = await pool.query('SELECT COUNT(*) as totalSsat FROM ssat_registrations');
      const [[{ totalPayments }]] = await pool.query('SELECT COUNT(*) as totalPayments FROM fee_payments');
      const [[{ totalCareers }]] = await pool.query('SELECT COUNT(*) as totalCareers FROM career_applications');
      leadsCount = totalLeads;
      newLeads = totalNew;
      ssatCount = totalSsat;
      paymentsCount = totalPayments;
      careersCount = totalCareers;
      usedMysql = true;
    } catch (err) {
      // Fallback
    }
  }

  if (!usedMysql) {
    const leads = readData(LEADS_FILE);
    const ssat = readData(SSAT_FILE);
    const payments = readData(PAYMENT_FILE);
    const careers = readData(CAREERS_FILE);
    leadsCount = leads.length;
    newLeads = leads.filter(l => l.status === 'New').length;
    ssatCount = ssat.length;
    paymentsCount = payments.length;
    careersCount = careers.length;
  }

  res.json({
    success: true,
    stats: {
      totalEnquiries: leadsCount,
      newLeads,
      ssatRegistrations: ssatCount,
      feePayments: paymentsCount,
      careerApplications: careersCount
    }
  });
});

// 15b. Clear Dummy / Test Data Endpoint (Protected by JWT)
app.post('/api/admin/clear-dummy-data', authenticateAdmin, async (req, res) => {
  try {
    // 1. Reset JSON files to empty arrays
    writeData(LEADS_FILE, []);
    writeData(SSAT_FILE, []);
    writeData(PAYMENT_FILE, []);
    writeData(CAREERS_FILE, []);

    // 2. Truncate MySQL tables if available
    if (pool) {
      try {
        await pool.query('TRUNCATE TABLE enquiries');
        await pool.query('TRUNCATE TABLE ssat_registrations');
        await pool.query('TRUNCATE TABLE fee_payments');
        await pool.query('TRUNCATE TABLE career_applications');
      } catch (dbErr) {
        console.warn('[MySQL Truncate Error]', dbErr.message);
      }
    }

    // 3. Reset Master Excel Workbook with headers only
    resetLocalMasterSheet();

    res.json({
      success: true,
      message: 'All dummy and test data have been cleared successfully.'
    });
  } catch (err) {
    console.error('Error clearing dummy data:', err);
    res.status(500).json({ success: false, error: 'Failed to clear dummy data' });
  }
});

// 16. Export Complete Multi-Tab Master Excel Spreadsheet (Protected by JWT)
app.get('/api/export/excel', authenticateAdmin, (req, res) => {
  if (fs.existsSync(MASTER_EXCEL_FILE)) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="scholar_spectra_master.xlsx"');
    return res.sendFile(MASTER_EXCEL_FILE);
  }

  res.status(404).json({ success: false, error: 'Master Excel file not yet generated. Submit a form first.' });
});

// 17. Export CSV (Protected by JWT)
app.get('/api/export/csv', authenticateAdmin, async (req, res) => {
  let leads = [];
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM enquiries ORDER BY created_at DESC');
      leads = rows.map(r => ({
        id: r.reference_id,
        name: r.name,
        phone: r.phone,
        course: r.course,
        city: r.city,
        status: r.status,
        source: r.source,
        timestamp: r.created_at
      }));
    } catch (e) {
      leads = readData(LEADS_FILE);
    }
  } else {
    leads = readData(LEADS_FILE);
  }

  const headers = ['Lead ID', 'Student Name', 'Phone', 'Target Course', 'City', 'Status', 'Source', 'Date'];
  const rows = leads.map(l => [
    l.id,
    `"${l.name}"`,
    l.phone,
    `"${l.course}"`,
    `"${l.city}"`,
    l.status,
    `"${l.source}"`,
    new Date(l.timestamp).toLocaleDateString()
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="scholar_spectra_leads.csv"');
  res.status(200).send(csvContent);
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Scholar Spectra API Server (Production v2.0)`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📧 Notification Target: ${process.env.ADMIN_EMAIL || 'developmentaffixx@gmail.com'}`);
  console.log(`📊 Google Sheet Target: ${process.env.GOOGLE_SHEET_URL}`);
  console.log(`🗄️  Database Target: ${process.env.DB_NAME || 'scholar_spectra'}`);
  console.log(`📁 Local Data Backup: ${DATA_DIR}`);
  console.log(`📁 Uploads Directory: ${UPLOADS_DIR}`);
  console.log(`🔒 Security: Helmet, Rate-Limit, JWT, Bcrypt Active`);
  console.log(`=========================================`);
});
