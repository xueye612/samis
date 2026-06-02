<template>
  <div class="record-status-bar" :class="{ inline }" aria-label="同步状态摘要">
    <!-- 顶栏 inline：固定宽度单槽，避免待传/同步中切换时挤压整行 -->
    <button
      v-if="inline"
      type="button"
      class="sync-summary"
      :class="[`tone-${inlineSummary.tone}`, { 'is-syncing': syncState.uploading }]"
      :title="inlineSummary.title"
      @click="onInlineClick"
    >
      {{ inlineSummary.label }}
    </button>

    <div v-else class="status-bar-track">
      <span
        v-if="!syncState.online"
        class="sync-chip warn"
        @click="$emit('open-sync-detail')"
      >
        离线
      </span>
      <span
        v-if="syncState.conflictCount > 0"
        class="sync-chip error clickable"
        @click="$emit('open-conflicts')"
      >
        冲突 {{ syncState.conflictCount }}
      </span>
      <span
        v-if="syncState.failedCount > 0"
        class="sync-chip error clickable"
        :title="syncState.lastSyncError"
        @click="$emit('open-sync-detail')"
      >
        失败 {{ syncState.failedCount }}
      </span>
      <span
        v-if="syncState.pendingCount > 0"
        class="sync-chip warn clickable"
        @click="$emit('open-sync-detail')"
      >
        待传 {{ syncState.pendingCount }}
      </span>
      <span v-if="syncState.uploading" class="sync-chip syncing">同步中</span>
      <span
        v-if="lastSyncLabel && !hasAttention"
        class="sync-chip muted clickable"
        @click="$emit('open-sync-detail')"
      >
        {{ lastSyncLabel }}
      </span>
      <button
        v-if="!hasAttention && syncState.online && !lastSyncLabel"
        type="button"
        class="sync-chip muted sync-link"
        @click="$emit('open-sync-detail')"
      >
        同步
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';

const props = defineProps<{
  syncState: AnesthesiaSyncState;
  inline?: boolean;
}>();

const emit = defineEmits<{
  'open-sync-detail': [];
  'open-conflicts': [];
}>();

const lastSyncLabel = computed(() => (
  props.syncState.lastSyncSuccessAt
    ? dayjs(props.syncState.lastSyncSuccessAt).format('HH:mm')
    : ''
));

const hasAttention = computed(() => (
  !props.syncState.online
  || props.syncState.conflictCount > 0
  || props.syncState.failedCount > 0
  || props.syncState.pendingCount > 0
  || props.syncState.uploading
));

type InlineTone = 'warn' | 'error' | 'syncing' | 'muted';

interface InlineSummary {
  label: string;
  tone: InlineTone;
  title: string;
  action: 'detail' | 'conflicts';
}

/** 固定占位文案宽度（与 CSS 槽宽一致），切换状态时顶栏不抖动 */
const inlineSummary = computed((): InlineSummary => {
  const s = props.syncState;
  if (!s.online) {
    return { label: '离线', tone: 'warn', title: '当前离线，点击查看同步详情', action: 'detail' };
  }
  if (s.conflictCount > 0) {
    return {
      label: `冲突${s.conflictCount}`,
      tone: 'error',
      title: `${s.conflictCount} 条冲突待处理`,
      action: 'conflicts',
    };
  }
  if (s.failedCount > 0) {
    return {
      label: `失败${s.failedCount}`,
      tone: 'error',
      title: s.lastSyncError || '同步失败',
      action: 'detail',
    };
  }
  if (s.uploading) {
    return { label: '同步中', tone: 'syncing', title: '正在上传', action: 'detail' };
  }
  if (s.pendingCount > 0) {
    return {
      label: `待传${s.pendingCount}`,
      tone: 'warn',
      title: `${s.pendingCount} 条待上传`,
      action: 'detail',
    };
  }
  if (lastSyncLabel.value) {
    return {
      label: lastSyncLabel.value,
      tone: 'muted',
      title: `最近同步 ${lastSyncLabel.value}`,
      action: 'detail',
    };
  }
  return { label: '同步', tone: 'muted', title: '查看同步详情', action: 'detail' };
});

const onInlineClick = () => {
  if (inlineSummary.value.action === 'conflicts') {
    emit('open-conflicts');
    return;
  }
  emit('open-sync-detail');
};
</script>

<style scoped>
.record-status-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.record-status-bar:not(.inline) {
  overflow: hidden;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 2px;
  margin: 2px 0;
  border-radius: 6px;
  background: var(--surface-muted);
}

.record-status-bar.inline {
  width: 72px;
  flex: 0 0 72px;
}

.sync-summary {
  box-sizing: border-box;
  width: 72px;
  height: 22px;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 999px;
  font: inherit;
  font-size: 11px;
  line-height: 22px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.sync-summary.tone-warn {
  background: var(--color-warning-light-1);
  color: var(--warning);
}

.sync-summary.tone-error {
  background: var(--color-danger-100);
  color: var(--danger);
}

.sync-summary.tone-syncing {
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
}

.sync-summary.tone-muted {
  background: transparent;
  color: var(--text-tertiary);
}

.sync-summary.is-syncing {
  animation: sync-pulse 1.2s ease-in-out infinite;
}

@keyframes sync-pulse {
  50% {
    opacity: 0.72;
  }
}

.status-bar-track {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
  min-height: 20px;
  overflow: hidden;
  white-space: nowrap;
}

.sync-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 20px;
  flex-shrink: 0;
}

.sync-chip.warn {
  background: var(--color-warning-light-1);
  color: var(--warning);
}

.sync-chip.syncing {
  background: var(--color-primary-light-1);
  color: rgb(var(--primary-6));
}

.sync-chip.error {
  background: var(--color-danger-100);
  color: var(--danger);
}

.sync-chip.clickable,
.sync-link {
  cursor: pointer;
}

.sync-chip.muted,
.sync-link {
  background: transparent;
  color: var(--text-tertiary);
}

.sync-link {
  border: 0;
  font: inherit;
}
</style>
