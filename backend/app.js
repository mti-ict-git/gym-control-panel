import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import testerRouter from './routes/tester.js';
import masterRouter from './routes/master.js';
import gymRouter from './routes/gym.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Support both /api prefix and root-level routes to tolerate different proxy setups
app.use('/api', testerRouter);
app.use('/api', masterRouter);
app.use('/api', gymRouter);
app.use('/api', authRouter);
app.use(testerRouter);
app.use(masterRouter);
app.use(gymRouter);
app.use(authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/gym-live-status', (_req, res) => {
  res.json({ ok: true, people: [] });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`DB tester listening on http://localhost:${PORT}`);
});
