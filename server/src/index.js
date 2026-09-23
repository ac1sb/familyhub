import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eventsRouter from './routes/events.js';
import choresRouter from './routes/chores.js';
import choreTemplatesRouter from './routes/choreTemplates.js';
import dailyTasksRouter from './routes/dailyTasks.js';
import dailyTaskTemplatesRouter from './routes/dailyTaskTemplates.js';
import mealsRouter from './routes/meals.js';
import lunchRouter from './routes/lunch.js';
import shoppingRouter from './routes/shopping.js';
import weatherRouter from './routes/weather.js';
import googleRouter from './routes/google.js';
import flyerRouter from './routes/flyer.js';
import whiteboardRouter from './routes/whiteboard.js';
import settingsRouter from './routes/settings.js';
import smartDevicesRouter from './routes/smartDevices.js';
import { getMemberNames, getWeatherZip, getThemeSettings } from './lib/appConfig.js';
import { uploadsDir } from './lib/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// This runs unattended on a shared household display, so a single bad request
// (e.g. a flaky download inside a library like tesseract.js) should never take
// the whole dashboard offline. Log it and keep serving everything else.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server is still running):', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server is still running):', err);
});

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/config', (req, res) => {
  res.json({ members: getMemberNames(), weather_zip: getWeatherZip(), theme: getThemeSettings() });
});

app.use('/api/events', eventsRouter);
app.use('/api/chores', choresRouter);
app.use('/api/chore-templates', choreTemplatesRouter);
app.use('/api/daily-tasks', dailyTasksRouter);
app.use('/api/daily-task-templates', dailyTaskTemplatesRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/lunch', lunchRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/google', googleRouter);
app.use('/api/flyer', flyerRouter);
app.use('/api/whiteboard', whiteboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/smart-devices', smartDevicesRouter);

// Serve the built client in production (npm run build in /client outputs to /client/dist).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run "npm run build" in /client first.');
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FamilyHub server listening on http://localhost:${PORT}`);
});
