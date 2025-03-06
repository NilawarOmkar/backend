const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');

const router = express.Router();
const uploadDir = 'uploads/';
const uploadFilePath = `${uploadDir}products.xlsx`;

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No File uploaded' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];

        const headers = worksheet.getRow(1).values.slice(1);
        const expectedHeaders = ['Grade', 'Model', 'Storage', 'Price'];

        if (!expectedHeaders.every(h => headers.includes(h))) {
            return res.status(400).json({ message: 'Invalid spreadsheet format. Ensure correct column headers: Grade, Model, Storage, Price' });
        }

        let jsonData = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rowData = {
                Grade: row.getCell(1).value,
                Model: row.getCell(2).value,
                Storage: row.getCell(3).value,
                Price: row.getCell(4).value,
            };
            jsonData.push(rowData);
        });

        const isValid = validateSpreadsheet(jsonData);
        if (!isValid) {
            return res.status(400).json({ message: 'Incorrect or missing data' });
        }

        jsonData.sort((a, b) => {
            const validGrades = ['A', 'B', 'C', 'D', 'E'];
            return validGrades.indexOf(a.Grade) - validGrades.indexOf(b.Grade);
        });

        const newWorkbook = new ExcelJS.Workbook();
        const newWorksheet = newWorkbook.addWorksheet('Products');

        newWorksheet.addRow(['Grade', 'Model', 'Storage', 'Price']);

        jsonData.forEach(row => {
            newWorksheet.addRow([row.Grade, row.Model, row.Storage, row.Price]);
        });

        await newWorkbook.xlsx.writeFile(uploadFilePath);
        fs.unlinkSync(req.file.path);
        res.json({ message: 'File uploaded, validated, and sorted successfully', filePath: uploadFilePath });

    } catch (error) {
        res.status(500).json({ message: 'Error processing file', error });
    }
});

function validateSpreadsheet(data) {
    const validGrades = ['A', 'B', 'C', 'D', 'E'];

    for (let row of data) {
        const { Grade, Model, Storage, Price } = row;

        if (!Grade || !Model || !Storage || !Price) {
            return false;
        }

        if (!validGrades.includes(Grade)) {
            return false;
        }
    }

    return true;
}

router.get('/products', async (req, res) => {
    try {
        if (!fs.existsSync(uploadFilePath)) {
            return res.status(404).json({ message: 'No products file found' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(uploadFilePath);
        const worksheet = workbook.getWorksheet('Products');

        let jsonData = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rowData = {
                Grade: row.getCell(1).value,
                Model: row.getCell(2).value,
                Storage: row.getCell(3).value,
                Price: row.getCell(4).value,
            };
            jsonData.push(rowData);
        });

        res.json(jsonData);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving products', error });
    }
});

module.exports = router;
