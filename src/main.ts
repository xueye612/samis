import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { registerAppIcons } from '@/icons/registry';
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
  await useAnesthesiaStore().bootstrapAnesthesiaLocalPersistence();
  app.mount('#app');
}

void bootstrap();
