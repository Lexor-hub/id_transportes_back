const pool = require('./shared/db');
(async () => {
  try {
    const companyId = 1;
    const today = new Date().toISOString().slice(0, 10);
    const deliveryDateExpr = 'DATE(COALESCE(dn.delivery_date_expected, dn.created_at))';

    const q1 = 'SELECT COUNT(*) AS cnt FROM delivery_notes dn WHERE dn.company_id = ? AND ' + deliveryDateExpr + ' = ?';
    const [r1] = await pool.query(q1, [companyId, today]);
    console.log('company=1 today count', r1[0].cnt);

    const q2 = 'SELECT COUNT(*) AS cnt FROM delivery_notes dn WHERE dn.company_id = ?';
    const [r2] = await pool.query(q2, [companyId]);
    console.log('company=1 total count', r2[0].cnt);

    const q3 = 'SELECT COUNT(*) AS cnt FROM delivery_notes dn WHERE ' + deliveryDateExpr + ' = ?';
    const [r3] = await pool.query(q3, [today]);
    console.log('global today count', r3[0].cnt);

    const qSample = 'SELECT id, client_name_extracted, status, created_at, delivery_date_expected FROM delivery_notes dn WHERE ' + deliveryDateExpr + ' = ? LIMIT 5';
    const [s] = await pool.query(qSample, [today]);
    console.log('sample rows for today (global):', s);
  } catch (e) {
    console.error('error', e && e.stack ? e.stack : e);
  } finally {
    process.exit();
  }
})();
