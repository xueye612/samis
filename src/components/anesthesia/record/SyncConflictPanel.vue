<template>
  <a-modal
    :visible="visible"
    title="同步冲突"
    width="760px"
    :footer="false"
    unmount-on-close
    @cancel="emit('update:visible', false)"
  >
    <a-empty v-if="!conflicts.length" description="当前无待处理冲突" />
    <div v-else class="conflict-list">
      <article v-for="item in conflicts" :key="item.conflict_id" class="conflict-card">
        <header>
          <strong>{{ conflictTypeLabel(item.conflict_type) }}</strong>
          <a-tag size="small">{{ item.entity_type }}</a-tag>
          <span class="conflict-id">{{ item.entity_local_id }}</span>
        </header>
        <p class="conflict-meta">
          本地版本 v{{ item.local_sync_version }}
          <template v-if="item.server_sync_version"> · 服务器版本 v{{ item.server_sync_version }}</template>
        </p>
        <div class="payload-grid">
          <div>
            <h4>本地数据</h4>
            <pre>{{ formatPayload(item.local_payload) }}</pre>
          </div>
          <div>
            <h4>服务器数据</h4>
            <pre>{{ formatPayload(item.server_payload) }}</pre>
          </div>
        </div>
        <a-space wrap class="conflict-actions">
          <a-button v-if="visibleActions(item.conflict_type).use_server" size="mini" @click="resolve(item.conflict_id, 'use_server')">使用服务器版本</a-button>
          <a-button v-if="visibleActions(item.conflict_type).keep_local_correction" size="mini" @click="resolve(item.conflict_id, 'keep_local_correction')">保留本地修正</a-button>
          <a-button v-if="visibleActions(item.conflict_type).manual_merge" size="mini" @click="resolve(item.conflict_id, 'manual_merge')">人工合并</a-button>
          <a-button v-if="visibleActions(item.conflict_type).ignore_local" size="mini" status="warning" @click="resolve(item.conflict_id, 'ignore_local')">忽略本地</a-button>
          <a-button v-if="visibleActions(item.conflict_type).retry_sync" size="mini" type="primary" @click="resolve(item.conflict_id, 'retry_sync')">重试同步</a-button>
        </a-space>
      </article>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { LocalSyncConflictRow, SyncConflictResolveAction, SyncConflictType } from '@/types/anesthesiaLocalDb';
import { conflictTypeLabel } from '@/services/anesthesia/anesthesiaSyncConflict';

const props = defineProps<{
  visible: boolean;
  caseId: string;
  loadConflicts: (caseId: string) => Promise<LocalSyncConflictRow[]>;
  onResolve: (caseId: string, conflictId: string, action: SyncConflictResolveAction, mergedPayload?: unknown) => Promise<void>;
}>();

const emit = defineEmits<{ 'update:visible': [boolean] }>();
const conflicts = ref<LocalSyncConflictRow[]>([]);

/**
 * Slice 3e：按 conflictType 收敛可见 action。
 * - record_locked / record_printed / deleted_remote：锁定/打印/已作废态不可 force-write 本地覆盖，仅 use_server / ignore_local。
 * - vital_corrected：保留修正 / 用服务器 / 人工合并。
 * - 其余（version_mismatch / entity_conflict / duplicate_time_point / server_newer）：全 5 action。
 */
type ActionVisibility = Record<'use_server' | 'keep_local_correction' | 'manual_merge' | 'ignore_local' | 'retry_sync', boolean>;
const ALL_VISIBLE: ActionVisibility = { use_server: true, keep_local_correction: true, manual_merge: true, ignore_local: true, retry_sync: true };
function visibleActions(type: SyncConflictType): ActionVisibility {
  if (type === 'record_locked' || type === 'record_printed' || type === 'deleted_remote') {
    return { use_server: true, keep_local_correction: false, manual_merge: false, ignore_local: true, retry_sync: false };
  }
  if (type === 'vital_corrected') {
    return { use_server: true, keep_local_correction: true, manual_merge: true, ignore_local: false, retry_sync: false };
  }
  return ALL_VISIBLE;
}

const formatPayload = (raw: string) => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const refresh = async () => {
  if (!props.caseId) {
    conflicts.value = [];
    return;
  }
  conflicts.value = await props.loadConflicts(props.caseId);
};

watch(() => [props.visible, props.caseId], () => {
  if (props.visible) void refresh();
}, { immediate: true });

const resolve = async (conflictId: string, action: SyncConflictResolveAction) => {
  let mergedPayload: unknown;
  if (action === 'manual_merge') {
    const item = conflicts.value.find((row) => row.conflict_id === conflictId);
    if (!item) return;
    try {
      mergedPayload = {
        ...JSON.parse(item.server_payload || '{}'),
        ...JSON.parse(item.local_payload || '{}'),
        source: '手工修正',
      };
    } catch {
      Message.error('合并失败：payload 无法解析');
      return;
    }
  }
  await props.onResolve(props.caseId, conflictId, action, mergedPayload);
  Message.success('冲突已处理');
  await refresh();
  if (!conflicts.value.length) emit('update:visible', false);
};
</script>

<style scoped>
.conflict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow: auto;
}

.conflict-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px;
  background: var(--surface-muted);
}

.conflict-card header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.conflict-id {
  color: var(--text-tertiary);
  font-size: 12px;
}

.conflict-meta {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.payload-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.payload-grid h4 {
  margin: 0 0 4px;
  font-size: 12px;
}

.payload-grid pre {
  margin: 0;
  padding: 8px;
  max-height: 140px;
  overflow: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
}

.conflict-actions {
  margin-top: 4px;
}
</style>
