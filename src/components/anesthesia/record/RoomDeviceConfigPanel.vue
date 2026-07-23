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
const emit = defineEmits<{ 'config-changed': [] }>();

const loading = ref(false);
const rooms = ref<RoomDeviceConfigListItem[]>([]);
const options = ref<{ rooms: RoomDeviceOption[]; deviceTypes: string[]; deviceCandidates: HuliDeviceCandidate[] }>({ rooms: [], deviceTypes: ['ventilator'], deviceCandidates: [] });
const selectedRoomId = ref<number | null>(null);
const roomKeyword = ref('');

const DEVICE_TYPE_LABEL: Record<string, string> = { ventilator: '呼吸机/麻醉机', monitor: '监护仪', anesthesia_machine: '麻醉机' };
const deviceTypeLabel = (code: string) => DEVICE_TYPE_LABEL[code] ?? code;
const DISPLAY_DEVICE_TYPES = ['monitor', 'ventilator'] as const;

const filteredRooms = computed(() => {
  const kw = roomKeyword.value.trim().toLowerCase();
  if (!kw) return rooms.value;
  return rooms.value.filter((r) => r.roomName.toLowerCase().includes(kw) || r.roomCode.toLowerCase().includes(kw));
});
const selected = computed(() => rooms.value.find((r) => r.roomId === selectedRoomId.value) ?? null);

const refresh = async () => {
  loading.value = true;
  try {
    const [listRes, optRes] = await Promise.all([anesthesiaRoomDeviceConfigApi.list(), anesthesiaRoomDeviceConfigApi.options()]);
    rooms.value = listRes.list;
    options.value = { rooms: optRes.rooms, deviceTypes: optRes.deviceTypes, deviceCandidates: optRes.deviceCandidates };
    if ((selectedRoomId.value === null || !rooms.value.some((r) => r.roomId === selectedRoomId.value)) && rooms.value.length) {
      selectedRoomId.value = rooms.value[0].roomId;
    }
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

// 候选过滤：停用/被其他房间占用由后端 selectable 决定；当前房间主设备不能再次选为备用设备。
const deviceOptions = computed(() => options.value.deviceCandidates.map((cand) => {
  const isCurrentPrimary = selected.value?.primaryDevice?.sourceDeviceId === cand.deviceId;
  const disabled = !cand.selectable || isCurrentPrimary;
  let reason = cand.disabledReason;
  if (isCurrentPrimary) reason = '当前手术间主设备，不能作为备用';
  if (!cand.deviceName) {
    // 不因 deviceName 为空过滤，仍展示编号/型号
  }
  return {
    value: cand.deviceId,
    label: `${cand.deviceCode}${cand.deviceName ? ` · ${cand.deviceName}` : ''}${cand.deviceModel ? ` · ${cand.deviceModel}` : ''}`,
    disabled,
    reason: disabled ? (reason ?? '不可选择') : null,
    cand,
  } as { value: number; label: string; disabled: boolean; reason: string | null; cand: HuliDeviceCandidate };
}));
const selectableDeviceOptions = computed(() => deviceOptions.value.filter((o) => !o.disabled));

const openCreate = (room: RoomDeviceConfigListItem, role: 'primary' | 'secondary', deviceType = 'ventilator') => {
  editorMode.value = role === 'secondary' ? 'secondary' : 'create';
  form.value = { roomId: room.roomId, sourceDeviceId: 0, deviceType, deviceRole: role, centralDeviceNo: '', reason: '' };
  editorVisible.value = true;
};
const openReplace = (room: RoomDeviceConfigListItem, deviceType = 'ventilator') => {
  editorMode.value = 'replace';
  form.value = { roomId: room.roomId, sourceDeviceId: 0, deviceType, deviceRole: 'primary', centralDeviceNo: '', reason: '更换主设备' };
  editorVisible.value = true;
};
const openEditCentral = (cfg: RoomDeviceConfig) => {
  editorMode.value = 'central';
  form.value = { roomId: cfg.roomId, sourceDeviceId: cfg.sourceDeviceId, deviceType: cfg.deviceType, deviceRole: cfg.deviceRole, centralDeviceNo: cfg.centralDeviceNo, reason: '修改中央采集编号' };
  editorVisible.value = true;
};

const canSubmit = computed(() => form.value.sourceDeviceId > 0 && form.value.reason.trim() !== '');

const confirmSave = () => {
  if (!canSubmit.value) {
    Message.warning(form.value.sourceDeviceId <= 0 ? '请选择设备' : '请填写变更原因');
    return;
  }
  // 保存前展示变更预览二次确认
  const roomName = selected.value?.roomName ?? '';
  const lines = [
    `手术间：${roomName}`,
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
    emit('config-changed');
  } catch (e) {
    Message.error((e as Error)?.message ?? '保存失败');
  }
};

// ---- 移除 ----
const removeConfig = (cfg: RoomDeviceConfig) => {
  const reason = window.prompt('请输入移除原因（必填，设备维修或移出手术间）') ?? '';
  if (!reason.trim()) { if (reason !== null) Message.warning('请填写移除原因'); return; }
  Modal.confirm({
    title: '确认移除该配置',
    content: '将结束该配置有效期（不物理删除，不修改 HULI 设备目录，不影响已进行病例的 binding）。',
    onOk: async () => {
      try {
        await anesthesiaRoomDeviceConfigApi.remove({ configId: cfg.configId, reason });
        Message.success('已移除配置');
        refresh();
        emit('config-changed');
      } catch (e) {
        Message.error((e as Error)?.message ?? '移除失败');
      }
    },
  });
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
    <!-- 独立工具栏：标题 + 说明 + 刷新，正常流式不覆盖 -->
    <header class="rdc-toolbar">
      <div class="rdc-toolbar-main">
        <strong>手术间设备配置</strong>
        <span class="rdc-hint">SAMIS 采集配置，HULI 设备编号和型号只读</span>
      </div>
      <a-button size="mini" :loading="loading" @click="refresh">刷新</a-button>
    </header>

    <div class="rdc-body">
      <aside class="rdc-rooms">
        <div class="rdc-rooms-head">
          <span>手术间</span>
          <a-input-search v-model="roomKeyword" size="mini" placeholder="搜索手术间" :allow-clear="true" class="rdc-search" />
        </div>
        <div class="rdc-rooms-list">
          <button
            v-for="room in filteredRooms"
            :key="room.roomId"
            type="button"
            class="rdc-room-item"
            :class="{ active: room.roomId === selectedRoomId, [`status-${room.configStatus}`]: true }"
            @click="selectedRoomId = room.roomId"
          >
            <span class="rdc-room-name">{{ room.roomName }}</span>
            <a-tag v-if="room.configStatus === 'configured'" color="green" size="small">已配置</a-tag>
            <a-tag v-else-if="room.configStatus === 'conflict'" color="red" size="small">异常</a-tag>
            <a-tag v-else color="gray" size="small">未配置</a-tag>
          </button>
          <div v-if="!filteredRooms.length" class="rdc-empty">无匹配手术间</div>
        </div>
      </aside>

      <section v-if="selected" class="rdc-detail">
        <div v-if="selected.anomalies.length" class="rdc-anomalies">
          <a-alert v-for="(msg, i) in selected.anomalies" :key="i" type="warning" show-icon>{{ msg }}</a-alert>
        </div>

        <!-- 按设备用途分组：监护仪 / 呼吸机或麻醉机，各自独立配置 -->
        <div v-for="dt in DISPLAY_DEVICE_TYPES" :key="dt" class="rdc-section">
          <div class="rdc-section-head">
            <strong>{{ deviceTypeLabel(dt) }}</strong>
            <div v-if="!readonly" class="rdc-section-actions">
              <a-button v-if="(selected.deviceConfigs?.[dt]?.primaryDevice) ?? null" size="mini" type="primary" @click="openReplace(selected, dt)">更换主设备</a-button>
              <a-button v-else size="mini" type="primary" @click="openCreate(selected, 'primary', dt)">配置主{{ deviceTypeLabel(dt) }}</a-button>
              <a-button size="mini" @click="openCreate(selected, 'secondary', dt)">添加备用</a-button>
            </div>
          </div>
          <div v-if="(selected.deviceConfigs?.[dt]?.primaryDevice) ?? null" class="rdc-fields">
            <div><span>设备编号</span><strong>{{ selected.deviceConfigs[dt].primaryDevice!.deviceCode }}</strong></div>
            <div><span>设备型号</span><strong>{{ selected.deviceConfigs[dt].primaryDevice!.deviceModel || '—' }}</strong></div>
            <div><span>中央采集编号</span><strong>{{ selected.deviceConfigs[dt].primaryDevice!.centralDeviceNo || '—' }}</strong></div>
            <div><span>配置状态</span><strong :class="{ 'is-active': selected.deviceConfigs[dt].primaryDevice!.enabled }">{{ selected.deviceConfigs[dt].primaryDevice!.enabled ? '启用' : '已停用' }}</strong></div>
            <div><span>最近修改</span><strong>{{ selected.deviceConfigs[dt].primaryDevice!.updatedAt ?? '—' }}</strong></div>
            <div v-if="!readonly" class="rdc-field-actions">
              <a-button size="mini" @click="openEditCentral(selected.deviceConfigs[dt].primaryDevice!)">修改中央采集编号</a-button>
              <a-button size="mini" status="danger" @click="removeConfig(selected.deviceConfigs[dt].primaryDevice!)">移除</a-button>
            </div>
          </div>
          <div v-else class="rdc-empty">未配置主{{ deviceTypeLabel(dt) }}</div>
          <!-- 备用设备 -->
          <div v-if="(selected.deviceConfigs?.[dt]?.secondaryDevices ?? []).length" class="rdc-secondary-list">
            <div v-for="sec in (selected.deviceConfigs[dt]?.secondaryDevices ?? [])" :key="sec.configId" class="rdc-secondary-item">
              <span>{{ sec.deviceCode }} · {{ sec.deviceModel || '—' }} · {{ sec.centralDeviceNo || '—' }}</span>
              <a-button v-if="!readonly" size="mini" status="danger" @click="removeConfig(sec)">移除</a-button>
            </div>
          </div>
        </div>

        <div class="rdc-section">
          <a-button size="mini" @click="openHistory(selected)">查看配置历史</a-button>
        </div>
      </section>
      <section v-else class="rdc-detail rdc-empty">请选择左侧手术间</section>
    </div>

    <!-- 保存配置（含变更预览）。下拉层挂到弹窗内容，保证在抽屉之上可点击。 -->
    <a-modal v-model:visible="editorVisible" :title="editorMode === 'central' ? '修改中央采集编号' : (editorMode === 'secondary' ? '添加备用设备' : (editorMode === 'replace' ? '更换主设备' : '首次配置'))" :on-before-ok="() => { confirmSave(); return false; }" ok-text="预览并保存" :width="520" :mask-closable="false">
      <div class="rdc-form">
        <div class="rdc-field">
          <span>手术间</span>
          <a-input :model-value="selected?.roomName ?? ''" readonly />
        </div>
        <label v-if="editorMode !== 'central'" class="rdc-field">
          <span>选择设备（HULI 编号/型号只读）</span>
          <a-select
            v-model="form.sourceDeviceId"
            placeholder="选择设备"
            popup-container="body"
            allow-search
          >
            <a-option
              v-for="opt in deviceOptions"
              :key="opt.value"
              :value="opt.value"
              :disabled="opt.disabled"
            >
              {{ opt.label }}<span v-if="opt.reason" class="rdc-occupied">（{{ opt.reason }}）</span>
            </a-option>
            <template #empty>
              <span class="rdc-empty-opt">无可用设备（设备可能均已停用或被其他手术间占用）</span>
            </template>
          </a-select>
          <small v-if="!selectableDeviceOptions.length && form.sourceDeviceId === 0" class="rdc-empty-note">当前无可选设备：停用/被占用设备均不可选择，但可在上方列表查看原因。</small>
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
/* 独立工具栏 + 左右流式布局，不使用绝对定位覆盖；抽屉只保留一个主滚动（rdc-body 外层滚动）。 */
.room-device-config { display: grid; grid-template-rows: auto 1fr; gap: 10px; min-height: 0; }
.room-device-config.embedded { height: 100%; }
.rdc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-bottom: 8px; border-bottom: 1px solid #eef2f7; }
.rdc-toolbar-main { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
.rdc-toolbar strong { font-size: 14px; }
.rdc-hint { color: #64748b; font-size: 11px; }
.rdc-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 12px; min-height: 0; overflow: visible; }
.rdc-rooms { display: flex; flex-direction: column; min-height: 0; max-height: 100%; padding: 6px; border: 1px solid #e5edf5; border-radius: 8px; background: #f8fafc; }
.rdc-rooms-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 4px 6px; }
.rdc-rooms-head span { color: #64748b; font-size: 12px; flex: none; }
.rdc-search { flex: 1 1 auto; min-width: 80px; }
/* 左侧列表独立滚动，不遮挡右侧 */
.rdc-rooms-list { display: grid; gap: 4px; align-content: start; overflow-y: auto; min-height: 0; flex: 1 1 auto; }
.rdc-room-item { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border: 1px solid transparent; border-radius: 6px; background: #fff; text-align: left; cursor: pointer; }
.rdc-room-item.active { border-color: #165dff; background: #f6fbff; }
.rdc-room-item.status-conflict { background: #fff7f5; }
.rdc-room-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.rdc-detail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.rdc-anomalies { display: grid; gap: 6px; }
.rdc-first-config { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 18px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #334155; }
.rdc-first-config p { margin: 0; font-size: 13px; }
.rdc-section { display: grid; gap: 8px; padding: 10px; border: 1px solid #e5edf5; border-radius: 8px; background: #fff; }
.rdc-section-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
.rdc-section-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.rdc-field-actions { display: flex; gap: 6px; grid-column: 1 / -1; padding-top: 4px; }
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
.rdc-field > span, .rdc-field > .rdc-field-title { color: #475569; font-size: 12px; }
.rdc-empty-note { color: #b45309; font-size: 11px; }
.rdc-empty-opt { display: inline-block; padding: 8px; color: #94a3b8; font-size: 12px; }
@media (max-width: 760px) { .rdc-body { grid-template-columns: 1fr; } .rdc-rooms { max-height: 240px; } }
</style>
