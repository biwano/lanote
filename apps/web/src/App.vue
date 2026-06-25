<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePronoteSessionStore } from './stores/pronoteSession';

const router = useRouter();
const session = usePronoteSessionStore();
const { isConnected, displayName, status } = storeToRefs(session);

async function disconnect() {
  await session.logout();
  await router.push('/');
}
</script>

<template>
  <div class="app-shell">
    <header class="app-navbar">
      <RouterLink class="app-brand" :to="isConnected ? '/aujourd-hui' : '/'">
        <span class="app-brand-title">LaNote</span>
        <span class="app-brand-tagline">Ton compagnon d'apprentissage</span>
      </RouterLink>

      <nav v-if="isConnected" class="app-nav" aria-label="Navigation principale">
        <RouterLink to="/aujourd-hui">Aujourd'hui</RouterLink>
        <RouterLink to="/">Connexion</RouterLink>
      </nav>

      <div v-if="isConnected" class="app-navbar-actions">
        <span class="app-user">{{ displayName }}</span>
        <button
          type="button"
          class="secondary"
          :disabled="status === 'loading'"
          @click="disconnect"
        >
          Déconnexion
        </button>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
