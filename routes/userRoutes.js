const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `INSERT INTO registration (username, password) VALUES ($1, $2) RETURNING *;`;
        const { rows } = await pool.query(query, [username, hashedPassword]);

        res.status(201).json({ message: 'User registered successfully', user: rows[0] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const query = `SELECT * FROM registration WHERE username = $1;`;
        const { rows } = await pool.query(query, [username]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, rows[0].password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.status(200).json({ message: 'Login successful', user: { id: rows[0].id, username: rows[0].username } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
