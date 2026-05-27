import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { registerAppIcons } from '@/icons/registry';
import './styles/tokens.css';
import './styles/arco-overrides.css';
import './styles/global.css';
import './styles/quality.css';

const app = createApp(App);
registerAppIcons(app);
app.use(createPinia()).use(router).use(ArcoVue).mount('#app');

