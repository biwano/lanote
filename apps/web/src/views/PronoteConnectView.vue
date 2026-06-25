<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { usePronoteCredentialsStore } from '../stores/pronoteCredentials';
import { usePronoteSessionStore } from '../stores/pronoteSession';

const credentials = usePronoteCredentialsStore();
const session = usePronoteSessionStore();
const { url, tgc } = storeToRefs(credentials);
const { displayName, isConnected, status, errorMessage } = storeToRefs(session);

const testMessage = ref('');
const testStatus = ref<'idle' | 'success' | 'error'>('idle');

onMounted(async () => {
  credentials.loadFromStorage();
  await session.restoreFromStorage();
});

async function testConnection() {
  testMessage.value = '';
  testStatus.value = 'idle';

  try {
    await session.login();
    testStatus.value = 'success';
    testMessage.value = `Connexion réussie — bonjour ${session.displayName} !`;
  } catch (error) {
    testStatus.value = 'error';
    testMessage.value = error instanceof Error ? error.message : 'Connexion impossible.';
    session.clearSession();
  }
}

async function saveAndConnect() {
  testMessage.value = '';
  testStatus.value = 'idle';

  try {
    await session.login();
    testStatus.value = 'success';
    testMessage.value = 'Identifiants enregistrés et connexion établie.';
  } catch {
    testStatus.value = 'error';
    testMessage.value = session.errorMessage;
  }
}

async function disconnect() {
  await session.logout();
  testMessage.value = '';
  testStatus.value = 'idle';
}
</script>

<template>
  <section class="card">
    <h2>Connexion PRONOTE</h2>
    <p class="lead">
      Connecte-toi d'abord à PRONOTE dans ton navigateur (EduConnect, ENT…), puis copie les cookies CAS ci-dessous.
    </p>

    <form class="form" @submit.prevent="saveAndConnect">
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
        <button type="button" class="secondary" :disabled="status === 'loading'" @click="testConnection">
          Tester la connexion
        </button>
        <button type="submit" class="primary" :disabled="status === 'loading'">
          Enregistrer
        </button>
      </div>
    </form>

    <p v-if="testMessage" class="feedback" :class="testStatus">{{ testMessage }}</p>
    <p v-else-if="errorMessage && !isConnected" class="feedback error">{{ errorMessage }}</p>

    <div v-if="isConnected" class="connected">
      <p>Connecté en tant que <strong>{{ displayName }}</strong></p>
      <button type="button" class="secondary" @click="disconnect">Se déconnecter</button>
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
