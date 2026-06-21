export interface ParsedCookie {
  name: string;
  value: string;
}

/** Strip BOM / whitespace; accept Cookie: prefix from DevTools copy. */
export function normalizeCookieInput(input: string): string {
  return input.replace(/^\uFEFF/, '').trim().replace(/^Cookie:\s*/i, '');
}

/**
 * Parse cookies pasted from DevTools or copied from curl -b.
 * Supports: name=value per line, semicolon-separated, lone TGC token.
 */
export function parseBrowserCookies(input: string): ParsedCookie[] {
  const trimmed = normalizeCookieInput(input);
  if (!trimmed) return [];

  const cookies = new Map<string, string>();

  for (const part of trimmed.split(/[;\n]+/)) {
    const line = part.trim();
    if (!line) continue;

    const eq = line.indexOf('=');
    if (eq === -1) {
      cookies.set('TGC', normalizeTgcValue(line));
      continue;
    }

    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (name) cookies.set(name, value);
  }

  return [...cookies.entries()].map(([name, value]) => ({ name, value }));
}

/** Build a Cookie header exactly like curl -b 'a=1; b=2'. */
export function buildCookieHeader(input: string): string {
  return parseBrowserCookies(input)
    .filter(c => c.name && c.value)
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

export function normalizeTgcValue(tgc: string): string {
  let value = tgc.trim();
  if (value.startsWith('TGC=')) value = value.substring(4);
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  return value;
}

export function requiredCasCookieNames(input: string): string[] {
  const names = parseBrowserCookies(input).map(c => c.name);
  const missing: string[] = [];
  if (!names.includes('TGC')) missing.push('TGC');
  if (!names.includes('SERVERID')) missing.push('SERVERID');
  return missing;
}
