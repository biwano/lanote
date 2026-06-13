import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface LearnerRow {
  id: string;
  pronote_account_hash: string;
  display_name: string;
  client_id: string | null;
  created_at: string;
}

export interface PronoteSessionRow {
  id: string;
  learner_id: string;
  session_data: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
