<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import {
  anesthesiaRoomDeviceConfigApi,
  type HuliDeviceCandidate,
  type RoomDeviceConfig,
  type RoomDeviceConfigListItem,
  type RoomDeviceOption,
} from '@/api/anesthesiaRoomDeviceConfig';

// 该面板归属 SAMIS 麻醉系统：手术间关联、设备用途、主备角色、中央采集编号由 SAMIS 维护；
// HULI 设备编号/型号只读引用，用户不可在此修改护理设备主数据。

const props = defineProps<{ embedded?: boolean }>();

const loading = ref(false);
const rooms = ref<RoomDeviceConfigListItem[]>([]);
const options = ref<{ rooms: RoomDeviceOption[]; deviceTypes: string[]; deviceCandidates: HuliDeviceCandidate[] }>({ rooms: [], deviceTypes: ['ventilator'], deviceCandidates: [] });
const selectedRoomId = ref<number | null>(null);

const DEVICE_TYPE_LABEL: Record<string, string> = { ventilator: '呼吸机', monitor: '监护仪', anesthesia_machine: '麻醉机' };
const deviceTypeLabel = (code: string) => DEVICE_TYPE_LABEL[code] ?? code;

const selected = computed(() => rooms.value.find((r) => r.roomId === selectedRoomId.value) ?? null);

const refresh = async () => {
  loading.value = true;
  try {
    const [listRes, optRes] = await Promise.all([anesthesiaRoomDeviceConfigApi.list(), anesthesiaRoomDeviceConfigApi.options()]);
    rooms.value = listRes.list;
    options.value = { rooms: optRes.rooms, deviceTypes: optRes.deviceTypes, deviceCandidates: optRes.deviceCandidates };
    if (selectedRoomId.value === null && rooms.value.length) selectedRoomId.value = rooms.value[0].roomId;
  } catch (e) {
    Message.error((e as Error)?.message ?? '加载手术间设备配置失败');
  } finally {
    loading.value = false;
  }
};
onMounted(refresh);

// ---- 编辑/保存 ----
const editorVisible = ref(false);
const editorMode = ref<'create' | 'replace' | 'secondary' | 'central'>('create');
const form = ref({ roomId: 0, sourceDeviceId: 0, deviceType: 'ventilator', deviceRole: 'primary' as 'primary' | 'secondary', centralDeviceNo: '', reason: '' });
const targetDevice = computed(() => options.value.deviceCandidates.find((d) => d.deviceId === form.value.sourceDeviceId) ?? null);
const oldPrimary = computed(() => selected.value?.primaryDevice ?? null);

const openCreate = (room: RoomDeviceConfigListItem, role: 'primary' | 'secondary') => {
  editorMode.value = role === 'secondary' ? 'secondary' : 'create';
  form.value = { roomId: room.roomId, sourceDeviceId: 0, deviceType: 'ventilator', deviceRole: role, centralDeviceNo: '', reason: '' };
  editorVisible.value = true;
};
const openReplace = (room: RoomDeviceConfigListItem) => {
  editorMode.value = 'replace';
  form.value = { roomId: room.roomId, sourceDeviceId: 0, deviceType: 'ventilator', deviceRole: 'primary', centralDeviceNo: '', reason: '更换主设备' };
  editorVisible.value = true;
};
const openEditCentral = (cfg: RoomDeviceConfig) => {
  editorMode.value = 'central';
  form.value = { roomId: cfg.roomId, sourceDeviceId: cfg.sourceDeviceId, deviceType: cfg.deviceType, deviceRole: cfg.deviceRole, centralDeviceNo: cfg.centralDeviceNo, reason: '修改中央采集编号' };
  editorVisible.value = true;
};

const canSubmit = computed(() => form.value.sourceDeviceId > 0 && form.value.reason.trim() !== '');

const confirmSave = () => {
  // 保存前展示变更预览二次确认
  const lines = [
    `手术间：${selected.value?.roomName ?? ''}`,
    oldPrimary.value ? `原设备：${oldPrimary.value.deviceCode} / ${oldPrimary.value.deviceModel}` : '原设备：无（首次配置）',
    targetDevice.value ? `新设备：${targetDevice.value.deviceCode} / ${targetDevice.value.deviceModel}` : '新设备：未选择',
    `中央采集编号：${form.value.centralDeviceNo || (targetDevice.value?.deviceCode ?? '')}`,
    `设备类型：${deviceTypeLabel(form.value.deviceType)}`,
    `角色：${form.value.deviceRole === 'primary' ? '主设备' : '备用设备'}`,
    `变更原因：${form.value.reason}`,
  ];
  Modal.confirm({
    title: '确认保存手术间设备配置',
    content: lines.join('<br>'),
    okText: '保存',
    onOk: () => doSave(),
  });
};
const doSave = async () => {
  try {
    await anesthesiaRoomDeviceConfigApi.save({
      roomId: form.value.roomId,
      sourceDeviceId: form.value.sourceDeviceId,
      deviceType: form.value.deviceType,
      deviceRole: form.value.deviceRole,
      centralDeviceNo: form.value.centralDeviceNo,
      reason: form.value.reason,
    });
    Message.success('已保存手术间设备配置（仅影响后续新病例）');
    editorVisible.value = false;
    refresh();
  } catch (e) {
    Message.error((e as Error)?.message ?? '保存失败');
  }
};

// ---- 移除 ----
const removeConfig = (cfg: RoomDeviceConfig) => {
  let reason = '';
  Modal.confirm({
    title: '移除该配置',
    content: '将结束该配置有效期（不物理删除，不修改 HULI 设备目录，不影响已进行病例的 binding）。',
    onOk: async () => {
      if (!reason.trim()) { Message.warning('请填写移除原因'); return false; }
      try {
        await anesthesiaRoomDeviceConfigApi.remove({ configId: cfg.configId, reason });
        Message.success('已移除配置');
        refresh();
      } catch (e) {
        Message.error((e as Error)?.message ?? '移除失败');
      }
      return true;
    },
  });
  // arco confirm 无内置输入，用 prompt 简化
  reason = window.prompt('请输入移除原因（必填）') ?? '';
};

// ---- 历史 ----
const historyVisible = ref(false);
const historyList = ref<RoomDeviceConfig[]>([]);
const openHistory = async (room: RoomDeviceConfigListItem) => {
  try {
    const res = await anesthesiaRoomDeviceConfigApi.history({ roomId: room.roomId });
    historyList.value = res.list;
    historyVisible.value = true;
  } catch (e) {
    Message.error((e as Error)?.message ?? '加载历史失败');
  }
};

const readonly = computed(() => Boolean((window as unknown as { __SAMIS_READONLY__?: boolean }).__SAMIS_READONLY__));
</script>

<template>
  <div class="room-device-config" :class="{ embedded: props.embedded }" data-testid="room-device-config">
    <header class="rdc-head">
      <strong>手术间设备配置</strong>
      <span class="rdc-hint">SAMIS 采集配置 · HULI 设备编号/型号只读引用</span>
      <a-button size="mini" :loading="loading" @click="refresh">刷新</a-button>
    </header>

    <div class="rdc-body">
      <aside class="rdc-rooms">
        <div class="rdc-rooms-head">手术间</div>
        <button
          v-for="room in rooms"
          :key="room.roomId"
          type="button"
          class="rdc-room-item"
          :class="{ active: room.roomId === selectedRoomId }"
          @click="selectedRoomId = room.roomId"
        >
          <span class="rdc-room-name">{{ room.roomName }}</span>
          <a-tag v-if="room.hasPrimaryVentilator" color="green" size="small">已配主设备</a-tag>
          <a-tag v-else color="gray" size="small">未配置</a-tag>
          <a-badge v-if="room.anomalies.length" :count="room.anomalies.length" status="warning" />
        </button>
      </aside>

      <section v-if="selected" class="rdc-detail">
        <div v-if="selected.anomalies.length" class="rdc-anomalies">
          <a-alert v-for="(msg, i) in selected.anomalies" :key="i" type="warning" show-icon>{{ msg }}</a-alert>
        </div>

        <div class="rdc-section">
          <div class="rdc-section-head">
            <strong>主设备</strong>
            <a-button v-if="!readonly" size="mini" type="primary" @click="selected.primaryDevice ? openReplace(selected) : openCreate(selected, 'primary')">
              {{ selected.primaryDevice ? '更换主设备' : '首次配置' }}
            </a-button>
          </div>
          <div v-if="selected.primaryDevice" class="rdc-fields">
            <div><span>设备编号</span><strong>{{ selected.primaryDevice.deviceCode }}</strong></div>
            <div><span>设备型号</span><strong>{{ selected.primaryDevice.deviceModel || '—' }}</strong></div>
            <div><span>设备用途</span><strong>{{ deviceTypeLabel(selected.primaryDevice.deviceType) }}</strong></div>
            <div><span>中央采集编号</span><strong>{{ selected.primaryDevice.centralDeviceNo || '—' }}</strong></div>
            <div><span>配置状态</span><strong :class="{ 'is-active': selected.primaryDevice.enabled }">{{ selected.primaryDevice.enabled ? '启用' : '已停用' }}</strong></div>
            <div><span>最近修改</span><strong>{{ selected.primaryDevice.updatedAt ?? '—' }}</strong></div>
          </div>
          <div v-else class="rdc-empty">未配置主设备，新病例入室后将无法自动关联。</div>
          <div v-if="selected.primaryDevice && !readonly" class="rdc-actions">
            <a-button size="mini" @click="openEditCentral(selected.primaryDevice)">修改中央采集编号</a-button>
            <a-button size="mini" status="danger" @click="removeConfig(selected.primaryDevice)">移除配置</a-button>
          </div>
        </div>

        <div class="rdc-section">
          <div class="rdc-section-head">
            <strong>备用设备</strong>
            <a-button v-if="!readonly" size="mini" @click="openCreate(selected, 'secondary')">添加备用设备</a-button>
          </div>
          <div v-if="selected.secondaryDevices.length" class="rdc-secondary-list">
            <div v-for="sec in selected.secondaryDevices" :key="sec.configId" class="rdc-secondary-item">
              <span>{{ sec.deviceCode }} · {{ sec.deviceModel || '—' }} · {{ sec.centralDeviceNo || '—' }}</span>
              <a-button v-if="!readonly" size="mini" status="danger" @click="removeConfig(sec)">移除</a-button>
            </div>
          </div>
          <div v-else class="rdc-empty">无备用设备</div>
        </div>

        <div class="rdc-section">
          <a-button size="mini" @click="openHistory(selected)">查看配置历史</a-button>
        </div>
      </section>
      <section v-else class="rdc-detail rdc-empty">请选择左侧手术间</section>
    </div>

    <!-- 保存配置（含变更预览） -->
    <a-modal v-model:visible="editorVisible" :title="editorMode === 'central' ? '修改中央采集编号' : (editorMode === 'secondary' ? '添加备用设备' : (editorMode === 'replace' ? '更换主设备' : '首次配置'))" :on-before-ok="() => { confirmSave(); return false; }" ok-text="预览并保存" :width="520">
      <div class="rdc-form">
        <label v-if="editorMode !== 'central'" class="rdc-field">
          <span>选择设备（HULI 编号/型号只读）</span>
          <a-select v-model="form.sourceDeviceId" placeholder="选择设备" popup-container="body">
            <a-option
              v-for="cand in options.deviceCandidates"
              :key="cand.deviceId"
              :value="cand.deviceId"
              :disabled="cand.occupied !== null && cand.occupied.roomId !== form.roomId"
            >
              {{ cand.deviceCode }} · {{ cand.deviceModel }}<span v-if="cand.occupied" class="rdc-occupied">（已用于{{ cand.occupied.roomName }}）</span>
            </a-option>
          </a-select>
        </label>
        <label class="rdc-field">
          <span>设备用途</span>
          <a-select v-model="form.deviceType" popup-container="body" :disabled="editorMode === 'central'">
            <a-option v-for="t in options.deviceTypes" :key="t" :value="t">{{ deviceTypeLabel(t) }}</a-option>
          </a-select>
        </label>
        <div class="rdc-field">
          <span>主/备用</span>
          <a-radio-group v-model="form.deviceRole" :disabled="editorMode === 'central' || editorMode === 'replace'">
            <a-radio value="primary">主设备</a-radio>
            <a-radio value="secondary">备用设备</a-radio>
          </a-radio-group>
        </div>
        <label class="rdc-field">
          <span>中央采集设备编号（可独立于 HULI 编号）</span>
          <a-input v-model="form.centralDeviceNo" :placeholder="targetDevice?.deviceCode ?? '默认复制 HULI 设备编号'" />
        </label>
        <label class="rdc-field">
          <span>变更原因（必填）</span>
          <a-input v-model="form.reason" placeholder="如：首次配置 / 设备维修更换" />
        </label>
      </div>
    </a-modal>

    <!-- 配置历史 -->
    <a-modal v-model:visible="historyVisible" title="手术间设备配置历史" :footer="false" :width="620">
      <a-table :data="historyList" :pagination="false" size="small" row-key="configId">
        <template #columns>
          <a-table-column title="设备编号" data-index="deviceCode" />
          <a-table-column title="型号" data-index="deviceModel" />
          <a-table-column title="角色">
            <template #cell="{ record }">{{ record.deviceRole === 'primary' ? '主' : '备' }}</template>
          </a-table-column>
          <a-table-column title="中央编号" data-index="centralDeviceNo" />
          <a-table-column title="状态">
            <template #cell="{ record }">{{ record.enabled ? '启用' : '已停用' }}</template>
          </a-table-column>
          <a-table-column title="生效" data-index="effectiveFrom" />
          <a-table-column title="结束" data-index="effectiveTo" />
          <a-table-column title="原因" data-index="changeReason" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.room-device-config { display: grid; grid-template-rows: auto 1fr; gap: 10px; height: 100%; min-height: 0; }
.room-device-config.embedded { height: auto; }
.rdc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rdc-head strong { font-size: 14px; }
.rdc-hint { color: #64748b; font-size: 11px; }
.rdc-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; min-height: 0; }
.rdc-rooms { display: grid; gap: 4px; align-content: start; padding: 6px; border: 1px solid #e5edf5; border-radius: 8px; background: #f8fafc; max-height: 100%; overflow-y: auto; }
.rdc-rooms-head { color: #64748b; font-size: 12px; padding: 2px 4px; }
.rdc-room-item { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border: 1px solid transparent; border-radius: 6px; background: #fff; text-align: left; cursor: pointer; }
.rdc-room-item.active { border-color: #165dff; background: #f6fbff; }
.rdc-room-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rdc-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.rdc-anomalies { display: grid; gap: 6px; }
.rdc-section { display: grid; gap: 8px; padding: 10px; border: 1px solid #e5edf5; border-radius: 8px; background: #fff; }
.rdc-section-head { display: flex; align-items: center; justify-content: space-between; }
.rdc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
.rdc-fields > div { display: grid; gap: 2px; }
.rdc-fields span { color: #64748b; font-size: 11px; }
.rdc-fields strong { color: #0f172a; font-size: 13px; word-break: break-all; }
.rdc-fields .is-active { color: #16a34a; }
.rdc-actions { display: flex; gap: 8px; }
.rdc-secondary-list { display: grid; gap: 6px; }
.rdc-secondary-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border: 1px solid #e5edf5; border-radius: 6px; font-size: 12px; }
.rdc-empty { color: #94a3b8; font-size: 12px; padding: 6px 0; }
.rdc-occupied { color: #b45309; }
.rdc-form { display: grid; gap: 10px; }
.rdc-field { display: grid; gap: 4px; }
.rdc-field > span { color: #475569; font-size: 12px; }
@media (max-width: 760px) { .rdc-body { grid-template-columns: 1fr; } }
</style>
