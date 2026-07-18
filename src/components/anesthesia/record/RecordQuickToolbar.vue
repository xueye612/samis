<template>
  <section v-if="runningPumps.length" class="quick-actions">
    <header>
      <strong>持续泵入</strong>
      <span>{{ runningPumps.length }} 条</span>
    </header>
    <a-space wrap>
      <a-button
        v-for="med in runningPumps"
        :key="med.id"
        size="mini"
        status="warning"
        :disabled="!entries.canEdit"
        @click="$emit('stop-pump', med.id)"
      >
        停 {{ med.drug }}
      </a-button>
    </a-space>
  </section>

  <section v-if="showDevice" class="quick-actions device-quick">
    <header>
      <strong>设备</strong>
      <span>{{ deviceSummary }}</span>
    </header>
    <p v-if="monitoringPaused" class="device-pause-hint">采集已暂停，实时数值将保持在最后一帧。</p>
    <p v-else-if="!monitorRunning && !ventilatorRunning" class="device-start-hint">尚未采集，请先启动已连接的设备</p>
    <div class="device-primary-actions">
      <a-button
        size="small"
        :type="monitorRunning ? 'outline' : 'primary'"
        :status="monitorRunning ? 'danger' : 'normal'"
        :disabled="!entries.canDeviceControl"
        @click="$emit('toggle-monitor')"
      >
        {{ monitorRunning ? '停止监护仪' : '启动监护仪' }}
      </a-button>
      <a-button
        size="small"
        :type="ventilatorRunning ? 'outline' : 'primary'"
        :status="ventilatorRunning ? 'danger' : 'normal'"
        :disabled="!entries.canDeviceControl"
        @click="$emit('toggle-ventilator')"
      >
        {{ ventilatorRunning ? '停止呼吸机' : '启动呼吸机' }}
      </a-button>
    </div>
    <a-space wrap>
      <a-button size="mini" :disabled="!entries.canDeviceControl" @click="$emit('import-vitals')">同步设备</a-button>
      <a-button
        v-if="monitorRunning || ventilatorRunning"
        size="mini"
        status="warning"
        :disabled="!entries.canDeviceControl"
        @click="$emit('pause-all-devices')"
      >
        暂停采集
      </a-button>
      <a-button
        v-if="monitoringPaused"
        size="mini"
        type="primary"
        :disabled="!entries.canDeviceControl"
        @click="$emit('resume-all-devices')"
      >
        继续采集
      </a-button>
      <a-button
        v-if="monitorRunning || ventilatorRunning || monitoringPaused"
        size="mini"
        status="danger"
        :disabled="!entries.canDeviceControl"
        @click="$emit('stop-all-devices')"
      >
        停止采集
      </a-button>
      <a-button size="mini" type="text" @click="$emit('open-sync-detail')">同步详情</a-button>
      <a-button
        v-if="(conflictCount ?? 0) > 0"
        size="mini"
        type="text"
        status="danger"
        @click="$emit('open-conflicts')"
      >
        冲突 {{ conflictCount ?? 0 }}
      </a-button>
    </a-space>
    <div class="device-intervals">
      <label>
        <span>设备读取</span>
        <a-select
          :model-value="rawIntervalSeconds"
          size="mini"
          :options="rawIntervalOptions"
          :disabled="!entries.canDeviceControl"
          @change="$emit('update:raw-interval-seconds', Number($event))"
        />
      </label>
      <label>
        <span>记录入单</span>
        <a-select
          :model-value="displayIntervalMinutes"
          size="mini"
          :options="displayIntervalOptions"
          :disabled="!entries.canDeviceControl"
          @change="$emit('update:display-interval-minutes', Number($event))"
        />
      </label>
    </div>
  </section>

  <section class="quick-actions">
    <header>
      <strong>数据维护</strong>
    </header>
    <a-space wrap>
      <a-button size="mini" :disabled="!entries.canEdit" @click="$emit('open-data', 'medications')">用药列表</a-button>
      <a-button size="mini" :disabled="!entries.canEdit" @click="$emit('open-data', 'infusions')">输液列表</a-button>
      <a-button size="mini" :disabled="!entries.canEdit" @click="$emit('open-data', 'vitals')">体征列表</a-button>
      <a-button size="mini" @click="$emit('open-quality')">质控提醒</a-button>
    </a-space>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MedicationRecord, SurgeryCase } from '@/types/anesthesia';
import type { RecordEntryVisibility } from '@/services/anesthesia/recordActionRules';

const props = defineProps<{
  record: SurgeryCase;
  entries: RecordEntryVisibility;
  monitorRunning?: boolean;
  ventilatorRunning?: boolean;
  monitoringPaused?: boolean;
  conflictCount?: number;
  showDevice?: boolean;
  rawIntervalSeconds?: number;
  displayIntervalMinutes?: number;
  rawIntervalOptions?: Array<{ label: string; value: number }>;
  displayIntervalOptions?: Array<{ label: string; value: number }>;
}>();

defineEmits<{
  'stop-pump': [medicationId: string];
  'open-data': [list: 'medications' | 'infusions' | 'vitals'];
  'toggle-monitor': [];
  'toggle-ventilator': [];
  'pause-all-devices': [];
  'resume-all-devices': [];
  'stop-all-devices': [];
  'update:raw-interval-seconds': [value: number];
  'update:display-interval-minutes': [value: number];
  'import-vitals': [];
  'open-sync-detail': [];
  'open-conflicts': [];
  'open-quality': [];
}>();

const runningPumps = computed(() => props.record.medications.filter(
  (item: MedicationRecord) => item.mode === '持续泵入' && !item.stopTime,
));

const deviceSummary = computed(() => {
  if (props.monitoringPaused) return '已暂停';
  const parts: string[] = [];
  if (props.monitorRunning) parts.push('监护仪');
  if (props.ventilatorRunning) parts.push('呼吸机');
  return parts.length ? parts.join(' · ') : '未运行';
});
</script>

<style scoped>
.clinical-entry-panel,
.quick-actions {
  padding: 10px 12px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #fff;
}

.clinical-entry-panel + .quick-actions,
.quick-actions + .quick-actions {
  margin-top: 8px;
}

.panel-head,
.quick-actions header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
}

.panel-head strong,
.quick-actions header strong {
  color: #0f172a;
}

.locked-hint {
  color: #f53f3f;
  font-size: 11px;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.device-quick :deep(.arco-btn) {
  padding-inline: 8px;
}

.device-intervals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.device-start-hint {
  margin: 0 0 6px;
  color: #92400e;
  font-size: 11px;
  line-height: 1.35;
}

.device-pause-hint {
  margin: 0 0 6px;
  color: #b45309;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
}

.device-primary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 6px;
}

.device-primary-actions :deep(.arco-btn) {
  font-weight: 700;
}

.device-intervals label {
  display: grid;
  grid-template-columns: auto minmax(76px, 1fr);
  gap: 5px;
  align-items: center;
  color: #64748b;
  font-size: 11px;
}
</style>
