<template>
  <a-collapse-item key="device" header="设备与同步（详情）" class="toolbox-collapse-item device-sync-collapse no-print">
    <div class="device-workbench device-workbench-compact">
      <a-alert
        v-if="deviceSimRescueMismatch"
        type="warning"
        show-icon
        banner
        class="device-rescue-mismatch-alert"
      >
        设备模拟仍处于抢救频率，请切换为「正常」采集。
      </a-alert>
      <a-alert
        v-if="monitoringView?.sessionOnOtherCase"
        type="info"
        show-icon
        banner
        class="device-session-alert"
      >
        其他患者（{{ monitoringView.sessionOwnerLabel }}）监护会话仍在进行，数据不会写入当前记录单。
      </a-alert>
      <a-alert
        v-if="monitoringView?.monitoringPaused && !monitoringView.sessionOnOtherCase"
        type="warning"
        show-icon
        banner
        class="device-session-alert"
      >
        监护会话已暂停模拟采集，已采集数据仍归属本记录单。可点击「恢复」或重新启动。
      </a-alert>
      <div class="device-core">
        <div class="device-status-lines">
          <div class="device-line" data-device="monitor">
            <span class="device-name">监护仪</span>
            <strong :class="monitorStatusClass">
              {{ monitorStatusLabel }}
            </strong>
            <a-button
              v-if="!locked"
              size="small"
              :type="monitorStatusLabel === '运行中' ? 'outline' : 'primary'"
              :status="monitorStatusLabel === '运行中' ? 'danger' : 'normal'"
              @click="emit('toggle-monitor')"
            >
              {{ monitorActionLabel }}监护仪
            </a-button>
          </div>
          <div class="device-line" data-device="ventilator">
            <span class="device-name">呼吸机</span>
            <strong :class="ventilatorStatusClass">
              {{ ventilatorStatusLabel }}
            </strong>
            <a-button
              v-if="!locked"
              size="small"
              :type="ventilatorStatusLabel === '运行中' ? 'outline' : 'primary'"
              :status="ventilatorStatusLabel === '运行中' ? 'danger' : 'normal'"
              @click="emit('toggle-ventilator')"
            >
              {{ ventilatorActionLabel }}呼吸机
            </a-button>
          </div>
        </div>

        <div class="device-meta-row">
          <span class="meta-item">最近采集 <strong>{{ lastCollectLabel }}</strong></span>
          <span class="interval-chip">入单 {{ effectiveIntervalMinutes }} 分钟/条</span>
        </div>

        <div class="device-actions-compact">
          <a-button size="mini" :disabled="locked" @click="emit('import-vitals')">同步设备</a-button>
          <a-button
            v-if="anyDeviceRunning && !locked"
            size="mini"
            status="warning"
            @click="emit('pause-all-devices')"
          >
            暂停采集
          </a-button>
          <a-button
            v-if="monitoringView?.monitoringPaused && !locked"
            size="mini"
            type="primary"
            @click="emit('resume-all-devices')"
          >
            继续采集
          </a-button>
          <a-button
            v-if="anyDeviceSession && !locked"
            size="mini"
            status="warning"
            @click="emit('stop-all-devices')"
          >
            停止监护
          </a-button>
        </div>

        <div v-if="!locked && anyDeviceSession" class="device-revoke-row">
          <a-input
            v-model="revokeReasonDraft"
            size="mini"
            placeholder="撤销原因（误绑定/误采集）"
            allow-clear
          />
          <a-button
            size="mini"
            type="outline"
            status="danger"
            :disabled="!revokeReasonDraft.trim()"
            @click="emit('revoke-monitoring', revokeReasonDraft.trim())"
          >
            撤销监护
          </a-button>
        </div>

        <div class="device-links-row">
          <a-button size="mini" type="text" @click="emit('open-sync-detail')">同步详情</a-button>
          <a-button
            v-if="syncState.conflictCount > 0"
            size="mini"
            type="text"
            status="danger"
            @click="emit('open-conflicts')"
          >
            冲突 {{ syncState.conflictCount }}
          </a-button>
          <button
            v-if="syncState.failedCount > 0"
            type="button"
            class="sync-fail-link"
            @click="emit('open-sync-detail')"
          >
            同步失败，点击查看
          </button>
        </div>
      </div>

      <details v-if="!locked" class="device-sim-details">
        <summary>模拟设置</summary>
        <div class="sim-details-body">
          <div class="device-row">
            <span class="device-label">模拟模式</span>
            <a-radio-group
              :model-value="simulationMode"
              size="mini"
              type="button"
              @change="(value) => emit('update:simulationMode', String(value) as DeviceSimulationMode)"
            >
              <a-radio value="normal">正常</a-radio>
              <a-radio value="abnormal">异常</a-radio>
              <a-radio value="rescue">抢救</a-radio>
            </a-radio-group>
          </div>
          <div v-if="simulationMode === 'abnormal'" class="device-row abnormal-types">
            <span class="device-label">异常类型</span>
            <a-checkbox-group
              :model-value="abnormalTypes"
              size="mini"
              @change="(values) => emit('update:abnormalTypes', values as AbnormalSimulationType[])"
            >
              <a-checkbox v-for="item in abnormalOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-checkbox>
            </a-checkbox-group>
          </div>
          <div v-if="intervalEditable" class="device-row">
            <span class="device-label">设备读取</span>
            <a-select
              :model-value="rawIntervalSeconds"
              size="mini"
              class="device-interval-select"
              :options="rawIntervalOptions"
              @change="(value) => emit('update:rawIntervalSeconds', Number(value))"
            />
          </div>
          <div v-if="intervalEditable" class="device-row">
            <span class="device-label">记录入单</span>
            <a-select
              :model-value="monitorDisplayIntervalMinutes"
              size="mini"
              class="device-interval-select"
              :options="monitorIntervalOptions"
              @change="(value) => emit('update:monitorDisplayIntervalMinutes', Number(value))"
            />
          </div>
        </div>
      </details>

      <a-button
        v-if="showDevConflictButton"
        size="mini"
        type="outline"
        status="warning"
        class="dev-conflict-button"
        @click="emit('inject-test-conflict')"
      >
        注入测试冲突
      </a-button>
    </div>
  </a-collapse-item>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';
import type { MonitoringViewUi } from '@/services/anesthesia/monitoringSessionService';
import {
  ABNORMAL_SIMULATION_OPTIONS,
  type AbnormalSimulationType,
  type DeviceSimulationMode,
} from '@/services/anesthesia/deviceSimulationMode';

const props = defineProps<{
  syncState: AnesthesiaSyncState;
  monitorDisplayIntervalMinutes: number;
  rawIntervalSeconds: number;
  effectiveIntervalMinutes: number;
  simulationMode: DeviceSimulationMode;
  abnormalTypes: AbnormalSimulationType[];
  locked?: boolean;
  rescueModeActive?: boolean;
  showDevConflictButton?: boolean;
  monitorIntervalOptions: Array<{ label: string; value: number }>;
  rawIntervalOptions: Array<{ label: string; value: number }>;
  monitoringView?: MonitoringViewUi;
}>();

const emit = defineEmits<{
  'update:monitorDisplayIntervalMinutes': [value: number];
  'update:rawIntervalSeconds': [value: number];
  'update:simulationMode': [value: DeviceSimulationMode];
  'update:abnormalTypes': [value: AbnormalSimulationType[]];
  'import-vitals': [];
  'toggle-monitor': [];
  'toggle-ventilator': [];
  'pause-all-devices': [];
  'resume-all-devices': [];
  'stop-all-devices': [];
  'revoke-monitoring': [reason: string];
  'inject-test-conflict': [];
  'open-sync-detail': [];
  'open-conflicts': [];
}>();

const revokeReasonDraft = ref('');

const abnormalOptions = ABNORMAL_SIMULATION_OPTIONS;

const lastCollectLabel = computed(() => (
  props.syncState.lastCollectTime ? dayjs(props.syncState.lastCollectTime).format('HH:mm:ss') : '—'
));

const anyDeviceRunning = computed(() => props.monitoringView?.mockTicking ?? (
  props.syncState.monitorRunning || props.syncState.ventilatorRunning
));

const anyDeviceSession = computed(() => (
  props.monitoringView?.hasMonitorSession
  || props.monitoringView?.hasVentilatorSession
  || anyDeviceRunning.value
));

const monitorStatusLabel = computed(() => {
  if (props.monitoringView?.mockTicking && props.monitoringView.hasMonitorSession) return '运行中';
  if (props.monitoringView?.monitoringPaused && props.monitoringView.hasMonitorSession) return '已暂停';
  if (props.monitoringView?.hasMonitorSession) return '会话中';
  return props.syncState.monitorRunning ? '运行中' : '已停止';
});

const ventilatorStatusLabel = computed(() => {
  if (props.monitoringView?.mockTicking && props.monitoringView.hasVentilatorSession) return '运行中';
  if (props.monitoringView?.monitoringPaused && props.monitoringView.hasVentilatorSession) return '已暂停';
  if (props.monitoringView?.hasVentilatorSession) return '会话中';
  return props.syncState.ventilatorRunning ? '运行中' : '已停止';
});

const monitorStatusClass = computed(() => (
  monitorStatusLabel.value === '运行中' ? 'status-running' : 'status-stopped'
));
const ventilatorStatusClass = computed(() => (
  ventilatorStatusLabel.value === '运行中' ? 'status-running' : 'status-stopped'
));

const monitorActionLabel = computed(() => {
  if (props.monitoringView?.mockTicking && props.monitoringView.hasMonitorSession) return '停止';
  if (props.monitoringView?.monitoringPaused && props.monitoringView.hasMonitorSession) return '恢复';
  return props.monitoringView?.hasMonitorSession ? '启动' : '启动';
});

const ventilatorActionLabel = computed(() => {
  if (props.monitoringView?.mockTicking && props.monitoringView.hasVentilatorSession) return '停止';
  if (props.monitoringView?.monitoringPaused && props.monitoringView.hasVentilatorSession) return '恢复';
  return '启动';
});

const intervalEditable = computed(() => (
  !props.locked
  && !props.syncState.monitorRunning
  && !props.syncState.ventilatorRunning
  && !props.rescueModeActive
  && props.simulationMode !== 'rescue'
));

const deviceSimRescueMismatch = computed(() => (
  !props.rescueModeActive && props.simulationMode === 'rescue'
));
</script>

<style scoped>
.device-workbench-compact {
  display: grid;
  gap: 8px;
}

.device-core {
  display: grid;
  gap: 8px;
  max-height: 160px;
}

.device-status-lines {
  display: grid;
  gap: 4px;
}

.device-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  font-size: 12px;
}

.device-name {
  color: var(--text-tertiary);
  min-width: 42px;
}

.device-line strong {
  flex: 1;
  font-size: 12px;
}

.status-running {
  color: var(--text-primary);
}

.status-stopped {
  color: var(--text-tertiary);
  font-weight: 500;
}

.device-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.device-session-alert {
  margin-bottom: 8px;
}

.device-revoke-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.meta-item strong {
  color: var(--text-primary);
  font-weight: 600;
}

.interval-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.device-actions-compact,
.device-links-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.sync-fail-link {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
}

.device-sim-details {
  border-top: 1px dashed var(--border);
  padding-top: 6px;
  font-size: 12px;
}

.device-sim-details summary {
  cursor: pointer;
  color: var(--text-tertiary);
  user-select: none;
}

.sim-details-body {
  display: grid;
  gap: 8px;
  padding-top: 8px;
}

.device-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.device-row.abnormal-types {
  flex-direction: column;
}

.device-label {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  line-height: 28px;
}

.device-interval-select {
  width: 108px;
}

.dev-conflict-button {
  justify-self: start;
}
</style>
