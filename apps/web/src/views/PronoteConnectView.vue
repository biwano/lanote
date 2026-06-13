<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { usePronoteCredentialsStore } from '../stores/pronoteCredentials';
import { usePronoteSessionStore } from '../stores/pronoteSession';

const credentials = usePronoteCredentialsStore();
const session = usePronoteSessionStore();
const { url, username, password, cas } = storeToRefs(credentials);
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
    const result = await session.login(false);
    void result;
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
    await session.login(true);
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
      Connecte ton compte PRONOTE pour accéder à tes notes et ton cahier de texte.
    </p>

    <form class="form" @submit.prevent="saveAndConnect">
      <label>
        URL PRONOTE
        <input v-model="url" type="url" required placeholder="https://…/pronote/" autocomplete="url" />
      </label>

      <label>
        Identifiant
        <input v-model="username" type="text" required autocomplete="username" />
      </label>

      <label>
        Mot de passe
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>

      <label>
        ENT / CAS <span class="optional">(facultatif)</span>
        <input v-model="cas" type="text" placeholder="none" />
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
