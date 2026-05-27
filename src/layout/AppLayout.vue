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
          class="sider-nav-item"
          :class="{ active: activeMenu === item.key }"
          @click="goMenu(item.key)"
        >
          <NavIconBadge
            :name="menuIcon(item.key)"
            :variant="activeMenu === item.key ? 'active' : 'default'"
            :size="16"
          />
          <span v-if="!collapsed" class="sider-nav-title">{{ item.label }}</span>
        </button>
      </nav>
    </a-layout-sider>
    <a-layout class="app-main">
      <a-layout-header class="app-header">
        <div class="app-header-main">
          <div class="header-title-block">
            <h1 class="header-title">{{ route.meta.title || moduleLabel }}</h1>
            <p class="header-subtitle">{{ moduleLabel }} · 商业化界面升级版</p>
          </div>
          <a-breadcrumb>
            <a-breadcrumb-item>{{ moduleLabel }}</a-breadcrumb-item>
            <a-breadcrumb-item>{{ route.meta.title }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <a-space class="header-actions" :size="8">
          <a-select
            :model-value="store.currentDoctorName"
            class="doctor-select"
            size="small"
            :options="store.doctorOptions.map((item) => ({ label: item, value: item }))"
            @change="(value) => store.setCurrentDoctor(String(value))"
          />
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
                <button
                  v-for="item in doctorCases"
                  :key="item.id"
                  class="my-surgery-item"
                  type="button"
                  @click="router.push(`/surgery/detail/${item.id}`)"
                >
                  <span>
                    <strong>{{ item.room }}</strong>
                    {{ timeRange(item) }}
                  </span>
                  <span class="surgery-name">{{ item.patientName }} · {{ item.surgeryName }}</span>
                  <span class="surgery-meta">
                    <a-tag v-if="item.emergencyInserted || item.urgency === '急诊'" color="red" size="small">急诊</a-tag>
                    <a-tag size="small">{{ item.status }}</a-tag>
                  </span>
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
          <a-avatar :size="32" class="header-avatar">麻</a-avatar>
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
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavIconBadge from '@/components/NavIconBadge.vue';
import { menuIconFor } from '@/config/menuTheme';
import {
  getPrimaryMenuLabel,
  matchSecondaryKey,
  primaryMenus,
  secondaryMenus,
} from '@/config/navigation';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const collapsed = ref(false);
const onCollapse = (value: boolean) => {
  collapsed.value = value;
};

const activeMenu = computed(() => String(route.meta.menu ?? 'workbench'));
const moduleLabel = computed(() => getPrimaryMenuLabel(activeMenu.value));
const secondaryNavItems = computed(() => secondaryMenus[activeMenu.value] ?? []);
const activeSecondaryKey = computed(() => matchSecondaryKey(route.path, activeMenu.value) ?? '');
const recordFocusMode = computed(() => route.name === 'record');
const doctorCases = computed(() => store.myTodayCases);
const activeDoctorCase = computed(() => store.currentDoctorActiveCase);

const menuPath = Object.fromEntries(primaryMenus.map((item) => [item.key, item.defaultPath]));
const menuIcon = (key: string) => menuIconFor(key);

const goMenu = (key: string) => router.push(menuPath[key] ?? '/workbench');
const goSecondary = (key: string) => {
  const target = secondaryNavItems.value.find((item) => item.key === key);
  if (target) router.push(target.path);
};
const timeRange = (item: { scheduledStart?: string; plannedStart: string; scheduledEnd?: string; surgeryEnd?: string; expectedDurationMinutes: number }) => {
  const start = item.scheduledStart ?? item.plannedStart;
  const end = item.scheduledEnd ?? item.surgeryEnd ?? dayjs(start).add(item.expectedDurationMinutes || 60, 'minute').toISOString();
  return `${dayjs(start).format('HH:mm')}-${dayjs(end).format('HH:mm')}`;
};
</script>

<style scoped>
.app-main {
  min-width: 0;
}

.record-focus-shell :deep(.app-sider),
.record-focus-shell :deep(.app-header),
.record-focus-shell :deep(.app-subnav) {
  display: none !important;
}

.record-focus-shell :deep(.app-content) {
  padding: 12px;
}

.header-title-block {
  margin-bottom: 4px;
}

.header-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
}

.header-subtitle {
  margin: 2px 0 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.sider-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.sider-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}

.sider-nav-item:hover {
  background: var(--surface-muted);
}

.sider-nav-item.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 500;
}

.sider-nav-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-avatar {
  background: var(--primary);
  color: var(--surface);
  font-size: 13px;
}
</style>
