import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import testerRouter from './routes/tester.js';
import masterRouter from './routes/master.js';
import gymRouter from './routes/gym.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', testerRouter);
app.use('/api', masterRouter);
app.use('/api', gymRouter);

const PORT = process.env.PORT || 5055;
app.listen(PORT, () => {
  console.log(`DB tester listening on http://localhost:${PORT}`);
});
