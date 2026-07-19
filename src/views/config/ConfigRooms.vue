<template>
  <ModulePageShell title="手术间目录" description="核心手术间由手术护理系统维护，麻醉系统读取房间、能力、设备与生命周期信息" shell-class="config-rooms-page">
    <ConfigTableShell title="手术间列表">
      <template #title-tag>
        <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? 'HULI 真实数据' : '未连接' }}</a-tag>
        <a-tag color="gray">只读</a-tag>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button @click="openFieldConfig">字段配置</a-button>
        </a-space>
      </template>

      <template #alerts>
        <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">
          加载手术间失败：{{ loadError }}。可点击刷新重试。
        </a-alert>
        <a-alert v-else-if="!loading && source === 'remote' && !rooms.length" type="warning" show-icon style="margin-bottom: 12px">
          HULI 暂无手术间数据，本页不会使用本地默认房间补造。
        </a-alert>
        <a-alert v-if="source === 'remote'" type="info" show-icon style="margin-bottom: 12px">
          核心手术间新增、编辑、暂停和停用请在手术护理系统处理；麻醉系统只保留读取与医院显示字段配置。
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
                <span v-else-if="field.fieldCode === 'equipment'">
                  <a-tag v-for="device in record.equipment" :key="device.deviceId" :color="device.status === 'enabled' ? 'green' : 'gray'">
                    {{ device.deviceName || device.deviceCode }}
                  </a-tag>
                  <span v-if="!record.equipment.length">未绑定</span>
                </span>
                <a-tag v-else-if="field.fieldCode === 'status'" :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
                <span v-else class="cell-ellipsis" :title="formatCell(record, field.fieldCode)">{{ formatCell(record, field.fieldCode) }}</span>
              </template>
            </a-table-column>
          </a-table-column>
          <a-table-column title="操作" :width="200" :fixed="rooms.length ? 'right' : undefined">
            <template #cell="{ record }">
              <ConfigRowActions :actions="[{ key: 'history', label: '历史', primary: true }]" @action="() => openHistory(record)" />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </ConfigTableShell>

    <RoomHistoryDrawer :visible="historyVisible" :room-id="historyRoomId" @cancel="historyVisible = false" />
    <RoomFieldConfigPanel
      :visible="fieldConfigVisible"
      :hospital-code="hospitalCode"
      :can-manage="canManageFieldCfg"
      @cancel="fieldConfigVisible = false"
      @saved="onFieldConfigSaved"
    />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import ConfigTableShell from '@/components/config/ConfigTableShell.vue';
import ConfigRowActions from '@/components/config/ConfigRowActions.vue';
import RoomHistoryDrawer from '@/components/config/RoomHistoryDrawer.vue';
import RoomFieldConfigPanel from '@/components/config/RoomFieldConfigPanel.vue';
import { authApi } from '@/api/auth';
import {
  loadRoomConfigurationList,
  loadHospitalFieldConfig,
  canManageField,
  groupRoomTableFields,
  type RoomFieldConfigEntry,
} from '@/services/configuration/roomConfigurationService';
import type { RoomConfiguration } from '@/services/anesthesia/adapters/roomAdapter';

const rooms = ref<RoomConfiguration[]>([]);
const fieldConfig = ref<RoomFieldConfigEntry[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);

const historyVisible = ref(false);
const historyRoomId = ref<number | null>(null);
const fieldConfigVisible = ref(false);
const hospitalCode = ref(resolveHospitalCode());

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

const canManageFieldCfg = computed(() => canManageField(permissions.value));

/** 表格列：按医院字段配置的显示名/显示/排序控制；系统关键字段（编码/状态/版本）与能力核心列始终可见，不可隐藏。 */
const SYSTEM_ALWAYS_FIELDS = [
  'roomCode', 'roomName', 'roomType', 'roomGroupName', 'location',
  'stationCapacity', 'openTime', 'closeTime', 'capabilities', 'equipment', 'status', 'version',
];
const tableFields = computed<RoomFieldConfigEntry[]>(() => {
  const cfgMap = new Map(fieldConfig.value.map((f) => [f.fieldCode, f]));
  const baseOrder = ['roomCode', 'roomName', 'shortName', 'roomType', 'roomGroupId', 'roomGroupName', 'campus', 'floor', 'location', 'cleanLevel', 'emergencyCapable', 'negativePressure', 'hybridRoom', 'capabilities', 'equipment', 'defaultAnesthesiaMachine', 'defaultMonitor', 'defaultWorkstation', 'stationCapacity', 'openTime', 'closeTime', 'schedulePreference', 'staffPreference', 'sortNo', 'remark', 'version', 'status'];
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
  location: 130, cleanLevel: 110, capabilities: 220, equipment: 240,
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
    location: '位置', cleanLevel: '洁净等级', capabilities: '业务能力', equipment: '已绑定物理设备', stationCapacity: '台位数量',
    emergencyCapable: '急诊能力', negativePressure: '负压', hybridRoom: '复合手术间',
    defaultAnesthesiaMachine: '默认麻醉机', defaultMonitor: '默认监护仪', defaultWorkstation: '默认工作站',
    openTime: '开放时间', closeTime: '关闭时间', schedulePreference: '排班偏好',
    staffPreference: '人员偏好', sortNo: '排序', remark: '备注', version: '版本', status: '状态',
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

function openHistory(room: RoomConfiguration) {
  historyRoomId.value = room.roomId;
  historyVisible.value = true;
}
function openFieldConfig() {
  fieldConfigVisible.value = true;
}

async function onFieldConfigSaved() {
  // 字段配置保存后重新 GET，刷新列定义
  await reload();
}

function statusLabel(status: string): string {
  return ({ draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status) || '—';
}
function statusColor(status: string): string {
  return { enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[status] ?? 'gray';
}
function formatCell(room: RoomConfiguration, code: string): string {
  if (code === 'roomType') {
    if (room.roomTypeName && room.roomType) return `${room.roomTypeName}（${room.roomType}）`;
    return room.roomTypeName || room.roomType || '—';
  }
  if (code === 'roomGroupId' && room.roomGroupName) {
    return room.roomGroupId ? `${room.roomGroupName}（${room.roomGroupId}）` : room.roomGroupName;
  }
  const value = (room as unknown as Record<string, unknown>)[code];
  if (value === null || value === undefined || value === '') return '未配置';
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
