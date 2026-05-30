<template>
  <section v-if="runningPumps.length" class="quick-actions">
    <header>
      <strong>持续泵入</strong>
      <span>{{ runningPumps.length }} 条进行中</span>
    </header>
    <a-space wrap>
      <a-button
        v-for="med in runningPumps"
        :key="med.id"
        size="small"
        status="warning"
        :disabled="locked"
        @click="$emit('stop-pump', med.id)"
      >
        停止 {{ med.drug }}
      </a-button>
    </a-space>
  </section>

  <section class="quick-actions">
    <header>
      <strong>纸面维护</strong>
      <span>打开已录入数据列表</span>
    </header>
    <a-space wrap>
      <a-button size="small" :disabled="locked" @click="$emit('open-data', 'medications')">用药维护</a-button>
      <a-button size="small" :disabled="locked" @click="$emit('open-data', 'infusions')">输液维护</a-button>
      <a-button size="small" :disabled="locked" @click="$emit('open-data', 'vitals')">体征维护</a-button>
    </a-space>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MedicationRecord, SurgeryCase } from '@/types/anesthesia';

const props = defineProps<{
  record: SurgeryCase;
  locked?: boolean;
}>();

defineEmits<{
  'stop-pump': [medicationId: string];
  'open-data': [list: 'medications' | 'infusions' | 'vitals'];
}>();

const runningPumps = computed(() => props.record.medications.filter((item: MedicationRecord) => item.mode === '持续泵入' && !item.stopTime));
</script>

<style scoped>
.quick-actions {
  padding: 10px 12px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #fff;
}

.quick-actions + .quick-actions {
  margin-top: 10px;
}

.quick-actions header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
}

.quick-actions header strong {
  color: #0f172a;
}
</style>
