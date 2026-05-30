<script setup lang="ts">
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';

defineProps<{
  form: {
    time: string;
    type: string;
    volume: number;
    remark: string;
  };
}>();

const emit = defineEmits<{
  'update:form': [patch: Record<string, unknown>];
  shiftTime: [delta: number];
}>();

const patch = (key: string, value: unknown) => emit('update:form', { [key]: value });
</script>

<template>
  <a-form :model="form" layout="vertical" class="record-entry-form">
    <section class="form-section">
      <header class="form-section-title">出入量记录</header>
      <a-form-item label="时间">
        <RecordTimeField
          :model-value="form.time"
          @update:model-value="patch('time', $event)"
          @step="emit('shiftTime', $event)"
        />
      </a-form-item>
      <div class="form-grid-2">
        <a-form-item label="类型">
          <a-select :model-value="form.type" @update:model-value="patch('type', $event)">
            <a-option value="尿量">尿量</a-option>
            <a-option value="出血量">出血量</a-option>
            <a-option value="引流量">引流量</a-option>
            <a-option value="其他">其他</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="容量 ml">
          <a-input-number :model-value="form.volume" :min="0" hide-button @update:model-value="patch('volume', $event ?? 0)" />
        </a-form-item>
      </div>
      <a-form-item label="备注">
        <a-input :model-value="form.remark" placeholder="可选" @update:model-value="patch('remark', $event)" />
      </a-form-item>
    </section>
  </a-form>
</template>

<style scoped>
.record-entry-form {
  display: grid;
  gap: 14px;
}

.form-section {
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fafcff;
}

.form-section-title {
  margin-bottom: 10px;
  color: #12385f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.record-entry-form :deep(.arco-form-item) {
  margin-bottom: 10px;
}

.record-entry-form :deep(.arco-form-item-label) {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
</style>
