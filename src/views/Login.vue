<template>
  <div class="login-page">
    <div class="login-brand">
      <div class="login-brand__inner">
        <div class="brand-mark brand-mark--lg">麻</div>
        <h1>手术麻醉管理系统</h1>
        <p>麻醉临床信息与质量控制平台</p>
        <ul class="login-features">
          <li>术中监测与记录闭环</li>
          <li>26 项质控指标看板</li>
          <li>PACU 恢复与转出管理</li>
        </ul>
      </div>
    </div>
    <div class="login-panel-wrap">
      <div class="login-panel">
        <h2>欢迎登录</h2>
        <p class="login-panel__hint">演示账号可直接进入系统</p>
        <a-form :model="loginForm" layout="vertical">
          <a-form-item field="username" label="账号">
            <a-input v-model="loginForm.username" size="large">
              <template #prefix><icon-user /></template>
            </a-input>
          </a-form-item>
          <a-form-item field="password" label="密码">
            <a-input-password v-model="loginForm.password" size="large" />
          </a-form-item>
          <a-button type="primary" long size="large" @click="router.push('/workbench/overview')">
            <template #icon><icon-home /></template>
            进入系统
          </a-button>
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const loginForm = reactive({
  username: 'quality_admin',
  password: 'samis2026',
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  background: var(--medical-bg);
}

.login-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background:
    radial-gradient(circle at 20% 20%, rgb(37 99 235 / 18%), transparent 45%),
    linear-gradient(145deg, var(--color-brand-700), var(--color-brand-500));
  color: #fff;
}

.login-brand__inner { max-width: 420px; }
.login-brand h1 { margin: 16px 0 8px; font-size: 28px; }
.login-brand p { margin: 0; opacity: 0.9; }
.login-features { margin: 24px 0 0; padding-left: 18px; line-height: 1.8; opacity: 0.95; }

.login-panel-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-panel {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.login-panel h2 { margin: 0 0 6px; }
.login-panel__hint { margin: 0 0 20px; color: var(--text-secondary); font-size: var(--font-size-sm); }

@media (max-width: 900px) {
  .login-page { grid-template-columns: 1fr; }
  .login-brand { min-height: 240px; padding: 32px 24px; }
}
</style>
