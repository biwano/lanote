<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useEvaluationsStore } from '../stores/evaluations';
import { usePronoteSessionStore } from '../stores/pronoteSession';

const session = usePronoteSessionStore();
const evaluations = useEvaluationsStore();
const { subjects, cahierTexte, status, errorMessage, lastFetchedAt } = storeToRefs(evaluations);
const { displayName, isConnected, status: sessionStatus } = storeToRefs(session);

const hasEvaluations = computed(() => subjects.value.some((subject) => subject.evaluations.length > 0));
const formattedLastFetch = computed(() => {
  if (!lastFetchedAt.value) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(lastFetchedAt.value));
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatTeachers(teachers: string[]): string {
  return teachers.length ? teachers.join(', ') : '—';
}

onMounted(async () => {
  await session.ensureRestored();
  if (session.isConnected) {
    await evaluations.refresh();
  }
});
</script>

<template>
  <section class="card">
    <header class="page-header">
      <div>
        <h2>Aujourd'hui</h2>
        <p v-if="isConnected" class="lead">Bonjour <strong>{{ displayName }}</strong></p>
      </div>
      <button
        type="button"
        class="secondary"
        :disabled="status === 'loading' || !isConnected"
        @click="evaluations.refresh()"
      >
        Actualiser
      </button>
    </header>

    <p v-if="sessionStatus === 'loading'" class="muted">Connexion en cours…</p>
    <p v-else-if="!isConnected" class="feedback error">
      Connecte-toi à PRONOTE pour voir tes notes et ton cahier de texte.
    </p>

    <p v-else-if="status === 'loading'" class="muted">Chargement…</p>
    <p v-else-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
    <p v-else-if="formattedLastFetch" class="muted">Dernière mise à jour : {{ formattedLastFetch }}</p>

    <section v-if="isConnected && status !== 'loading' && !errorMessage" class="panel">
      <h3>Notes récentes</h3>
      <p v-if="!hasEvaluations" class="empty">Aucune évaluation sur la période affichée.</p>

      <article v-for="subject in subjects" :key="subject.name" class="subject-block">
        <header class="subject-header">
          <h4>{{ subject.name }}</h4>
          <span class="teacher">{{ subject.teacher || '—' }}</span>
        </header>

        <ul v-if="subject.evaluations.length" class="evaluation-list">
          <li v-for="evaluation in subject.evaluations" :key="evaluation.id" class="evaluation-item">
            <div class="evaluation-title">
              <strong>{{ evaluation.name }}</strong>
              <span class="date">{{ formatDate(evaluation.date) }}</span>
            </div>
            <p v-if="evaluation.coefficient" class="meta">Coefficient {{ evaluation.coefficient }}</p>
            <ul v-if="evaluation.levels.length" class="levels">
              <li v-for="level in evaluation.levels" :key="level.name + level.value.short">
                <span class="level-name">{{ level.name }}</span>
                <span class="level-value" :title="level.value.long">{{ level.value.short }}</span>
              </li>
            </ul>
          </li>
        </ul>
      </article>
    </section>

    <section v-if="isConnected && status !== 'loading' && !errorMessage" class="panel">
      <h3>Cahier de texte</h3>
      <p v-if="!cahierTexte.length" class="empty">Aucune séance de cours sur la période affichée.</p>

      <article v-for="entry in cahierTexte" :key="entry.id" class="cahier-item">
        <header class="cahier-header">
          <div>
            <h4>{{ entry.subject }}</h4>
            <p class="teacher">{{ formatTeachers(entry.teachers) }}</p>
          </div>
          <time class="date">{{ formatDate(entry.from) }}</time>
        </header>
        <p v-if="entry.category" class="category">{{ entry.category }}</p>
        <p class="description">{{ entry.description || 'Pas de contenu.' }}</p>
      </article>
    </section>
  </section>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-header h2 {
  margin: 0;
}

.panel + .panel {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.panel h3 {
  margin-top: 0;
}

.muted {
  color: #6b7280;
  font-size: 0.9rem;
}

.empty {
  color: #6b7280;
  font-style: italic;
}

.subject-block + .subject-block {
  margin-top: 1.25rem;
}

.subject-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.subject-header h4,
.cahier-header h4 {
  margin: 0;
}

.teacher {
  color: #6b7280;
  font-size: 0.9rem;
}

.evaluation-list,
.levels {
  list-style: none;
  margin: 0;
  padding: 0;
}

.evaluation-item {
  padding: 0.75rem 0;
  border-top: 1px solid #f3f4f6;
}

.evaluation-title {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.date {
  color: #6b7280;
  font-size: 0.9rem;
  white-space: nowrap;
}

.meta {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.levels {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.35rem;
}

.levels li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.level-value {
  font-weight: 600;
}

.cahier-item {
  padding: 1rem 0;
  border-top: 1px solid #f3f4f6;
}

.cahier-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.category {
  margin: 0.35rem 0;
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 600;
}

.description {
  margin: 0;
  white-space: pre-wrap;
}
</style>
