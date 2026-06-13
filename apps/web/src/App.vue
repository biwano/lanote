<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>LaNote</h1>
      <p>Ton compagnon d'apprentissage</p>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
