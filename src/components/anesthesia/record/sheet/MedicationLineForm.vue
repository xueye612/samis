<script setup lang="ts">
import { computed } from 'vue';
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';
import {
  LIVE_DEFAULT_SEGMENT_MINUTES,
  addMinutesToClock,
  resolveRecordSheetNowClock,
} from '@/services/anesthesiaRecordEngine';
import { formatSpecialNo } from '@/services/medicationDisplayRules';
import type { DrugDictItem, FluidBloodDictItem } from '@/types/system';
import { SPECIAL_DRUG_CATEGORY_OPTIONS, type SpecialDrugCategory } from '@/types/drugDict';

const props = defineProps<{
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
    isSpecial: boolean;
    recommendIsSpecial: boolean;
    specialCategory: SpecialDrugCategory | '';
    specialReason: string;
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

const isMedication = computed(() => props.form.kind === 'medication');
const isContinuous = computed(() => isMedication.value && props.form.mode === '持续泵入');
const isIntermittent = computed(() => isMedication.value && props.form.mode === '间断追加');
const isPointMode = computed(() => isMedication.value && !isContinuous.value);
const durationPresets = [10, 20, 30] as const;

const selectedDrug = computed(() => props.drugs.find((d) => d.name === props.form.name));

const drugCategoryText = computed(() => {
  const drug = selectedDrug.value;
  if (!drug) return '';
  const cat = SPECIAL_DRUG_CATEGORY_OPTIONS.find((c) => c.value === drug.specialCategory);
  if (cat) return cat.label;
  if (drug.isVasoactive) return '血管活性药';
  if (drug.isRescueDrug) return '抢救药';
  if (drug.isAnticoagulant) return '抗凝/拮抗类';
  if (drug.isObstetricDrug) return '产科特殊用药';
  if (drug.isElectrolyteDrug) return '电解质/内环境';
  if (drug.highAlert) return '高警示麻醉用药';
  return '常规麻醉用药';
});

const systemRecommendTag = computed(() => {
  if (!isMedication.value || !selectedDrug.value) return null;
  if (props.form.recommendIsSpecial) {
    return { tone: 'special' as const, text: '系统推荐：特殊用药' };
  }
  return { tone: 'normal' as const, text: '系统推荐：普通用药' };
});

const specialPreview = computed(() => {
  if (!props.form.isSpecial || !props.form.name) return '';
  const prefix = formatSpecialNo(1);
  const dose = `${props.form.amount ?? ''}${props.form.unit ?? ''}`.trim();
  const route = props.form.route?.trim() ? ` ${props.form.route}` : '';
  const tail = props.form.specialReason?.trim() ? `，${props.form.specialReason}` : '';
  if (isContinuous.value) {
    const end = props.form.endTime || '未结束';
    return `${prefix} ${props.form.time || '--:--'}-${end} ${props.form.name} ${dose}${route}${tail}`.trim();
  }
  return `${prefix} ${props.form.time || '--:--'} ${props.form.name} ${dose}${route}${tail}`.trim();
});

const patch = (key: string, value: unknown) => emit('update:form', { [key]: value });

const selectTriggerProps = { style: { zIndex: 6000 } };

const onDrugChange = (name: string | undefined) => {
  const next = String(name ?? '').trim();
  if (!next || next === props.form.name) return;
  patch('name', next);
  emit('syncMedication');
};

const patchIsSpecial = (checked: boolean) => {
  const next: Record<string, unknown> = { isSpecial: checked, isSpecialUserTouched: true };
  if (!checked) {
    next.specialReason = '';
    next.reason = '';
  } else if (!props.form.specialCategory && selectedDrug.value?.specialCategory) {
    next.specialCategory = selectedDrug.value.specialCategory;
  }
  emit('update:form', next);
};

const patchMode = (mode: string) => {
  if (mode === '持续泵入') {
    const start = props.form.time || resolveRecordSheetNowClock();
    const next: Record<string, unknown> = { mode, time: start };
    if (!props.form.endTime) next.endTime = addMinutesToClock(start, LIVE_DEFAULT_SEGMENT_MINUTES);
    emit('update:form', next);
    return;
  }
  emit('update:form', { mode, endTime: '' });
};

const patchStartTime = (time: string) => {
  const next: Record<string, unknown> = { time };
  if (isContinuous.value && !props.form.endTime) {
    next.endTime = addMinutesToClock(time, LIVE_DEFAULT_SEGMENT_MINUTES);
  }
  emit('update:form', next);
};

const applyDurationPreset = (minutes: number) => {
  const start = props.form.time;
  if (!start) return;
  emit('update:form', { endTime: addMinutesToClock(start, minutes) });
};
</script>

<template>
  <div class="medication-line-form" :class="{ 'is-fluid': !isMedication }">
    <template v-if="isMedication">
      <section class="clinical-block">
        <div class="drug-row">
          <label class="field-label field-label--inline">药品</label>
          <a-select
            class="drug-select"
            :model-value="form.name || undefined"
            allow-search
            placeholder="选择药品"
            popup-container="body"
            :trigger-props="selectTriggerProps"
            @update:model-value="onDrugChange"
          >
            <a-option v-for="drug in drugs" :key="drug.id" :value="drug.name">
              {{ drug.name }}（{{ drug.specification }}）
            </a-option>
          </a-select>
        </div>
        <div v-if="form.name" class="drug-meta">
          <span v-if="drugCategoryText" class="meta-chip">{{ drugCategoryText }}</span>
          <span
            v-if="systemRecommendTag"
            class="recommend-chip"
            :class="systemRecommendTag.tone"
          >{{ systemRecommendTag.text }}</span>
        </div>

        <a-radio-group
          class="mode-switch"
          :model-value="form.mode"
          type="button"
          @update:model-value="patchMode"
        >
          <a-radio value="单次用药">单次给药</a-radio>
          <a-radio value="间断追加">追加一次</a-radio>
          <a-radio value="持续泵入">持续给药</a-radio>
        </a-radio-group>
      </section>

      <section class="clinical-block">
        <div v-if="isPointMode" class="detail-grid detail-grid--point">
          <div class="detail-cell">
            <label class="field-label">给药时间</label>
            <RecordTimeField
              :model-value="form.time"
              @update:model-value="patchStartTime"
              @step="emit('shiftTime', 'time', $event)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">剂量</label>
            <a-input-number
              :model-value="form.amount"
              :min="0"
              hide-button
              @update:model-value="patch('amount', $event ?? 0)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">单位</label>
            <a-input :model-value="form.unit" @update:model-value="patch('unit', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">给药途径</label>
            <a-input :model-value="form.route" @update:model-value="patch('route', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">执行人</label>
            <a-input :model-value="form.executor" @update:model-value="patch('executor', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">核对人</label>
            <a-input :model-value="form.checker" placeholder="可选" @update:model-value="patch('checker', $event)" />
          </div>
        </div>

        <div v-else class="detail-grid detail-grid--continuous">
          <div class="detail-cell">
            <label class="field-label">开始时间</label>
            <RecordTimeField
              :model-value="form.time"
              @update:model-value="patchStartTime"
              @step="emit('shiftTime', 'time', $event)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">结束时间</label>
            <RecordTimeField
              :model-value="form.endTime"
              @update:model-value="patch('endTime', $event)"
              @step="emit('shiftTime', 'endTime', $event)"
            />
          </div>
          <div class="duration-quick span-row">
            <span class="duration-quick-label">快捷时长</span>
            <a-button
              v-for="minutes in durationPresets"
              :key="minutes"
              size="mini"
              type="outline"
              @click="applyDurationPreset(minutes)"
            >{{ minutes }}分</a-button>
          </div>
          <div class="detail-cell">
            <label class="field-label">剂量/浓度</label>
            <a-input-number
              :model-value="form.amount"
              :min="0"
              hide-button
              @update:model-value="patch('amount', $event ?? 0)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">单位</label>
            <a-input :model-value="form.unit" placeholder="如 μg/kg/min" @update:model-value="patch('unit', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">给药途径</label>
            <a-input :model-value="form.route" placeholder="如 泵注" @update:model-value="patch('route', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">执行人</label>
            <a-input :model-value="form.executor" @update:model-value="patch('executor', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">核对人</label>
            <a-input :model-value="form.checker" placeholder="可选" @update:model-value="patch('checker', $event)" />
          </div>
        </div>
      </section>

      <section class="clinical-block clinical-block--special">
        <a-checkbox :model-value="form.isSpecial" @update:model-value="patchIsSpecial">
          记入【辅助及特殊用药】
        </a-checkbox>
        <div v-if="form.isSpecial" class="special-fields">
          <div class="detail-cell">
            <label class="field-label">分类</label>
            <a-select
              :model-value="form.specialCategory || undefined"
              allow-search
              allow-clear
              placeholder="选择分类"
              popup-container="body"
              :trigger-props="selectTriggerProps"
              @update:model-value="patch('specialCategory', $event ?? '')"
            >
              <a-option v-for="item in SPECIAL_DRUG_CATEGORY_OPTIONS" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-option>
            </a-select>
          </div>
          <div class="detail-cell">
            <label class="field-label">说明</label>
            <a-input
              :model-value="form.specialReason"
              placeholder="可选"
              @update:model-value="patch('specialReason', $event); patch('reason', $event)"
            />
          </div>
        </div>
        <p v-if="form.isSpecial && specialPreview" class="special-preview">{{ specialPreview }}</p>
      </section>

    </template>

    <!-- 输液 / 输血：保持紧凑临床表单 -->
    <template v-else>
      <section class="clinical-section">
        <header class="section-head">{{ form.kind === 'transfusion' ? '输血' : '输液' }}</header>
        <div class="field-block">
          <label class="field-label">名称</label>
          <a-select
            :model-value="form.name"
            allow-search
            popup-container="body"
            @update:model-value="patch('name', $event); emit('syncFluid')"
          >
            <a-option v-for="fluid in fluidCatalog" :key="fluid.id" :value="fluid.name">{{ fluid.name }}</a-option>
          </a-select>
        </div>
        <div class="detail-grid detail-grid--continuous">
          <div class="detail-cell">
            <label class="field-label">开始时间</label>
            <RecordTimeField
              :model-value="form.time"
              @update:model-value="patchStartTime"
              @step="emit('shiftTime', 'time', $event)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">结束时间</label>
            <RecordTimeField
              :model-value="form.endTime"
              @update:model-value="patch('endTime', $event)"
              @step="emit('shiftTime', 'endTime', $event)"
            />
          </div>
          <div class="detail-cell">
            <label class="field-label">容量</label>
            <a-input-number :model-value="form.amount" :min="0" hide-button @update:model-value="patch('amount', $event ?? 0)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">单位</label>
            <a-input :model-value="form.unit" @update:model-value="patch('unit', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">执行人</label>
            <a-input :model-value="form.executor" @update:model-value="patch('executor', $event)" />
          </div>
        </div>
      </section>
      <section v-if="form.kind === 'transfusion'" class="clinical-section">
        <header class="section-head">输血核对</header>
        <div class="detail-grid detail-grid--point">
          <div class="detail-cell">
            <label class="field-label">血型</label>
            <a-select :model-value="form.bloodType" allow-clear @update:model-value="patch('bloodType', $event ?? '')">
              <a-option v-for="item in bloodTypes" :key="item" :value="item">{{ item }}</a-option>
            </a-select>
          </div>
          <div class="detail-cell">
            <label class="field-label">Rh</label>
            <a-select :model-value="form.rh" allow-clear @update:model-value="patch('rh', $event ?? '')">
              <a-option v-for="item in rhTypes" :key="item" :value="item">{{ item }}</a-option>
            </a-select>
          </div>
          <div class="detail-cell">
            <label class="field-label">血袋号</label>
            <a-input :model-value="form.bagNo" @update:model-value="patch('bagNo', $event)" />
          </div>
          <div class="detail-cell">
            <label class="field-label">反应</label>
            <a-select :model-value="form.reaction" @update:model-value="patch('reaction', $event)">
              <a-option v-for="item in transfusionReactions" :key="item" :value="item">{{ item }}</a-option>
            </a-select>
          </div>
          <div class="detail-cell span-row">
            <a-space>
              <a-checkbox :model-value="form.anesthesiaConfirmed" @update:model-value="patch('anesthesiaConfirmed', $event)">麻醉医师</a-checkbox>
              <a-checkbox :model-value="form.circulatingConfirmed" @update:model-value="patch('circulatingConfirmed', $event)">巡回护士</a-checkbox>
            </a-space>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.medication-line-form {
  display: grid;
  gap: 10px;
  padding: 0;
}

.clinical-block {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.clinical-block--special {
  border-color: #fde68a;
  background: #fffbeb;
  overflow: visible;
}

.drug-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.drug-select {
  min-width: 0;
}

.field-block {
  display: grid;
  gap: 4px;
}

.field-label {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.field-label--inline {
  margin: 0;
}

.drug-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.meta-chip {
  color: #64748b;
  font-size: 12px;
}

.recommend-chip {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.recommend-chip.normal {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.recommend-chip.special {
  color: #b45309;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.mode-switch {
  width: 100%;
  margin-top: 2px;
}

.mode-switch :deep(.arco-radio-button) {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.detail-grid {
  display: grid;
  gap: 8px 10px;
}

.detail-grid--point,
.detail-grid--continuous {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.span-row {
  grid-column: 1 / -1;
}

.duration-quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.duration-quick-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.special-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 8px 10px;
  margin-top: 4px;
}

.special-preview {
  margin: 0;
  color: #92400e;
  font-size: 11px;
  line-height: 1.4;
}

.medication-line-form :deep(.arco-input-number),
.medication-line-form :deep(.arco-input-wrapper),
.medication-line-form :deep(.arco-select-view-single) {
  min-height: 32px;
}

.medication-line-form :deep(.arco-form-item) {
  margin-bottom: 0;
}

.clinical-section {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.section-head {
  margin: 0 0 8px;
  color: #1e3a5f;
  font-size: 13px;
  font-weight: 700;
}
</style>
