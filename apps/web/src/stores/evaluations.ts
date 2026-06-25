import { defineStore } from 'pinia';
import type { CahierTexteEntry, SubjectEvaluations } from '../../../shared/index';
import { fetchCahierTexte, fetchEvaluations } from '../api/pronote';
import { usePronoteSessionStore } from './pronoteSession';

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export const useEvaluationsStore = defineStore('evaluations', {
  state: () => ({
    subjects: [] as SubjectEvaluations[],
    cahierTexte: [] as CahierTexteEntry[],
    status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
    errorMessage: '',
    lastFetchedAt: '',
    range: defaultRange(),
  }),

  actions: {
    async refresh() {
      const session = usePronoteSessionStore();
      if (!session.sessionToken) {
        this.errorMessage = 'Connecte-toi à PRONOTE pour afficher tes données.';
        this.status = 'error';
        return;
      }

      this.status = 'loading';
      this.errorMessage = '';

      try {
        const [evaluations, cahier] = await Promise.all([
          fetchEvaluations(session.sessionToken, this.range),
          fetchCahierTexte(session.sessionToken, this.range),
        ]);

        this.subjects = evaluations.subjects;
        this.cahierTexte = cahier.entries;
        this.status = 'ready';
        this.lastFetchedAt = new Date().toISOString();
      } catch (error) {
        this.status = 'error';
        this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les données PRONOTE.';
      }
    },
  },
});
