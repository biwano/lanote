import { defineStore } from 'pinia';
import {
  PRONOTE_CREDENTIALS_KEY,
  type PronoteCredentials,
} from '@lanote/shared';

function readStoredCredentials(): PronoteCredentials | null {
  const raw = localStorage.getItem(PRONOTE_CREDENTIALS_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PronoteCredentials;
  } catch {
    localStorage.removeItem(PRONOTE_CREDENTIALS_KEY);
    return null;
  }
}

function createClientId(): string {
  return crypto.randomUUID();
}

export const usePronoteCredentialsStore = defineStore('pronoteCredentials', {
  state: () => ({
    clientId: readStoredCredentials()?.clientId ?? createClientId(),
    url: readStoredCredentials()?.url ?? '',
    username: readStoredCredentials()?.username ?? '',
    password: readStoredCredentials()?.password ?? '',
    cas: readStoredCredentials()?.cas ?? '',
  }),

  actions: {
    loadFromStorage() {
      const stored = readStoredCredentials();
      if (!stored) {
        return;
      }

      this.clientId = stored.clientId;
      this.url = stored.url;
      this.username = stored.username;
      this.password = stored.password;
      this.cas = stored.cas ?? '';
    },

    saveToStorage() {
      const payload: PronoteCredentials = {
        clientId: this.clientId,
        url: this.url.trim(),
        username: this.username.trim(),
        password: this.password,
        cas: this.cas.trim() || undefined,
      };

      localStorage.setItem(PRONOTE_CREDENTIALS_KEY, JSON.stringify(payload));
    },

    clearStorage() {
      localStorage.removeItem(PRONOTE_CREDENTIALS_KEY);
    },
  },
});
