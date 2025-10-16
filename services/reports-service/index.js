const express = require('express');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fetch = require('node-fetch');
const { Buffer } = require('buffer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const receiptsBaseUrlRaw =
  process.env.RECEIPTS_SERVICE_INTERNAL_URL ||
  process.env.RECEIPTS_SERVICE_URL ||
  process.env.RECEIPTS_SERVICE_PUBLIC_URL ||
  process.env.RECEIPTS_PUBLIC_BASE_URL ||
  process.env.RECEIPTS_API_URL ||
  'http://localhost:3004';

const normalizeBaseUrl = (value) => {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const RECEIPTS_BASE_URL = normalizeBaseUrl(receiptsBaseUrlRaw);

const buildReceiptViewUrl = (path) => {
  if (!path) return null;
  const sanitized = path.startsWith('/') ? path.slice(1) : path;
  return `${RECEIPTS_BASE_URL}/api/receipts/view?path=${encodeURIComponent(sanitized)}`;
};

const resolveReceiptTargetUrl = (rawUrl, rawPath) => {
  if (rawPath) {
    return buildReceiptViewUrl(rawPath);
  }

  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const queryPath = parsed.searchParams.get('path');
    if (queryPath) {
      return buildReceiptViewUrl(queryPath);
    }

    const hostname = parsed.hostname || '';
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      if (parsed.pathname && parsed.pathname.startsWith('/uploads/')) {
        const sanitized = parsed.pathname.replace(/^\/+/, '');
        const absoluteUploadPath = path.resolve(__dirname, '../deliveries-routes-service', sanitized);
        return buildReceiptViewUrl(absoluteUploadPath);
      }
    }

    return parsed.href;
  } catch {
    return buildReceiptViewUrl(rawUrl);
  }
};

const jwtSecret = process.env.JWT_SECRET || 'fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a';

// Middleware de autenticação
function authorize(roles = []) {
  return (req, res, next) => {
    // Debugging: accept token via Authorization header or ?token query param (temporary)
    console.log('[Reports] Authorization header:', req.headers.authorization);
    console.log('[Reports] query.token:', req.query && req.query.token ? '<present>' : '<none>');
    const token = req.headers.authorization?.split(' ')[1] || (req.query && req.query.token) || null;
    if (!token) return res.status(401).json({ success: false, error: { message: 'Token não fornecido' } });

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (roles.length && !roles.includes(decoded.user_type)) {
        return res.status(403).json({ success: false, error: { message: 'Acesso negado' } });
      }
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ success: false, error: { message: 'Token inválido' } });
    }
  };
}

const RECOVERABLE_SQL_ERRORS = new Set(['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ER_NO_SUCH_FIELD', 'ER_NO_SUCH_COLUMN']);

const COMPLETED_STATUSES = ['DELIVERED', 'ENTREGUE', 'REALIZADA', 'REALIZADO', 'ENTREGADO'];
const IN_PROGRESS_STATUSES = ['IN_TRANSIT', 'IN_PROGRESS', 'EN_ROUTE', 'EM_ANDAMENTO'];
const PENDING_STATUSES = ['PENDING', 'PENDENTE'];
const ADDITIONAL_OPEN_STATUSES = ['REATTEMPTED', 'PROBLEM'];
const ROUTE_STARTED_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'STARTED'];

const COMPLETED_STATUSES_UPPER = COMPLETED_STATUSES.map((status) => status.toUpperCase());
const IN_PROGRESS_STATUSES_UPPER = IN_PROGRESS_STATUSES.map((status) => status.toUpperCase());
const PENDING_STATUSES_UPPER = PENDING_STATUSES.map((status) => status.toUpperCase());
const OPEN_STATUSES_UPPER = Array.from(new Set([
  ...IN_PROGRESS_STATUSES_UPPER,
  ...PENDING_STATUSES_UPPER,
  ...ADDITIONAL_OPEN_STATUSES.map((status) => status.toUpperCase()),
]));
const DRIVER_RELEVANT_STATUSES_UPPER = Array.from(new Set([...OPEN_STATUSES_UPPER, ...COMPLETED_STATUSES_UPPER]));
const ROUTE_STARTED_STATUSES_UPPER = Array.from(new Set(ROUTE_STARTED_STATUSES.map((status) => status.toUpperCase())));

const buildPlaceholders = (values) => values.map(() => '?').join(', ');

const completedPlaceholders = buildPlaceholders(COMPLETED_STATUSES_UPPER);
const inProgressPlaceholders = buildPlaceholders(IN_PROGRESS_STATUSES_UPPER);
const pendingPlaceholders = buildPlaceholders(PENDING_STATUSES_UPPER);
const openPlaceholders = buildPlaceholders(OPEN_STATUSES_UPPER);
const driverStatusesPlaceholders = buildPlaceholders(DRIVER_RELEVANT_STATUSES_UPPER);
const routeStatusesPlaceholders = buildPlaceholders(ROUTE_STARTED_STATUSES_UPPER);

// Literal lists for use inside SELECT expressions where binding placeholders
// would complicate the expression. These are built from the static status arrays.
const completedLiterals = COMPLETED_STATUSES_UPPER.map(s => `'${s}'`).join(', ');
const pendingLiterals = PENDING_STATUSES_UPPER.map(s => `'${s}'`).join(', ');
const inProgressLiterals = IN_PROGRESS_STATUSES_UPPER.map(s => `'${s}'`).join(', ');

const shouldFallback = (error) => {
  if (!error) return false;
  if (RECOVERABLE_SQL_ERRORS.has(error.code)) {
    return true;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  return message.includes('Unknown column');
};

const runWithFallbacks = async (queries) => {
  let lastError = null;
  for (const { sql, params } of queries) {
    try {
      // Debug: log SQL and params to help pinpoint syntax errors
      console.log('\n--- Executing SQL ---');
      console.log(sql);
      console.log('params:', JSON.stringify(params));
      console.log('--- end SQL ---\n');

      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      if (!shouldFallback(error)) {
        throw error;
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
  return [[], []];
};

/**
 * @swagger
 * /api/dashboard/kpis:
 *   get:
 *     summary: Retorna os KPIs para o dashboard do supervisor.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPIs retornados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     today_deliveries:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         completed:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         in_progress:
 *                           type: integer
 *                     active_drivers:
 *                       type: integer
 *                     pending_occurrences:
 *                       type: integer
 */
app.get('/api/dashboard/kpis', authorize(['ADMIN', 'SUPERVISOR', 'MASTER']), async (req, res) => {
  try {
    const { company_id } = req.user;
    const today = new Date().toISOString().slice(0, 10);

    // Define an explicit "is today" expression so we don't accidentally prefer delivery_date_expected
    // when it was intentionally set to another date. Rule: a delivery is "today" when
    // - delivery_date_expected is set and equals CURDATE(), OR
    // - delivery_date_expected is NULL and DATE(created_at) = CURDATE()
    const isTodayExpr = `((dn.delivery_date_expected IS NOT NULL AND DATE(dn.delivery_date_expected) = CURDATE()) OR (dn.delivery_date_expected IS NULL AND DATE(dn.created_at) = CURDATE()))`;

    const deliveryStatsQueries = [
      {
        sql: `SELECT
            COUNT(CASE WHEN ${isTodayExpr} THEN 1 END) as total_deliveries,
            COUNT(CASE WHEN ${isTodayExpr} AND (UPPER(dn.status) IN (${completedPlaceholders}) OR dr.id IS NOT NULL OR dn.delivery_date_actual IS NOT NULL) THEN 1 END) as completed_deliveries,
            COUNT(CASE WHEN ${isTodayExpr} AND UPPER(dn.status) IN (${pendingPlaceholders}) THEN 1 END) as pending_deliveries,
            COUNT(CASE WHEN ${isTodayExpr} AND (
              UPPER(dn.status) IN (${inProgressPlaceholders})
              OR EXISTS(
                SELECT 1 FROM route_deliveries rd JOIN routes r ON rd.route_id = r.id
                WHERE rd.delivery_note_id = dn.id AND r.company_id = dn.company_id AND DATE(r.start_datetime) = CURDATE() AND UPPER(r.status) IN (${routeStatusesPlaceholders})
              )
            ) THEN 1 END) as in_progress_deliveries
          FROM delivery_notes dn
          LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
          WHERE dn.company_id = ?`,
          params: [...COMPLETED_STATUSES_UPPER, ...PENDING_STATUSES_UPPER, ...IN_PROGRESS_STATUSES_UPPER, ...ROUTE_STARTED_STATUSES_UPPER, company_id],
      },
      {
        // Fallback: count by created_at only
        sql: `SELECT
          COUNT(dn.id) AS total_deliveries,
          SUM(CASE WHEN (UPPER(dn.status) IN (${completedPlaceholders}) OR EXISTS(SELECT 1 FROM delivery_receipts dr2 WHERE dr2.delivery_note_id = dn.id) OR dn.delivery_date_actual IS NOT NULL) THEN 1 ELSE 0 END) AS completed_deliveries,
          SUM(CASE WHEN UPPER(dn.status) IN (${pendingPlaceholders}) THEN 1 ELSE 0 END) AS pending_deliveries,
          SUM(CASE WHEN (UPPER(dn.status) IN (${inProgressPlaceholders}) OR EXISTS(
            SELECT 1 FROM route_deliveries rd JOIN routes r ON rd.route_id = r.id
            WHERE rd.delivery_note_id = dn.id AND r.company_id = dn.company_id AND DATE(r.start_datetime) = CURDATE() AND UPPER(r.status) IN (${routeStatusesPlaceholders})
          )) THEN 1 ELSE 0 END) AS in_progress_deliveries
        FROM delivery_notes dn
        WHERE dn.company_id = ? AND DATE(dn.created_at) = CURDATE()`,
        params: [...COMPLETED_STATUSES_UPPER, ...PENDING_STATUSES_UPPER, ...IN_PROGRESS_STATUSES_UPPER, ...ROUTE_STARTED_STATUSES_UPPER, company_id],
      },
    ];

    const [deliveryStatsRows] = await runWithFallbacks(deliveryStatsQueries);
    const deliveryStats = Array.isArray(deliveryStatsRows) && deliveryStatsRows.length ? deliveryStatsRows[0] : {};

    const totalDeliveries = Number(deliveryStats.total_deliveries) || 0;
    const completedDeliveries = Number(deliveryStats.completed_deliveries) || 0;
    const pendingDeliveries = Number(deliveryStats.pending_deliveries) || 0;
    const inProgressDeliveries = Number(deliveryStats.in_progress_deliveries) || 0;

    // More robust active drivers calculation: combine routes that started today with tracking points
    const activeDriversCountSql = `
      SELECT COUNT(DISTINCT driver_id) AS active_drivers FROM (
        SELECT driver_id FROM routes WHERE company_id = ? AND DATE(start_datetime) = CURDATE() AND UPPER(status) IN (${routeStatusesPlaceholders})
        UNION
        SELECT driver_id FROM tracking_points WHERE company_id = ? AND DATE(timestamp) = CURDATE()
      ) t
    `;

    const [activeDriversRows] = await runWithFallbacks([
      { sql: activeDriversCountSql, params: [company_id, ...ROUTE_STARTED_STATUSES_UPPER, company_id] }
    ]);
    const activeDrivers = Number(activeDriversRows?.[0]?.active_drivers) || 0;

    const occurrencesQueries = [
      {
        sql: `SELECT COUNT(DISTINCT do.id) AS pending_occurrences
          FROM delivery_occurrences do
          JOIN delivery_notes dn ON dn.id = do.delivery_id
          WHERE dn.company_id = ? AND UPPER(dn.status) NOT IN (${completedPlaceholders})`, // Ocorrências de entregas não finalizadas
        params: [company_id, ...COMPLETED_STATUSES_UPPER],
      },
      {
        sql: `SELECT COUNT(DISTINCT do.id) AS pending_occurrences
          FROM delivery_occurrences do
          WHERE do.company_id = ?`, // Fallback: conta todas as ocorrências da empresa
        params: [company_id],
      },
    ];

    const [occurrencesRows] = await runWithFallbacks(occurrencesQueries);
    const pendingOccurrences = Number(occurrencesRows?.[0]?.pending_occurrences) || 0;

    const kpis = {
      today_deliveries: {
        total: totalDeliveries,
        completed: completedDeliveries,
        pending: pendingDeliveries,
        in_progress: inProgressDeliveries,
      },
      active_drivers: activeDrivers,
      pending_occurrences: pendingOccurrences,
    };

    // Fetch list of deliveries for today (for UI list view)
    try {
      // Use client_name_extracted and try to resolve assigned driver via route_deliveries -> routes -> drivers -> users
      const deliveriesListQueries = [
        {
          sql: `SELECT dn.id,
            dn.client_id,
            dn.client_name_extracted AS client_name,
            dn.status,
            (
              SELECT rd.route_id FROM route_deliveries rd WHERE rd.delivery_note_id = dn.id LIMIT 1
            ) AS route_id,
            (
              SELECT u.full_name FROM users u JOIN drivers d ON u.id = d.user_id WHERE d.id = dn.driver_id LIMIT 1
            ) as driver_name,
            dn.created_at,
            dn.delivery_date_expected,
            dr.id AS receipt_id,
            ${isTodayExpr} AS is_today,
            (UPPER(dn.status) IN (${completedLiterals}) OR dr.id IS NOT NULL OR dn.delivery_date_actual IS NOT NULL) AS is_completed
          FROM delivery_notes dn
          LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
          WHERE dn.company_id = ? AND ${isTodayExpr}
          ORDER BY dn.created_at DESC LIMIT 1000`,
          params: [company_id],
        },
    ];

      const [deliveriesRows] = await runWithFallbacks(deliveriesListQueries);
      let resolvedDeliveries = Array.isArray(deliveriesRows) ? deliveriesRows : [];

      // If we have KPI counts indicating there are deliveries today but the
      // is_today-based query returned no rows (possible due to data inconsistencies),
      // fall back to selecting by DATE(created_at) = CURDATE() so the UI isn't empty.
      if ((!resolvedDeliveries || resolvedDeliveries.length === 0) && Number(kpis.today_deliveries?.total || 0) > 0) {
        console.warn('[Reports] is_today query returned no rows but KPI total > 0 — running fallback by created_at');
        try {
          const fallbackSql = `SELECT dn.id, dn.client_id, dn.client_name_extracted AS client_name, dn.status,
            (SELECT rd.route_id FROM route_deliveries rd WHERE rd.delivery_note_id = dn.id LIMIT 1) AS route_id,
            (SELECT u.full_name FROM users u JOIN drivers d ON u.id = d.user_id WHERE d.id = dn.driver_id LIMIT 1) as driver_name,
            dn.created_at, dn.delivery_date_expected, dr.id AS receipt_id, DATE(dn.created_at) = CURDATE() AS is_today
            , (UPPER(dn.status) IN (${completedLiterals}) OR dr.id IS NOT NULL OR dn.delivery_date_actual IS NOT NULL) AS is_completed
            FROM delivery_notes dn
            LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
            WHERE dn.company_id = ? AND DATE(dn.created_at) = CURDATE()
            ORDER BY dn.created_at DESC LIMIT 1000`;
          const [fallbackRows] = await pool.query(fallbackSql, [company_id]);
          resolvedDeliveries = Array.isArray(fallbackRows) ? fallbackRows : [];
        } catch (fallbackErr) {
          console.warn('[Reports] Fallback delivery list query failed:', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
        }
      }

      kpis.today_deliveries.list = resolvedDeliveries;
    } catch (err) {
      console.warn('Erro ao buscar lista de entregas:', err && err.message ? err.message : err);
      kpis.today_deliveries.list = [];
    }

    // Fetch active drivers list: combine routes that started today and tracking_points from today
    try {
      // Build a list of active drivers combining routes and tracking points
      const activeDriversListSql = `
        SELECT DISTINCT d.id, u.full_name as name, COALESCE(tp.last_ts, r.start_datetime, d.last_location_update) as last_seen
        FROM drivers d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN (
          SELECT driver_id, MAX(timestamp) as last_ts FROM tracking_points WHERE company_id = ? AND DATE(timestamp) = CURDATE() GROUP BY driver_id
        ) tp ON tp.driver_id = d.id
        LEFT JOIN (
          SELECT driver_id, start_datetime FROM routes WHERE company_id = ? AND DATE(start_datetime) = CURDATE() AND UPPER(status) IN (${routeStatusesPlaceholders})
        ) r ON r.driver_id = d.id
        WHERE d.company_id = ? AND (r.driver_id IS NOT NULL OR tp.last_ts IS NOT NULL)
        ORDER BY last_seen DESC
        LIMIT 1000
      `;

      const [activeDriversListRows] = await runWithFallbacks([
        { sql: activeDriversListSql, params: [company_id, company_id, ...ROUTE_STARTED_STATUSES_UPPER, company_id] }
      ]);
      kpis.active_drivers_list = Array.isArray(activeDriversListRows) ? activeDriversListRows : [];

    } catch (err) {
      console.warn('Erro ao buscar lista de motoristas ativos:', err && err.message ? err.message : err);
      kpis.active_drivers_list = [];
    }

    res.json({ success: true, data: kpis });
  } catch (error) {
    // Log full stack for debugging
    console.error('Erro ao buscar KPIs:', error && error.stack ? error.stack : error);

    // Normalize error shape for the frontend: `error` should be a string so
    // frontend code that calls string methods (like includes) won't crash.
    const responseMessage = (process.env.NODE_ENV === 'production')
      ? 'Erro interno do servidor ao buscar KPIs.'
      : (error && error.message) ? String(error.message) : 'Erro desconhecido';

    const responseBody = { success: false, error: responseMessage };
    // In non-production include full stack trace under a separate key for debugging
    if (process.env.NODE_ENV !== 'production' && error && error.stack) {
      responseBody.error_details = String(error.stack);
    }

    res.status(500).json(responseBody);
  }
});

/**
 * GET /api/reports/canhotos
 * Retorna entregas finalizadas com informações do motorista, cliente, data e link para a imagem do canhoto (se houver).
 */

app.get('/api/reports/driver-performance', authorize(['ADMIN', 'SUPERVISOR', 'MASTER']), async (req, res) => {
  try {
    const { company_id: companyId } = req.user || {};
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Empresa nao informada no token.' });
    }

    const [driverRows] = await pool.query(
      `SELECT
        d.id AS driver_id,
        d.user_id AS driver_user_id,
        u.full_name AS driver_name,
        u.username AS driver_username,
        u.email AS driver_email
      FROM drivers d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.company_id = ?`,
      [companyId]
    );

    const deliveriesSql = `
      SELECT
        dn.id,
        dn.driver_id AS raw_driver_id,
        COALESCE(dn.delivery_date_actual, dn.created_at) AS delivery_datetime,
        DATE(COALESCE(dn.delivery_date_actual, dn.created_at)) = CURDATE() AS is_today,
        YEAR(COALESCE(dn.delivery_date_actual, dn.created_at)) = YEAR(CURDATE())
          AND MONTH(COALESCE(dn.delivery_date_actual, dn.created_at)) = MONTH(CURDATE()) AS is_current_month,
        drv.id AS driver_record_id,
        drv.user_id AS driver_user_id,
        u_drv.full_name AS driver_record_name,
        u_drv.username AS driver_record_username,
        u_direct.full_name AS direct_name,
        u_direct.username AS direct_username
      FROM delivery_notes dn
      LEFT JOIN drivers drv ON drv.id = dn.driver_id
      LEFT JOIN users u_drv ON u_drv.id = drv.user_id
      LEFT JOIN users u_direct ON u_direct.id = dn.driver_id
      WHERE dn.company_id = ?
        AND (
          DATE(COALESCE(dn.delivery_date_actual, dn.created_at)) = CURDATE()
          OR (
            YEAR(COALESCE(dn.delivery_date_actual, dn.created_at)) = YEAR(CURDATE())
            AND MONTH(COALESCE(dn.delivery_date_actual, dn.created_at)) = MONTH(CURDATE())
          )
        )
    `;
    const [deliveryRows] = await pool.query(deliveriesSql, [companyId]);

    const occurrencesSql = `
      SELECT
        do.id,
        do.driver_id AS occurrence_driver_id,
        do.created_at,
        DATE(do.created_at) = CURDATE() AS is_today,
        YEAR(do.created_at) = YEAR(CURDATE()) AND MONTH(do.created_at) = MONTH(CURDATE()) AS is_current_month,
        dn.driver_id AS related_delivery_driver_id,
        drv.id AS driver_record_id,
        drv.user_id AS driver_user_id,
        u_drv.full_name AS driver_record_name,
        u_direct.full_name AS direct_name
      FROM delivery_occurrences do
      LEFT JOIN delivery_notes dn ON dn.id = do.delivery_id
      LEFT JOIN drivers drv ON drv.id = dn.driver_id
      LEFT JOIN users u_drv ON u_drv.id = drv.user_id
      LEFT JOIN users u_direct ON u_direct.id = do.driver_id
      WHERE do.company_id = ?
        AND (
          DATE(do.created_at) = CURDATE()
          OR (
            YEAR(do.created_at) = YEAR(CURDATE())
            AND MONTH(do.created_at) = MONTH(CURDATE())
          )
        )
    `;
    const [occurrenceRows] = await pool.query(occurrencesSql, [companyId]);

    const routesSql = `
      SELECT
        r.driver_id,
        r.vehicle_id,
        DATE(r.start_datetime) = CURDATE() AS used_today,
        YEAR(r.start_datetime) = YEAR(CURDATE()) AND MONTH(r.start_datetime) = MONTH(CURDATE()) AS used_current_month,
        v.plate,
        v.model,
        drv.user_id AS driver_user_id
      FROM routes r
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      LEFT JOIN drivers drv ON drv.id = r.driver_id
      WHERE r.company_id = ?
        AND r.vehicle_id IS NOT NULL
        AND (
          DATE(r.start_datetime) = CURDATE()
          OR (
            YEAR(r.start_datetime) = YEAR(CURDATE())
            AND MONTH(r.start_datetime) = MONTH(CURDATE())
          )
        )
    `;
    const [routeRows] = await pool.query(routesSql, [companyId]);

    const driverMap = new Map();

    const toSafeString = (value) => {
      if (value === null || value === undefined) return null;
      return String(value);
    };

    const toBooleanLike = (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') return Number(value) === 1;
      if (Buffer.isBuffer(value)) return value.length ? value[0] === 1 : false;
      return Boolean(value);
    };

    const ensureDriverEntry = ({
      driverRecordId,
      driverUserId,
      rawDriverId,
      name,
      username,
    }) => {
      const sanitizedRecordId = driverRecordId != null ? Number(driverRecordId) : null;
      const sanitizedUserId = driverUserId != null ? Number(driverUserId) : null;
      const sanitizedRawId = rawDriverId != null ? Number(rawDriverId) : null;

      let key = null;
      if (Number.isFinite(sanitizedRecordId)) {
        key = `driver:${sanitizedRecordId}`;
      } else if (Number.isFinite(sanitizedUserId)) {
        key = `user:${sanitizedUserId}`;
      } else if (Number.isFinite(sanitizedRawId)) {
        key = `user:${sanitizedRawId}`;
      }

      if (!key) {
        return null;
      }

      if (!driverMap.has(key)) {
        driverMap.set(key, {
          driverKey: key,
          driverId: Number.isFinite(sanitizedRecordId) ? toSafeString(sanitizedRecordId) : null,
          userId: Number.isFinite(sanitizedUserId)
            ? toSafeString(sanitizedUserId)
            : (Number.isFinite(sanitizedRawId) ? toSafeString(sanitizedRawId) : null),
          name: name || 'Motorista',
          username: username || null,
          deliveriesToday: 0,
          deliveriesMonth: 0,
          occurrencesToday: 0,
          occurrencesMonth: 0,
          vehiclesTodaySet: new Map(),
          vehiclesMonthSet: new Map(),
        });
      } else {
        const entry = driverMap.get(key);
        if ((!entry.name || entry.name === 'Motorista') && name) {
          entry.name = name;
        }
        if (!entry.username && username) {
          entry.username = username;
        }
        if (!entry.userId && Number.isFinite(sanitizedUserId)) {
          entry.userId = toSafeString(sanitizedUserId);
        }
      }

      return driverMap.get(key);
    };

    driverRows.forEach((row) => {
      ensureDriverEntry({
        driverRecordId: row.driver_id,
        driverUserId: row.driver_user_id,
        rawDriverId: null,
        name: row.driver_name || row.driver_username || 'Motorista',
        username: row.driver_username || null,
      });
    });

    let totalDeliveriesToday = 0;
    let totalDeliveriesMonth = 0;

    deliveryRows.forEach((row) => {
      const entry = ensureDriverEntry({
        driverRecordId: row.driver_record_id,
        driverUserId: row.driver_user_id,
        rawDriverId: row.raw_driver_id,
        name: row.driver_record_name || row.direct_name || row.driver_record_username || row.direct_username,
        username: row.driver_record_username || row.direct_username || null,
      });

      if (!entry) {
        return;
      }

      const isToday = toBooleanLike(row.is_today);
      const isCurrentMonth = toBooleanLike(row.is_current_month);

      if (isToday) {
        entry.deliveriesToday += 1;
        totalDeliveriesToday += 1;
      }
      if (isCurrentMonth) {
        entry.deliveriesMonth += 1;
        totalDeliveriesMonth += 1;
      }
    });

    occurrenceRows.forEach((row) => {
      const entry = ensureDriverEntry({
        driverRecordId: row.driver_record_id,
        driverUserId: row.driver_user_id,
        rawDriverId: row.occurrence_driver_id ?? row.related_delivery_driver_id,
        name: row.driver_record_name || row.direct_name,
        username: null,
      });

      if (!entry) {
        return;
      }

      const isToday = toBooleanLike(row.is_today);
      const isCurrentMonth = toBooleanLike(row.is_current_month);

      if (isToday) {
        entry.occurrencesToday += 1;
      }
      if (isCurrentMonth) {
        entry.occurrencesMonth += 1;
      }
    });

    const registerVehicle = (entry, bucket, vehicleRow) => {
      if (!entry) return;
      const vehicleKey = vehicleRow.vehicle_id != null
        ? `id:${vehicleRow.vehicle_id}`
        : `label:${vehicleRow.plate || vehicleRow.model || 'desconhecido'}`;

      const labelParts = [];
      if (vehicleRow.plate) labelParts.push(vehicleRow.plate);
      if (vehicleRow.model) labelParts.push(vehicleRow.model);
      const label = labelParts.length ? labelParts.join(' - ') : 'Veiculo nao identificado';

      const targetBucket = bucket === 'today' ? entry.vehiclesTodaySet : entry.vehiclesMonthSet;
      if (!targetBucket.has(vehicleKey)) {
        targetBucket.set(vehicleKey, {
          vehicleId: vehicleRow.vehicle_id != null ? toSafeString(vehicleRow.vehicle_id) : null,
          plate: vehicleRow.plate || null,
          model: vehicleRow.model || null,
          brand: null, // A coluna 'brand' não existe na tabela 'vehicles'
          label,
        });
      }
    };

    routeRows.forEach((row) => {
      const entry = ensureDriverEntry({
        driverRecordId: row.driver_id,
        driverUserId: row.driver_user_id,
        rawDriverId: row.driver_user_id,
        name: null,
        username: null,
      });
      if (!entry) {
        return;
      }

      if (toBooleanLike(row.used_today)) {
        registerVehicle(entry, 'today', row);
      }
      if (toBooleanLike(row.used_current_month)) {
        registerVehicle(entry, 'month', row);
      }
    });

    let topEntry = null;

    const drivers = Array.from(driverMap.values()).map((entry) => {
      const vehiclesToday = Array.from(entry.vehiclesTodaySet.values());
      const vehiclesMonth = Array.from(entry.vehiclesMonthSet.values());
      delete entry.vehiclesTodaySet;
      delete entry.vehiclesMonthSet;

      if (entry.deliveriesToday > 0) {
        if (!topEntry || entry.deliveriesToday > topEntry.deliveriesToday) {
          topEntry = entry;
        }
      }

      return {
        ...entry,
        vehiclesToday,
        vehiclesMonth,
        isTopToday: false,
      };
    });

    const sortedDrivers = drivers.sort((a, b) => {
      if (b.deliveriesToday !== a.deliveriesToday) {
        return b.deliveriesToday - a.deliveriesToday;
      }
      if (b.deliveriesMonth !== a.deliveriesMonth) {
        return b.deliveriesMonth - a.deliveriesMonth;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    if (sortedDrivers.length === 0) {
      return res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          summary: {
            totalDrivers: 0,
            totalDeliveriesToday,
            totalDeliveriesMonth,
            topDriver: null,
          },
          drivers: [],
        },
      });
    }

    const topDriverEntry = sortedDrivers[0];
    if (topDriverEntry.deliveriesToday > 0) {
      topDriverEntry.isTopToday = true;
    }

    const summary = {
      totalDrivers: sortedDrivers.length,
      totalDeliveriesToday,
      totalDeliveriesMonth,
      topDriver: topDriverEntry.deliveriesToday > 0
        ? {
            driverKey: topDriverEntry.driverKey,
            driverId: topDriverEntry.driverId,
            userId: topDriverEntry.userId,
            name: topDriverEntry.name,
            deliveriesToday: topDriverEntry.deliveriesToday,
          }
        : null,
    };

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary,
        drivers: sortedDrivers.map((driver, index) => ({
          ...driver,
          rankToday: index + 1,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao gerar relatorio de motoristas:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao gerar relatorio de motoristas.',
    });
  }
});

app.get('/api/reports/canhotos', authorize(['ADMIN', 'SUPERVISOR', 'MASTER']), async (req, res) => {
  try {
    const { company_id } = req.user;

    const toSingleValue = (value) => (Array.isArray(value) ? value[0] : value);
    const normalizeNumericId = (value) => {
      const single = toSingleValue(value);
      if (single === undefined || single === null) return null;
      const trimmed = typeof single === 'string' ? single.trim() : String(single).trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const normalizeDateParam = (value) => {
      const single = toSingleValue(value);
      if (single === undefined || single === null) return null;
      const trimmed = String(single).trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
    };

    const userType = typeof req.user?.user_type === 'string' ? req.user.user_type.toUpperCase() : '';
    let effectiveCompanyId = normalizeNumericId(company_id);
    const requestedCompanyId = normalizeNumericId(req.query?.company_id);
    if (requestedCompanyId !== null && (userType === 'MASTER' || userType === 'ADMIN' || requestedCompanyId === effectiveCompanyId)) {
      effectiveCompanyId = requestedCompanyId;
    }
    if (effectiveCompanyId === null) {
      return res.status(400).json({ success: false, error: 'Empresa nao definida para consulta.' });
    }

    const driverIdFilter = normalizeNumericId(req.query?.driver_id);
    let startDateFilter = normalizeDateParam(req.query?.start_date);
    let endDateFilter = normalizeDateParam(req.query?.end_date);
    if (startDateFilter && endDateFilter && startDateFilter > endDateFilter) {
      const temp = startDateFilter;
      startDateFilter = endDateFilter;
      endDateFilter = temp;
    }
    const searchFilterRaw = toSingleValue(req.query?.search);
    const searchFilter = typeof searchFilterRaw === 'string' ? searchFilterRaw.trim() : '';
    const normalizedSearch = searchFilter ? searchFilter : null;

    const dateExpr = 'DATE(COALESCE(dn.delivery_date_actual, dn.created_at))';

    const buildReceiptsQuery = ({ includeGcsPath = true, includeFilePath = true, includeFilename = true } = {}) => {
      const columns = [
        'dn.id AS delivery_id',
        'dn.nf_number AS nf_number',
        'dn.client_id',
        'dn.company_id AS company_id',
        'dn.client_name_extracted AS client_name',
        'dn.status',
        'COALESCE(dn.delivery_date_actual, dn.created_at) AS date',
        'COALESCE(d.id, d_user.id, dn.driver_id) AS driver_id',
        'COALESCE(u.full_name, u_direct.full_name) AS driver_name',
        'dr.id AS receipt_id',
        'dr.image_url',
        includeGcsPath ? 'dr.gcs_path' : 'NULL AS gcs_path',
        includeFilePath ? 'dr.file_path' : 'NULL AS file_path',
        includeFilename ? 'dr.filename' : 'NULL AS filename',
      ];

      const selectClause = columns.join(',\n      ');

      const conditions = [
        'dn.company_id = ?',
        `(
          UPPER(dn.status) IN (${completedLiterals})
          OR dr.id IS NOT NULL
          OR dn.delivery_date_actual IS NOT NULL
        )`,
      ];
      const params = [effectiveCompanyId];

      if (driverIdFilter !== null) {
        conditions.push('COALESCE(d.id, d_user.id, dn.driver_id) = ?');
        params.push(driverIdFilter);
      }
      if (startDateFilter) {
        conditions.push(`${dateExpr} >= ?`);
        params.push(startDateFilter);
      }
      if (endDateFilter) {
        conditions.push(`${dateExpr} <= ?`);
        params.push(endDateFilter);
      }
      if (normalizedSearch) {
        const likeValue = `%${normalizedSearch}%`;
        conditions.push(`(
          dn.nf_number LIKE ?
          OR dn.client_name_extracted LIKE ?
          OR u.full_name LIKE ?
          OR u_direct.full_name LIKE ?
          OR dr.filename LIKE ?
        )`);
        params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
      }

      const whereClause = conditions.join("\n      AND ");

      const sql = `SELECT
      ${selectClause}
    FROM delivery_notes dn
    LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = dn.id
    LEFT JOIN drivers d ON d.id = dn.driver_id
    LEFT JOIN drivers d_user ON d_user.user_id = dn.driver_id
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN users u_direct ON u_direct.id = dn.driver_id
    WHERE
      ${whereClause}
    ORDER BY date DESC, dn.created_at DESC
    LIMIT 2000`;

      return { sql, params };
    };

    const receiptQueries = [
      buildReceiptsQuery({ includeGcsPath: true, includeFilePath: true, includeFilename: true }),
      buildReceiptsQuery({ includeGcsPath: true, includeFilePath: false, includeFilename: false }),
      buildReceiptsQuery({ includeGcsPath: false, includeFilePath: false, includeFilename: false }),
    ];

    const [rows] = await runWithFallbacks(receiptQueries);

    const results = Array.isArray(rows) ? rows.map(r => ({
      id: r.delivery_id,
      delivery_id: r.delivery_id,
      nf_number: r.nf_number || null,
      client_id: r.client_id,
      client_name: r.client_name,
      status: r.status,
      date: r.date,
      driver_id: r.driver_id,
      driver_name: r.driver_name,
      receipt_id: r.receipt_id,
      image_url: r.image_url || r.gcs_path || r.file_path || null,
      gcs_path: r.gcs_path || null,
      file_path: r.file_path || null,
      filename: r.filename || null,
    })) : [];

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Erro ao buscar canhotos:', error && error.stack ? error.stack : error);
    const responseMessage = (process.env.NODE_ENV === 'production')
      ? 'Erro interno ao buscar canhotos.'
      : (error && error.message) ? String(error.message) : 'Erro desconhecido';
    const responseBody = { success: false, error: responseMessage };
    if (process.env.NODE_ENV !== 'production' && error && error.stack) {
      responseBody.error_details = String(error.stack);
    }
    res.status(500).json(responseBody);
  }
});

app.get('/api/reports/canhotos/proxy-view', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  const rawPathParam = typeof req.query?.path === 'string' ? req.query.path.trim() : '';
  const rawUrlParam = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  const targetUrl = resolveReceiptTargetUrl(rawUrlParam || null, rawPathParam || null);

  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'Parametros invalidos para localizar o canhoto.' });
  }

  try {
    const headers = {};
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const upstreamResponse = await fetch(targetUrl, { headers });

    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const skipHeaders = new Set(['access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-methods', 'access-control-allow-headers']);

    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'content-length' || lowerKey === 'transfer-encoding' || skipHeaders.has(lowerKey)) {
        return;
      }
      res.setHeader(key, value);
    });

    const buffer = await upstreamResponse.arrayBuffer();
    res.status(upstreamResponse.status).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Erro ao proxy do canhoto:', error);
    res.status(500).json({ success: false, error: 'Falha ao recuperar o canhoto.' });
  }
});

const PORT = Number(process.env.REPORTS_SERVICE_PORT || process.env.REPORTS_PORT || process.env.PORT || 3006);
if (require.main === module) {
  app.listen(PORT, () => console.log(`Reports Service rodando na porta ${PORT}`));
}

module.exports = app;
