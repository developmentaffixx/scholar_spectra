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

// ── 1. 5 SAMPLES FOR ADMISSION ENQUIRIES ──
const admissionSamples = [
  {
    id: 'SS-ENQ-10492',
    name: 'R. Vigneshwaran',
    phone: '9840198401',
    email: 'vignesh.neet2026@gmail.com',
    studentType: 'Student',
    course: 'Regular NEET (11th & 12th)',
    targetClass: 'Class 11 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Puducherry',
    status: 'New',
    source: 'Website Modal (enquiry)',
    notes: 'Interested in weekend evening batch for 11th NEET preparation',
    timestamp: '2026-09-24T09:30:00.000Z'
  },
  {
    id: 'SS-ENQ-21584',
    name: 'Priya Soundarajan',
    phone: '9843210987',
    email: 'priya.soundar@gmail.com',
    studentType: 'Student',
    course: 'Repeaters Batch for NEET',
    targetClass: 'Class 12 Passed (Dropper)',
    hostelNeeded: 'Yes - Girls Hostel (Puducherry)',
    city: 'Cuddalore',
    status: 'Counseling Scheduled',
    source: 'Website Modal (enquiry)',
    notes: 'Scored 510 in NEET 2025; aims for JIPMER in 2026. Needs girls hostel accommodation.',
    timestamp: '2026-09-25T11:15:00.000Z'
  },
  {
    id: 'SS-ENQ-32940',
    name: 'K. Sanjay',
    phone: '9443215678',
    email: 'sanjay.k98@gmail.com',
    studentType: 'Student',
    course: 'Crash Course NEET',
    targetClass: 'Class 12 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Villupuram',
    status: 'Contacted',
    source: 'Website Modal (admission)',
    notes: 'Requires intensive revision tests and high-yield physics test series.',
    timestamp: '2026-09-26T14:20:00.000Z'
  },
  {
    id: 'SS-ENQ-43821',
    name: 'S. Dhanush',
    phone: '9894371234',
    email: 'dhanush.iitjee@gmail.com',
    studentType: 'Student',
    course: 'Regular JEE for 11th and 12th',
    targetClass: 'Class 11 Ongoing',
    hostelNeeded: 'Yes - Boys Hostel (Puducherry)',
    city: 'Neyveli',
    status: 'Admitted',
    source: 'Website Modal (enquiry)',
    notes: 'Admitted for 2-Year Integrated JEE Advanced batch with residential boys hostel.',
    timestamp: '2026-09-27T10:00:00.000Z'
  },
  {
    id: 'SS-ENQ-54719',
    name: 'Meera Krishnan',
    phone: '9442189012',
    email: 'meera.parents@gmail.com',
    studentType: 'Parent',
    course: 'Foundation Course (6th to 10th)',
    targetClass: 'Class 9th & 10th',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Puducherry',
    status: 'New',
    source: 'Website Modal (enquiry)',
    notes: 'Parent enquiring for Class 9 NTSE & STEM Foundation evening batch.',
    timestamp: '2026-09-28T08:45:00.000Z'
  }
];

// ── 2. 5 SAMPLES FOR SSAT 2026 SCHOLARSHIP ──
const ssatSamples = [
  {
    id: 'SSAT-2026-11042',
    name: 'A. Harish',
    phone: '9840294821',
    email: 'harish.ssat2026@gmail.com',
    targetClass: 'Class 12th Appearing',
    courseStream: 'NEET Medical Stream',
    testMode: 'Offline Puducherry Campus',
    examDate: 'This Sunday (10:00 AM - 1:00 PM)',
    city: 'Puducherry',
    status: 'Registered',
    timestamp: '2026-09-24T10:15:00.000Z'
  },
  {
    id: 'SSAT-2026-22183',
    name: 'Keerthana R',
    phone: '9443810294',
    email: 'keerthana.dr26@gmail.com',
    targetClass: 'Class 12 Passed (Dropper)',
    courseStream: 'NEET Medical Stream',
    testMode: 'Offline Puducherry Campus',
    examDate: 'Next Sunday (10:00 AM - 1:00 PM)',
    city: 'Cuddalore',
    status: 'Registered',
    timestamp: '2026-09-25T13:30:00.000Z'
  },
  {
    id: 'SSAT-2026-33924',
    name: 'Nitin Joseph',
    phone: '9841029384',
    email: 'nitin.joseph@gmail.com',
    targetClass: 'Class 11th Ongoing',
    courseStream: 'JEE Engineering Stream',
    testMode: 'Online Computer Based Test (CBT)',
    examDate: 'Flexible Weekday Evening Slot',
    city: 'Chennai',
    status: 'Registered',
    timestamp: '2026-09-26T16:00:00.000Z'
  },
  {
    id: 'SSAT-2026-44815',
    name: 'Swetha Varadarajan',
    phone: '9443192837',
    email: 'swetha.varad@gmail.com',
    targetClass: 'Class 9th & 10th',
    courseStream: 'STEM Foundation (6th to 10th)',
    testMode: 'Offline Puducherry Campus',
    examDate: 'This Sunday (10:00 AM - 1:00 PM)',
    city: 'Puducherry',
    status: 'Registered',
    timestamp: '2026-09-27T11:45:00.000Z'
  },
  {
    id: 'SSAT-2026-55706',
    name: 'B. Siddharth',
    phone: '9894102938',
    email: 'siddharth.iit26@gmail.com',
    targetClass: 'Class 12th Appearing',
    courseStream: 'JEE Engineering Stream',
    testMode: 'Offline Puducherry Campus',
    examDate: 'Next Sunday (10:00 AM - 1:00 PM)',
    city: 'Tindivanam',
    status: 'Registered',
    timestamp: '2026-09-28T09:10:00.000Z'
  }
];

// ── 3. 5 SAMPLES FOR FEE PAYMENTS VERIFICATION ──
const paymentSamples = [
  {
    id: 'SS-PAY-109281',
    name: 'Ramesh Kumar',
    phone: '9843210987',
    email: 'ramesh.kumar99@gmail.com',
    feeType: 'Crash Course Fee (NEET / JEE)',
    amount: '15,000',
    numericAmount: 15000,
    utrNumber: '409281729012',
    paymentDate: '2026-09-24',
    receiptFile: 'receipt_ss_pay_109281.jpg',
    city: 'Puducherry',
    status: 'Verified',
    timestamp: '2026-09-24T12:00:00.000Z'
  },
  {
    id: 'SS-PAY-218492',
    name: 'Kavitha Sundar',
    phone: '9443291823',
    email: 'kavitha.sundar@gmail.com',
    feeType: 'Hostel Fee (Girls Hostel)',
    amount: '25,000',
    numericAmount: 25000,
    utrNumber: '510293847561',
    paymentDate: '2026-09-25',
    receiptFile: 'receipt_girls_hostel_q1.pdf',
    city: 'Cuddalore',
    status: 'Verified',
    timestamp: '2026-09-25T15:20:00.000Z'
  },
  {
    id: 'SS-PAY-327103',
    name: 'M. Rajesh',
    phone: '9894123456',
    email: 'rajesh.m92@gmail.com',
    feeType: 'Regular Coaching Batch Fee',
    amount: '45,000',
    numericAmount: 45000,
    utrNumber: '489201948572',
    paymentDate: '2026-09-26',
    receiptFile: 'gpay_transaction_45k.png',
    city: 'Puducherry',
    status: 'Verified',
    timestamp: '2026-09-26T17:45:00.000Z'
  },
  {
    id: 'SS-PAY-436214',
    name: 'S. Venkatesh',
    phone: '9442109876',
    email: 'venkat.achiever@gmail.com',
    feeType: 'Repeaters Batch (Achievers) Fee',
    amount: '35,000',
    numericAmount: 35000,
    utrNumber: '394857102938',
    paymentDate: '2026-09-27',
    receiptFile: 'bank_neft_ref3948.pdf',
    city: 'Neyveli',
    status: 'Verified',
    timestamp: '2026-09-27T14:10:00.000Z'
  },
  {
    id: 'SS-PAY-545325',
    name: 'Divya Bharathi',
    phone: '9840918273',
    email: 'divya.bharathi@gmail.com',
    feeType: 'Hostel Fee (Boys Hostel)',
    amount: '25,000',
    numericAmount: 25000,
    utrNumber: '601928374650',
    paymentDate: '2026-09-28',
    receiptFile: 'upi_transfer_boys_hostel.jpg',
    city: 'Villupuram',
    status: 'Pending Verification',
    timestamp: '2026-09-28T10:15:00.000Z'
  }
];

// ── 4. 5 SAMPLES FOR SCHOOL PARTNERSHIPS (SIP) ──
const partnershipSamples = [
  {
    id: 'SS-SIP-10501',
    name: "Fr. Augustine D'Souza",
    phone: '9443217890',
    email: 'principal.stjoseph@gmail.com',
    studentType: 'School Principal / Management',
    course: 'Partner Schools (SIP) Integrated Coaching',
    targetClass: 'Class 11 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Puducherry',
    status: 'Contacted',
    source: 'School Partnership Modal',
    notes: 'St. Joseph Higher Secondary School. Interested in in-school NEET coaching for 80+ science students.',
    timestamp: '2026-09-24T11:00:00.000Z'
  },
  {
    id: 'SS-SIP-21612',
    name: 'Dr. K. Meenakshi',
    phone: '9840123890',
    email: 'meenakshi.sankaraschool@gmail.com',
    studentType: 'School Principal / Management',
    course: 'Partner Schools (SIP) Integrated Coaching',
    targetClass: 'Class 12 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Cuddalore',
    status: 'Counseling Scheduled',
    source: 'School Partnership Modal',
    notes: 'Sri Sankara Senior Secondary School. Requesting presentation on weekend faculty deployment and study materials.',
    timestamp: '2026-09-25T14:30:00.000Z'
  },
  {
    id: 'SS-SIP-32723',
    name: 'P. Senthil Nathan',
    phone: '9894387654',
    email: 'senthil.vallalar@gmail.com',
    studentType: 'School Principal / Management',
    course: 'Partner Schools (SIP) Integrated Coaching',
    targetClass: 'Class 11 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Villupuram',
    status: 'New',
    source: 'School Partnership Modal',
    notes: 'Vallalar Matriculation Higher Secondary School. Seeking integrated JEE Mains & NEET hybrid curriculum.',
    timestamp: '2026-09-26T16:45:00.000Z'
  },
  {
    id: 'SS-SIP-43834',
    name: 'Rev. Sr. Theresa',
    phone: '9442098765',
    email: 'sacredheart.girls@gmail.com',
    studentType: 'School Principal / Management',
    course: 'Partner Schools (SIP) Integrated Coaching',
    targetClass: 'Class 11 Ongoing',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Tindivanam',
    status: 'Admitted',
    source: 'School Partnership Modal',
    notes: 'Sacred Heart Girls Higher Secondary School. MOU signed for 2026-27 batch of 65 medical aspirants.',
    timestamp: '2026-09-27T15:15:00.000Z'
  },
  {
    id: 'SS-SIP-54945',
    name: 'T. Rajasekaran',
    phone: '9843901234',
    email: 'bvb.puducherry@gmail.com',
    studentType: 'School Principal / Management',
    course: 'Partner Schools (SIP) Integrated Coaching',
    targetClass: 'Class 9th & 10th',
    hostelNeeded: 'Day Scholar (No Hostel)',
    city: 'Puducherry',
    status: 'New',
    source: 'School Partnership Modal',
    notes: 'Bharathi Vidya Bhavan Matric School. Interested in Junior STEM Foundation for 8th, 9th and 10th grades.',
    timestamp: '2026-09-28T09:40:00.000Z'
  }
];

// ── 5. 5 SAMPLES FOR CAREERS & FACULTY ──
const careerSamples = [
  {
    id: 'SS-CAREER-10201',
    name: 'Dr. Ananya Sharma',
    phone: '9876501234',
    email: 'ananya.biology.phd@gmail.com',
    position: 'Senior Biology Faculty (NEET)',
    subject: 'Zoology & Botany',
    experience: '8+ Years',
    qualification: 'Ph.D in Life Sciences',
    location: 'Puducherry',
    resumeUrl: '/uploads/resume_dr_ananya_sharma.pdf',
    coverNote: '8 years of national-level NEET coaching experience with multiple 680+ scorers.',
    status: 'Shortlisted',
    timestamp: '2026-09-24T14:00:00.000Z'
  },
  {
    id: 'SS-CAREER-21312',
    name: 'M. Karthikeyan',
    phone: '9840394857',
    email: 'karthik.physics.iit@gmail.com',
    position: 'Senior Physics Faculty (JEE / NEET)',
    subject: 'Mechanics & Electrodynamics',
    experience: '10+ Years',
    qualification: 'M.Tech (IIT Madras)',
    location: 'Puducherry',
    resumeUrl: '/uploads/resume_karthikeyan_physics.pdf',
    coverNote: 'Former Kota senior faculty with top 500 AIR mentor history in JEE Advanced.',
    status: 'Selected',
    timestamp: '2026-09-25T16:30:00.000Z'
  },
  {
    id: 'SS-CAREER-32423',
    name: 'Dr. S. Balasubramanian',
    phone: '9443890123',
    email: 'bala.chemistry.phd@gmail.com',
    position: 'Senior Chemistry Faculty (NEET / JEE)',
    subject: 'Organic & Physical Chemistry',
    experience: '12+ Years',
    qualification: 'Ph.D Chemistry',
    location: 'Cuddalore',
    resumeUrl: '/uploads/resume_dr_bala_chem.pdf',
    coverNote: '12 years experience mentoring top medical aspirants. Expert in NCERT line-by-line mastery.',
    status: 'Interview Scheduled',
    timestamp: '2026-09-26T17:15:00.000Z'
  },
  {
    id: 'SS-CAREER-43534',
    name: 'V. Rajeshwari',
    phone: '9894019283',
    email: 'rajeshwari.maths.msc@gmail.com',
    position: 'Senior Mathematics Faculty (JEE Advanced)',
    subject: 'Calculus & Coordinate Geometry',
    experience: '7 Years',
    qualification: 'M.Sc, B.Ed (Mathematics)',
    location: 'Chennai',
    resumeUrl: '/uploads/resume_v_rajeshwari_maths.pdf',
    coverNote: 'Strong focus on JEE Advanced multi-concept problems and Olympiad preparation.',
    status: 'Applied',
    timestamp: '2026-09-27T13:45:00.000Z'
  },
  {
    id: 'SS-CAREER-54645',
    name: 'N. Praveen',
    phone: '9442901823',
    email: 'praveen.science.stem@gmail.com',
    position: 'Junior Science & STEM Foundation Mentor',
    subject: 'Physics & Chemistry (6th to 10th)',
    experience: '4 Years',
    qualification: 'M.Sc Physics',
    location: 'Puducherry',
    resumeUrl: '/uploads/resume_n_praveen.pdf',
    coverNote: 'Energetic mentor specialized in interactive experiments and NTSE/Olympiad foundation.',
    status: 'Shortlisted',
    timestamp: '2026-09-28T10:30:00.000Z'
  }
];

// Helper to save JSON files
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function runSeed() {
  console.log('🚀 Seeding 5 realistic sample records for all 5 forms...');

  // ── A. LOCAL JSON BACKUPS (ADMIN DASHBOARD FALLBACK) ──
  const allLeads = [...admissionSamples, ...partnershipSamples];
  saveJson(LEADS_FILE, allLeads);
  saveJson(SSAT_FILE, ssatSamples);
  saveJson(PAYMENT_FILE, paymentSamples);
  saveJson(CAREERS_FILE, careerSamples);
  console.log('✅ Local JSON files updated: leads.json, ssat.json, payments.json, careers.json');

  // ── B. MYSQL DATABASE (PRIMARY ADMIN DASHBOARD SOURCE) ──
  if (pool) {
    try {
      console.log('🔄 Syncing samples into MySQL Database...');
      // 1. Insert Enquiries & Partnerships
      for (const item of allLeads) {
        await pool.query(
          `INSERT INTO enquiries (reference_id, name, phone, email, student_type, course, target_class, hostel_needed, city, source, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
             course = VALUES(course), target_class = VALUES(target_class),
             hostel_needed = VALUES(hostel_needed), city = VALUES(city),
             status = VALUES(status), notes = VALUES(notes)`,
          [
            item.id, item.name, item.phone, item.email, item.studentType,
            item.course, item.targetClass, item.hostelNeeded, item.city,
            item.source, item.status, item.notes, new Date(item.timestamp)
          ]
        );
      }
      console.log('  -> 10 Enquiries (5 Admission + 5 School Partnerships) synced into MySQL');

      // 2. Insert SSAT Registrations
      for (const item of ssatSamples) {
        await pool.query(
          `INSERT INTO ssat_registrations (reference_id, name, phone, email, target_class, course_stream, test_mode, exam_date, city, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
             target_class = VALUES(target_class), course_stream = VALUES(course_stream),
             test_mode = VALUES(test_mode), exam_date = VALUES(exam_date),
             city = VALUES(city), status = VALUES(status)`,
          [
            item.id, item.name, item.phone, item.email, item.targetClass,
            item.courseStream, item.testMode, item.examDate, item.city,
            item.status, new Date(item.timestamp)
          ]
        );
      }
      console.log('  -> 5 SSAT Registrations synced into MySQL');

      // 3. Insert Fee Payments
      for (const item of paymentSamples) {
        try {
          await pool.query(
            `INSERT INTO fee_payments (reference_id, name, phone, email, fee_type, amount, utr_number, payment_date, receipt_file, city, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
               fee_type = VALUES(fee_type), amount = VALUES(amount),
               utr_number = VALUES(utr_number), payment_date = VALUES(payment_date),
               receipt_file = VALUES(receipt_file), city = VALUES(city),
               status = VALUES(status)`,
            [
              item.id, item.name, item.phone, item.email, item.feeType,
              item.numericAmount, item.utrNumber, item.paymentDate,
              item.receiptFile, item.city, item.status, new Date(item.timestamp)
            ]
          );
        } catch (payDbErr) {
          // Legacy table without email column fallback
          await pool.query(
            `INSERT INTO fee_payments (reference_id, name, phone, fee_type, amount, utr_number, payment_date, receipt_file, city, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               name = VALUES(name), phone = VALUES(phone), fee_type = VALUES(fee_type),
               amount = VALUES(amount), utr_number = VALUES(utr_number),
               payment_date = VALUES(payment_date), receipt_file = VALUES(receipt_file),
               city = VALUES(city), status = VALUES(status)`,
            [
              item.id, item.name, item.phone, item.feeType,
              item.numericAmount, item.utrNumber, item.paymentDate,
              item.receiptFile, item.city, item.status, new Date(item.timestamp)
            ]
          );
        }
      }
      console.log('  -> 5 Fee Payments synced into MySQL');

      // 4. Insert Career Applications
      for (const item of careerSamples) {
        await pool.query(
          `INSERT INTO career_applications (reference_id, name, phone, email, position, subject, experience, qualification, location, resume_url, cover_note, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
             position = VALUES(position), subject = VALUES(subject),
             experience = VALUES(experience), qualification = VALUES(qualification),
             location = VALUES(location), resume_url = VALUES(resume_url),
             cover_note = VALUES(cover_note), status = VALUES(status)`,
          [
            item.id, item.name, item.phone, item.email, item.position,
            item.subject, item.experience, item.qualification, item.location,
            item.resumeUrl, item.coverNote, item.status, new Date(item.timestamp)
          ]
        );
      }
      console.log('  -> 5 Faculty Applications synced into MySQL');
    } catch (mysqlErr) {
      console.warn('⚠️ MySQL update error (using local JSON fallback):', mysqlErr.message);
    }
  }

  // ── C. MULTI-TAB MASTER EXCEL WORKBOOK ──
  console.log('📊 Building Master Multi-Tab Excel Workbook...');
  const wb = XLSX.utils.book_new();

  // Tab 1: Admission Enquiries (5 samples)
  const tab1Headers = ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Course', 'Target Class', 'Hostel Needed', 'City', 'Source', 'Status', 'Notes', 'Submitted At'];
  const tab1Rows = admissionSamples.map(s => [
    s.id, s.name, s.phone, s.email, s.course, s.targetClass, s.hostelNeeded, s.city, s.source, s.status, s.notes, s.timestamp
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([tab1Headers, ...tab1Rows]);
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_NAMES.ENQUIRIES);

  // Tab 2: SSAT Registrations (5 samples)
  const tab2Headers = ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Class', 'Course Stream', 'Test Mode', 'Exam Slot', 'City', 'Status', 'Registered At'];
  const tab2Rows = ssatSamples.map(s => [
    s.id, s.name, s.phone, s.email, s.targetClass, s.courseStream, s.testMode, s.examDate, s.city, s.status, s.timestamp
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([tab2Headers, ...tab2Rows]);
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_NAMES.SSAT);

  // Tab 3: Fee Payments (5 samples)
  const tab3Headers = ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Fee Category', 'Amount (INR)', '12-Digit UTR Number', 'Payment Date', 'Receipt File', 'City', 'Status', 'Submitted At'];
  const tab3Rows = paymentSamples.map(s => [
    s.id, s.name, s.phone, s.email, s.feeType, s.amount, s.utrNumber, s.paymentDate, s.receiptFile, s.city, s.status, s.timestamp
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([tab3Headers, ...tab3Rows]);
  XLSX.utils.book_append_sheet(wb, ws3, SHEET_NAMES.PAYMENTS);

  // Tab 4: School Partnerships (SIP) (5 samples)
  const tab4Headers = ['Reference ID', 'Principal / Contact Name', 'Mobile', 'Email', 'Target Program', 'Current Class', 'City', 'Source', 'Status', 'Notes', 'Submitted At'];
  const tab4Rows = partnershipSamples.map(s => [
    s.id, s.name, s.phone, s.email, s.course, s.targetClass, s.city, s.source, s.status, s.notes, s.timestamp
  ]);
  const ws4 = XLSX.utils.aoa_to_sheet([tab4Headers, ...tab4Rows]);
  XLSX.utils.book_append_sheet(wb, ws4, SHEET_NAMES.PARTNERSHIPS);

  // Tab 5: Careers & Faculty (5 samples)
  const tab5Headers = ['Reference ID', 'Applicant Name', 'Mobile', 'Email', 'Position Applied', 'Subject Specialization', 'Total Experience', 'Highest Qualification', 'Current City', 'Resume URL', 'Cover Note', 'Status', 'Applied At'];
  const tab5Rows = careerSamples.map(s => [
    s.id, s.name, s.phone, s.email, s.position, s.subject, s.experience, s.qualification, s.location, s.resumeUrl, s.coverNote, s.status, s.timestamp
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet([tab5Headers, ...tab5Rows]);
  XLSX.utils.book_append_sheet(wb, ws5, SHEET_NAMES.CAREERS);

  // Write Master Excel Workbook
  XLSX.writeFile(wb, MASTER_EXCEL_FILE);
  console.log(`✅ Master Excel file generated with all 5 tabs (5 records each): ${MASTER_EXCEL_FILE}`);

  console.log('🎉 All 5 samples for all 5 forms successfully stored in Admin Dashboard and Master Excel Sheet!');
  process.exit(0);
}

runSeed();
