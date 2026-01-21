import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from './db';
import taskRoutes from './routes/tasks';
import aiRoutes from './routes/ai';
import authRoutes from './routes/auth';
import suggestionRoutes from './routes/suggestions';
import pushRoutes from './routes/push';
import settingsRoutes from './routes/settings';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/settings', settingsRoutes);

startScheduler();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
