import { createHash } from 'node:crypto';

export function withId<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
  extraData?: string,
): T & { id: string } {
  const keyParts: Record<string, unknown> = {};
  for (const field of fields) {
    keyParts[String(field)] = obj[field];
  }
  if (extraData) {
    keyParts.__extraData = extraData;
  }

  const id = createHash('sha256').update(JSON.stringify(keyParts)).digest('hex').slice(0, 16);
  return { id, ...obj };
}

export function checkDuplicates<T extends { id: string }>(items: T[]): T[] {
  for (const item of items) {
    const duplicates = items.filter((entry) => entry.id === item.id);
    if (duplicates.length > 1) {
      duplicates.forEach((entry, index) => {
        entry.id = entry.id.slice(0, -1) + index;
      });
    }
  }
  return items;
}
