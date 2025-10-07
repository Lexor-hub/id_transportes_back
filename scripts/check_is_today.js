require('dotenv').config();
const pool = require('../shared/db');

(async () => {
  try {
    const sql = `SELECT id, created_at, delivery_date_expected,
      ((delivery_date_expected IS NOT NULL AND DATE(delivery_date_expected)=CURDATE()) OR (delivery_date_expected IS NULL AND DATE(created_at)=CURDATE())) AS is_today
      FROM delivery_notes WHERE company_id = ? ORDER BY id DESC`;
    const [rows] = await pool.query(sql, [1]);
    console.log('Rows count:', rows.length);
    for (const r of rows) {
      console.log(r);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error running check:', err);
    process.exit(2);
  }
})();
