/**
 * 🚀 Bikiran Career Mitra — Backend Express Server
 * Designed for deployment on Render.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes';
import translateRoutes from './routes/translate.routes';
import openAppRoutes from './routes/openApp.routes';
import { supabase, secondarySupabase } from './services/supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/api/translate', translateRoutes);
app.use('/open-app', openAppRoutes);

// Root route: Responds to pings and queries both Supabase databases so root pings keep them 100% active
app.get('/', async (_req: Request, res: Response) => {
  try {
    await Promise.allSettled([
      supabase.from('profiles').select('id').limit(1),
      secondarySupabase.from('user_form_responses').select('id').limit(1),
    ]);
  } catch {}
  res.send('Bikiran Career Mitra Backend API & Both Supabase Databases Kept Alive 🚀');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
