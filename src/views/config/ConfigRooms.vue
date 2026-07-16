<template>
  <ModulePageShell title="手术间管理" description="维护手术间结构化配置、能力、生命周期与医院字段配置" shell-class="config-rooms-page">
    <ConfigTableShell title="手术间列表">
      <template #title-tag>
        <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button v-if="canManage" type="primary" @click="openCreate">新增手术间</a-button>
          <a-button @click="openFieldConfig">字段配置</a-button>
        </a-space>
      </template>

      <template #alerts>
        <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">
          加载手术间失败：{{ loadError }}。可点击刷新重试。
        </a-alert>
        <a-alert v-else-if="!loading && source === 'remote' && !rooms.length" type="warning" show-icon style="margin-bottom: 12px">
          远程暂无手术间数据，表格为空属正常状态，可在本页新增。
        </a-alert>
        <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">
          无手术间配置权限（config.room.manage）；仅可查看，写动作已禁用。
        </a-alert>
      </template>

      <a-table :data="rooms" row-key="roomId" :loading="loading" :pagination="false" size="medium" :scroll="{ x: tableScrollX }">
        <template #empty>
          <a-empty description="暂无手术间" />
        </template>
        <template #columns>
          <a-table-column v-for="group in tableFieldGroups" :key="group.groupName" :title="group.groupName">
            <a-table-column v-for="field in group.fields" :key="field.fieldCode" :title="field.displayName" :width="fieldWidth(field.fieldCode)">
              <template #cell="{ record }">
                <span v-if="field.fieldCode === 'capabilities'">
                  <a-tag v-for="cap in record.capabilities" :key="cap.capabilityType + cap.capabilityCode">
                    {{ cap.capabilityCode }}
                  </a-tag>
                </span>
                <a-tag v-else-if="field.fieldCode === 'status'" :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
                <span v-else class="cell-ellipsis" :title="formatCell(record, field.fieldCode)">{{ formatCell(record, field.fieldCode) }}</span>
              </template>
            </a-table-column>
          </a-table-column>
          <a-table-column title="操作" :width="200" :fixed="rooms.length ? 'right' : undefined">
            <template #cell="{ record }">
              <ConfigRowActions :actions="rowActions(record)" @action="(key: string) => onRowAction(record, key)" />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </ConfigTableShell>

    <RoomEditorDrawer
      :visible="editorVisible"
      :room="editingRoom"
      :field-configs="fieldConfig"
      @cancel="editorVisible = false"
      @saved="onSaved"
    />
    <RoomHistoryDrawer :visible="historyVisible" :room-id="historyRoomId" @cancel="historyVisible = false" />
    <RoomFieldConfigPanel
      :visible="fieldConfigVisible"
      :hospital-code="hospitalCode"
      :can-manage="canManageFieldCfg"
      @cancel="fieldConfigVisible = false"
      @saved="onFieldConfigSaved"
    />

    <a-modal
      :visible="statusModalVisible"
      :title="statusTarget ? statusLabel(statusTarget.toStatus) + '手术间' : '状态变更'"
      :ok-loading="statusSaving"
      :mask-closable="false"
      @cancel="statusModalVisible = false"
      @ok="confirmStatusChange"
    >
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required>
          <a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" placeholder="请填写变更原因" />
        </a-form-item>
        <a-form-item v-else>
          确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}该手术间？
        </a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { computed, onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import ConfigTableShell from '@/components/config/ConfigTableShell.vue';
import ConfigRowActions, { type ConfigRowAction } from '@/components/config/ConfigRowActions.vue';
import RoomEditorDrawer from '@/components/config/RoomEditorDrawer.vue';
import RoomHistoryDrawer from '@/components/config/RoomHistoryDrawer.vue';
import RoomFieldConfigPanel from '@/components/config/RoomFieldConfigPanel.vue';
import { authApi } from '@/api/auth';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import {
  loadRoomConfigurationList,
  changeRoomStatus,
  loadHospitalFieldConfig,
  canManageRoom,
  canManageField,
  groupRoomTableFields,
  RoomConfigConflictError,
  type RoomFieldConfigEntry,
} from '@/services/configuration/roomConfigurationService';
import type { RoomConfiguration } from '@/services/anesthesia/adapters/roomAdapter';
import { useRealRoom } from '@/config/apiFlags';

const store = useAnesthesiaStore();

const rooms = ref<RoomConfiguration[]>([]);
const fieldConfig = ref<RoomFieldConfigEntry[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);

const editorVisible = ref(false);
const editingRoom = ref<RoomConfiguration | null>(null);
const historyVisible = ref(false);
const historyRoomId = ref<number | null>(null);
const fieldConfigVisible = ref(false);
const hospitalCode = ref(resolveHospitalCode());
const statusModalVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ room: RoomConfiguration; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

function resolveHospitalCode(): string {
  if (typeof window === 'undefined') return 'default';
  const explicit = sessionStorage.getItem('samis_hospital_code');
  if (explicit) return explicit;
  try {
    const profile = JSON.parse(sessionStorage.getItem('samis_user_profile') ?? '{}') as Record<string, unknown>;
    return String(profile.hospitalCode ?? profile.hospital_code ?? 'default');
  } catch {
    return 'default';
  }
}

const canManage = computed(() => !useRealRoom() || canManageRoom(permissions.value));
const canManageFieldCfg = computed(() => !useRealRoom() || canManageField(permissions.value));

/** 表格列：按医院字段配置的显示名/显示/排序控制；系统关键字段（编码/状态/版本）与能力核心列始终可见，不可隐藏。 */
const SYSTEM_ALWAYS_FIELDS = ['roomCode', 'status', 'version', 'capabilities'];
const tableFields = computed<RoomFieldConfigEntry[]>(() => {
  const cfgMap = new Map(fieldConfig.value.map((f) => [f.fieldCode, f]));
  const baseOrder = ['roomCode', 'roomName', 'shortName', 'roomType', 'roomGroupId', 'roomGroupName', 'campus', 'floor', 'location', 'cleanLevel', 'emergencyCapable', 'negativePressure', 'hybridRoom', 'capabilities', 'defaultAnesthesiaMachine', 'defaultMonitor', 'defaultWorkstation', 'stationCapacity', 'openTime', 'closeTime', 'schedulePreference', 'staffPreference', 'sortNo', 'remark', 'version', 'status'];
  const result: RoomFieldConfigEntry[] = [];
  for (const code of baseOrder) {
    const cfg = cfgMap.get(code);
    const visible = cfg ? cfg.visible || SYSTEM_ALWAYS_FIELDS.includes(code) : SYSTEM_ALWAYS_FIELDS.includes(code);
    if (!visible) continue;
    result.push({
      fieldCode: code,
      displayName: cfg?.displayName ?? defaultLabel(code),
      visible,
      required: cfg?.required ?? false,
      sortNo: cfg?.sortNo ?? baseOrder.indexOf(code),
      groupName: cfg?.groupName ?? null,
      systemField: cfg?.systemField ?? SYSTEM_ALWAYS_FIELDS.includes(code),
      serverRequired: cfg?.serverRequired ?? false,
      dataType: cfg?.dataType ?? 'string',
      defaultValue: cfg?.defaultValue ?? null,
      options: cfg?.options ?? [],
      version: cfg?.version ?? null,
      id: cfg?.id ?? null,
      updatedAt: cfg?.updatedAt ?? null,
    });
  }
  return [...result].sort((a, b) => a.sortNo - b.sortNo);
});
const tableFieldGroups = computed(() => groupRoomTableFields(tableFields.value));

/** 各字段统一列宽，杜绝表头逐字竖排；系统关键字段（编码/名称/状态/版本/能力）保持核心宽度。 */
const FIELD_WIDTHS: Record<string, number> = {
  roomCode: 160, roomName: 170, shortName: 110, roomType: 120,
  roomGroupId: 120, roomGroupName: 130, campus: 110, floor: 90,
  location: 130, cleanLevel: 110, capabilities: 220,
  defaultAnesthesiaMachine: 160, defaultMonitor: 150, defaultWorkstation: 150,
  stationCapacity: 90, openTime: 100, closeTime: 100,
  schedulePreference: 130, staffPreference: 130, sortNo: 80,
  remark: 160, version: 80, status: 100,
};
function fieldWidth(code: string): number {
  return FIELD_WIDTHS[code] ?? 130;
}
const tableScrollX = computed(() => tableFields.value.reduce((sum, f) => sum + fieldWidth(f.fieldCode), 0) + 160);

function defaultLabel(code: string): string {
  const map: Record<string, string> = {
    roomCode: '手术间编码', roomName: '手术间名称', shortName: '简称', roomType: '类型',
    roomGroupId: '所属手术部', roomGroupName: '手术部名称', campus: '院区', floor: '楼层',
    location: '位置', cleanLevel: '洁净等级', capabilities: '能力', stationCapacity: '台位',
    version: '版本', status: '状态',
  };
  return map[code] ?? code;
}

async function reload() {
  loading.value = true;
  loadError.value = '';
  try {
    // 配置管理页查询全部生命周期状态；业务目录默认只返回 enabled（后端边界）
    const [roomList, cfg] = await Promise.all([
      loadRoomConfigurationList({ allStatus: true }),
      loadHospitalFieldConfig(hospitalCode.value).catch(() => [] as RoomFieldConfigEntry[]),
    ]);
    rooms.value = roomList;
    fieldConfig.value = cfg.map((c) => ({ ...c, options: [...c.options] }));
    source.value = 'remote';
  } catch (error) {
    rooms.value = [];
    source.value = 'local';
    loadError.value = error instanceof Error ? error.message : '未知错误';
  } finally {
    loading.value = false;
  }
}

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions)
      ? result.permissions.map(String)
      : Array.isArray(result)
        ? (result as unknown[]).map(String)
        : [];
  } catch {
    permissions.value = [];
  }
}

function openCreate() {
  editingRoom.value = null;
  editorVisible.value = true;
}
function openEdit(room: RoomConfiguration) {
  editingRoom.value = room;
  editorVisible.value = true;
}
function openHistory(room: RoomConfiguration) {
  historyRoomId.value = room.roomId;
  historyVisible.value = true;
}
function openFieldConfig() {
  fieldConfigVisible.value = true;
}

async function onSaved() {
  editorVisible.value = false;
  await reload();
  try {
    await store.loadRoomCatalog();
  } catch {
    // 门店面目录刷新失败不影响配置页真值
  }
}

async function onFieldConfigSaved() {
  // 字段配置保存后重新 GET，刷新列定义
  await reload();
}

function onChangeStatus(room: RoomConfiguration, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { room, toStatus };
  statusReason.value = '';
  statusModalVisible.value = true;
}

function rowActions(room: RoomConfiguration): ConfigRowAction[] {
  return [
    { key: 'edit', label: '编辑', primary: true, hidden: !canManage.value },
    { key: 'history', label: '历史' },
    { key: 'pause', label: '暂停', hidden: !canManage.value || room.status !== 'enabled' },
    { key: 'enable', label: '启用', hidden: !canManage.value || room.status !== 'paused' },
    { key: 'disable', label: '停用', danger: true, hidden: !canManage.value || room.status === 'disabled' },
  ];
}
function onRowAction(room: RoomConfiguration, key: string) {
  if (key === 'edit') openEdit(room);
  else if (key === 'history') openHistory(room);
  else if (key === 'pause') onChangeStatus(room, 'paused');
  else if (key === 'enable') onChangeStatus(room, 'enabled');
  else if (key === 'disable') onChangeStatus(room, 'disabled');
}

function needsReason(toStatus: string): boolean {
  return toStatus === 'paused' || toStatus === 'disabled';
}

async function confirmStatusChange() {
  const target = statusTarget.value;
  if (!target) return;
  if (needsReason(target.toStatus) && !statusReason.value.trim()) {
    Message.warning('请填写变更原因');
    return;
  }
  statusSaving.value = true;
  try {
    await changeRoomStatus({
      id: target.room.roomId,
      toStatus: target.toStatus,
      reason: statusReason.value.trim(),
      expectedVersion: target.room.version,
    });
    Message.success('状态变更成功');
    statusModalVisible.value = false;
    await reload();
  } catch (error) {
    if (error instanceof RoomConfigConflictError) {
      Message.warning('数据已被其他人修改，请刷新后重试');
      statusModalVisible.value = false;
      await reload();
    } else if (error instanceof Error) {
      Message.error(error.message);
    }
  } finally {
    statusSaving.value = false;
  }
}

function statusLabel(status: string): string {
  return ({ draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status) || '—';
}
function statusColor(status: string): string {
  return { enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[status] ?? 'gray';
}
function formatCell(room: RoomConfiguration, code: string): string {
  const value = (room as unknown as Record<string, unknown>)[code];
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

onMounted(async () => {
  await loadPermissions();
  await reload();
});
</script>

<style scoped>
.cap-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
</style>
