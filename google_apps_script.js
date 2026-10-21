/**
 * ==============================================================================
 * SCHOLAR SPECTRA - GOOGLE SPREADSHEET AUTO-APPEND APPS SCRIPT
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/15kXdBbpO4CHN7_k4n--6zCt7ZxION5svmHtJKqeikSc/edit
 * ==============================================================================
 * 
 * HOW TO INSTALL IN 1 MINUTE:
 * 1. Open your Google Spreadsheet:
 *    https://docs.google.com/spreadsheets/d/15kXdBbpO4CHN7_k4n--6zCt7ZxION5svmHtJKqeikSc/edit
 * 2. Click on the top menu: "Extensions" > "Apps Script"
 * 3. Delete any code inside Code.gs and PASTE THIS ENTIRE FILE.
 * 4. Click the blue "Deploy" button (top right) > "New deployment".
 * 5. Select type: "Web app" (click gear icon next to 'Select type').
 * 6. Set Description: "Scholar Spectra Form Webhook".
 * 7. Set "Execute as": "Me" (your Google account).
 * 8. Set "Who has access": "Anyone" (allows website backend to post form submissions).
 * 9. Click "Deploy" and authorize permissions.
 * 10. Copy the Web app URL (starts with https://script.google.com/macros/s/...)
 * 11. Paste that URL into your react folder/backend/.env file:
 *     GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 * 
 * DONE! Every submission from all 4 website forms will automatically create
 * and append rows into:
 *   - Tab 1: "Admission Enquiries"
 *   - Tab 2: "SSAT Registrations"
 *   - Tab 3: "Fee Payments"
 *   - Tab 4: "Careers & Faculty"
 * ==============================================================================
 */

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var json = JSON.parse(raw);
    
    var sheetName = json.sheetName || 'Admission Enquiries';
    var data = json.data || {};
    var timestamp = json.timestamp || new Date().toLocaleString();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    // If sheet doesn't exist yet, create it with headers
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = getHeadersForSheet(sheetName);
      sheet.appendRow(headers);
      
      // Style headers
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#0A1628');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
    }

    var row = formatRowForSheet(sheetName, data, timestamp);
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, sheet: sheetName, row: row }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: 'online', 
      service: 'Scholar Spectra Google Sheet Sync Webhook',
      target: SpreadsheetApp.getActiveSpreadsheet().getName()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeadersForSheet(sheetName) {
  if (sheetName === 'Admission Enquiries') {
    return ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Course', 'Target Class', 'Hostel Needed', 'City', 'Source', 'Status', 'Notes', 'Submitted At'];
  } else if (sheetName === 'SSAT Registrations') {
    return ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Target Class', 'Course Stream', 'Test Mode', 'Exam Slot', 'City', 'Status', 'Registered At'];
  } else if (sheetName === 'Fee Payments') {
    return ['Reference ID', 'Student Name', 'Mobile', 'Email', 'Fee Category', 'Amount (INR)', '12-Digit UTR Number', 'Payment Date', 'Receipt File', 'City', 'Status', 'Submitted At'];
  } else if (sheetName === 'School Partnerships (SIP)') {
    return ['Reference ID', 'Principal / Contact Name', 'Mobile', 'Email', 'Target Program', 'Current Class', 'City', 'Source', 'Status', 'Notes', 'Submitted At'];
  } else if (sheetName === 'Careers & Faculty') {
    return ['Reference ID', 'Applicant Name', 'Mobile', 'Email', 'Position Applied', 'Subject Specialization', 'Total Experience', 'Highest Qualification', 'Current City', 'Resume URL', 'Cover Note', 'Status', 'Applied At'];
  }
  return ['Reference ID', 'Name', 'Phone', 'Timestamp'];
}

function formatRowForSheet(sheetName, data, timestamp) {
  if (sheetName === 'Admission Enquiries') {
    return [
      data.referenceId || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.course || '',
      data.targetClass || '',
      data.hostelNeeded || '',
      data.city || '',
      data.source || 'Website',
      data.status || 'New',
      data.notes || data.message || '',
      timestamp
    ];
  } else if (sheetName === 'SSAT Registrations') {
    return [
      data.referenceId || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.targetClass || '',
      data.courseStream || '',
      data.testMode || '',
      data.examDate || '',
      data.city || '',
      data.status || 'Registered',
      timestamp
    ];
  } else if (sheetName === 'Fee Payments') {
    return [
      data.referenceId || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.feeType || '',
      data.amount || '',
      data.utrNumber || '',
      data.paymentDate || '',
      data.receiptFile || '',
      data.city || '',
      data.status || 'Pending Verification',
      timestamp
    ];
  } else if (sheetName === 'School Partnerships (SIP)') {
    return [
      data.referenceId || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.course || '',
      data.targetClass || '',
      data.city || '',
      data.source || 'School Partnership Modal',
      data.status || 'New',
      data.notes || data.message || '',
      timestamp
    ];
  } else if (sheetName === 'Careers & Faculty') {
    return [
      data.referenceId || '',
      data.name || '',
      data.phone || '',
      data.email || '',
      data.position || '',
      data.subject || '',
      data.experience || '',
      data.qualification || '',
      data.location || '',
      data.resumeUrl || '',
      data.coverNote || '',
      data.status || 'Applied',
      timestamp
    ];
  }
  return [data.referenceId || '', data.name || '', data.phone || '', timestamp];
}
