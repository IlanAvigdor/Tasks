const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'tasks.json');

app.use(cors());
app.use(bodyParser.json());

// Initialize tasks.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [] }, null, 2));
}

// Get all tasks
app.get('/api/tasks', (req, res) => {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data.tasks);
});

// Save all tasks
app.post('/api/tasks', (req, res) => {
    const tasks = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks }, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
