import { getUUID } from '../cipher.js';
import { parsePronoteDate } from '../data/pronote-types.js';
import { parsePeriods, type PronotePeriod } from '../data/periods.js';
import { pronoteRequest } from '../request.js';
import type { PronoteSession } from '../session.js';

export interface PronoteSessionParams {
  title: string;
  firstDay: Date;
  periods: PronotePeriod[];
}

export async function getParams(session: PronoteSession): Promise<PronoteSessionParams | null> {
  const { donnees } = await pronoteRequest(session, 'FonctionParametres', {
    donnees: { Uuid: getUUID(session, session.aesIV!) },
  });

  const params = donnees as {
    Nom?: string;
    General?: {
      PremiereDate?: { V?: string };
      ListePeriodes?: unknown[];
    };
  };

  if (!params?.General) return null;

  const firstDayValue = params.General.PremiereDate?.V;
  const firstDay = firstDayValue ? parsePronoteDate(firstDayValue) : new Date();

  return {
    title: params.Nom ?? '',
    firstDay,
    periods: parsePeriods(params.General.ListePeriodes),
  };
}
