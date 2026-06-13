import type { Context, Next } from 'hono';
import { verifySessionToken } from '../lib/session-token.js';
import { getSupabase, type PronoteSessionRow } from '../lib/supabase.js';
import { restoreSession, serializeSession, type PronoteSession } from '../lib/pronote.js';

export type PronoteAuthVariables = {
  pronoteSessionId: string;
  pronoteSessionRow: PronoteSessionRow;
  pronoteClient: PronoteSession;
};

export async function requirePronoteSession(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Session requise.' }, 401);
  }

  let sessionId: string;
  try {
    sessionId = await verifySessionToken(token);
  } catch {
    return c.json({ error: 'Session invalide ou expirée.' }, 401);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pronote_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) {
    return c.json({ error: 'Session introuvable.' }, 401);
  }

  const row = data as PronoteSessionRow;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await supabase.from('pronote_sessions').delete().eq('id', sessionId);
    return c.json({ error: 'Session expirée. Reconnecte-toi.' }, 401);
  }

  try {
    const client = restoreSession(row.session_data);
    c.set('pronoteSessionId', sessionId);
    c.set('pronoteSessionRow', row);
    c.set('pronoteClient', client);
    await next();
  } catch {
    return c.json({ error: 'Impossible de restaurer la session PRONOTE.' }, 401);
  }
}

export async function persistPronoteSessionIfChanged(
  sessionId: string,
  before: Record<string, unknown>,
  client: PronoteSession,
) {
  const snapshot = serializeSession(client) as Record<string, unknown>;

  if (JSON.stringify(snapshot) === JSON.stringify(before)) {
    return;
  }

  const supabase = getSupabase();
  await supabase
    .from('pronote_sessions')
    .update({ session_data: snapshot })
    .eq('id', sessionId);
}
