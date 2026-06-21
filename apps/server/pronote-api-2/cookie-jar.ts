interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  expires?: number;
}

function hostname(url: string): string {
  return new URL(url).hostname;
}

function defaultPath(url: string): string {
  const path = new URL(url).pathname;
  const slash = path.lastIndexOf('/');
  return slash <= 0 ? '/' : path.slice(0, slash + 1);
}

function sanitizeSetCookie(raw: string): string {
  return raw
    .replace(/;\s*Domain=""\s*/gi, '; ')
    .replace(/;\s*Domain=''\s*/gi, '; ')
    .trim();
}

function parseSetCookie(raw: string, url: string): StoredCookie | null | 'delete' {
  const parts = sanitizeSetCookie(raw).split(';').map(p => p.trim());
  const [pair, ...attrs] = parts;
  const eq = pair.indexOf('=');
  if (eq === -1) return null;

  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return null;

  let path = defaultPath(url);
  let domain = hostname(url);
  let secure = url.startsWith('https');
  let expires: number | undefined;

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('path=')) path = attr.slice(5) || '/';
    else if (lower.startsWith('domain=')) domain = attr.slice(7).replace(/^\./, '');
    else if (lower === 'secure') secure = true;
    else if (lower.startsWith('max-age=')) {
      const maxAge = parseInt(attr.slice(8), 10);
      if (maxAge <= 0) return 'delete';
      expires = Date.now() + maxAge * 1000;
    } else if (lower.startsWith('expires=')) {
      const date = Date.parse(attr.slice(8));
      if (!Number.isNaN(date)) {
        if (date <= Date.now()) return 'delete';
        expires = date;
      }
    }
  }

  return { name, value, domain, path, secure, expires };
}

function domainMatches(cookieDomain: string, host: string): boolean {
  return host === cookieDomain || host.endsWith(`.${cookieDomain}`);
}

/** Read all Set-Cookie lines from a fetch Response (Node getSetCookie + fallback). */
export function readSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const raw = headers.get('set-cookie');
  if (!raw) return [];

  // Fallback: split combined header (imperfect for comma-in-date but rare on CAS).
  return raw.split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
}

/** In-memory cookie jar for PRONOTE redirect chain after CAS ticket. */
export class CookieJar {
  private cookies: StoredCookie[] = [];

  setManual(name: string, value: string, url: string): void {
    this.cookies = this.cookies.filter(c => !(c.name === name && domainMatches(c.domain, hostname(url))));
    this.cookies.push({
      name,
      value,
      domain: hostname(url),
      path: '/',
      secure: url.startsWith('https'),
    });
  }

  ingestFromResponse(headers: Headers, url: string): void {
    for (const raw of readSetCookieHeaders(headers)) {
      const parsed = parseSetCookie(raw, url);
      if (parsed === null) continue;
      if (parsed === 'delete') {
        const name = raw.split('=')[0]?.trim();
        if (name) {
          this.cookies = this.cookies.filter(c => c.name !== name || !domainMatches(c.domain, hostname(url)));
        }
        continue;
      }
      this.cookies = this.cookies.filter(
        c => !(c.name === parsed.name && c.domain === parsed.domain && c.path === parsed.path),
      );
      this.cookies.push(parsed);
    }
  }

  cookieHeader(url: string): string {
    const { hostname: host, pathname } = new URL(url);
    const now = Date.now();
    const matching = this.cookies.filter(c => {
      if (c.expires !== undefined && c.expires <= now) return false;
      if (!domainMatches(c.domain, host)) return false;
      if (!pathname.startsWith(c.path)) return false;
      if (c.secure && !url.startsWith('https')) return false;
      return true;
    });

    return matching.map(c => `${c.name}=${c.value}`).join('; ');
  }
}
