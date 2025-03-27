const express = require('express');
const pool = require('../db');

const router = express.Router();

// Get all groups
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM groups');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new group
router.post('/', async (req, res) => {
    const { name, numbers } = req.body;
    if (!name || !numbers) {
        return res.status(400).json({ error: "Name and numbers are required" });
    }
    try {
        const result = await pool.query(
            'INSERT INTO groups (name, numbers) VALUES ($1, $2) RETURNING *',
            [name, numbers]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update an existing group
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, numbers } = req.body;
    if (!name || !numbers) {
        return res.status(400).json({ error: "Name and numbers are required" });
    }
    try {
        const result = await pool.query(
            'UPDATE groups SET name = $1, numbers = $2 WHERE id = $3 RETURNING *',
            [name, numbers, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a group
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;