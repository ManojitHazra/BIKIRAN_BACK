/**
 * ⚡ Bikiran Career Mitra — Backend Supabase Service Client
 * Directory: backend/src/services/supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// 🗄️ Primary Database (Auth & User Profiles)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jpjfkmvkqssfdhpyktim.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 📦 Secondary Database (Form Responses & Career Explorer)
const SECONDARY_SUPABASE_URL = process.env.SECONDARY_SUPABASE_URL || 'https://pqihqargzhuubcjupvhn.supabase.co';
const SECONDARY_SUPABASE_SERVICE_ROLE_KEY = process.env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY || '';

if (!SECONDARY_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SECONDARY_SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.');
}

export const secondarySupabase = createClient(SECONDARY_SUPABASE_URL, SECONDARY_SUPABASE_SERVICE_ROLE_KEY);

export default supabase;
