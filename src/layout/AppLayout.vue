<template>
  <a-layout class="app-shell" :class="{ 'record-focus-shell': recordFocusMode }">
    <a-layout-sider class="app-sider" :width="220" collapsible :collapsed="collapsed" @collapse="onCollapse">
      <div class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M12 3L4 8v8l8 5 8-5V8l-8-5z" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </div>
        <div v-if="!collapsed" class="brand-text">
          <div class="brand-title">手术麻醉管理系统</div>
          <div class="brand-subtitle">SAMIS</div>
        </div>
      </div>
      <nav class="sider-nav" aria-label="主导航">
        <button
          v-for="item in primaryMenus"
          :key="item.key"
          type="button"
          class="sider-nav-item arco-menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="goMenu(item.key)"
        >
          <NavIconBadge :name="menuIcon(item.key)" :variant="activeMenu === item.key ? 'active' : 'default'" :size="16" />
          <span v-if="!collapsed" class="sider-nav-title">{{ item.label }}</span>
        </button>
      </nav>
    </a-layout-sider>
    <a-layout class="app-main">
      <a-layout-header class="app-header">
        <div class="app-header-main">
          <div class="header-title-block">
            <h1 class="header-title">{{ route.meta.title || moduleLabel }}</h1>
            <p class="header-subtitle">{{ moduleDescription }}</p>
          </div>
          <a-breadcrumb>
            <a-breadcrumb-item>{{ moduleLabel }}</a-breadcrumb-item>
            <a-breadcrumb-item>{{ route.meta.title }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <a-space class="header-actions" :size="8">
          <a-popover trigger="click" position="bottom">
            <a-input-search size="small" class="header-search" placeholder="查找病人..." readonly @click.stop />
            <template #content>
              <div class="search-popover">
                <a-input-search v-model="patientQuery" placeholder="姓名/手术/手术间" size="small" />
                <div class="search-results">
                  <button v-for="item in searchResults" :key="item.id" type="button" class="search-result-item" @click="openPatient(item.id)">
                    <strong>{{ item.patientName }}</strong>
                    <span>{{ item.room }} · {{ item.surgeryName }}</span>
                  </button>
                  <a-empty v-if="!searchResults.length" description="无匹配患者" />
                </div>
              </div>
            </template>
          </a-popover>
          <a-select
            :model-value="store.currentDoctorName"
            class="doctor-select"
            size="small"
            :options="store.doctorOptions.map((item) => ({ label: item, value: item }))"
            @change="(value) => store.setCurrentDoctor(String(value))"
          />
          <a-badge :count="pendingTodos" :max-count="99">
            <a-button type="outline" size="small" aria-label="消息通知" @click="router.push('/workbench/todos')">
              <template #icon><icon-exclamation-circle /></template>
            </a-button>
          </a-badge>
          <a-popover trigger="click" position="bottom">
            <a-button type="outline" size="small">
              <template #icon><icon-schedule /></template>
              我的手术
            </a-button>
            <template #content>
              <div class="my-surgery-popover">
                <div class="popover-title">
                  <strong>{{ store.currentDoctorName }} 今日负责</strong>
                  <a-tag v-if="activeDoctorCase" color="green" size="small">进行中</a-tag>
                </div>
                <a-empty v-if="!doctorCases.length" description="今日暂无排班" />
                <button v-for="item in doctorCases" :key="item.id" class="my-surgery-item" type="button" @click="router.push(`/surgery/detail/${item.id}`)">
                  <span><strong>{{ item.room }}</strong> {{ timeRange(item) }}</span>
                  <span class="surgery-name">{{ item.patientName }} · {{ item.surgeryName }}</span>
                </button>
              </div>
            </template>
          </a-popover>
          <a-badge :count="store.qualityDefects.length" :max-count="99">
            <a-button type="outline" size="small" @click="router.push('/quality/defects')">
              <template #icon><icon-exclamation-circle /></template>
              质控缺陷
            </a-button>
          </a-badge>
          <a-dropdown trigger="click">
            <a-avatar :size="32" class="header-avatar" aria-label="用户菜单">麻</a-avatar>
            <template #content>
              <a-doption @click="router.push('/system/users')">系统设置</a-doption>
              <a-doption @click="router.push('/workbench/emergency')">紧急呼叫</a-doption>
              <a-doption @click="logout">退出登录</a-doption>
            </template>
          </a-dropdown>
        </a-space>
      </a-layout-header>
      <div v-if="secondaryNavItems.length" class="app-subnav">
        <div class="app-subnav-scroll" role="menubar" :aria-label="`${moduleLabel}二级导航`">
          <button
            v-for="item in secondaryNavItems"
            :key="item.key"
            class="subnav-item"
            :class="{ active: item.key === activeSecondaryKey }"
            type="button"
            role="menuitem"
            @click="goSecondary(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
      <footer class="app-footer">
        <span>{{ clockText }}</span>
        <span>在线用户 12</span>
        <span>SAMIS v0.1-prototype</span>
      </footer>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavIconBadge from '@/components/NavIconBadge.vue';
import { menuIconFor } from '@/config/menuTheme';
import { getPrimaryMenuLabel, matchSecondaryKey, primaryMenuMap, primaryMenus, secondaryMenus } from '@/config/navigation';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const collapsed = ref(false);
const patientQuery = ref('');
const clockText = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'));
let clockTimer: number | undefined;

onMounted(() => {
  clockTimer = window.setInterval(() => {
    clockText.value = dayjs().format('YYYY-MM-DD HH:mm:ss');
  }, 1000);
});
onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer);
});

const activeMenu = computed(() => String(route.meta.menu ?? 'workbench'));
const moduleLabel = computed(() => getPrimaryMenuLabel(activeMenu.value));
const moduleDescription = computed(() => primaryMenuMap[activeMenu.value]?.description ?? '手术麻醉数字化管理');
const secondaryNavItems = computed(() => secondaryMenus[activeMenu.value] ?? []);
const activeSecondaryKey = computed(() => matchSecondaryKey(route.path, activeMenu.value) ?? '');
const recordFocusMode = computed(() => route.name === 'record');
const doctorCases = computed(() => store.myTodayCases);
const activeDoctorCase = computed(() => store.currentDoctorActiveCase);
const pendingTodos = computed(() => store.todos.filter((item) => item.status === '待处理').length);
const searchResults = computed(() => {
  const q = patientQuery.value.trim();
  if (!q) return store.cases.slice(0, 6);
  return store.cases.filter((item) => [item.patientName, item.surgeryName, item.room, item.anesthesiologist].some((v) => v.includes(q))).slice(0, 8);
});

const menuPath = Object.fromEntries(primaryMenus.map((item) => [item.key, item.defaultPath]));
const menuIcon = (key: string) => menuIconFor(key);
const onCollapse = (value: boolean) => { collapsed.value = value; };
const goMenu = (key: string) => router.push(menuPath[key] ?? '/workbench');
const goSecondary = (key: string) => {
  const target = secondaryNavItems.value.find((item) => item.key === key);
  if (target) router.push(target.path);
};
const openPatient = (id: string) => router.push(`/surgery/detail/${id}`);
const logout = () => router.push('/login');
const timeRange = (item: { scheduledStart?: string; plannedStart: string; scheduledEnd?: string; surgeryEnd?: string; expectedDurationMinutes: number }) => {
  const start = item.scheduledStart ?? item.plannedStart;
  const end = item.scheduledEnd ?? item.surgeryEnd ?? dayjs(start).add(item.expectedDurationMinutes || 60, 'minute').toISOString();
  return `${dayjs(start).format('HH:mm')}-${dayjs(end).format('HH:mm')}`;
};
</script>

<style scoped>
.app-main { min-width: 0; display: flex; flex-direction: column; min-height: 100vh; }
.record-focus-shell :deep(.app-sider), .record-focus-shell :deep(.app-header), .record-focus-shell :deep(.app-subnav), .record-focus-shell :deep(.app-footer) { display: none !important; }
.record-focus-shell :deep(.app-content) { padding: 12px; }
.header-title-block { margin-bottom: 4px; }
.header-title { margin: 0; color: var(--text-primary); font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
.header-subtitle { margin: 3px 0 0; color: var(--text-secondary); font-size: var(--font-size-xs); }
.header-actions { flex-shrink: 0; }
.header-search { width: 180px; cursor: pointer; }
.search-popover { width: 300px; }
.search-results { margin-top: 8px; max-height: 240px; overflow: auto; }
.search-result-item { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 9px 10px; border: 1px solid transparent; background: transparent; text-align: left; cursor: pointer; border-radius: var(--radius-sm); }
.search-result-item:hover { border-color: var(--color-brand-100); background: var(--primary-soft); }
.sider-nav { flex: 1; padding: 10px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.sider-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 11px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; text-align: left; transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; position: relative; }
.sider-nav-item:hover { border-color: var(--border); background: var(--surface-muted); color: var(--text-primary); }
.sider-nav-item.active { border-color: var(--color-brand-100); background: linear-gradient(90deg, var(--primary-soft), var(--surface)); color: var(--primary); font-weight: 600; }
.sider-nav-item.active::before { content: ''; position: absolute; left: -1px; top: 10px; bottom: 10px; width: 3px; border-radius: 999px; background: var(--primary); }
.sider-nav-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-avatar { background: var(--primary); color: var(--surface); font-size: 13px; cursor: pointer; box-shadow: var(--shadow-xs); }
.app-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 18px; border-top: 1px solid var(--border); background: rgb(255 255 255 / 86%); color: var(--text-tertiary); font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; }
</style>
