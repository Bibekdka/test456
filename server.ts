import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure database folder and file exist
function initializeServerDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialSchema = {
      projects: [],
      labours: [],
      attendance: [],
      advances: [],
      payments: [],
      materials: [],
      hotel_advances: [],
      food_logs: [],
      gst_records: [],
      payers: [],
      site_diaries: [],
      delay_weather_logs: [],
      daily_expenses: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf-8');
  }
}

initializeServerDb();

app.use(express.json({ limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// GET the full server-side database
app.get('/api/db', (req, res) => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      initializeServerDb();
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(rawData);
    res.json(data);
  } catch (error) {
    console.error('Error reading db.json:', error);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

// POST to sync full database or save latest state
app.post('/api/db/sync', (req, res) => {
  try {
    const incomingData = req.body;
    
    // Validate that incoming data is structured correctly
    const requiredKeys = ['projects', 'labours', 'attendance', 'advances', 'payments', 'materials', 'hotel_advances', 'food_logs', 'gst_records', 'payers', 'site_diaries', 'delay_weather_logs', 'daily_expenses'];
    
    const validatedData: any = {};
    for (const key of requiredKeys) {
      validatedData[key] = Array.isArray(incomingData[key]) ? incomingData[key] : [];
    }

    // Atomic write
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(validatedData, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    res.json({ status: 'success', message: 'Database synced successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error writing to db.json:', error);
    res.status(500).json({ error: 'Failed to sync database' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
