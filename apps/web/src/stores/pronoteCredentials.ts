import { defineStore } from 'pinia';
import {
  PRONOTE_CREDENTIALS_KEY,
  type PronoteCredentials,
} from '../../../shared/index';

function createClientId(): string {
  return crypto.randomUUID();
}

function readStoredCredentials(): PronoteCredentials | null {
  const raw = localStorage.getItem(PRONOTE_CREDENTIALS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PronoteCredentials> & { startPayload?: string };
    if (!parsed.url) {
      return null;
    }
    return {
      clientId: parsed.clientId || createClientId(),
      url: parsed.url,
      tgc: parsed.tgc ?? '',
    };
  } catch {
    localStorage.removeItem(PRONOTE_CREDENTIALS_KEY);
    return null;
  }
}

export const usePronoteCredentialsStore = defineStore('pronoteCredentials', {
  state: () => {
    const stored = readStoredCredentials();
    return {
      clientId: stored?.clientId ?? createClientId(),
      url: stored?.url ?? '',
      tgc: stored?.tgc ?? '',
    };
  },

  actions: {
    loadFromStorage() {
      const stored = readStoredCredentials();
      if (!stored) {
        return;
      }

      this.clientId = stored.clientId;
      this.url = stored.url;
      this.tgc = stored.tgc;
    },

    saveToStorage() {
      const payload: PronoteCredentials = {
        clientId: this.clientId || createClientId(),
        url: this.url.trim(),
        tgc: this.tgc.trim(),
      };

      this.clientId = payload.clientId;
      localStorage.setItem(PRONOTE_CREDENTIALS_KEY, JSON.stringify(payload));
    },

    clearStorage() {
      localStorage.removeItem(PRONOTE_CREDENTIALS_KEY);
    },
  },
});
