export type PronoteError = { code: number; message: string };

function defineError(code: number, message: string | ((arg: string) => string)) {
  return {
    code,
    drop: (...args: unknown[]): PronoteError => ({
      code,
      message: typeof message === 'string' ? message : message(String(args[0] ?? '')),
    }),
  };
}

export const errors = {
  PRONOTE: defineError(-1, (detail: unknown) => {
    const d = detail as { title?: string; message?: string };
    return `${d.title ?? ''}${d.title && d.message ? ' - ' : ''}${d.message ?? ''}`;
  }),
  UNKNOWN_CAS: defineError(1, (cas: string) => `Unknown CAS '${cas}'`),
  BANNED: defineError(2, 'IP temporarily banned'),
  WRONG_CREDENTIALS: defineError(3, 'Wrong user credentials'),
  UNKNOWN_ACCOUNT: defineError(4, (t: string) => `Unknown account type '${t}'`),
  SESSION_EXPIRED: defineError(5, 'Session expired'),
  RATE_LIMITED: defineError(6, 'Rate limited'),
  CLOSED: defineError(7, 'Instance closed'),
  INVALID_START: defineError(8, 'Invalid or expired Start payload'),
  INVALID_TGC: defineError(9, 'Invalid or expired CAS TGC cookie'),
} as const;
