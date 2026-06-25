import type { PronoteSessionParams } from '../auth/params.js';

function toUtcWeek(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7);
}

export function toPronoteWeek(params: PronoteSessionParams, date: Date): number {
  const firstWeek = toUtcWeek(params.firstDay);
  const week = toUtcWeek(date);

  if (week >= firstWeek) {
    return week - firstWeek + 1;
  }

  return 52 - (firstWeek - week) + 1;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function defaultDateRange(): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - 30);
  return { from, to };
}

export function parseIsoDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
