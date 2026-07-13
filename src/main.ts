import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { registerAppIcons } from '@/icons/registry';
import { restoreSessionIfPresent } from '@/services/auth/authService';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import './styles/tokens.css';
import './styles/arco-overrides.css';
import './styles/global.css';
import './styles/quality.css';

async function bootstrap() {
  const app = createApp(App);
  registerAppIcons(app);
  const pinia = createPinia();
  app.use(pinia).use(router).use(ArcoVue);
  router.beforeEach(async () => {
    await useAnesthesiaStore().bootstrapAnesthesiaLocalPersistence();
  });
  // 先恢复已存会话（刷新页已有 token），再 bootstrap 本地持久化（纯本地、无远程 HTTP）。
  await restoreSessionIfPresent();
  await useAnesthesiaStore().bootstrapAnesthesiaLocalPersistence();
  // 恢复结束后重新检查会话：仅当有效会话仍存在时才加载受保护远程目录（AUTH-001）。
  await useAnesthesiaStore().bootstrapSamisAuthenticatedData();
  app.mount('#app');
}

void bootstrap();
