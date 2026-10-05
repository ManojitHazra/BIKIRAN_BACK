/**
 * 🏥 Health Check Route for UptimeRobot, Render & Supabase Keep-Alive
 * Directory: backend/src/routes/health.routes.ts
 * 
 * ℹ️ WHAT DOES THIS ROUTE DO?
 * - Keeps Render Awake: Prevents free-tier web services from sleeping after 15 min.
 * - Keeps Supabase Alive: Executes a lightweight query against public.profiles so
 *   Supabase's free tier inactivity timer (7 days) NEVER triggers.
 */

import { Router, Request, Response } from 'express';
import { supabase, secondarySupabase } from '../services/supabase';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  // 1. Ping Primary Database (Auth & Profiles)
  const startPrimary = Date.now();
  let primaryStatus = 'connected';
  let primaryLatencyMs = 0;
  let primaryNotice: string | null = null;

  // 2. Ping Secondary Database (Form Responses & Career Explorer)
  const startSecondary = Date.now();
  let secondaryStatus = 'connected';
  let secondaryLatencyMs = 0;
  let secondaryNotice: string | null = null;

  try {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      supabase.from('profiles').select('id').limit(1),
      secondarySupabase.from('user_form_responses').select('id').limit(1),
    ]);

    // Handle Primary DB result
    primaryLatencyMs = Date.now() - startPrimary;
    if (primaryResult.status === 'fulfilled') {
      if (primaryResult.value.error) {
        primaryStatus = 'notice';
        primaryNotice = primaryResult.value.error.message;
      }
    } else {
      primaryStatus = 'unreachable';
      primaryNotice = primaryResult.reason?.message || 'Primary ping failed';
    }

    // Handle Secondary DB result
    secondaryLatencyMs = Date.now() - startSecondary;
    if (secondaryResult.status === 'fulfilled') {
      if (secondaryResult.value.error) {
        secondaryStatus = 'notice';
        secondaryNotice = secondaryResult.value.error.message;
      }
    } else {
      secondaryStatus = 'unreachable';
      secondaryNotice = secondaryResult.reason?.message || 'Secondary ping failed';
    }
  } catch (err: any) {
    primaryStatus = 'unreachable';
    secondaryStatus = 'unreachable';
    primaryNotice = err?.message || 'Unknown health ping error';
  }

  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    server: 'healthy',
    databases: {
      primary: {
        name: 'Database 1 (Auth & Profiles)',
        provider: 'Supabase PostgreSQL',
        status: primaryStatus,
        latencyMs: primaryLatencyMs,
        notice: primaryNotice,
      },
      secondary: {
        name: 'Database 2 (Form Responses)',
        provider: 'Supabase PostgreSQL',
        status: secondaryStatus,
        latencyMs: secondaryLatencyMs,
        notice: secondaryNotice,
      },
    },
    message: 'Bikiran Career Mitra Backend & Both Supabase Databases Kept Alive 🚀',
    timestamp: new Date().toISOString(),
  });
});

export default router;
