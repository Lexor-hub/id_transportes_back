const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '207.180.252.4',
  user: 'glaubermag',
  password: 'C@C3te12',
  database: 'id_transportes',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool; 