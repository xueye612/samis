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
        <div class="app-header-main header-title-area">
          <div class="header-title-block">
            <h1 class="header-title">{{ route.meta.title || moduleLabel }}</h1>
            <p class="header-subtitle">{{ moduleDescription }}</p>
          </div>
          <a-breadcrumb class="header-breadcrumb">
            <a-breadcrumb-item>{{ moduleLabel }}</a-breadcrumb-item>
            <a-breadcrumb-item>{{ route.meta.title }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <div class="header-actions">
          <a-popover trigger="click" position="bottom" class="header-search-area">
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

          <div class="header-quick-area">
            <a-popover trigger="click" position="bottom">
              <a-button type="outline" size="small" class="header-action-btn">
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

            <a-badge :count="store.qualityDefects.length" :max-count="99" class="header-badge-btn">
              <a-button type="outline" size="small" class="header-action-btn" @click="router.push('/quality/defects')">
                <template #icon><icon-exclamation-circle /></template>
                质控缺陷
              </a-button>
            </a-badge>
          </div>

          <a-popover trigger="click" position="br" class="header-more-area">
            <a-badge :count="pendingTodos" :max-count="99" class="header-badge-btn">
              <a-button type="outline" size="small" class="header-action-btn">
                <template #icon><icon-unordered-list /></template>
                更多
              </a-button>
            </a-badge>
            <template #content>
              <div class="header-more-panel">
                <div class="header-more-section">
                  <span class="header-more-label">当前医生</span>
                  <a-select
                    :model-value="store.currentDoctorName"
                    size="small"
                    class="header-more-select"
                    :options="store.doctorOptions.map((item) => ({ label: item, value: item }))"
                    @change="(value) => store.setCurrentDoctor(String(value))"
                  />
                </div>
                <div v-if="sessionRoomGroup || sessionRoom" class="header-more-section">
                  <span class="header-more-label">手术间</span>
                  <div class="header-more-tags">
                    <a-tag v-if="sessionRoomGroup" size="small" color="arcoblue">{{ sessionRoomGroup }}</a-tag>
                    <a-tag v-if="sessionRoom" size="small">{{ sessionRoom }}</a-tag>
                  </div>
                </div>
                <button type="button" class="header-more-link" @click="router.push('/workbench/todos')">
                  <icon-exclamation-circle />
                  <span class="header-more-link-text">消息通知</span>
                  <a-badge v-if="pendingTodos" :count="pendingTodos" :max-count="99" class="header-more-link-badge" />
                </button>
              </div>
            </template>
          </a-popover>

          <a-dropdown trigger="click" class="header-user-area">
            <a-space :size="6" class="header-user-trigger">
              <span class="header-user-name">{{ userDisplayName }}</span>
              <a-avatar :size="32" class="header-avatar" aria-label="用户菜单">{{ userAvatarText }}</a-avatar>
            </a-space>
            <template #content>
              <a-doption disabled>{{ userDisplayName }}</a-doption>
              <a-doption @click="router.push('/system/users')">系统设置</a-doption>
              <a-doption @click="router.push('/workbench/emergency')">紧急呼叫</a-doption>
              <a-doption @click="logout">退出登录</a-doption>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      <div v-if="secondaryNavItems.length" class="app-subnav" :class="{ 'app-subnav--workflow': activeMenu === 'surgery' }">
        <div v-if="activeMenu === 'surgery'" class="surgery-subnav" :aria-label="`${moduleLabel}二级导航`">
          <div class="surgery-subnav-groups" role="tablist" aria-label="手术麻醉流程">
            <button
              v-for="group in secondaryNavGroups"
              :key="group.key"
              type="button"
              class="surgery-subnav-group"
              :class="{ active: group.key === activeSecondaryGroupKey }"
              role="tab"
              :aria-selected="group.key === activeSecondaryGroupKey"
              @click="goSecondaryGroup(group.key)"
            >
              {{ group.label }}
            </button>
          </div>
          <div class="surgery-subnav-items" role="menubar" :aria-label="`${activeSecondaryGroupLabel}菜单`">
            <button
              v-for="item in activeSecondaryGroupItems"
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
        <div v-else class="app-subnav-scroll" role="menubar" :aria-label="`${moduleLabel}二级导航`">
          <template v-for="group in secondaryNavGroups" :key="group.key">
            <span v-if="group.label" class="subnav-group-label">{{ group.label }}</span>
            <button
              v-for="item in group.items"
              :key="item.key"
              class="subnav-item"
              :class="{ active: item.key === activeSecondaryKey }"
              type="button"
              role="menuitem"
              @click="goSecondary(item.key)"
            >
              {{ item.label }}
            </button>
          </template>
        </div>
      </div>
      <a-layout-content class="app-content">
        <div v-if="!persistenceReady" class="app-persistence-loading" aria-live="polite">
          <a-spin dot />
          <span>正在恢复本地数据…</span>
        </div>
        <router-view v-else />
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
import { getPrimaryMenuLabel, matchSecondaryKey, primaryMenuMap, primaryMenus, secondaryMenuGroupLabels, secondaryMenus } from '@/config/navigation';
import { useAnesthesiaPersistenceGate } from '@/composables/useAnesthesiaPersistenceGate';
import { logoutSamis, restoreSessionIfPresent } from '@/services/auth/authService';
import {
  getSamisRoom,
  getSamisRoomGroup,
  getSamisUserProfile,
} from '@/services/session/samisSession';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const { ready: persistenceReady, ensureReady } = useAnesthesiaPersistenceGate();
const collapsed = ref(false);
const patientQuery = ref('');
const clockText = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'));
let clockTimer: number | undefined;

const userDisplayName = computed(() => getSamisUserProfile()?.displayName ?? store.currentDoctorName ?? '未登录');
const userAvatarText = computed(() => {
  const name = userDisplayName.value;
  return name && name !== '未登录' ? name.slice(0, 1) : '麻';
});
const sessionRoom = computed(() => getSamisRoom());
const sessionRoomGroup = computed(() => getSamisRoomGroup());

onMounted(() => {
  void ensureReady();
  void restoreSessionIfPresent();
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
const secondaryNavGroups = computed(() => {
  const items = secondaryNavItems.value;
  if (activeMenu.value !== 'surgery') return [{ key: activeMenu.value, label: '', items }];
  const groups: Array<{ key: string; label: string; items: typeof items }> = [];
  items.forEach((item) => {
    const key = item.group ?? 'default';
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label: item.group ? secondaryMenuGroupLabels[item.group] : '', items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });
  return groups;
});
const activeSecondaryKey = computed(() => matchSecondaryKey(route.path, activeMenu.value) ?? '');
const activeSecondaryItem = computed(() => secondaryNavItems.value.find((item) => item.key === activeSecondaryKey.value));
const activeSecondaryGroupKey = computed(() => activeSecondaryItem.value?.group ?? secondaryNavGroups.value[0]?.key ?? '');
const activeSecondaryGroup = computed(() => secondaryNavGroups.value.find((group) => group.key === activeSecondaryGroupKey.value) ?? secondaryNavGroups.value[0]);
const activeSecondaryGroupLabel = computed(() => activeSecondaryGroup.value?.label || moduleLabel.value);
const activeSecondaryGroupItems = computed(() => activeSecondaryGroup.value?.items ?? []);
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
const goSecondaryGroup = (key: string) => {
  const target = secondaryNavGroups.value.find((group) => group.key === key)?.items[0];
  if (target) router.push(target.path);
};
const openPatient = (id: string) => router.push(`/surgery/detail/${id}`);
const logout = () => {
  logoutSamis();
  router.push('/login');
};
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
.header-title-area { min-width: 0; }
.header-title-block { margin-bottom: 2px; }
.header-title { margin: 0; color: var(--text-primary); font-size: 18px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (min-width: 1440px) { .header-title { font-size: 20px; } }
.header-subtitle { margin: 2px 0 0; color: var(--text-tertiary); font-size: var(--font-size-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-breadcrumb { margin-top: 4px; }
/* 头部动作区：单行不换行，按 区划(搜索/快捷/更多/用户) 组织，杜绝重叠与裁切 */
.header-actions { display: flex; align-items: center; flex-wrap: nowrap; flex-shrink: 0; gap: 10px; min-width: 0; }
.header-quick-area { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.header-action-btn { flex-shrink: 0; }
/* 徽标计数偏移在外侧，给相邻控件留出净空，避免覆盖文字 */
.header-badge-btn { margin-right: 6px; }
.header-search { width: 168px; cursor: pointer; flex-shrink: 0; }
@media (min-width: 1440px) { .header-search { width: 200px; } }
.subnav-group-label { display: inline-flex; align-items: center; align-self: stretch; margin-left: 8px; padding: 0 4px; color: var(--text-tertiary); font-size: var(--font-size-xs); font-weight: 700; white-space: nowrap; }
.subnav-group-label:first-child { margin-left: 0; }
.subnav-group-label::after { content: ''; width: 1px; height: 14px; margin-left: 8px; background: var(--border); }
.app-subnav--workflow { padding-top: 6px; padding-bottom: 6px; }
.surgery-subnav { display: flex; align-items: center; gap: 14px; min-width: 0; }
.surgery-subnav-groups { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-right: 12px; border-right: 1px solid var(--border); }
.surgery-subnav-group { height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text-tertiary); font-size: var(--font-size-xs); font-weight: 600; white-space: nowrap; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.surgery-subnav-group:hover { border-color: var(--border); background: var(--surface-muted); color: var(--text-primary); }
.surgery-subnav-group.active { border-color: var(--color-brand-100); background: var(--primary-soft); color: var(--primary); }
.surgery-subnav-items { display: flex; align-items: stretch; min-width: 0; height: 32px; overflow-x: auto; }
.surgery-subnav-items .subnav-item { padding: 0 12px; }
.search-popover { width: 300px; }
.search-results { margin-top: 8px; max-height: 240px; overflow: auto; }
.search-result-item { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 9px 10px; border: 1px solid transparent; background: transparent; text-align: left; cursor: pointer; border-radius: var(--radius-sm); }
.search-result-item:hover { border-color: var(--color-brand-100); background: var(--primary-soft); }
.sider-nav { flex: 1; padding: 8px; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; }
.sider-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 11px; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); font-size: var(--font-size-sm); cursor: pointer; text-align: left; transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease; position: relative; }
.sider-nav-item:hover { border-color: var(--border); background: var(--surface-muted); color: var(--text-primary); }
.sider-nav-item.active { border-color: var(--color-brand-100); background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.sider-nav-item.active::before { content: ''; position: absolute; left: -1px; top: 8px; bottom: 8px; width: 3px; border-radius: 999px; background: var(--primary); }
.sider-nav-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-user-name { font-size: var(--font-size-sm); color: var(--text-secondary); max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (min-width: 1440px) { .header-user-name { max-width: 100px; } }
.header-user-area { flex-shrink: 0; }
.header-user-trigger { cursor: pointer; }
.header-avatar { background: var(--primary); color: var(--surface); font-size: 13px; cursor: pointer; box-shadow: var(--shadow-xs); flex-shrink: 0; }
/* “更多”面板：低优先级入口集中收拢 */
.header-more-panel { width: 240px; display: flex; flex-direction: column; gap: 12px; padding: 4px 2px; }
.header-more-section { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header-more-label { color: var(--text-tertiary); font-size: var(--font-size-xs); white-space: nowrap; }
.header-more-select { width: 140px; }
.header-more-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.header-more-link { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); font-size: var(--font-size-sm); cursor: pointer; text-align: left; transition: background 0.12s ease, border-color 0.12s ease; }
.header-more-link:hover { border-color: var(--border); background: var(--surface-muted); color: var(--text-primary); }
.header-more-link-text { flex: 1; }
.app-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 18px; border-top: 1px solid var(--border); background: rgb(255 255 255 / 86%); color: var(--text-tertiary); font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; }
.app-persistence-loading { min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-tertiary); }
</style>
