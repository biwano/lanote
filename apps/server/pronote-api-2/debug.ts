const PREFIX = '[pronote-login]';

function enabled(): boolean {
  return process.env.PRONOTE_DEBUG !== '0';
}

export function step(name: string, details?: Record<string, unknown>): void {
  if (!enabled()) return;
  const payload = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`${PREFIX} ${name}${payload}`);
}

export function fail(name: string, error: unknown, details?: Record<string, unknown>): void {
  if (!enabled()) return;
  const extra = details ? ` ${JSON.stringify(details)}` : '';
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code: unknown }).code
    : undefined;
  console.error(`${PREFIX} FAIL ${name}${extra} → ${message}${code !== undefined ? ` (code ${code})` : ''}`);
}

export function htmlHint(html: string): Record<string, unknown> {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    length: html.length,
    hasPronote: html.includes('PRONOTE'),
    hasStart: html.includes('Start('),
    title: title ? title[1].trim().slice(0, 80) : undefined,
  };
}
