<script setup lang="ts">
import PaperFormField from '@/components/anesthesia/record/sheet/PaperFormField.vue';
import PaperPickerField from '@/components/anesthesia/record/sheet/PaperPickerField.vue';
import AnesthesiaMethodPickerField from '@/components/anesthesia/record/sheet/AnesthesiaMethodPickerField.vue';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaRecordSnapshot } from '@/types/anesthesiaRecord';

defineProps<{
  snapshot: AnesthesiaRecordSnapshot;
  recordNo?: string;
  readOnly?: boolean;
  printMode?: boolean;
  interactionMode?: 'edit' | 'view' | 'print';
  actualSurgeryName?: string;
  surgicalPosition?: string;
  anesthesiologist?: string;
  surgeon?: string;
  circulatingNurses?: string;
  scrubNurses?: string;
  methodPrimary?: AnesthesiaMethodKey;
  methodAuxiliary?: AnesthesiaMethodKey[];
  positionOptions?: string[];
  surgeryOptions?: string[];
  anesthesiologistOptions?: string[];
  surgeonOptions?: string[];
  nurseOptions?: string[];
  fastingStatus?: string;
  preMedications?: string;
  preoperativeConditions?: string;
  surgeryType?: string;
  surgeryLevel?: string;
  postoperativeDiagnosis?: string;
}>();

const emit = defineEmits<{
  'update:actualSurgeryName': [value: string];
  'update:surgicalPosition': [value: string];
  'update:anesthesiologist': [value: string];
  'update:surgeon': [value: string];
  'update:circulatingNurses': [value: string];
  'update:scrubNurses': [value: string];
  applyMethodSelection: [payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }];
  'update:fastingStatus': [value: string];
  'update:preMedications': [value: string];
  'update:preoperativeConditions': [value: string];
  'update:surgeryType': [value: string];
  'update:surgeryLevel': [value: string];
  'update:postoperativeDiagnosis': [value: string];
}>();

const fastingOptions = ['已禁食', '未禁食', '禁食不足', '不适用', '未评估'];
const surgeryTypeOptions = ['择期', '急诊', '日间'];
const surgeryLevelOptions = ['一级', '二级', '三级', '四级'];
const commonPreopConditions = ['高血压', '糖尿病', '高脂血症', '冠心病', '慢性阻塞性肺病', '肾功能不全', '贫血'];
const formatAge = (value: unknown) => {
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 ? `${age}岁` : '—';
};
</script>

<template>
  <div class="record-header">
    <div class="print-heading">
      <div></div>
      <h2>{{ snapshot.hospitalName }}麻醉记录单</h2>
      <div class="doc-meta">
        <span class="meta-label">编号</span>
        <i>{{ recordNo ?? snapshot.recordNo }}</i>
      </div>
    </div>

    <div class="patient-grid">
      <PaperFormField compact label="科别" :model-value="snapshot.department" readonly :print-mode="printMode" :span="4" />
      <PaperFormField compact label="床号" :model-value="snapshot.bedNo ?? '-'" readonly :print-mode="printMode" :span="4" />
      <PaperFormField compact label="住院号" :model-value="snapshot.inpatientNo" readonly :print-mode="printMode" :span="8" />
      <PaperFormField compact label="手术日期" :model-value="snapshot.surgeryDate" readonly :print-mode="printMode" :span="8" />

      <PaperFormField compact label="姓名" :model-value="snapshot.patientName" readonly :print-mode="printMode" :span="5" />
      <PaperFormField compact label="性别" :model-value="snapshot.gender" readonly :print-mode="printMode" :span="3" />
      <PaperFormField compact label="年龄" :model-value="formatAge(snapshot.age)" readonly :print-mode="printMode" :span="4" />
      <PaperFormField compact label="体重" :model-value="`${snapshot.weight}kg`" readonly :print-mode="printMode" :span="4" />
      <PaperFormField compact label="身高" :model-value="`${snapshot.height ?? '-'}cm`" readonly :print-mode="printMode" :span="5" />
      <PaperFormField compact label="血型" :model-value="snapshot.bloodType ?? '-'" readonly :print-mode="printMode" :span="3" />

      <PaperFormField compact label="付费方式" :model-value="snapshot.paymentMethod ?? '未记录'" readonly :print-mode="printMode" :span="8" />
      <PaperFormField compact label="ASA" :model-value="snapshot.asa" readonly :print-mode="printMode" :span="4" />
    </div>

    <section class="header-block preop-block">
      <div class="block-grid">
        <PaperFormField
          compact
          label="术前诊断"
          :model-value="snapshot.diagnosisPreop"
          readonly
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="12"
        />
        <PaperPickerField
          compact
          label="禁食状态"
          :model-value="fastingStatus ?? snapshot.fastingStatus ?? '未评估'"
          :options="fastingOptions"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="5"
          :allow-custom="false"
          @update:model-value="emit('update:fastingStatus', $event)"
        />
        <PaperPickerField
          compact
          multiple
          label="术前用药"
          :model-value="preMedications ?? snapshot.preMedications?.join('、') ?? snapshot.preMedication ?? ''"
          :options="[]"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="7"
          placeholder="无术前用药"
          @update:model-value="emit('update:preMedications', $event)"
        />
        <PaperPickerField
          compact
          multiple
          label="术前状况"
          :model-value="preoperativeConditions ?? snapshot.preoperativeConditions?.join('、') ?? ''"
          :options="commonPreopConditions"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="24"
          placeholder="无特殊情况"
          @update:model-value="emit('update:preoperativeConditions', $event)"
        />
      </div>
    </section>

    <section class="header-block intraop-block">
      <div class="block-grid">
        <PaperFormField
          compact
          label="拟施手术"
          :model-value="snapshot.surgeryPlanned"
          readonly
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="12"
        />
        <PaperPickerField
          compact
          multiple
          numbered
          joiner="+"
          pinyin-search
          label="实施手术"
          :model-value="actualSurgeryName ?? snapshot.surgeryActual ?? snapshot.surgeryPlanned"
          :options="surgeryOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="12"
          placeholder="点击选择，多项用+连接"
          @update:model-value="emit('update:actualSurgeryName', $event)"
        />
        <PaperPickerField
          compact
          label="手术类型"
          :model-value="surgeryType ?? snapshot.surgeryType ?? '择期'"
          :options="surgeryTypeOptions"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="4"
          :allow-custom="false"
          @update:model-value="emit('update:surgeryType', $event)"
        />
        <PaperPickerField
          compact
          label="手术等级"
          :model-value="surgeryLevel ?? snapshot.surgeryLevel ?? ''"
          :options="surgeryLevelOptions"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="4"
          :allow-custom="false"
          placeholder="待评定"
          @update:model-value="emit('update:surgeryLevel', $event)"
        />
        <div class="bmi-field" :class="{ alert: (snapshot.bmi ?? 0) >= 28 }" style="grid-column: span 4">
          <PaperFormField compact label="BMI" :model-value="snapshot.bmi ? String(snapshot.bmi) : '未计算'" readonly :print-mode="printMode" />
        </div>
        <PaperPickerField
          compact
          label="术后诊断"
          :model-value="postoperativeDiagnosis ?? snapshot.diagnosisPostop ?? ''"
          :options="[]"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="12"
          placeholder="待术后确认"
          @update:model-value="emit('update:postoperativeDiagnosis', $event)"
        />

        <PaperPickerField
          compact
          label="手术体位"
          :model-value="surgicalPosition ?? snapshot.surgicalPosition ?? ''"
          :options="positionOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="8"
          placeholder="点击选择体位"
          :allow-custom="false"
          @update:model-value="emit('update:surgicalPosition', $event)"
        />
        <AnesthesiaMethodPickerField
          compact
          :primary="methodPrimary ?? 'general'"
          :auxiliary="methodAuxiliary ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="16"
          @apply="emit('applyMethodSelection', $event)"
        />

        <PaperPickerField
          compact
          multiple
          pinyin-search
          label="麻醉医师"
          :model-value="anesthesiologist ?? snapshot.anesthesiologistName"
          :options="anesthesiologistOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="6"
          placeholder="点击选择"
          :allow-custom="false"
          @update:model-value="emit('update:anesthesiologist', $event)"
        />
        <PaperPickerField
          compact
          multiple
          pinyin-search
          label="手术医师"
          :model-value="surgeon ?? snapshot.surgeonName"
          :options="surgeonOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="6"
          placeholder="点击选择"
          :allow-custom="false"
          @update:model-value="emit('update:surgeon', $event)"
        />
        <PaperPickerField
          compact
          multiple
          pinyin-search
          label="巡回护士"
          :model-value="circulatingNurses ?? snapshot.circulatingNurseNames ?? snapshot.nurseName"
          :options="nurseOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="6"
          placeholder="点击选择"
          :allow-custom="false"
          @update:model-value="emit('update:circulatingNurses', $event)"
        />
        <PaperPickerField
          compact
          multiple
          pinyin-search
          label="洗手护士"
          :model-value="scrubNurses ?? snapshot.scrubNurseNames ?? ''"
          :options="nurseOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :interaction-mode="interactionMode"
          :span="6"
          placeholder="点击选择"
          :allow-custom="false"
          @update:model-value="emit('update:scrubNurses', $event)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.record-header {
  padding: 6px 10px 0;
}

.bmi-field.alert :deep(.paper-field-value) {
  color: #dc2626;
  font-weight: 900;
}

.bmi-field.alert :deep(.paper-form-field) {
  background: #fef2f2;
}

.record-header .print-heading {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 4px;
}

.record-header .print-heading h2 {
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.25;
}

.record-header .doc-meta {
  justify-self: end;
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.record-header .doc-meta i {
  font-style: normal;
  min-width: 56px;
  border-bottom: 1px solid #555;
}

.patient-grid,
.block-grid {
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  gap: 5px 10px;
  font-size: 12px;
}

.patient-grid {
  padding: 7px 0 6px;
  border-top: 1px solid #111827;
}

.header-block {
  border-top: 1px solid #111827;
}

.header-block:last-child {
  border-bottom: 1px solid #111827;
  padding-bottom: 6px;
}

.block-title {
  padding: 5px 0 3px;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.preop-block {
  background: #fafafa;
}

.preop-block .block-grid {
  padding-top: 6px;
}

.block-grid {
  padding-bottom: 6px;
}

.block-grid :deep(.field-full) {
  grid-column: 1 / -1;
}

.intraop-block .block-grid {
  padding-top: 6px;
}

.record-header :deep(.paper-field-label),
.record-header :deep(.paper-picker-label),
.record-header :deep(.paper-field-value),
.record-header :deep(.paper-picker-readonly),
.record-header :deep(.paper-picker-trigger) {
  font-size: 12px;
}

.record-header :deep(.paper-field-label),
.record-header :deep(.paper-picker-label) {
  color: #111827;
  font-weight: 700;
}

.record-header :deep(.paper-field-value),
.record-header :deep(.paper-picker-readonly) {
  min-height: 20px;
  color: #0f172a;
  font-weight: 600;
  border-bottom-color: #94a3b8;
}
</style>
