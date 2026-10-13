import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ibtqosnxktzxmniwhuqa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabaseClient = null;

export function getSupabase() {
  if (!supabaseClient) {
    if (!SUPABASE_KEY) {
      throw new Error('SUPABASE_KEY environment variable is required. Please check your .env file.');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false
      }
    });
  }
  return supabaseClient;
}
