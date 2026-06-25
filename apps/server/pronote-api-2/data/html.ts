import { stripHtml } from 'string-strip-html';

export function fromHtml(text: unknown): string {
  if (!text) {
    if (text === undefined) return '';
    return String(text);
  }

  if (typeof text !== 'string') {
    return String(text);
  }

  return stripHtml(text).result.trim();
}
