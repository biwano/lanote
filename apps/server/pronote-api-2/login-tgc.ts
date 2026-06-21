/**
 * CAS TGC login — mirrors working curl:
 *   GET cas…/login?service=… + Cookie: preselection=…; TGC=…; SERVERID=…
 */
import { navigationHeaders } from './browser-headers.js';
import { discoverCasLoginUrl, fetchDocument, readSetCookieHeaders } from './fetch-client.js';
import { CookieJar } from './cookie-jar.js';
import { fail, step } from './debug.js';
import { errors } from './errors.js';
import {
  buildCookieHeader,
  parseBrowserCookies,
  requiredCasCookieNames,
} from './parse-cookies.js';
import { extractStart } from './start.js';
import { normalizeServer } from './session.js';

function casRejectedTgc(headers: Headers): boolean {
  for (const raw of readSetCookieHeaders(headers)) {
    if (
      /\bTGC=/i.test(raw)
      && (/\bMax-Age=0\b/i.test(raw) || /Expires=Thu, 01 Jan 1970/i.test(raw))
    ) {
      return true;
    }
  }
  return false;
}

export async function fetchStartFromTgc(pronoteUrl: string, casCookies: string) {
  const server = normalizeServer(pronoteUrl);
  const cookieHeader = buildCookieHeader(casCookies);

  if (!cookieHeader) {
    fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'empty_cookie_header' });
    throw errors.INVALID_TGC.drop();
  }

  const missing = requiredCasCookieNames(casCookies);
  if (missing.length > 0) {
    step('login.tgc.missingCookies', { missing });
  }

  step('login.tgc.begin', {
    server,
    cookieNames: parseBrowserCookies(casCookies).map(c => c.name),
  });

  const casLoginUrl = await discoverCasLoginUrl(server);
  if (!casLoginUrl) {
    fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'no_cas_redirect' });
    throw errors.INVALID_TGC.drop();
  }

  step('login.tgc.casLoginUrl', { casLoginUrl });

  // CAS hop — send Cookie header exactly like curl -b (no jar round-trip).
  const first = await fetch(casLoginUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      ...navigationHeaders(),
      Cookie: cookieHeader,
    },
  });

  step('login.tgc.casResponse', {
    status: first.status,
    location: first.headers.get('location')?.slice(0, 120),
  });

  if (casRejectedTgc(first.headers)) {
    fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'tgc_rejected_by_cas' });
    throw errors.INVALID_TGC.drop();
  }

  const jar = new CookieJar();
  jar.ingestFromResponse(first.headers, casLoginUrl);

  let html: string;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get('location');
    if (!location) throw errors.INVALID_TGC.drop();
    const next = location.startsWith('http') ? location : new URL(location, casLoginUrl).href;
    html = (await fetchDocument(next, { jar, referer: casLoginUrl })).body;
  } else if (first.status === 200) {
    html = await first.text();
  } else {
    fail('login.tgc', errors.INVALID_TGC.drop(), { reason: 'unexpected_cas_status', status: first.status });
    throw errors.INVALID_TGC.drop();
  }

  return extractStart(html);
}
