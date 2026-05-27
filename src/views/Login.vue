<template>
  <div class="login-page">
    <div class="login-panel">
      <div class="login-head">
        <div class="brand-mark brand-mark--lg">麻</div>
        <div>
          <h1>手术麻醉管理系统</h1>
          <p>麻醉临床信息与质量控制平台原型</p>
        </div>
      </div>
      <div class="login-highlights">
        <span>术中监测</span>
        <span>质控看板</span>
        <span>PACU闭环</span>
      </div>
      <a-form :model="loginForm" layout="vertical">
        <a-form-item field="username" label="账号">
          <a-input v-model="loginForm.username" size="large">
            <template #prefix><icon-user /></template>
          </a-input>
        </a-form-item>
        <a-form-item field="password" label="密码">
          <a-input-password v-model="loginForm.password" size="large" />
        </a-form-item>
        <a-button type="primary" long size="large" @click="router.push('/workbench')">
          <template #icon><icon-home /></template>
          进入系统
        </a-button>
      </a-form>
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
.login-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.login-head h1 {
  margin: 0;
}

.login-head p {
  margin: var(--space-1) 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.login-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.login-highlights span {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}
</style>
