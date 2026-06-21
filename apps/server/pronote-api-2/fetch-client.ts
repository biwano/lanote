import { navigationHeaders } from './browser-headers.js';
import { CookieJar, readSetCookieHeaders } from './cookie-jar.js';
import { step } from './debug.js';

export interface DocumentResponse {
  url: string;
  status: number;
  body: string;
  headers: Headers;
}

function resolveLocation(from: string, location: string): string {
  return location.startsWith('http') ? location : new URL(location, from).href;
}

function hostOf(url: string): string {
  return new URL(url).hostname;
}

/** Discover CAS login URL from PRONOTE root — no cookie jar (matches curl going straight to CAS). */
export async function discoverCasLoginUrl(pronoteUrl: string): Promise<string | null> {
  const response = await fetch(pronoteUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: navigationHeaders(),
  });

  step('fetch.discoverCas', { url: pronoteUrl, status: response.status });

  const location = response.headers.get('location');
  return location ? resolveLocation(pronoteUrl, location) : null;
}

/** GET with manual redirects; optional fixed Cookie header (curl -b style). */
export async function fetchDocument(
  url: string,
  options: {
    jar?: CookieJar;
    cookieHeader?: string;
    headers?: Record<string, string>;
    maxRedirects?: number;
    referer?: string;
  } = {},
): Promise<DocumentResponse> {
  const jar = options.jar ?? new CookieJar();
  let current = url;
  let referer = options.referer;
  let redirects = 0;
  const maxRedirects = options.maxRedirects ?? 10;

  while (redirects <= maxRedirects) {
    const fromHost = hostOf(current);
    const fetchSite = referer && hostOf(referer) !== fromHost ? 'cross-site' : 'none';

    const headers = {
      ...navigationHeaders({ fetchSite, referer }),
      ...options.headers,
    };

    const jarCookies = jar.cookieHeader(current);
    const cookie = options.cookieHeader && redirects === 0 && current === url
      ? options.cookieHeader
      : jarCookies;

    if (cookie) {
      headers.Cookie = cookie;
    }

    const response = await fetch(current, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });

    jar.ingestFromResponse(response.headers, current);
    step('fetch.document', { url: current, status: response.status, hasCookie: !!cookie });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          url: current,
          status: response.status,
          body: await response.text(),
          headers: response.headers,
        };
      }
      referer = current;
      current = resolveLocation(current, location);
      redirects += 1;
      continue;
    }

    return {
      url: current,
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  }

  throw new Error(`Too many redirects (${maxRedirects})`);
}

/** POST JSON to PRONOTE appelfonction endpoint. */
export async function fetchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': navigationHeaders()['User-Agent'],
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`PRONOTE HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export { readSetCookieHeaders };
