import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { usePronoteCredentialsStore } from './stores/pronoteCredentials';
import { usePronoteSessionStore } from './stores/pronoteSession';
import './styles/main.css';

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia).use(router);

  const credentials = usePronoteCredentialsStore();
  credentials.loadFromStorage();

  const session = usePronoteSessionStore();
  await session.ensureRestored();

  app.mount('#app');
}

bootstrap();
