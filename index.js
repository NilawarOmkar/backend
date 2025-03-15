const express = require('express');
const ExcelJS = require('exceljs');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require("cors");
const pool = require('./db');
const path = require("path");

const app = express();
const port = 3000;
const excelFilePath = './users.xlsx';
const productRoutes = require('./routes/productRoutes');
const rabbitmqRoutes = require('./routes/rabbitmq');
const userRoutes = require('./routes/userRoutes');

app.use(bodyParser.json());
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use('/products', productRoutes);
app.use('/rabbitmq', rabbitmqRoutes);
app.use('/users', userRoutes);


async function initializeExcelFile() {
    if (!fs.existsSync(excelFilePath)) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');
        worksheet.addRow(['screen_0_First_0', 'screen_0_Last_1', 'screen_0_Email_2', 'flow_token']);
        await workbook.xlsx.writeFile(excelFilePath);
    }
}

initializeExcelFile().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

app.post('/users', async (req, res) => {
    try {
        const { screen_0_First_0, screen_0_Last_1, screen_0_Email_2, flow_token } = req.body;

        if (!screen_0_First_0 || !screen_0_Last_1 || !screen_0_Email_2 || !flow_token) {
            return res.status(400).send('All fields are required');
        }

        const query = `INSERT INTO users (first_name, last_name, email, phone_number) VALUES ($1, $2, $3, $4) RETURNING *;`;
        const values = [screen_0_First_0, screen_0_Last_1, screen_0_Email_2, flow_token];

        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).send(error.message);
    }
});


// Get user by flow_token
app.get('/users/:flowToken', async (req, res) => {
    try {
        const flowToken = req.params.flowToken;
        const query = `SELECT * FROM users WHERE phone_number = $1;`;
        const { rows } = await pool.query(query, [flowToken]);

        rows.length > 0 ? res.status(200).json(rows[0]) : res.status(404).send('User not found');
    } catch (error) {
        res.status(500).send(error.message);
    }
});


// Get all users
app.get('/users', async (req, res) => {
    try {
        const query = `SELECT * FROM users;`;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Delete user by flow_token
app.delete('/users/:flowToken', async (req, res) => {
    try {
        const flowToken = req.params.flowToken;
        const query = `DELETE FROM users WHERE phone_number = $1 RETURNING *;`;
        const { rows } = await pool.query(query, [flowToken]);

        rows.length > 0 ? res.status(200).send('User deleted successfully') : res.status(404).send('User not found');
    } catch (error) {
        res.status(500).send(error.message);
    }
});
