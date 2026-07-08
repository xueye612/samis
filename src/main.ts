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
  // 先恢复已存会话（刷新页已有 token），再 bootstrap 本地持久化 / 加载远程目录，
  // 避免引导期 catalog GET 在 pre-token 阶段全部 400（T21 token 竞态）。
  await restoreSessionIfPresent();
  await useAnesthesiaStore().bootstrapAnesthesiaLocalPersistence();
  app.mount('#app');
}

void bootstrap();
