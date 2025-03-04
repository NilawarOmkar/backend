const express = require('express');
const ExcelJS = require('exceljs');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = 3000;
const excelFilePath = './users.xlsx';

app.use(bodyParser.json());

// Initialize Excel file with headers if it doesn't exist
async function initializeExcelFile() {
    if (!fs.existsSync(excelFilePath)) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');
        worksheet.addRow(['screen_0_First_0', 'screen_0_Last_1', 'screen_0_Email_2', 'flow_token']);
        await workbook.xlsx.writeFile(excelFilePath);
    }
}

// Start server after initialization
initializeExcelFile().then(() => {
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
});

// Add new user
app.post('/users', async (req, res) => {
    try {
        const userData = req.body;

        // Validate required fields
        if (!userData.screen_0_First_0 || !userData.screen_0_Last_1 ||
            !userData.screen_0_Email_2 || !userData.flow_token) {
            return res.status(400).send('All fields are required');
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        const worksheet = workbook.getWorksheet('Users');

        // Check for existing user
        let userExists = false;
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (row.getCell(4).value === userData.flow_token) {
                userExists = true;
                break;
            }
        }

        if (userExists) {
            return res.status(400).send('User already exists');
        }

        // Add new row
        worksheet.addRow([
            userData.screen_0_First_0,
            userData.screen_0_Last_1,
            userData.screen_0_Email_2,
            userData.flow_token
        ]);

        await workbook.xlsx.writeFile(excelFilePath);
        res.status(201).send('User added successfully');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Get user by flow_token
app.get('/users/:flowToken', async (req, res) => {
    try {
        const flowToken = req.params.flowToken;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        const worksheet = workbook.getWorksheet('Users');

        let user = null;
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (row.getCell(4).value === flowToken) {
                user = {
                    screen_0_First_0: row.getCell(1).value,
                    screen_0_Last_1: row.getCell(2).value,
                    screen_0_Email_2: row.getCell(3).value,
                    flow_token: row.getCell(4).value
                };
                break;
            }
        }

        user ? res.status(200).json(user) : res.status(404).send('User not found');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Get all users
app.get('/users', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        const worksheet = workbook.getWorksheet('Users');

        const users = [];
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const user = {
                screen_0_First_0: row.getCell(1).value,
                screen_0_Last_1: row.getCell(2).value,
                screen_0_Email_2: row.getCell(3).value,
                flow_token: row.getCell(4).value
            };
            users.push(user);
        }

        res.status(200).json(users);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Delete user by flow_token
app.delete('/users/:flowToken', async (req, res) => {
    try {
        const flowToken = req.params.flowToken;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        const worksheet = workbook.getWorksheet('Users');

        let rowToDelete = null;
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (row.getCell(4).value === flowToken) {
                rowToDelete = rowNumber;
                break;
            }
        }

        if (!rowToDelete) return res.status(404).send('User not found');

        worksheet.spliceRows(rowToDelete, 1);
        await workbook.xlsx.writeFile(excelFilePath);
        res.status(200).send('User deleted successfully');
    } catch (error) {
        res.status(500).send(error.message);
    }
});