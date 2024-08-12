const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(cors());

app.use(express.json());

const sheets = google.sheets('v4');

// Replace with your own credentials and sheet ID
const credentials = require('./credentials.json'); // Your Google Cloud credentials
const spreadsheetId = '1UY_v93QxLrJoqmioD_0D_RBBVOl_2taE7kfZeslwkx8';

async function getAuth() {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

app.post('/clockIn', async (req, res) => {
    const { employee, gps } = req.body;
    const auth = await getAuth();

    // Reverse Geocoding to get the location (You can use any other API if required)
    const location = `Lat: ${gps[0]}, Lng: ${gps[1]}`; // Replace with actual geocoding result

    // Fetch existing data
    const getResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: 'MAIN!A:D',
    });

    const rows = getResponse.data.values;
    let msg = 'SUCCESS';
    let returnDate = new Date().toISOString();
    let lastRow = rows.length;

    // Check if employee has already clocked in
    for (let i = 1; i < lastRow; i++) {
        if (rows[i][0] === employee && !rows[i][2]) {
            msg = 'Sorry, you have to ClockOut first!';
            return res.json({ msg, returnDate, employee });
        }
    }

    // Append new clock-in entry
    await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId,
        range: 'MAIN!A:D',
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[employee, new Date().toISOString(), '', location]],
        },
    });

    res.json({ msg, returnDate, employee });
});

app.post('/clockOut', async (req, res) => {
    const { employee, gps } = req.body;
    const auth = await getAuth();
    const location = `Lat: ${gps[0]}, Lng: ${gps[1]}`;

    const getResponse = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: 'MAIN!A:F',
    });

    const rows = getResponse.data.values;
    let foundRecord = false;
    let msg = 'SUCCESS';
    let returnDate = new Date().toISOString();

    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === employee && !rows[i][2]) {
            const clockInTime = new Date(rows[i][1]);
            const clockOutTime = new Date();
            const totalTime = (clockOutTime - clockInTime) / (60 * 60 * 1000);

            // Update the row with clock-out details
            await sheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: `MAIN!C${i + 1}:F${i + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[clockOutTime.toISOString(), location, totalTime.toFixed(2)]],
                },
            });
            foundRecord = true;
        }
    }

    if (!foundRecord) {
        return res.json({ msg: 'Sorry, you have not Clocked In yet.', returnDate, employee });
    }

    res.json({ msg, returnDate, employee });
});

app.listen(5000, () => {
    console.log('Server running on http://127.0.0.1:5000');
});
