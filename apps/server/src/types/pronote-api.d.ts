declare module '@lanote/pronote-api' {
  export const loginStudent: (
    url: string,
    username: string,
    password: string,
    cas?: string,
  ) => Promise<{
    server: string;
    user: { id: string | number; name?: string };
    logout: () => Promise<unknown>;
  }>;

  export function serializeSession(session: unknown): Record<string, unknown>;
  export function restoreSession(data: Record<string, unknown>): ReturnType<typeof loginStudent> extends Promise<infer T> ? T : never;

  export const errors: {
    WRONG_CREDENTIALS: { code: number };
    UNKNOWN_CAS: { code: number };
    BANNED: { code: number };
    SESSION_EXPIRED: { code: number };
    RATE_LIMITED: { code: number };
    CLOSED: { code: number };
  };
}
