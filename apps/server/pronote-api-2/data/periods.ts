export type PeriodKind = 'trimester' | 'semester' | 'year' | 'other';

export interface PronotePeriod {
  id: string | number;
  name: string;
  kind: PeriodKind;
  from: Date;
  to: Date;
}

const KIND_BY_TYPE: Record<number, PeriodKind> = {
  1: 'trimester',
  2: 'semester',
  3: 'year',
};

export function parsePeriods(rawPeriods: unknown): PronotePeriod[] {
  if (!Array.isArray(rawPeriods)) return [];

  return rawPeriods.map((entry) => {
    const period = entry as {
      N?: string | number;
      L?: string;
      G?: number;
      dateDebut?: { _T?: number; V?: string };
      dateFin?: { _T?: number; V?: string };
    };

    const fromValue = period.dateDebut?.V;
    const toValue = period.dateFin?.V;

    return {
      id: period.N ?? '',
      name: period.L ?? '',
      kind: KIND_BY_TYPE[period.G ?? 0] ?? 'other',
      from: fromValue ? new Date(parsePronoteDateValue(fromValue)) : new Date(0),
      to: toValue ? new Date(parsePronoteDateValue(toValue)) : new Date(0),
    };
  });
}

function parsePronoteDateValue(value: string): number {
  const [day, month, year] = value.split(' ')[0].split('/').map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function getPeriodBy(
  periods: PronotePeriod[],
  period?: string | PronotePeriod | null,
  type: PeriodKind = 'trimester',
): PronotePeriod {
  if (period && typeof period === 'object') return period;

  if (!period) {
    const now = Date.now();
    return (
      periods.find((p) => now >= p.from.getTime() && now <= p.to.getTime() && p.kind === type)
      ?? periods[0]
    );
  }

  return periods.find((p) => p.name === period) ?? periods[0];
}
