export interface PronoteRef {
  id?: string | number;
  name?: string;
  type?: number;
}

export function fromPronote(
  { N, L, G, ...obj }: { N?: string | number; L?: string; G?: number; [key: string]: unknown } = {},
  fn?: ((extra: Record<string, unknown>) => Record<string, unknown>) | string | null,
  gName = 'type',
): PronoteRef & Record<string, unknown> {
  let mapper = fn;
  let groupKey = gName;

  if (typeof fn === 'string') {
    groupKey = fn;
    mapper = null;
  }

  const result: PronoteRef & Record<string, unknown> = {};
  if (N !== undefined) result.id = N;
  if (L !== undefined) result.name = L;
  if (G !== undefined && groupKey) result[groupKey] = G;

  const extra = typeof mapper === 'function'
    ? mapper(G !== undefined && groupKey ? obj : { G, ...obj })
    : {};
  return { ...result, ...extra };
}

export function toPronote({ id, name, type }: PronoteRef = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (id !== undefined) result.N = id;
  if (name !== undefined) result.L = name;
  if (type !== undefined) result.G = type;
  return result;
}
