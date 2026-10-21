import dotenv from 'dotenv';
dotenv.config();

let pool = null;
let isConnected = false;

// Attempt to load mysql2 dynamically so server doesn't crash if npm install hasn't been run yet
try {
  const mysql = await import('mysql2/promise');
  
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

  // Test the connection
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
  console.warn('⚠️  mysql2 package not yet installed. Run "npm install mysql2" in backend folder.');
  console.warn('ℹ️  Server using fallback mode.');
}

export { pool, isConnected };
export default pool;
