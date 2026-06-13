import { createRouter, createWebHistory } from 'vue-router';
import PronoteConnectView from '../views/PronoteConnectView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: PronoteConnectView,
    },
  ],
});

export default router;
