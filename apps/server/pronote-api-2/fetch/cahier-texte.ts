import { fromHtml } from '../data/html.js';
import { checkDuplicates, withId } from '../data/id.js';
import { toPronoteWeek } from '../data/dates.js';
import { fromPronote } from '../data/pronote-objects.js';
import { parsePronoteList, parsePronoteValue } from '../data/pronote-types.js';
import type { PronoteSession } from '../session.js';
import { navigate } from './navigate.js';

const PAGE_NAME = 'PageCahierDeTexte';
const TAB_ID = 89;

export interface CahierTexteEntry {
  id: string;
  subject: string;
  teachers: string[];
  from: string;
  to: string;
  description: string;
  category: string;
}

async function fetchRawLessons(
  session: PronoteSession,
  fromWeek: number,
  toWeek: number,
): Promise<Array<{
  subject: { name?: string };
  teachers: Array<{ name?: string }>;
  from: Date;
  to: Date;
  content: Array<{
    description: unknown;
    category: { name?: string };
  }>;
}> | null> {
  const user = session.user;
  if (!user?.id) return null;

  const contents = await navigate(session, user, PAGE_NAME, TAB_ID, ['student', 'parent'], {
    domaine: {
      _T: 8,
      V: `[${fromWeek}..${toWeek}]`,
    },
  });

  if (!contents || typeof contents !== 'object') return null;

  return parsePronoteList(
    (contents as { ListeCahierDeTextes?: { V?: unknown[] } }).ListeCahierDeTextes,
    ({
      Matiere,
      listeProfesseurs,
      Date: fromDate,
      DateFin,
      listeContenus,
    }) => ({
      subject: parsePronoteValue(Matiere as { _T?: number; V?: unknown }) as { name?: string },
      teachers: parsePronoteList(
        listeProfesseurs as { V?: unknown[] },
        (entry) => fromPronote(entry as { N?: string; L?: string }),
      ),
      from: parsePronoteValue(fromDate as { _T?: number; V?: string }) as Date,
      to: parsePronoteValue(DateFin as { _T?: number; V?: string }) as Date,
      content: parsePronoteList(
        listeContenus as { V?: unknown[] },
        ({ descriptif, categorie }) => ({
          description: parsePronoteValue(descriptif as { _T?: number; V?: unknown }),
          category: parsePronoteValue(categorie as { _T?: number; V?: unknown }) as { name?: string },
        }),
      ),
    }),
  );
}

export async function fetchCahierTexte(
  session: PronoteSession,
  from: Date,
  to: Date,
): Promise<CahierTexteEntry[] | null> {
  const params = session.params;
  if (!params) return null;

  const fromWeek = toPronoteWeek(params, from);
  const toWeek = toPronoteWeek(params, to);
  const lessons = await fetchRawLessons(session, fromWeek, toWeek);
  if (!lessons) return null;

  const result: CahierTexteEntry[] = [];

  for (const lesson of lessons) {
    if (lesson.from < from || lesson.to > to) continue;

    const content = lesson.content[0];
    if (!content) continue;

    result.push(withId({
      subject: lesson.subject.name ?? 'Matière',
      teachers: lesson.teachers.map((teacher) => teacher.name ?? '').filter(Boolean),
      from: lesson.from.toISOString(),
      to: lesson.to.toISOString(),
      description: fromHtml(content.description),
      category: content.category?.name ?? '',
    }, ['subject', 'from', 'to']));
  }

  return checkDuplicates(result).sort((a, b) => a.from.localeCompare(b.from));
}
