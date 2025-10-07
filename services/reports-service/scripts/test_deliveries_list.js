const pool = require('../../shared/db');
(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const deliveryDateExpr = 'DATE(COALESCE(dn.delivery_date_expected, dn.created_at))';

    const qCompanyDate = `SELECT dn.id, dn.client_id, dn.client_name_extracted AS client_name, dn.status, (
      SELECT rd.route_id FROM route_deliveries rd WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS route_id, (
      SELECT r.driver_id FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_id, (
      SELECT u.full_name FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_name, dn.created_at, dn.delivery_date_expected, dr.id AS receipt_id
    FROM delivery_notes dn
    LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
    WHERE dn.company_id = ? AND ${deliveryDateExpr} = ?
    ORDER BY dn.created_at DESC LIMIT 1000`;

    const qCompanyNoDate = `SELECT dn.id, dn.client_id, dn.client_name_extracted AS client_name, dn.status, (
      SELECT rd.route_id FROM route_deliveries rd WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS route_id, (
      SELECT r.driver_id FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_id, (
      SELECT u.full_name FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_name, dn.created_at, dn.delivery_date_expected, dr.id AS receipt_id
    FROM delivery_notes dn
    LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
    WHERE dn.company_id = ?
    ORDER BY dn.created_at DESC LIMIT 10`;

    const qDateOnly = `SELECT dn.id, dn.client_id, dn.client_name_extracted AS client_name, dn.status, (
      SELECT rd.route_id FROM route_deliveries rd WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS route_id, (
      SELECT r.driver_id FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_id, (
      SELECT u.full_name FROM route_deliveries rd JOIN routes r ON r.id = rd.route_id JOIN drivers d ON d.id = r.driver_id JOIN users u ON u.id = d.user_id WHERE rd.delivery_note_id = dn.id LIMIT 1
    ) AS driver_name, dn.created_at, dn.delivery_date_expected, dr.id AS receipt_id
    FROM delivery_notes dn
    LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
    WHERE ${deliveryDateExpr} = ?
    ORDER BY dn.created_at DESC LIMIT 10`;

    console.log('today', today);
    const [r1] = await pool.query(qCompanyDate, [1, today]);
    console.log('company+date rows', Array.isArray(r1) ? r1.length : 0);
    if (Array.isArray(r1) && r1.length) console.log(r1[0]);

    const [r2] = await pool.query(qCompanyNoDate, [1]);
    console.log('company no date rows', Array.isArray(r2) ? r2.length : 0);
    if (Array.isArray(r2) && r2.length) console.log(r2[0]);

    const [r3] = await pool.query(qDateOnly, [today]);
    console.log('date only rows', Array.isArray(r3) ? r3.length : 0);
    if (Array.isArray(r3) && r3.length) console.log(r3[0]);
  } catch (e) {
    console.error('error', e && e.stack ? e.stack : e);
  } finally {
    process.exit();
  }
})();
