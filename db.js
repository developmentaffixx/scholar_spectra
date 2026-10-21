import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

let pool = null;
let isConnected = false;

// Create the connection pool synchronously (no top-level await).
// Using a static import + createPool keeps this module free of top-level await,
// which is required by LiteSpeed/Passenger-style CommonJS loaders (Hostinger).
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'scholar_spectra',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test the connection in the background (fire-and-forget, no await at top level)
  pool.getConnection()
    .then(conn => {
      console.log('✅ MySQL Connected successfully to database: ' + (process.env.DB_NAME || 'scholar_spectra'));
      isConnected = true;
      conn.release();
    })
    .catch(err => {
      console.warn('⚠️  MySQL connection not established:', err.message);
      console.warn('ℹ️  Server will continue using local fallback until MySQL is running.');
      isConnected = false;
    });
} catch (e) {
  console.warn('⚠️  Could not initialize MySQL pool:', e.message);
  console.warn('ℹ️  Server using fallback mode.');
  pool = null;
}

export { pool, isConnected };
export default pool;
