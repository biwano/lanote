import { fromHtml } from '../data/html.js';
import { checkDuplicates, withId } from '../data/id.js';
import { toPronote } from '../data/pronote-objects.js';
import { parsePronoteList, parsePronoteValue } from '../data/pronote-types.js';
import { getPeriodBy, type PronotePeriod } from '../data/periods.js';
import type { PronoteSessionParams } from '../auth/params.js';
import type { PronoteSession, PronoteUser } from '../session.js';
import { navigate } from './navigate.js';

const PAGE_NAME = 'DernieresEvaluations';
const TAB_ID = 201;

interface RawEvaluation {
  title: unknown;
  acquisitionLevels: Array<{
    position: number;
    value: string;
    pillar: { prefixes: string[] };
    domain: { name?: string };
    item: { name?: string } | null;
    name?: string;
  }>;
  subject: { position: number; name?: string; color?: number };
  teacher: { name?: string };
  coefficient: number;
  date: Date;
}

async function fetchRawEvaluations(
  session: PronoteSession,
  user: PronoteUser,
  period: PronotePeriod,
): Promise<RawEvaluation[] | null> {
  const evaluations = await navigate(session, user, PAGE_NAME, TAB_ID, ['student', 'parent'], {
    periode: period.name ? toPronote(period) : period,
  });

  if (!evaluations || typeof evaluations !== 'object') return null;

  return parsePronoteList<RawEvaluation>(
    (evaluations as { listeEvaluations?: { V?: unknown[] } }).listeEvaluations,
    ({
      listeNiveauxDAcquisitions,
      matiere,
      individu,
      coefficient,
      descriptif,
      date,
    }) => ({
      title: descriptif,
      acquisitionLevels: parsePronoteList(
        listeNiveauxDAcquisitions as { V?: unknown[] },
        ({ abbreviation, ordre, pilier, domaine, item }) => ({
          position: Number(ordre),
          value: String(abbreviation ?? ''),
          pillar: {
            prefixes: String((pilier as { strPrefixes?: string })?.strPrefixes ?? '').split(', '),
          },
          domain: parsePronoteValue(domaine as { _T?: number; V?: unknown }) as { name?: string },
          item: (parsePronoteValue(item as { _T?: number; V?: unknown }) as { name?: string }) || null,
          name: typeof abbreviation === 'string' ? abbreviation : undefined,
        }),
      ),
      subject: (() => {
        const parsed = parsePronoteValue(matiere as { _T?: number; V?: unknown }, ({ couleur, ordre }) => ({
          color: couleur,
          position: ordre,
        })) as { name?: string; color?: number; position?: number };
        return {
          position: Number(parsed?.position ?? (matiere as { ordre?: number })?.ordre ?? 0),
          name: parsed?.name,
          color: parsed?.color,
        };
      })(),
      teacher: parsePronoteValue(individu as { _T?: number; V?: unknown }) as { name?: string },
      coefficient: Number(coefficient ?? 0),
      date: parsePronoteValue(date as { _T?: number; V?: string }) as Date,
    }),
  );
}

function evaluationTitle(title: unknown): string {
  if (typeof title === 'string') return fromHtml(title);
  if (title && typeof title === 'object' && 'name' in title) {
    return String((title as { name?: string }).name ?? '');
  }
  return 'Évaluation';
}

export interface EvaluationLevel {
  name: string;
  value: { short: string; long: string };
}

export interface EvaluationItem {
  id: string;
  name: string;
  date: string;
  coefficient: number;
  levels: EvaluationLevel[];
}

export interface SubjectEvaluations {
  name: string;
  teacher: string;
  color?: number;
  evaluations: EvaluationItem[];
}

export async function fetchEvaluations(
  session: PronoteSession,
  from: Date,
  to: Date,
): Promise<SubjectEvaluations[] | null> {
  const params = session.params;
  const user = session.user;
  if (!params || !user?.id) return null;

  const period = getPeriodBy(params.periods);
  const raw = await fetchRawEvaluations(session, user, period);
  if (!raw) return null;

  const result: SubjectEvaluations[] = [];

  for (const evaluation of raw) {
    const evalDate = evaluation.date;
    if (evalDate < from || evalDate > to) continue;

    const subjectName = evaluation.subject.name ?? 'Matière';
    let subject = result.find((entry) => entry.name === subjectName);
    if (!subject) {
      subject = {
        name: subjectName,
        teacher: evaluation.teacher.name ?? '',
        color: evaluation.subject.color,
        evaluations: [],
      };
      result.push(subject);
    }

    subject.evaluations.push(withId({
      name: evaluationTitle(evaluation.title),
      date: evalDate.toISOString(),
      coefficient: evaluation.coefficient,
      levels: evaluation.acquisitionLevels.map(({ position, value, item, domain, name }) => ({
        name: item?.name || domain?.name || 'Niveau',
        position,
        value: {
          short: value,
          long: name ?? value,
        },
      })).sort((a, b) => a.position - b.position).map(({ name, value }) => ({ name, value })),
    }, ['name', 'date'], subjectName));
  }

  result.sort((a, b) => {
    const posA = raw.find((entry) => entry.subject.name === a.name)?.subject.position ?? 0;
    const posB = raw.find((entry) => entry.subject.name === b.name)?.subject.position ?? 0;
    return posA - posB;
  });

  for (const subject of result) {
    subject.evaluations.sort((a, b) => a.date.localeCompare(b.date));
    checkDuplicates(subject.evaluations);
  }

  return result;
}

export type { PronoteSessionParams };
