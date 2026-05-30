<script setup lang="ts">
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';
import type { DrugDictItem, FluidBloodDictItem } from '@/types/system';

defineProps<{
  form: {
    kind: 'medication' | 'infusion' | 'transfusion';
    category?: string;
    name: string;
    mode: string;
    time: string;
    endTime: string;
    amount: number;
    unit: string;
    route: string;
    executor: string;
    checker: string;
    bloodType: string;
    rh: string;
    bagNo: string;
    reaction: string;
    anesthesiaConfirmed: boolean;
    circulatingConfirmed: boolean;
  };
  drugs: DrugDictItem[];
  fluidCatalog: FluidBloodDictItem[];
  bloodTypes: string[];
  rhTypes: string[];
  transfusionReactions: string[];
}>();

const emit = defineEmits<{
  'update:form': [patch: Record<string, unknown>];
  syncMedication: [];
  syncFluid: [];
  shiftTime: [field: 'time' | 'endTime', delta: number];
}>();

const patch = (key: string, value: unknown) => emit('update:form', { [key]: value });
</script>

<template>
  <a-form :model="form" layout="vertical" class="record-entry-form">
    <section class="form-section">
      <header class="form-section-title">药品信息</header>
      <a-form-item label="名称" required>
        <a-select
          v-if="form.kind === 'medication'"
          :model-value="form.name"
          allow-search
          @update:model-value="patch('name', $event); emit('syncMedication')"
        >
          <a-option v-for="drug in drugs" :key="drug.id" :value="drug.name">
            {{ drug.name }}（{{ drug.specification }}）
          </a-option>
        </a-select>
        <a-select
          v-else
          :model-value="form.name"
          allow-search
          @update:model-value="patch('name', $event); emit('syncFluid')"
        >
          <a-option v-for="fluid in fluidCatalog" :key="fluid.id" :value="fluid.name">{{ fluid.name }}</a-option>
        </a-select>
      </a-form-item>
      <a-form-item v-if="form.kind === 'medication'" label="类型">
        <a-radio-group
          :model-value="form.mode"
          type="button"
          @update:model-value="patch('mode', $event)"
        >
          <a-radio value="单次用药">单次</a-radio>
          <a-radio value="持续泵入">持续</a-radio>
        </a-radio-group>
      </a-form-item>
    </section>

    <section class="form-section">
      <header class="form-section-title">时间</header>
      <div class="form-grid-2">
        <a-form-item label="开始时间">
          <RecordTimeField
            :model-value="form.time"
            @update:model-value="patch('time', $event)"
            @step="emit('shiftTime', 'time', $event)"
          />
        </a-form-item>
        <a-form-item label="结束时间">
          <RecordTimeField
            :model-value="form.endTime"
            :disabled="form.kind === 'medication' && form.mode === '单次用药'"
            @update:model-value="patch('endTime', $event)"
            @step="emit('shiftTime', 'endTime', $event)"
          />
        </a-form-item>
      </div>
    </section>

    <section class="form-section">
      <header class="form-section-title">剂量与执行</header>
      <div class="form-grid-2">
        <a-form-item label="剂量/容量">
          <a-input-number :model-value="form.amount" :min="0" hide-button @update:model-value="patch('amount', $event ?? 0)" />
        </a-form-item>
        <a-form-item label="单位">
          <a-input :model-value="form.unit" @update:model-value="patch('unit', $event)" />
        </a-form-item>
        <a-form-item v-if="form.kind === 'medication'" label="途径">
          <a-input :model-value="form.route" @update:model-value="patch('route', $event)" />
        </a-form-item>
        <a-form-item label="执行人">
          <a-input :model-value="form.executor" @update:model-value="patch('executor', $event)" />
        </a-form-item>
        <a-form-item v-if="form.kind === 'medication'" label="核对人" class="span-2">
          <a-input :model-value="form.checker" @update:model-value="patch('checker', $event)" />
        </a-form-item>
      </div>
    </section>

    <section v-if="form.kind === 'transfusion'" class="form-section">
      <header class="form-section-title">输血核对</header>
      <div class="form-grid-2">
        <a-form-item label="血型">
          <a-select :model-value="form.bloodType" allow-clear @update:model-value="patch('bloodType', $event ?? '')">
            <a-option v-for="item in bloodTypes" :key="item" :value="item">{{ item }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Rh">
          <a-select :model-value="form.rh" allow-clear @update:model-value="patch('rh', $event ?? '')">
            <a-option v-for="item in rhTypes" :key="item" :value="item">{{ item }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="血袋号">
          <a-input :model-value="form.bagNo" @update:model-value="patch('bagNo', $event)" />
        </a-form-item>
        <a-form-item label="反应">
          <a-select :model-value="form.reaction" @update:model-value="patch('reaction', $event)">
            <a-option v-for="item in transfusionReactions" :key="item" :value="item">{{ item }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="双人核对" class="span-2">
          <a-space>
            <a-checkbox :model-value="form.anesthesiaConfirmed" @update:model-value="patch('anesthesiaConfirmed', $event)">麻醉医师</a-checkbox>
            <a-checkbox :model-value="form.circulatingConfirmed" @update:model-value="patch('circulatingConfirmed', $event)">巡回护士</a-checkbox>
          </a-space>
        </a-form-item>
      </div>
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

.span-2 {
  grid-column: 1 / -1;
}

.record-entry-form :deep(.arco-form-item) {
  margin-bottom: 10px;
}

.record-entry-form :deep(.arco-form-item-label) {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.record-entry-form :deep(.arco-radio-button) {
  min-width: 72px;
  text-align: center;
}
</style>
