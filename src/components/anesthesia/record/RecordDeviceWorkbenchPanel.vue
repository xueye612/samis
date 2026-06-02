<template>
  <a-collapse-item key="device" header="设备与同步" class="toolbox-collapse-item device-sync-collapse no-print">
    <div class="device-workbench device-workbench-compact">
      <div class="device-core">
        <div class="device-status-lines">
          <div class="device-line" data-device="monitor">
            <span class="device-name">监护仪</span>
            <strong :class="syncState.monitorRunning ? 'status-running' : 'status-stopped'">
              {{ syncState.monitorRunning ? '运行中' : '已停止' }}
            </strong>
            <a-button
              v-if="!locked"
              size="mini"
              type="text"
              @click="emit('toggle-monitor')"
            >
              {{ syncState.monitorRunning ? '停止' : '启动' }}
            </a-button>
          </div>
          <div class="device-line" data-device="ventilator">
            <span class="device-name">呼吸机</span>
            <strong :class="syncState.ventilatorRunning ? 'status-running' : 'status-stopped'">
              {{ syncState.ventilatorRunning ? '运行中' : '已停止' }}
            </strong>
            <a-button
              v-if="!locked"
              size="mini"
              type="text"
              @click="emit('toggle-ventilator')"
            >
              {{ syncState.ventilatorRunning ? '停止' : '启动' }}
            </a-button>
          </div>
        </div>

        <div class="device-meta-row">
          <span class="meta-item">最近采集 <strong>{{ lastCollectLabel }}</strong></span>
          <span class="interval-chip">采样 {{ effectiveIntervalMinutes }} 分钟/条</span>
        </div>

        <div class="device-actions-compact">
          <a-button size="mini" :disabled="locked" @click="emit('import-vitals')">同步设备</a-button>
          <a-button
            v-if="anyDeviceRunning && !locked"
            size="mini"
            status="warning"
            @click="emit('stop-all-devices')"
          >
            停止全部
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
            <span class="device-label">采样间隔</span>
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
import { computed } from 'vue';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';
import {
  ABNORMAL_SIMULATION_OPTIONS,
  type AbnormalSimulationType,
  type DeviceSimulationMode,
} from '@/services/anesthesia/deviceSimulationMode';

const props = defineProps<{
  syncState: AnesthesiaSyncState;
  monitorDisplayIntervalMinutes: number;
  effectiveIntervalMinutes: number;
  simulationMode: DeviceSimulationMode;
  abnormalTypes: AbnormalSimulationType[];
  locked?: boolean;
  rescueModeActive?: boolean;
  showDevConflictButton?: boolean;
  monitorIntervalOptions: Array<{ label: string; value: number }>;
}>();

const emit = defineEmits<{
  'update:monitorDisplayIntervalMinutes': [value: number];
  'update:simulationMode': [value: DeviceSimulationMode];
  'update:abnormalTypes': [value: AbnormalSimulationType[]];
  'import-vitals': [];
  'toggle-monitor': [];
  'toggle-ventilator': [];
  'stop-all-devices': [];
  'inject-test-conflict': [];
  'open-sync-detail': [];
  'open-conflicts': [];
}>();

const abnormalOptions = ABNORMAL_SIMULATION_OPTIONS;

const lastCollectLabel = computed(() => (
  props.syncState.lastCollectTime ? dayjs(props.syncState.lastCollectTime).format('HH:mm:ss') : '—'
));

const anyDeviceRunning = computed(() => (
  props.syncState.monitorRunning || props.syncState.ventilatorRunning
));

const intervalEditable = computed(() => (
  !props.locked
  && !props.syncState.monitorRunning
  && !props.syncState.ventilatorRunning
  && !props.rescueModeActive
  && props.simulationMode !== 'rescue'
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
