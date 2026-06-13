import { Hono } from 'hono';
import type { PronoteLoginRequest, PronoteLoginResponse, PronoteSessionInfo } from '@lanote/shared';
import { getSupabase } from '../lib/supabase.js';
import {
  getDisplayName,
  loginStudent,
  mapPronoteError,
  serializeSession,
} from '../lib/pronote.js';
import {
  hashPronoteAccount,
  sessionExpiresAt,
  signSessionToken,
} from '../lib/session-token.js';
import {
  persistPronoteSessionIfChanged,
  requirePronoteSession,
  type PronoteAuthVariables,
} from '../middleware/pronote-session.js';

type LoginBody = PronoteLoginRequest;

const pronote = new Hono<{ Variables: PronoteAuthVariables }>();

pronote.post('/login', async (c) => {
  let body: LoginBody;
  try {
    body = await c.req.json<LoginBody>();
  } catch {
    return c.json({ error: 'Requête invalide.' }, 400);
  }

  const { url, username, password, clientId } = body;
  const cas = body.cas?.trim() || 'none';

  if (!url?.trim() || !username?.trim() || !password || !clientId?.trim()) {
    return c.json({ error: 'URL, identifiant, mot de passe et identifiant client sont requis.' }, 400);
  }

  let session;
  try {
    session = await loginStudent(url.trim(), username.trim(), password, cas);
  } catch (error) {
    return c.json({ error: mapPronoteError(error) }, 401);
  }

  const displayName = getDisplayName(session);
  const accountHash = hashPronoteAccount(session.server, String(session.user.id));
  const supabase = getSupabase();

  const { data: learner, error: learnerError } = await supabase
    .from('learners')
    .upsert(
      {
        pronote_account_hash: accountHash,
        display_name: displayName,
        client_id: clientId.trim(),
      },
      { onConflict: 'pronote_account_hash' },
    )
    .select('id')
    .single();

  if (learnerError || !learner) {
    return c.json({ error: 'Impossible d\'enregistrer le profil.' }, 500);
  }

  await supabase.from('pronote_sessions').delete().eq('learner_id', learner.id);

  const sessionData = serializeSession(session);
  const expiresAt = sessionExpiresAt();

  const { data: sessionRow, error: sessionError } = await supabase
    .from('pronote_sessions')
    .insert({
      learner_id: learner.id,
      session_data: sessionData,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (sessionError || !sessionRow) {
    return c.json({ error: 'Impossible de créer la session.' }, 500);
  }

  const sessionToken = await signSessionToken(sessionRow.id);
  const response: PronoteLoginResponse = {
    sessionToken,
    displayName,
  };

  return c.json(response);
});

pronote.post('/logout', requirePronoteSession, async (c) => {
  const sessionId = c.get('pronoteSessionId');
  const client = c.get('pronoteClient');

  try {
    await client.logout();
  } catch {
    // Best effort — still delete the stored session.
  }

  const supabase = getSupabase();
  await supabase.from('pronote_sessions').delete().eq('id', sessionId);

  return c.json({ success: true });
});

pronote.get('/session', requirePronoteSession, async (c) => {
  const sessionId = c.get('pronoteSessionId');
  const row = c.get('pronoteSessionRow');
  const client = c.get('pronoteClient');

  await persistPronoteSessionIfChanged(sessionId, row.session_data, client);

  const supabase = getSupabase();
  const { data: learner } = await supabase
    .from('learners')
    .select('display_name')
    .eq('id', row.learner_id)
    .maybeSingle();

  const response: PronoteSessionInfo = {
    displayName: learner?.display_name ?? getDisplayName(client),
  };

  return c.json(response);
});

export default pronote;
