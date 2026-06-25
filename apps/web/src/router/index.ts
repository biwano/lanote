import { createRouter, createWebHistory } from 'vue-router';
import PronoteConnectView from '../views/PronoteConnectView.vue';
import TodayView from '../views/TodayView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: PronoteConnectView,
    },
    {
      path: '/aujourd-hui',
      name: 'today',
      component: TodayView,
    },
  ],
});

export default router;
