import { fromPronote } from './pronote-objects.js';

export function parsePronoteDate(str: string): Date {
  const date = new Date();
  const split = str.split(' ');
  const day = split[0].split('/');

  date.setFullYear(~~day[2], ~~day[1] - 1, ~~day[0]);
  date.setMilliseconds(0);

  if (split.length > 1) {
    const time = split[1].split(':');
    date.setHours(~~time[0]);
    date.setMinutes(~~time[1]);
    date.setSeconds(~~time[2]);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function parseRange(str: string): number[] {
  const content = str.substring(1, str.length - 1).split(',');
  const result: number[] = [];

  for (const val of content) {
    if (val.includes('..')) {
      const index = val.indexOf('..');
      for (let i = ~~val.substring(0, index); i <= ~~val.substring(index + 2); i++) {
        result.push(i);
      }
    } else {
      result.push(~~val);
    }
  }

  return result;
}

type ParseMapper = (value: Record<string, unknown>) => Record<string, unknown>;

export function parsePronoteValue(
  input: { _T?: number; V?: unknown } | null | undefined,
  mapper: ParseMapper | false | null = null,
  groupKey = 'type',
): unknown {
  const type = input?._T;
  const value = input?.V;

  if (!value) {
    if (value === undefined) return null;
    return value;
  }

  switch (type) {
    case 7:
      return parsePronoteDate(String(value));
    case 8:
    case 11:
    case 26:
      return parseRange(String(value));
    case 10: {
      let mark = String(value).replace('|', '-');
      if (mark.includes(',')) return parseFloat(mark.replace(',', '.'));
      return ~~mark;
    }
    default:
      if (mapper !== false && Array.isArray(value)) {
        return value.map((entry) => fromPronote(entry as Parameters<typeof fromPronote>[0], mapper, groupKey));
      }
      if (mapper !== false && value && typeof value === 'object' && ('N' in value || 'L' in value)) {
        return fromPronote(value as Parameters<typeof fromPronote>[0], mapper, groupKey);
      }
      return value;
  }
}

export function parsePronoteList<T>(
  list: { V?: unknown[] } | null | undefined,
  mapper: ParseMapper,
): T[] {
  if (!list?.V || !Array.isArray(list.V)) return [];
  return list.V.map((entry) => mapper(entry as Record<string, unknown>)) as T[];
}
