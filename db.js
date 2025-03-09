const { Pool } = require('pg');

const pool = new Pool({
    user: 'squaregroup',
    host: 'localhost',
    database: 'flows',
    password: 'omkar',
    port: 5432,
});

module.exports = pool;
