<template>
  <div class="record-status-bar" aria-label="同步状态摘要">
    <div class="status-bar-track">
      <span
        v-if="syncState.pendingCount > 0"
        class="sync-chip warn clickable"
        @click="$emit('open-sync-detail')"
      >
        待上传 {{ syncState.pendingCount }}
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
      <span v-if="syncState.uploading" class="sync-chip syncing">同步中</span>
      <span class="sync-chip" :class="syncState.online ? 'muted' : 'warn'">
        {{ syncState.online ? '网络在线' : '网络离线' }}
      </span>
      <span v-if="lastSyncLabel" class="sync-chip muted">最近同步 {{ lastSyncLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';

const props = defineProps<{
  syncState: AnesthesiaSyncState;
}>();

defineEmits<{
  'open-sync-detail': [];
  'open-conflicts': [];
}>();

const lastSyncLabel = computed(() => (
  props.syncState.lastSyncSuccessAt
    ? dayjs(props.syncState.lastSyncSuccessAt).format('HH:mm:ss')
    : ''
));
</script>

<style scoped>
.record-status-bar {
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 2px;
  margin: 2px 0;
  border-radius: 6px;
  background: var(--surface-muted);
  overflow: hidden;
}

.status-bar-track {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 24px;
  overflow: hidden;
  white-space: nowrap;
}

.sync-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 22px;
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

.sync-chip.clickable {
  cursor: pointer;
}

.sync-chip.muted {
  background: transparent;
  color: var(--text-tertiary);
}
</style>
