<template>
  <div class="sheet-quick-strip no-print">
    <div class="strip-group strip-entries">
      <span class="strip-label">数据录入</span>
      <a-button size="mini" type="primary" :disabled="disabled('medication')" @click="emit('entry', 'medication')">给药</a-button>
      <a-button size="mini" :disabled="disabled('infusion')" @click="emit('entry', 'infusion')">液体</a-button>
      <a-button size="mini" :disabled="disabled('transfusion')" @click="emit('entry', 'transfusion')">输血</a-button>
      <a-button size="mini" :disabled="disabled('output-urine')" @click="emit('entry', 'output-urine')">出入量</a-button>
      <a-button size="mini" :disabled="disabled('lab')" @click="emit('entry', 'lab')">血气</a-button>
    </div>

    <div class="strip-group strip-events">
      <span class="strip-label">关键事件</span>
      <a-tooltip
        v-for="event in primaryEvents"
        :key="event.name"
        :content="event.title"
        :disabled="!event.title"
      >
        <a-button
          size="mini"
          type="outline"
          :status="event.name === '低血压' ? 'warning' : 'normal'"
          :disabled="event.disabled"
          @click="emit('quick-event', event.name)"
        >
          {{ event.name }}
        </a-button>
      </a-tooltip>
      <a-dropdown v-if="hasMoreEvents" trigger="click">
        <a-button size="mini" type="outline">更多事件</a-button>
        <template #content>
          <a-doption
            v-for="event in moreEvents"
            :key="event.name"
            :disabled="event.disabled"
            @click="emit('quick-event', event.name)"
          >
            {{ event.name }}
          </a-doption>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RecordEntryVisibility } from '@/services/anesthesia/recordActionRules';
import {
  entryActionDisabled,
  type QuickEventButtonState,
  type SheetEntryAction,
} from '@/services/anesthesia/recordQuickActions';

const props = defineProps<{
  entries: RecordEntryVisibility;
  primaryEvents: QuickEventButtonState[];
  moreEvents: QuickEventButtonState[];
  hasMoreEvents: boolean;
}>();

const emit = defineEmits<{
  entry: [action: SheetEntryAction];
  'quick-event': [name: string];
}>();

const disabled = (action: SheetEntryAction) => entryActionDisabled(props.entries, action);
</script>

<style scoped>
.sheet-quick-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 6px;
  padding: 6px 8px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}

.strip-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.strip-events {
  padding-left: 10px;
  border-left: 1px solid #e2e8f0;
}

.strip-label {
  flex-shrink: 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

@media (max-width: 900px) {
  .strip-events {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
