<template>
  <ModulePageShell title="手术间管理" description="维护手术间结构化配置、能力、生命周期与医院字段配置" shell-class="config-rooms-page">
    <a-card class="section-card" :bordered="false">
      <template #title>
        <a-space>
          <span>手术间列表</span>
          <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button v-if="canManage" type="primary" @click="openCreate">新增手术间</a-button>
          <a-button @click="fieldConfigVisible = true">字段配置</a-button>
        </a-space>
      </template>

      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">
        加载手术间失败：{{ loadError }}。可点击刷新重试。
      </a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !rooms.length" type="warning" show-icon style="margin-bottom: 12px">
        远程暂无手术间数据，表格为空属正常状态，可在本页新增。
      </a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">
        无手术间配置权限（config.room.manage）；仅可查看，写动作已禁用。
      </a-alert>

      <a-table :data="rooms" row-key="roomId" :loading="loading" :pagination="false" size="medium">
        <template #empty>
          <a-empty description="暂无手术间" />
        </template>
        <template #columns>
          <a-table-column title="编码" data-index="roomCode" />
          <a-table-column title="名称" data-index="roomName" />
          <a-table-column title="位置">
            <template #cell="{ record }">{{ joinLocation(record) }}</template>
          </a-table-column>
          <a-table-column title="能力">
            <template #cell="{ record }">
              <a-space wrap>
                <a-tag v-for="cap in record.capabilities" :key="cap.capabilityType + cap.capabilityCode">
                  {{ cap.capabilityCode }}
                </a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="台位" :width="80">
            <template #cell="{ record }">{{ record.stationCapacity }}</template>
          </a-table-column>
          <a-table-column title="版本" :width="80">
            <template #cell="{ record }">{{ record.version }}</template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="280">
            <template #cell="{ record }">
              <a-space wrap>
                <a-button size="small" @click="openHistory(record)">历史</a-button>
                <a-button v-if="canManage" size="small" @click="openEdit(record)">编辑</a-button>
                <a-button v-if="canManage && record.status === 'enabled'" size="small" @click="onChangeStatus(record, 'paused')">暂停</a-button>
                <a-button v-if="canManage && record.status === 'paused'" size="small" @click="onChangeStatus(record, 'enabled')">启用</a-button>
                <a-button v-if="canManage && record.status !== 'disabled'" size="small" status="warning" @click="onChangeStatus(record, 'disabled')">停用</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <RoomEditorDrawer :visible="editorVisible" :room="editingRoom" @cancel="editorVisible = false" @saved="onSaved" />
    <RoomHistoryDrawer :visible="historyVisible" :room-id="historyRoomId" @cancel="historyVisible = false" />
    <RoomFieldConfigPanel
      :visible="fieldConfigVisible"
      :hospital-code="hospitalCode"
      :can-manage="canManageFieldCfg"
      @cancel="fieldConfigVisible = false"
      @saved="fieldConfigVisible = false"
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
import RoomEditorDrawer from '@/components/config/RoomEditorDrawer.vue';
import RoomHistoryDrawer from '@/components/config/RoomHistoryDrawer.vue';
import RoomFieldConfigPanel from '@/components/config/RoomFieldConfigPanel.vue';
import { authApi } from '@/api/auth';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import {
  loadRoomConfigurationList,
  changeRoomStatus,
  canManageRoom,
  canManageField,
  RoomConfigConflictError,
} from '@/services/configuration/roomConfigurationService';
import type { RoomConfiguration } from '@/services/anesthesia/adapters/roomAdapter';
import { useRealRoom } from '@/config/apiFlags';

const store = useAnesthesiaStore();

const rooms = ref<RoomConfiguration[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);

const editorVisible = ref(false);
const editingRoom = ref<RoomConfiguration | null>(null);
const historyVisible = ref(false);
const historyRoomId = ref<number | null>(null);
const fieldConfigVisible = ref(false);
const hospitalCode = ref('default');
const statusModalVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ room: RoomConfiguration; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

const canManage = computed(() => !useRealRoom() || canManageRoom(permissions.value));
const canManageFieldCfg = computed(() => !useRealRoom() || canManageField(permissions.value));

async function reload() {
  loading.value = true;
  loadError.value = '';
  try {
    rooms.value = await loadRoomConfigurationList();
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

async function onSaved() {
  editorVisible.value = false;
  // 保存成功后强制 GET 回读，替换页面与 store 派生 configRooms；失败不保留乐观假状态。
  await reload();
  try {
    await store.loadRoomCatalog();
  } catch {
    // 门店面目录刷新失败不影响配置页真值
  }
}

function onChangeStatus(room: RoomConfiguration, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { room, toStatus };
  statusReason.value = '';
  statusModalVisible.value = true;
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
  return { draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status;
}
function statusColor(status: string): string {
  return { enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[status] ?? 'gray';
}
function joinLocation(room: RoomConfiguration): string {
  return [room.campus, room.floor, room.location].filter(Boolean).join(' / ') || '—';
}

onMounted(async () => {
  await loadPermissions();
  await reload();
});
</script>
