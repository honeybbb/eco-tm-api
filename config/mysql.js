var mysql = require("mysql2/promise");
var util = require("util");
var pool = mysql.createPool({
    host: 'renewwave.co.kr',
    post: '3306',
    user: 'root',
    password: 'Renew0701!',
    database: 'eco_erp_system'
})
/*
pool.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { console.error('Database connection was closed.'); }
        if (err.code === 'ER_CON_COUNT_ERROR') { console.error('Database has too many connections.'); }
        if (err.code === 'ECONNREFUSED') { console.error('Database connection was refused.'); }
    }
    if (connection) connection.release()
    return;
});
pool.query = util.promisify(pool.query);

 */
module.exports = pool;
