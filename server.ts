import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Zod Validation Schemas
const BaseEntitySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  updatedAt: z.number().optional(),
  deletedAt: z.number().optional()
}).passthrough();

const DatabaseSchema = z.object({
  revision: z.number().optional(),
  lastUpdated: z.string().optional(),
  projects: z.array(BaseEntitySchema).default([]),
  labours: z.array(BaseEntitySchema).default([]),
  attendance: z.array(BaseEntitySchema).default([]),
  advances: z.array(BaseEntitySchema).default([]),
  payments: z.array(BaseEntitySchema).default([]),
  materials: z.array(BaseEntitySchema).default([]),
  hotel_advances: z.array(BaseEntitySchema).default([]),
  food_logs: z.array(BaseEntitySchema).default([]),
  gst_records: z.array(BaseEntitySchema).default([]),
  payers: z.array(BaseEntitySchema).default([]),
  site_diaries: z.array(BaseEntitySchema).default([]),
  delay_weather_logs: z.array(BaseEntitySchema).default([]),
  daily_expenses: z.array(BaseEntitySchema).default([])
});

const DeltaSyncSchema = z.object({
  clientRevision: z.number().optional(),
  sinceTimestamp: z.number().optional(),
  changes: DatabaseSchema.partial()
});

// Ensure database folder and file exist
function initializeServerDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialSchema = {
      revision: 1,
      lastUpdated: new Date().toISOString(),
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

// POST to sync full database or save latest state with Zod validation
app.post('/api/db/sync', (req, res) => {
  try {
    const parseResult = DatabaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid database payload format',
        details: parseResult.error.format()
      });
    }

    const currentRaw = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf-8') : '{}';
    let currentDb: any = {};
    try { currentDb = JSON.parse(currentRaw); } catch (e) {}

    const newRevision = (currentDb.revision || 0) + 1;
    const validatedData = {
      ...parseResult.data,
      revision: newRevision,
      lastUpdated: new Date().toISOString()
    };

    // Atomic write
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(validatedData, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    res.json({
      status: 'success',
      message: 'Database synced successfully',
      revision: newRevision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error writing to db.json:', error);
    res.status(500).json({ error: 'Failed to sync database' });
  }
});

// POST for Incremental Delta Sync (Only changed records)
app.post('/api/db/sync/delta', (req, res) => {
  try {
    const parseResult = DeltaSyncSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid delta payload',
        details: parseResult.error.format()
      });
    }

    const { sinceTimestamp = 0, changes = {} } = parseResult.data;

    if (!fs.existsSync(DB_FILE)) {
      initializeServerDb();
    }

    const currentRaw = fs.readFileSync(DB_FILE, 'utf-8');
    const serverDb = JSON.parse(currentRaw);

    const storeKeys = [
      'projects', 'labours', 'attendance', 'advances', 'payments',
      'materials', 'hotel_advances', 'food_logs', 'gst_records',
      'payers', 'site_diaries', 'delay_weather_logs', 'daily_expenses'
    ];

    const serverUpdates: Record<string, any[]> = {};

    // 1. Merge incoming client changes into server database
    storeKeys.forEach((key) => {
      const serverItems: any[] = Array.isArray(serverDb[key]) ? serverDb[key] : [];
      const clientItems: any[] = Array.isArray((changes as any)[key]) ? (changes as any)[key] : [];

      const itemMap = new Map<string, any>();
      serverItems.forEach(item => itemMap.set(item.id, item));

      // Merge client items if newer
      clientItems.forEach(clientItem => {
        const existing = itemMap.get(clientItem.id);
        if (!existing || (clientItem.updatedAt || 0) >= (existing.updatedAt || 0)) {
          itemMap.set(clientItem.id, clientItem);
        }
      });

      serverDb[key] = Array.from(itemMap.values());

      // 2. Identify items changed on server since `sinceTimestamp` to return to client
      if (sinceTimestamp > 0) {
        serverUpdates[key] = serverDb[key].filter(item => (item.updatedAt || 0) > sinceTimestamp);
      } else {
        serverUpdates[key] = serverDb[key];
      }
    });

    serverDb.revision = (serverDb.revision || 0) + 1;
    serverDb.lastUpdated = new Date().toISOString();

    // Atomic write
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(serverDb, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    res.json({
      status: 'success',
      revision: serverDb.revision,
      timestamp: Date.now(),
      serverUpdates
    });
  } catch (error) {
    console.error('Error during delta sync:', error);
    res.status(500).json({ error: 'Failed to process incremental sync' });
  }
});

// Explicit API 404 handler so unmatched API routes respond with JSON 404 instead of Vite SPA index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
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
