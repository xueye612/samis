<template>
  <section class="structured-entities" data-testid="structured-clinical-entities">
    <header class="panel-header">
      <div>
        <strong>结构化术中记录</strong>
        <p>气道、通气、持续输注、输血核对及抢救记录均保存到真实关系表。</p>
      </div>
      <a-button size="small" :loading="loading" @click="reload">刷新</a-button>
    </header>

    <a-alert v-if="errorMessage" type="error" show-icon closable @close="errorMessage = ''">
      {{ errorMessage }}
    </a-alert>

    <a-tabs v-model:active-key="activeEntity" type="rounded" lazy-load>
      <a-tab-pane v-for="definition in definitions" :key="definition.entityType" :title="`${definition.label} ${rowsByEntity[definition.entityType].length}`">
        <div class="tab-actions">
          <span class="source-note">数据来源：麻醉记录关系表 / 本地同步队列</span>
          <a-button
            v-if="!readOnly"
            size="small"
            type="primary"
            :data-testid="`structured-add-${definition.entityType}`"
            @click="openCreate(definition.entityType)"
          >新增{{ definition.label }}</a-button>
        </div>

        <a-empty v-if="!loading && rowsByEntity[definition.entityType].length === 0" :description="`暂无${definition.label}记录`" />
        <a-table
          v-else
          :data="rowsByEntity[definition.entityType]"
          :pagination="false"
          row-key="localId"
          size="small"
          :scroll="{ x: 760 }"
        >
          <template #columns>
            <a-table-column title="临床时间" :width="170">
              <template #cell="{ record }">{{ formatClinicalTime(record[definition.timeKey]) }}</template>
            </a-table-column>
            <a-table-column title="内容" :width="320">
              <template #cell="{ record }">{{ summarize(definition.entityType, record) }}</template>
            </a-table-column>
            <a-table-column title="版本/同步" :width="150">
              <template #cell="{ record }">
                <a-space size="mini">
                  <span>v{{ record.syncVersion ?? 1 }}</span>
                  <a-tag :color="record.syncStatus === 'success' ? 'green' : 'orange'">
                    {{ record.syncStatus === 'success' ? '已回读' : '待同步' }}
                  </a-tag>
                </a-space>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="130" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button size="mini" type="text" @click="openEdit(definition.entityType, record)">{{ readOnly ? '查看' : '编辑' }}</a-button>
                  <a-button v-if="!readOnly" size="mini" type="text" status="danger" @click="openDelete(definition.entityType, record)">作废</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <a-drawer
      v-model:visible="editorVisible"
      :title="`${editingLocalId ? (readOnly ? '查看' : '编辑') : '新增'}${activeDefinition.label}`"
      :width="720"
      :footer="false"
      unmount-on-close
    >
      <a-form layout="vertical" :model="draft" class="structured-form">
        <a-form-item
          v-for="field in activeDefinition.fields"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <a-select
            v-if="field.kind === 'select'"
            :model-value="draft[field.key] as string | undefined"
            :options="field.options"
            allow-clear
            :disabled="readOnly"
            @change="setDraftValue(field.key, $event)"
          />
          <a-input-number
            v-else-if="field.kind === 'number'"
            :model-value="numberDraftValue(field.key)"
            hide-button
            :disabled="readOnly"
            @change="setDraftValue(field.key, $event)"
          />
          <a-textarea
            v-else-if="field.kind === 'textarea'"
            :model-value="stringDraftValue(field.key)"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :disabled="readOnly"
            @input="setDraftValue(field.key, $event)"
          />
          <input
            v-else-if="field.kind === 'datetime'"
            class="native-datetime-input"
            type="datetime-local"
            :value="stringDraftValue(field.key)"
            :disabled="readOnly"
            @input="setDraftValue(field.key, ($event.target as HTMLInputElement).value)"
          />
          <a-input
            v-else
            :model-value="stringDraftValue(field.key)"
            :disabled="readOnly"
            @input="setDraftValue(field.key, $event)"
          />
        </a-form-item>
      </a-form>
      <div class="drawer-footer">
        <a-button @click="editorVisible = false">{{ readOnly ? '关闭' : '取消' }}</a-button>
        <a-button v-if="!readOnly" type="primary" :loading="saving" data-testid="structured-save" @click="saveDraft">保存并回读</a-button>
      </div>
    </a-drawer>

    <a-modal v-model:visible="deleteVisible" title="作废结构化记录" :footer="false" unmount-on-close>
      <a-alert type="warning" show-icon>作废会进入同步队列并保留审计痕迹，不会物理删除。</a-alert>
      <a-textarea v-model="deleteReason" class="delete-reason" placeholder="请输入作废原因" :auto-size="{ minRows: 3, maxRows: 5 }" />
      <div class="drawer-footer">
        <a-button @click="deleteVisible = false">取消</a-button>
        <a-button type="primary" status="danger" :loading="saving" @click="confirmDelete">确认作废</a-button>
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { Message } from '@arco-design/web-vue';
import { computed, reactive, ref, watch } from 'vue';
import { fetchRecordDetail, type RecordDetailStructuredEntity } from '@/services/anesthesia/anesthesiaRecordHydrate';
import { flushAnesthesiaSyncNow } from '@/services/anesthesia/anesthesiaSyncService';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { getFailedSyncCount, getPendingSyncCount } from '@/services/anesthesia/anesthesiaSyncQueue';
import {
  deleteStructuredRecord,
  hydrateStructuredRecordFromServer,
  listStructuredRecords,
  saveStructuredRecord,
  type StructuredRecordEntityType,
} from '@/services/anesthesia/structuredRecordRepository';
import {
  buildStructuredRecordPayload,
  getStructuredRecordDefinition,
  resolveStructuredRecordOccurredAt,
  STRUCTURED_RECORD_DEFINITIONS,
  validateStructuredRecordDraft,
  type StructuredRecordDraft,
} from '@/services/anesthesia/structuredRecordForm';

interface StructuredViewRow extends Record<string, unknown> {
  localId: string;
  serverId?: number;
  syncVersion?: number;
  syncStatus?: string;
}

const props = defineProps<{
  operationId: string;
  recordLocalId: string;
  readOnly?: boolean;
}>();

const definitions = STRUCTURED_RECORD_DEFINITIONS;
const activeEntity = ref<StructuredRecordEntityType>('airway_record');
const rowsByEntity = reactive<Record<StructuredRecordEntityType, StructuredViewRow[]>>({
  airway_record: [], ventilation_segment: [], infusion_segment: [],
  transfusion_verification: [], rescue_event: [], rescue_action: [],
});
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const editorVisible = ref(false);
const deleteVisible = ref(false);
const editingLocalId = ref('');
const deleteLocalId = ref('');
const deleteEntity = ref<StructuredRecordEntityType>('airway_record');
const deleteReason = ref('');
const draft = reactive<StructuredRecordDraft>({});
const activeDefinition = computed(() => getStructuredRecordDefinition(activeEntity.value));

const serverListKey: Record<StructuredRecordEntityType, keyof NonNullable<Awaited<ReturnType<typeof fetchRecordDetail>>['record']>> = {
  airway_record: 'airwayRecords', ventilation_segment: 'ventilationSegments', infusion_segment: 'infusionSegments',
  transfusion_verification: 'transfusionVerifications', rescue_event: 'rescueEvents', rescue_action: 'rescueActions',
};

function parsePayload(value: string): Record<string, unknown> {
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

function toServerId(row: RecordDetailStructuredEntity): number | undefined {
  const value = Number(row.id ?? row.serverId);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toLocalDateTime(value: unknown): string {
  if (!value) return '';
  const parsed = dayjs(String(value));
  return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm') : '';
}

async function reload() {
  if (!props.operationId) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const detail = await fetchRecordDetail(props.operationId);
    const recordServerId = Number(detail.record?.serverId);
    for (const definition of definitions) {
      const serverRows = (detail.record?.[serverListKey[definition.entityType]] ?? []) as RecordDetailStructuredEntity[];
      for (const row of serverRows) {
        const localId = String(row.localId ?? '');
        const serverId = toServerId(row);
        if (!localId || !serverId) continue;
        const payload = buildStructuredRecordPayload(definition.entityType, row as StructuredRecordDraft);
        await hydrateStructuredRecordFromServer({
          entityType: definition.entityType,
          localId,
          operationId: props.operationId,
          recordLocalId: props.recordLocalId,
          recordServerId: Number.isFinite(recordServerId) ? recordServerId : null,
          serverId,
          syncVersion: Number(row.syncVersion ?? 1),
          occurredAt: resolveStructuredRecordOccurredAt(definition.entityType, row as StructuredRecordDraft),
          payload,
        });
      }
      const localRows = await listStructuredRecords(definition.entityType, props.operationId);
      const merged = new Map<string, StructuredViewRow>();
      for (const row of serverRows) {
        const localId = String(row.localId ?? '');
        if (!localId) continue;
        merged.set(localId, {
          ...row, localId, serverId: toServerId(row), syncVersion: Number(row.syncVersion ?? 1), syncStatus: 'success',
        });
      }
      for (const row of localRows) {
        if (row.sync_status === 'success' && merged.has(row.local_id)) continue;
        merged.set(row.local_id, {
          ...parsePayload(row.payload), localId: row.local_id, serverId: row.server_id ?? undefined,
          syncVersion: row.sync_version, syncStatus: row.sync_status,
        });
      }
      rowsByEntity[definition.entityType] = [...merged.values()].sort((a, b) => String(a[definition.timeKey] ?? '').localeCompare(String(b[definition.timeKey] ?? '')));
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '结构化术中记录加载失败';
  } finally {
    loading.value = false;
  }
}

function resetDraft() { Object.keys(draft).forEach((key) => delete draft[key]); }

function openCreate(entityType: StructuredRecordEntityType) {
  activeEntity.value = entityType;
  editingLocalId.value = '';
  resetDraft();
  editorVisible.value = true;
}

function openEdit(entityType: StructuredRecordEntityType, row: StructuredViewRow) {
  activeEntity.value = entityType;
  editingLocalId.value = row.localId;
  resetDraft();
  for (const field of getStructuredRecordDefinition(entityType).fields) {
    const value = row[field.key];
    draft[field.key] = field.kind === 'datetime' ? toLocalDateTime(value) : (value as string | number | undefined);
  }
  editorVisible.value = true;
}

function setDraftValue(key: string, value: unknown) { draft[key] = value as string | number | undefined; }
function stringDraftValue(key: string) { return draft[key] === null || draft[key] === undefined ? '' : String(draft[key]); }
function numberDraftValue(key: string) { const value = Number(draft[key]); return Number.isFinite(value) ? value : undefined; }

function localIdFor(entityType: StructuredRecordEntityType) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${entityType}-${id}`;
}

async function reportSyncResult(successMessage: string) {
  const [pending, failed] = await Promise.all([getPendingSyncCount(props.recordLocalId), getFailedSyncCount(props.recordLocalId)]);
  if (pending || failed) Message.warning(`本地已保存，远程同步待处理（待同步 ${pending}，失败 ${failed}）`);
  else Message.success(successMessage);
}

async function saveDraft() {
  const validation = validateStructuredRecordDraft(activeEntity.value, draft);
  if (validation) { Message.warning(validation); return; }
  saving.value = true;
  try {
    const recordMeta = await getAnesthesiaLocalDb().records.get(props.recordLocalId);
    const payload = buildStructuredRecordPayload(activeEntity.value, draft);
    await saveStructuredRecord({
      entityType: activeEntity.value,
      localId: editingLocalId.value || localIdFor(activeEntity.value),
      operationId: props.operationId,
      recordLocalId: props.recordLocalId,
      recordServerId: recordMeta?.server_id,
      occurredAt: resolveStructuredRecordOccurredAt(activeEntity.value, draft),
      payload,
    });
    await flushAnesthesiaSyncNow(props.recordLocalId);
    editorVisible.value = false;
    await reload();
    await reportSyncResult('结构化记录已保存并从服务端回读');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '结构化记录保存失败';
    Message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

function openDelete(entityType: StructuredRecordEntityType, row: StructuredViewRow) {
  deleteEntity.value = entityType;
  deleteLocalId.value = row.localId;
  deleteReason.value = '';
  deleteVisible.value = true;
}

async function confirmDelete() {
  if (!deleteReason.value.trim()) { Message.warning('请输入作废原因'); return; }
  saving.value = true;
  try {
    await deleteStructuredRecord(deleteEntity.value, deleteLocalId.value, deleteReason.value.trim());
    await flushAnesthesiaSyncNow(props.recordLocalId);
    deleteVisible.value = false;
    await reload();
    await reportSyncResult('结构化记录已作废并从服务端回读');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '结构化记录作废失败';
    Message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

function formatClinicalTime(value: unknown) { return value && dayjs(String(value)).isValid() ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '—'; }
function summarize(entityType: StructuredRecordEntityType, row: StructuredViewRow) {
  const definition = getStructuredRecordDefinition(entityType);
  const parts = definition.summaryKeys.map((key) => row[key]).filter((value) => value !== null && value !== undefined && value !== '');
  return parts.length ? parts.join(' · ') : '—';
}

watch(() => props.operationId, () => { void reload(); }, { immediate: true });
</script>

<style scoped>
.structured-entities { display: grid; gap: 12px; }
.panel-header, .tab-actions, .drawer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-header p { margin: 4px 0 0; color: var(--color-text-3); font-size: 12px; }
.tab-actions { margin-bottom: 12px; }
.source-note { color: var(--color-text-3); font-size: 12px; }
.structured-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.structured-form :deep(.arco-form-item:has(textarea)) { grid-column: 1 / -1; }
.drawer-footer { justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-2); }
.delete-reason { margin-top: 16px; }
.native-datetime-input { box-sizing: border-box; width: 100%; height: 32px; padding: 4px 12px; color: var(--color-text-1); border: 1px solid transparent; border-radius: var(--border-radius-small); outline: none; background: var(--color-fill-2); }
.native-datetime-input:focus { border-color: rgb(var(--primary-6)); background: var(--color-bg-2); }
.native-datetime-input:disabled { cursor: not-allowed; color: var(--color-text-4); }
@media (max-width: 760px) { .structured-form { grid-template-columns: 1fr; } }
</style>
