import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendPasswordResetEmail } from './emailService.js';
import { pool } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_FILE = path.join(__dirname, 'data', 'admin_auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'scholar_spectra_jwt_super_secret_key_2026_change_in_production';

// Default password: Spectrasite
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('Spectrasite', 10);

const DEFAULT_AUTH = {
  loginId: 'Scholar Spectra',
  passwordHash: DEFAULT_PASSWORD_HASH,
  email: 'developmentaffixx@gmail.com',
  updatedAt: new Date().toISOString()
};

// Store active reset tokens in memory: { token: { expiry, email } }
const resetTokens = new Map();

/**
 * Get current credentials (from file or defaults)
 */
export function getAdminCredentials() {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      fs.writeFileSync(AUTH_FILE, JSON.stringify(DEFAULT_AUTH, null, 2), 'utf8');
      return DEFAULT_AUTH;
    }
    const data = fs.readFileSync(AUTH_FILE, 'utf8');
    const parsed = JSON.parse(data || '{}');

    // Upgrade plaintext legacy password to bcrypt hash automatically
    if (parsed.password && !parsed.passwordHash) {
      parsed.passwordHash = bcrypt.hashSync(parsed.password, 10);
      delete parsed.password;
      saveAdminCredentials(parsed);
    }

    return parsed.passwordHash ? parsed : DEFAULT_AUTH;
  } catch (err) {
    console.error('Error reading admin_auth.json:', err);
    return DEFAULT_AUTH;
  }
}

/**
 * Save updated credentials
 */
export function saveAdminCredentials(updated) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving admin_auth.json:', err);
    return false;
  }
}

/**
 * Validate login credentials using bcrypt & MySQL/JSON fallback
 */
export async function verifyLogin(loginId, password) {
  if (!loginId || !password) return { isValid: false };

  const cleanId = loginId.trim();
  const cleanPass = password.trim();

  // 1. Try MySQL admin_users table first if available
  if (pool) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM admin_users WHERE username = ? OR email = ? LIMIT 1',
        [cleanId, cleanId]
      );
      if (rows && rows.length > 0) {
        const user = rows[0];
        const match = bcrypt.compareSync(cleanPass, user.password_hash);
        if (match) {
          // Update last login
          pool.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]).catch(() => {});
          return {
            isValid: true,
            user: {
              loginId: user.username,
              email: user.email,
              role: user.role || 'SuperAdmin'
            }
          };
        }
      }
    } catch (e) {
      // Fallback to local auth
    }
  }

  // 2. Fallback to local admin_auth.json
  const current = getAdminCredentials();
  const validId = cleanId.toLowerCase() === current.loginId.trim().toLowerCase() ||
                  cleanId.toLowerCase() === (current.email || '').trim().toLowerCase();

  if (!validId) return { isValid: false };

  let validPass = false;
  if (current.passwordHash) {
    validPass = bcrypt.compareSync(cleanPass, current.passwordHash);
  } else if (current.password) {
    validPass = cleanPass === current.password.trim();
    if (validPass) {
      // Upgrade to hash immediately
      current.passwordHash = bcrypt.hashSync(cleanPass, 10);
      delete current.password;
      saveAdminCredentials(current);
    }
  }

  if (validPass) {
    return {
      isValid: true,
      user: {
        loginId: current.loginId,
        email: current.email,
        role: 'SuperAdmin'
      }
    };
  }

  return { isValid: false };
}

/**
 * Generate secure JWT admin token
 */
export function generateAdminToken(user) {
  return jwt.sign(
    {
      loginId: user.loginId,
      email: user.email,
      role: user.role || 'Staff'
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

/**
 * Verify JWT admin token
 */
export function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware: Protect Admin Routes
 */
export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. Authorization token missing.'
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  const decoded = verifyAdminToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token. Please log in again.'
    });
  }

  req.adminUser = decoded;
  next();
}

/**
 * Initiate Forgot Password Request
 */
export async function initiatePasswordReset(requestedEmail) {
  const current = getAdminCredentials();
  const targetEmail = process.env.ADMIN_EMAIL || current.email || 'developmentaffixx@gmail.com';

  // Generate secure token
  const token = crypto.randomBytes(24).toString('hex');
  const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

  resetTokens.set(token, { expiry, email: targetEmail });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/#admin-reset?token=${token}`;

  const emailResult = await sendPasswordResetEmail({
    toEmail: targetEmail,
    resetLink,
    token
  });

  return {
    success: true,
    message: `Password reset link sent to ${targetEmail}`,
    targetEmail,
    token: emailResult.simulated ? token : undefined,
    resetLink: emailResult.simulated ? resetLink : undefined
  };
}

/**
 * Verify token and update password with bcrypt
 */
export function completePasswordReset(token, newPassword) {
  if (!token || !newPassword) {
    return { success: false, error: 'Token and new password are required.' };
  }

  const tokenData = resetTokens.get(token);
  if (!tokenData) {
    return { success: false, error: 'Invalid or expired reset token.' };
  }

  if (Date.now() > tokenData.expiry) {
    resetTokens.delete(token);
    return { success: false, error: 'Reset token has expired. Please request a new one.' };
  }

  if (newPassword.trim().length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const hashed = bcrypt.hashSync(newPassword.trim(), 10);

  const current = getAdminCredentials();
  current.passwordHash = hashed;
  delete current.password;
  current.updatedAt = new Date().toISOString();

  saveAdminCredentials(current);
  resetTokens.delete(token);

  // Also update MySQL if available
  if (pool) {
    pool.query(
      'UPDATE admin_users SET password_hash = ? WHERE username = ? OR email = ?',
      [hashed, current.loginId, current.email]
    ).catch(err => console.warn('Could not update MySQL admin password:', err.message));
  }

  console.log(`🔐 [Staff Password Updated] New bcrypt password saved successfully.`);
  return { success: true, message: 'Password updated successfully. You can now login.' };
}
