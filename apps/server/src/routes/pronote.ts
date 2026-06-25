import { Hono } from 'hono';
import type {
  PronoteLoginRequest,
  PronoteLoginResponse,
  PronoteSessionInfo,
  PronoteEvaluationsResponse,
  CahierTexteResponse,
} from '../../../shared/index.js';
import { getSupabase } from '../lib/supabase.js';
import {
  getDisplayName,
  loginStudentFromTgc,
  mapPronoteError,
  serializeSession,
  fetchEvaluations,
  fetchCahierTexte,
  defaultDateRange,
  endOfDay,
  parseIsoDate,
  startOfDay,
} from '../lib/pronote.js';
import {
  getPronoteLearnerIdentity,
  MissingPronoteUserNameError,
} from '../lib/learner-identity.js';
import {
  sessionExpiresAt,
  signSessionToken,
} from '../lib/session-token.js';
import {
  persistPronoteSessionIfChanged,
  requirePronoteSession,
  type PronoteAuthVariables,
} from '../middleware/pronote-session.js';
import { cacheKey, getCached, setCached } from '../lib/pronote-cache.js';

type LoginBody = PronoteLoginRequest;

const pronote = new Hono<{ Variables: PronoteAuthVariables }>();

pronote.post('/login', async (c) => {
  let body: LoginBody;
  try {
    body = await c.req.json<LoginBody>();
  } catch {
    return c.json({ error: 'Requête invalide.' }, 400);
  }

  const url = body.url?.trim();
  const tgc = body.tgc?.trim();
  const clientId = body.clientId?.trim() || crypto.randomUUID();

  if (!url) {
    return c.json({ error: 'L\'URL PRONOTE est requise.' }, 400);
  }

  if (!tgc) {
    return c.json({ error: 'Les cookies CAS sont requis. Copie-les depuis ton navigateur après connexion à PRONOTE.' }, 400);
  }

  // Replay browser CAS session: TGC → ticket → eleve.html → Start → PRONOTE API session.
  let session;
  try {
    session = await loginStudentFromTgc(url, tgc);
  } catch (error) {
    console.error('[pronote-login] API login failed:', error);
    return c.json({ error: mapPronoteError(error) }, 401);
  }

  const displayName = getDisplayName(session);

  let identity;
  try {
    identity = getPronoteLearnerIdentity(session);
  } catch (error) {
    if (error instanceof MissingPronoteUserNameError) {
      return c.json({ error: 'Impossible d\'identifier le compte PRONOTE.' }, 500);
    }
    throw error;
  }

  const supabase = getSupabase();

  const { data: learner, error: learnerError } = await supabase
    .from('learners')
    .upsert(
      {
        pronote_server: identity.server,
        pronote_user_name: identity.userName,
        pronote_account_hash: identity.accountHash,
        display_name: displayName,
        client_id: clientId.trim(),
      },
      { onConflict: 'pronote_server,pronote_user_name' },
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

function parseDateRangeQuery(c: { req: { query: (name: string) => string | undefined } }): { from: Date; to: Date } {
  const defaults = defaultDateRange();
  const from = startOfDay(parseIsoDate(c.req.query('from'), defaults.from));
  const to = endOfDay(parseIsoDate(c.req.query('to'), defaults.to));
  return from <= to ? { from, to } : { from: defaults.from, to: defaults.to };
}

pronote.get('/evaluations', requirePronoteSession, async (c) => {
  const sessionId = c.get('pronoteSessionId');
  const row = c.get('pronoteSessionRow');
  const client = c.get('pronoteClient');
  const { from, to } = parseDateRangeQuery(c);
  const key = cacheKey(sessionId, 'evaluations', from.toISOString(), to.toISOString());

  const cached = getCached<PronoteEvaluationsResponse>(key);
  if (cached) return c.json(cached);

  try {
    const subjects = await fetchEvaluations(client, from, to);
    await persistPronoteSessionIfChanged(sessionId, row.session_data, client);

    const response: PronoteEvaluationsResponse = { subjects: subjects ?? [] };
    setCached(key, response);
    return c.json(response);
  } catch (error) {
    console.error('[pronote-evaluations] fetch failed:', error);
    return c.json({ error: mapPronoteError(error) }, 502);
  }
});

pronote.get('/cahier-texte', requirePronoteSession, async (c) => {
  const sessionId = c.get('pronoteSessionId');
  const row = c.get('pronoteSessionRow');
  const client = c.get('pronoteClient');
  const { from, to } = parseDateRangeQuery(c);
  const key = cacheKey(sessionId, 'cahier-texte', from.toISOString(), to.toISOString());

  const cached = getCached<CahierTexteResponse>(key);
  if (cached) return c.json(cached);

  try {
    const entries = await fetchCahierTexte(client, from, to);
    await persistPronoteSessionIfChanged(sessionId, row.session_data, client);

    const response: CahierTexteResponse = { entries: entries ?? [] };
    setCached(key, response);
    return c.json(response);
  } catch (error) {
    console.error('[pronote-cahier-texte] fetch failed:', error);
    return c.json({ error: mapPronoteError(error) }, 502);
  }
});

export default pronote;
