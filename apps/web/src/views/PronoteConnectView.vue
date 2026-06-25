<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePronoteCredentialsStore } from '../stores/pronoteCredentials';
import { usePronoteSessionStore } from '../stores/pronoteSession';

const credentials = usePronoteCredentialsStore();
const session = usePronoteSessionStore();
const router = useRouter();
const { url, tgc } = storeToRefs(credentials);
const { displayName, isConnected, status, errorMessage } = storeToRefs(session);

const feedbackMessage = ref('');
const feedbackStatus = ref<'idle' | 'success' | 'error'>('idle');

async function connect() {
  feedbackMessage.value = '';
  feedbackStatus.value = 'idle';

  try {
    await session.login();
    feedbackStatus.value = 'success';
    feedbackMessage.value = `Connexion réussie — bonjour ${session.displayName} !`;
    await router.push('/aujourd-hui');
  } catch {
    feedbackStatus.value = 'error';
    feedbackMessage.value = session.errorMessage;
  }
}

</script>

<template>
  <section class="card">
    <h2>Connexion PRONOTE</h2>
    <p class="lead">
      Connecte-toi d'abord à PRONOTE dans ton navigateur (EduConnect, ENT…), puis copie les cookies CAS ci-dessous.
    </p>

    <form class="form" @submit.prevent="connect">
      <label>
        URL PRONOTE
        <input v-model="url" type="url" required placeholder="https://…/pronote/" autocomplete="url" />
      </label>

      <div class="help">
        <p><strong>Comment obtenir les cookies&nbsp;?</strong></p>
        <ol>
          <li>Ouvre PRONOTE dans ton navigateur et connecte-toi jusqu'à la page d'accueil.</li>
          <li>Ouvre les outils développeur (<kbd>F12</kbd>) → onglet <strong>Application</strong> (Chrome) ou <strong>Stockage</strong> (Firefox).</li>
          <li>Dans <strong>Cookies</strong>, ouvre le domaine CAS de ton ENT (ex. <code>cas.ecollege.haute-garonne.fr</code>).</li>
          <li>Copie <strong>tous</strong> les cookies du domaine CAS — au minimum <code>TGC</code> et <code>SERVERID</code> (même valeur que dans curl).</li>
          <li>Format : <code>nom=valeur; nom2=valeur2</code> ou un cookie par ligne.</li>
          <li>Les cookies expirent après quelques heures — recopie-les si la connexion échoue.</li>
        </ol>
      </div>

      <label>
        Cookies CAS
        <textarea
          v-model="tgc"
          required
          rows="4"
          placeholder="TGC=TGC-…&#10;JSESSIONID=…"
          spellcheck="false"
          autocomplete="off"
        />
      </label>

      <div class="actions">
        <button type="submit" class="primary" :disabled="status === 'loading'">
          Se connecter
        </button>
      </div>
    </form>

    <p v-if="feedbackMessage" class="feedback" :class="feedbackStatus">{{ feedbackMessage }}</p>
    <p v-else-if="errorMessage && !isConnected" class="feedback error">{{ errorMessage }}</p>

    <div v-if="isConnected" class="connected">
      <p>Connecté en tant que <strong>{{ displayName }}</strong></p>
      <p class="lead">Utilise la barre de navigation en haut pour accéder à <strong>Aujourd'hui</strong> ou te déconnecter.</p>
    </div>
  </section>
</template>

<style scoped>
.help {
  background: var(--surface-muted, #f5f5f5);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
}

.help ol {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
}

.help code {
  font-size: 0.85em;
}

input[type="text"] {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

textarea {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  resize: vertical;
  min-height: 4rem;
}
</style>
