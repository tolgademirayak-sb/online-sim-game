import express from 'express';
import cors from 'cors';
import { initStore, persistStore } from './db.js';
import sessionRoutes from './routes/sessions.js';
import roomRoutes from './routes/rooms.js';
import gameRoutes from './routes/game.js';
import adminRoutes from './routes/admin.js';
import instructorRoutes from './routes/instructor.js';
import classroomRoutes from './routes/classrooms.js';
import { sweepExpiredTimers } from './services/gameService.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../dist');

function getLanUrls(port: number): string[] {
  const interfaces = os.networkInterfaces();
  const urls = new Set<string>();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.add(`http://${address.address}:${port}`);
      }
    }
  }

  return Array.from(urls).sort();
}

function main() {
  // Initialize in-memory store (loads from disk if available)
  initStore();

  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
  });
  app.use(express.json());

  // Routes
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/rooms', gameRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/instructor', instructorRoutes);
  app.use('/api/classrooms', classroomRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      persistenceFile: 'server/data/store.json',
      host: HOST,
      lanUrls: getLanUrls(PORT),
    });
  });

  // Timer sweep every 5 seconds
  setInterval(() => {
    try {
      sweepExpiredTimers();
    } catch {
      // Ignore sweep errors
    }
  }, 5000);

  // Persist store every 30 seconds as backup
  setInterval(() => {
    try {
      persistStore();
    } catch {
      // Ignore
    }
  }, 30000);

  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Beer Game server running on ${HOST}:${PORT}`);
    console.log(`Admin token: ${ADMIN_TOKEN}`);
    if (fs.existsSync(CLIENT_DIST)) {
      console.log(`Serving client build from ${CLIENT_DIST}`);
    }
    console.log(`Local URL: http://localhost:${PORT}`);
    const lanUrls = getLanUrls(PORT);
    if (lanUrls.length > 0) {
      console.log('LAN URLs:');
      for (const url of lanUrls) {
        console.log(`  ${url}`);
      }
    }
  });
}

main();
