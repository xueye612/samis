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
        <p class="login-panel__hint">{{ hintText }}</p>
        <a-form ref="formRef" :model="loginForm" layout="vertical" @submit-success="handleSubmit">
          <a-form-item field="username" label="账号" :rules="[{ required: true, message: '请输入账号' }]">
            <a-input v-model="loginForm.username" size="large" :disabled="loading" allow-clear>
              <template #prefix><icon-user /></template>
            </a-input>
          </a-form-item>
          <a-form-item field="password" label="密码" :rules="[{ required: true, message: '请输入密码' }]">
            <a-input-password v-model="loginForm.password" size="large" :disabled="loading" />
          </a-form-item>
          <a-form-item field="roomGroup" label="手术部（上下文）">
            <a-select
              v-model="loginForm.roomGroup"
              size="large"
              placeholder="选择手术部"
              allow-clear
              :loading="roomCatalogLoading"
              :options="roomGroupOptions"
              @change="onRoomGroupChange"
            />
          </a-form-item>
          <a-form-item field="room" label="默认手术间（上下文）">
            <a-select
              v-model="loginForm.room"
              size="large"
              placeholder="选择手术间"
              allow-clear
              :loading="roomCatalogLoading"
              :options="roomOptions"
            />
          </a-form-item>
          <a-button type="primary" long size="large" html-type="submit" :loading="loading">
            登录
          </a-button>
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { FormInstance } from '@arco-design/web-vue';
import { useRoute, useRouter } from 'vue-router';
import { AUTH_LOGIN_BYPASS, useRealAuth } from '@/config/apiFlags';
import { formatAuthError } from '@/services/auth/authAdapter';
import { fetchCurrentUser, loginWithCredentials } from '@/services/auth/authService';
import { loadRoomCatalog } from '@/services/anesthesia/roomService';
import { isSamisLoggedIn, setSamisSession } from '@/services/session/samisSession';

const router = useRouter();
const route = useRoute();
const formRef = ref<FormInstance>();
const loading = ref(false);
const roomCatalogLoading = ref(false);
const roomGroups = ref<Array<{ roomGroupId: string; roomGroupName: string; rooms: Array<{ roomId: string; roomName: string }> }>>([]);

const loginForm = reactive({
  username: 'quality_admin',
  password: 'samis2026',
  roomGroup: '',
  room: '',
});

const hintText = computed(() => {
  if (AUTH_LOGIN_BYPASS) return '已开启登录绕过（开发模式），任意账号可进入';
  if (useRealAuth()) return '请使用系统账号登录；手术部/手术间将写入请求头';
  return '当前为 Mock 登录，将写入演示会话';
});

const roomGroupOptions = computed(() =>
  roomGroups.value.map((g) => ({
    label: g.roomGroupName || g.roomGroupId,
    value: g.roomGroupId || g.roomGroupName,
  })),
);

const roomOptions = computed(() => {
  const group = roomGroups.value.find(
    (g) => g.roomGroupId === loginForm.roomGroup || g.roomGroupName === loginForm.roomGroup,
  );
  const rooms = group?.rooms?.length
    ? group.rooms
    : roomGroups.value.flatMap((g) => g.rooms);
  return rooms.map((r) => ({
    label: r.roomName || r.roomId,
    value: r.roomId || r.roomName,
  }));
});

function onRoomGroupChange() {
  if (!loginForm.room) return;
  const allowed = roomOptions.value.some((o) => o.value === loginForm.room);
  if (!allowed) loginForm.room = '';
}

function resolveRedirect(): string {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('/login')) {
    return redirect;
  }
  return '/workbench/overview';
}

async function completeLoginNavigation() {
  try {
    await fetchCurrentUser();
  } catch {
    // 登录已成功，用户信息补全失败不阻断
  }
  await router.replace(resolveRedirect());
}

async function handleSubmit() {
  loading.value = true;
  try {
    if (AUTH_LOGIN_BYPASS) {
      setSamisSession({
        token: 'bypass-token',
        authorization: 'Bearer bypass-token',
        room: loginForm.room || 'OR-01',
        roomGroup: loginForm.roomGroup || '',
        user: { displayName: loginForm.username, loginName: loginForm.username },
      });
      const { useAnesthesiaStore } = await import('@/stores/anesthesia');
      useAnesthesiaStore().setCurrentUserFromSession({ displayName: loginForm.username, loginName: loginForm.username });
      Message.success('已进入系统（开发绕过）');
      await router.replace(resolveRedirect());
      return;
    }
    await loginWithCredentials(loginForm.username, loginForm.password, {
      room: loginForm.room,
      roomGroup: loginForm.roomGroup,
    });
    Message.success('登录成功');
    await completeLoginNavigation();
  } catch (error) {
    Message.error(formatAuthError(error));
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!AUTH_LOGIN_BYPASS && isSamisLoggedIn()) {
    await router.replace(resolveRedirect());
    return;
  }
  roomCatalogLoading.value = true;
  try {
    const catalog = await loadRoomCatalog();
    roomGroups.value = catalog.groups;
    if (!loginForm.roomGroup) {
      loginForm.roomGroup = catalog.groups[0]?.roomGroupId || 'ANES';
    }
    if (!loginForm.room) {
      const firstRoom = catalog.groups[0]?.rooms[0];
      loginForm.room = firstRoom?.roomId || '01';
    }
  } finally {
    roomCatalogLoading.value = false;
  }
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
