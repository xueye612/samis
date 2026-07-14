<template>
  <a-drawer
    :visible="visible"
    :width="520"
    title="状态变更历史"
    unmount-on-close
    @cancel="emit('cancel')"
  >
    <a-spin :loading="loading">
      <a-empty v-if="!history.length" description="暂无状态变更记录" />
      <a-timeline v-else>
        <a-timeline-item v-for="item in history" :key="item.id">
          <div class="history-item">
            <a-tag :color="statusColor(item.toStatus)">{{ statusLabel(item.toStatus) }}</a-tag>
            <span class="history-meta">版本 {{ item.version }} · {{ item.actor ?? '系统' }} · {{ item.occurredAt ?? '—' }}</span>
            <div v-if="item.reason" class="history-reason">原因：{{ item.reason }}</div>
            <div v-if="item.fromStatus" class="history-from">由 {{ statusLabel(item.fromStatus) }} 变更</div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-spin>
    <template #footer>
      <a-button @click="emit('cancel')">关闭</a-button>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { loadRoomConfigurationHistory } from '@/services/configuration/roomConfigurationService';
import type { RoomStatusHistoryItem } from '@/services/anesthesia/adapters/roomAdapter';

const props = defineProps<{ visible: boolean; roomId: number | null }>();
const emit = defineEmits<{ (e: 'cancel'): void }>();

const loading = ref(false);
const history = ref<RoomStatusHistoryItem[]>([]);

watch(
  () => props.visible,
  async (visible) => {
    if (!visible || !props.roomId) {
      history.value = [];
      return;
    }
    loading.value = true;
    try {
      history.value = await loadRoomConfigurationHistory(props.roomId);
    } catch {
      history.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function statusLabel(status: string): string {
  return { draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status;
}
function statusColor(status: string): string {
  return { enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[status] ?? 'gray';
}
</script>

<style scoped>
.history-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.history-meta {
  color: var(--color-text-3);
  font-size: 12px;
}
.history-reason,
.history-from {
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
