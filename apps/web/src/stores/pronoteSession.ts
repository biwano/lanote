import { defineStore } from 'pinia';
import {
  PRONOTE_SESSION_KEY,
  type PronoteLoginRequest,
} from '../../../shared/index';
import {
  fetchPronoteSession,
  loginToPronote,
  logoutFromPronote,
} from '../api/client';
import { usePronoteCredentialsStore } from './pronoteCredentials';

interface StoredSession {
  sessionToken: string;
  displayName: string;
}

function readStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(PRONOTE_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(PRONOTE_SESSION_KEY);
    return null;
  }
}

export const usePronoteSessionStore = defineStore('pronoteSession', {
  state: () => ({
    sessionToken: readStoredSession()?.sessionToken ?? '',
    displayName: readStoredSession()?.displayName ?? '',
    status: 'idle' as 'idle' | 'loading' | 'connected' | 'error',
    errorMessage: '',
  }),

  getters: {
    isConnected: (state) => state.status === 'connected' && !!state.sessionToken,
  },

  actions: {
    persistSession() {
      if (!this.sessionToken) {
        localStorage.removeItem(PRONOTE_SESSION_KEY);
        return;
      }

      localStorage.setItem(
        PRONOTE_SESSION_KEY,
        JSON.stringify({
          sessionToken: this.sessionToken,
          displayName: this.displayName,
        }),
      );
    },

    clearSession() {
      this.sessionToken = '';
      this.displayName = '';
      this.status = 'idle';
      this.errorMessage = '';
      localStorage.removeItem(PRONOTE_SESSION_KEY);
    },

    buildLoginRequest(): PronoteLoginRequest {
      const credentials = usePronoteCredentialsStore();
      if (!credentials.clientId) {
        credentials.clientId = crypto.randomUUID();
      }
      return {
        clientId: credentials.clientId,
        url: credentials.url.trim(),
        tgc: credentials.tgc.trim(),
      };
    },

    async login() {
      const credentials = usePronoteCredentialsStore();
      this.status = 'loading';
      this.errorMessage = '';

      try {
        const result = await loginToPronote(this.buildLoginRequest());
        this.sessionToken = result.sessionToken;
        this.displayName = result.displayName;
        this.status = 'connected';
        this.persistSession();
        credentials.saveToStorage();
      } catch (error) {
        this.status = 'error';
        this.errorMessage = error instanceof Error ? error.message : 'Connexion impossible.';
        throw error;
      }
    },

    async restoreFromStorage() {
      if (!this.sessionToken) {
        return;
      }

      this.status = 'loading';
      this.errorMessage = '';

      try {
        const info = await fetchPronoteSession(this.sessionToken);
        this.displayName = info.displayName;
        this.status = 'connected';
        this.persistSession();
      } catch {
        this.clearSession();
        await this.loginWithSavedCredentials();
      }
    },

    async loginWithSavedCredentials() {
      const credentials = usePronoteCredentialsStore();
      credentials.loadFromStorage();

      if (!credentials.url?.trim() || !credentials.tgc?.trim()) {
        return;
      }

      try {
        await this.login();
      } catch {
        // Error message already set by login().
      }
    },

    async logout() {
      if (this.sessionToken) {
        try {
          await logoutFromPronote(this.sessionToken);
        } catch {
          // Ignore network errors on logout.
        }
      }

      this.clearSession();
    },
  },
});
