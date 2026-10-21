import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
function getTransporter() {
  const user = process.env.SMTP_USER || 'developmentaffixx@gmail.com';
  const pass = process.env.SMTP_PASS || '';

  if (!pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user,
      pass
    }
  });
}

const BRAND_COLOR = '#0A1628';
const TEAL_COLOR = '#0D9488';
const GOLD_COLOR = '#D97706';

/**
 * Send admin alert email
 */
export async function sendAdminAlert({ subject, title, badge, details, rawData = {} }) {
  const adminEmail = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'developmentaffixx@gmail.com';
  const transporter = getTransporter();

  const detailsRows = Object.entries(details)
    .map(
      ([label, val]) => `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-bottom: 1px solid #E2E8F0; width: 35%; background: #F8FAFC;">
          ${label}
        </td>
        <td style="padding: 10px 14px; color: #0F172A; border-bottom: 1px solid #E2E8F0; font-size: 14px;">
          ${val || '—'}
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; color: #1E293B;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background: ${BRAND_COLOR}; padding: 26px 30px; text-align: left;">
            <div style="display: inline-block; background: ${TEAL_COLOR}; color: #FFFFFF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 20px; margin-bottom: 10px;">
              ${badge || 'NEW NOTIFICATION'}
            </div>
            <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;">
              Scholar Spectra Puducherry
            </h1>
            <p style="color: #94A3B8; margin: 4px 0 0; font-size: 13px;">
              ${title || 'Portal Notification Alert'}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 26px 30px;">
            <h3 style="margin: 0 0 16px; color: #0F172A; font-size: 17px; font-weight: 700;">
              Submission Summary
            </h3>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
              ${detailsRows}
            </table>

            <div style="background: #F8FAFC; border-left: 4px solid ${TEAL_COLOR}; padding: 14px 18px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                <strong>Next Step:</strong> This submission has also been logged into your Google Spreadsheet (Sheets 1–4) and your local backup records.
              </p>
            </div>

            <div style="text-align: center; margin-top: 26px;">
              <a href="${process.env.GOOGLE_SHEET_URL || 'https://docs.google.com/spreadsheets/d/15kXdBbpO4CHN7_k4n--6zCt7ZxION5svmHtJKqeikSc'}" 
                 target="_blank"
                 style="display: inline-block; background: ${BRAND_COLOR}; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.02em;">
                Open Live Google Spreadsheet &rarr;
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background: #F8FAFC; padding: 18px 30px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
            Scholar Spectra Entrance Training Institute &bull; 100 Feet Road, Puducherry<br/>
            Automated Server Notification &bull; Target: ${adminEmail}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`📧 [EMAIL SIMULATION] SMTP_PASS not set in .env`);
    console.log(`To: ${adminEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Title: ${title}`);
    console.log(`Details:`, details);
    console.log(`======================================================\n`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Scholar Spectra Desk" <${process.env.SMTP_USER || 'developmentaffixx@gmail.com'}>`,
      to: adminEmail,
      subject,
      html
    });
    console.log(`✅ [Email Sent] ${subject} to ${adminEmail} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`⚠️ [Email Error] Could not send email: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send Password Reset Link Email to Staff
 */
export async function sendPasswordResetEmail({ toEmail, resetLink, token }) {
  const transporter = getTransporter();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Staff Portal Password Reset</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; color: #1E293B;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08);">
        <tr>
          <td style="background: ${BRAND_COLOR}; padding: 26px 30px; text-align: left;">
            <div style="display: inline-block; background: ${GOLD_COLOR}; color: #FFFFFF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 20px; margin-bottom: 10px;">
              SECURITY DESK
            </div>
            <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">
              Scholar Spectra Staff Portal
            </h1>
            <p style="color: #94A3B8; margin: 4px 0 0; font-size: 13px;">
              Password Reset Request
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding: 28px 30px;">
            <p style="font-size: 15px; color: #334155; margin-top: 0; line-height: 1.6;">
              Hello,
            </p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              A request was received to reset the password for your Scholar Spectra Staff Portal (Login ID: <strong>Scholar Spectra</strong>).
            </p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Click the button below to set a new password. This reset link is valid for <strong>1 hour</strong>.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background: ${TEAL_COLOR}; color: #FFFFFF; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.02em;">
                Reset Staff Password &rarr;
              </a>
            </div>

            <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; color: #92400E;">
                <strong>Security Code:</strong> <code style="font-size: 14px; font-weight: 700;">${token}</code>
              </p>
            </div>

            <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin-bottom: 0;">
              If you did not request this change, you can safely ignore this email. The existing password will remain active.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background: #F8FAFC; padding: 16px 30px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
            Scholar Spectra 100 Feet Road, Puducherry &bull; Staff Authentication Desk
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`🔑 [PASSWORD RESET LINK SIMULATION]`);
    console.log(`To: ${toEmail}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log(`Token: ${token}`);
    console.log(`======================================================\n`);
    return { success: true, simulated: true, resetLink };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Scholar Spectra Security" <${process.env.SMTP_USER || 'developmentaffixx@gmail.com'}>`,
      to: toEmail,
      subject: 'Scholar Spectra Staff Portal — Reset Your Password',
      html
    });
    console.log(`✅ [Reset Email Sent] to ${toEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`⚠️ [Reset Email Error] ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send automated Thank You / Confirmation Email to User (Student / Parent / Applicant)
 */
export async function sendUserThankYouEmail({ toEmail, name, formType, refId, details = {} }) {
  if (!toEmail || !toEmail.includes('@')) {
    return { success: false, reason: 'No valid user email provided' };
  }

  const transporter = getTransporter();

  const cleanTo = toEmail.trim();

  let subjectTitle = `🎓 Admission Enquiry Received — Ref: ${refId} | Scholar Spectra`;
  let badgeText = 'ADMISSION ENQUIRY RECEIVED';
  let nextStepsText = 'Our senior academic counselor will connect with you within 30 minutes to discuss batch schedules, demo classes, and fee details.';

  if (formType === 'ssat') {
    subjectTitle = `🏆 SSAT 2026 Scholarship Registration Confirmed — Ref: ${refId} | Scholar Spectra`;
    badgeText = 'SSAT 2026 REGISTRATION CONFIRMED';
    nextStepsText = 'Your registration for the SSAT 2026 National Scholarship Test is confirmed! Your digital hall ticket, syllabus breakdown, and test instructions will be dispatched to your WhatsApp number and email before the test slot.';
  } else if (formType === 'payment') {
    subjectTitle = `💳 Fee Payment Submission Received — Ref: ${refId} | Scholar Spectra`;
    badgeText = 'PAYMENT VERIFICATION SUBMITTED';
    nextStepsText = 'Our accounts team is verifying your 12-digit UTR reference with our bank. Your official tax invoice and fee receipt will be sent via WhatsApp and email.';
  } else if (formType === 'careers') {
    subjectTitle = `💼 Faculty Application Received — Ref: ${refId} | Scholar Spectra`;
    badgeText = 'FACULTY RECRUITMENT APPLICATION';
    nextStepsText = 'Our Dean Academic Advisory Committee reviews all submissions. Shortlisted candidates will be invited for an interactive demo lecture and interview within 48 hours.';
  } else if (formType === 'school-partnership') {
    subjectTitle = `🤝 School Partnership (SIP) Enquiry Received — Ref: ${refId} | Scholar Spectra`;
    badgeText = 'SCHOOL PARTNERSHIP (SIP)';
    nextStepsText = 'Thank you for your interest in partnering with Scholar Spectra. Our Academic Director and Institutional Head will get in touch with your office within 24 hours with complete integrated coaching program details.';
  }

  const detailsRows = Object.entries(details)
    .filter(([_, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #E2E8F0; width: 40%; background: #F8FAFC;">
          ${k}
        </td>
        <td style="padding: 8px 12px; color: #0F172A; font-size: 13px; border-bottom: 1px solid #E2E8F0;">
          ${v}
        </td>
      </tr>
    `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subjectTitle}</title>
    </head>
    <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; color: #1E293B;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.08);">
        <!-- Top Banner -->
        <tr>
          <td style="background: ${BRAND_COLOR}; padding: 26px 30px; text-align: left;">
            <div style="display: inline-block; background: ${TEAL_COLOR}; color: #FFFFFF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 20px; margin-bottom: 10px;">
              ${badgeText}
            </div>
            <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: 700;">
              Scholar Spectra Puducherry
            </h1>
            <p style="color: #94A3B8; margin: 4px 0 0; font-size: 13px;">
              Premier NEET Medical &amp; JEE Engineering Training Institute
            </p>
          </td>
        </tr>

        <!-- Body Content -->
        <tr>
          <td style="padding: 26px 30px;">
            <p style="font-size: 15px; color: #0F172A; margin: 0 0 12px; font-weight: 600;">
              Dear ${name || 'Aspirant / Parent'},
            </p>
            <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px;">
              Thank you for connecting with Scholar Spectra. Your submission has been securely recorded in our academic system.
            </p>

            <!-- Reference Card -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; text-align: center;">
              <span style="font-size: 12px; color: #64748B; display: block; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                Your Official Reference Number
              </span>
              <strong style="font-size: 20px; color: ${BRAND_COLOR}; letter-spacing: 0.05em;">
                ${refId}
              </strong>
            </div>

            <!-- Details Summary Table -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
              ${detailsRows}
            </table>

            <!-- Next Steps -->
            <div style="background: #ECFDF5; border-left: 4px solid ${TEAL_COLOR}; padding: 14px 18px; border-radius: 4px; margin-bottom: 24px;">
              <strong style="color: #065F46; font-size: 13px; display: block; margin-bottom: 4px;">What Happens Next?</strong>
              <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.5;">
                ${nextStepsText}
              </p>
            </div>

            <!-- Need Help Contacts -->
            <div style="background: #F8FAFC; padding: 14px 18px; border-radius: 8px; font-size: 13px; color: #475569;">
              <strong>Have urgent questions? Reach our front desk directly:</strong><br/>
              📞 Call: <a href="tel:+919943487999" style="color: ${TEAL_COLOR}; text-decoration: none; font-weight: 600;">+91 99434 87999</a> &bull; 
              💬 WhatsApp: <a href="https://wa.me/919943487999" style="color: ${TEAL_COLOR}; text-decoration: none; font-weight: 600;">+91 99434 87999</a><br/>
              📍 Campus: 100 Feet Road, Ellaipillaichavady, Puducherry – 605005
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background: #F8FAFC; padding: 16px 30px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
            Scholar Spectra Entrance Training Institute &bull; Puducherry<br/>
            Visit website: <a href="https://scholarspectra.com" style="color: ${TEAL_COLOR}; text-decoration: none;">scholarspectra.com</a>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`[User Email Simulation] Would send Thank You email to: ${cleanTo} for ${refId}`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Scholar Spectra Puducherry" <${process.env.SMTP_USER || 'developmentaffixx@gmail.com'}>`,
      to: cleanTo,
      subject: subjectTitle,
      html
    });
    console.log(`💌 [User Email Sent] "${subjectTitle}" to ${cleanTo} (${refId}) (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`⚠️ [User Email Error] Could not send to ${cleanTo}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
