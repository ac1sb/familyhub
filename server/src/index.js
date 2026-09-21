import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eventsRouter from './routes/events.js';
import choresRouter from './routes/chores.js';
import mealsRouter from './routes/meals.js';
import lunchRouter from './routes/lunch.js';
import shoppingRouter from './routes/shopping.js';
import weatherRouter from './routes/weather.js';
import googleRouter from './routes/google.js';
import flyerRouter from './routes/flyer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/config', (req, res) => {
  res.json({
    members: {
      member_1: process.env.MEMBER_1_NAME || 'Mom',
      member_2: process.env.MEMBER_2_NAME || 'Dad',
      member_3: process.env.MEMBER_3_NAME || 'Child',
    },
    weather_zip: process.env.WEATHER_ZIP || '05255',
  });
});

app.use('/api/events', eventsRouter);
app.use('/api/chores', choresRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/lunch', lunchRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/google', googleRouter);
app.use('/api/flyer', flyerRouter);

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
