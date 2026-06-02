<template>
  <section class="clinical-entry-panel">
    <header class="panel-head">
      <strong>快捷录入</strong>
      <span v-if="!entries.canEdit" class="locked-hint">已锁定</span>
    </header>
    <div class="entry-grid">
      <a-button size="mini" type="primary" :disabled="disabled('medication')" @click="$emit('entry', 'medication')">给药</a-button>
      <a-button size="mini" :disabled="disabled('vital')" @click="$emit('entry', 'vital')">体征</a-button>
      <a-button size="mini" :disabled="disabled('infusion')" @click="$emit('entry', 'infusion')">液体</a-button>
      <a-button size="mini" :disabled="disabled('transfusion')" @click="$emit('entry', 'transfusion')">输血</a-button>
      <a-button size="mini" :disabled="disabled('output-urine')" @click="$emit('entry', 'output-urine')">尿量</a-button>
      <a-button size="mini" :disabled="disabled('lab')" @click="$emit('entry', 'lab')">血气</a-button>
    </div>
  </section>

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
    <a-space wrap>
      <a-button size="mini" :disabled="!entries.canDeviceControl" @click="$emit('toggle-monitor')">
        {{ monitorRunning ? '停监护仪' : '启监护仪' }}
      </a-button>
      <a-button size="mini" :disabled="!entries.canDeviceControl" @click="$emit('toggle-ventilator')">
        {{ ventilatorRunning ? '停呼吸机' : '启呼吸机' }}
      </a-button>
      <a-button size="mini" :disabled="!entries.canDeviceControl" @click="$emit('import-vitals')">同步设备</a-button>
      <a-button size="mini" type="text" @click="$emit('open-sync-detail')">同步详情</a-button>
      <a-button
        v-if="conflictCount > 0"
        size="mini"
        type="text"
        status="danger"
        @click="$emit('open-conflicts')"
      >
        冲突 {{ conflictCount }}
      </a-button>
    </a-space>
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
import { entryActionDisabled, type SheetEntryAction } from '@/services/anesthesia/recordQuickActions';

const props = defineProps<{
  record: SurgeryCase;
  entries: RecordEntryVisibility;
  monitorRunning?: boolean;
  ventilatorRunning?: boolean;
  conflictCount?: number;
  showDevice?: boolean;
}>();

defineEmits<{
  entry: [action: SheetEntryAction];
  'stop-pump': [medicationId: string];
  'open-data': [list: 'medications' | 'infusions' | 'vitals'];
  'toggle-monitor': [];
  'toggle-ventilator': [];
  'import-vitals': [];
  'open-sync-detail': [];
  'open-conflicts': [];
  'open-quality': [];
}>();

const runningPumps = computed(() => props.record.medications.filter(
  (item: MedicationRecord) => item.mode === '持续泵入' && !item.stopTime,
));

const deviceSummary = computed(() => {
  const parts: string[] = [];
  if (props.monitorRunning) parts.push('监护仪');
  if (props.ventilatorRunning) parts.push('呼吸机');
  return parts.length ? parts.join(' · ') : '未运行';
});

const disabled = (action: SheetEntryAction) => entryActionDisabled(props.entries, action);
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
</style>
