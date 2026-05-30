<script setup lang="ts">
import PaperFormField from '@/components/anesthesia/record/sheet/PaperFormField.vue';
import PaperPickerField from '@/components/anesthesia/record/sheet/PaperPickerField.vue';
import AnesthesiaMethodPickerField from '@/components/anesthesia/record/sheet/AnesthesiaMethodPickerField.vue';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaRecordSnapshot, TimeAxisPageConfig } from '@/types/anesthesiaRecord';

defineProps<{
  snapshot: AnesthesiaRecordSnapshot;
  page: TimeAxisPageConfig;
  recordNo?: string;
  readOnly?: boolean;
  printMode?: boolean;
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
}>();

const emit = defineEmits<{
  'update:actualSurgeryName': [value: string];
  'update:surgicalPosition': [value: string];
  'update:anesthesiologist': [value: string];
  'update:surgeon': [value: string];
  'update:circulatingNurses': [value: string];
  'update:scrubNurses': [value: string];
  applyMethodSelection: [payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }];
}>();
</script>

<template>
  <div class="record-header">
    <div class="print-heading">
      <div></div>
      <h2>{{ snapshot.hospitalName }}麻醉记录单</h2>
      <div class="doc-meta">
        <span class="meta-label">编号</span>
        <i>{{ recordNo ?? snapshot.recordNo }}</i>
        <strong>第{{ page.pageNo }}/{{ page.pageCount }}页</strong>
      </div>
    </div>

    <div class="patient-grid">
      <PaperFormField compact label="科别" :model-value="snapshot.department" readonly :print-mode="printMode" />
      <PaperFormField compact label="床号" :model-value="snapshot.bedNo ?? '-'" readonly :print-mode="printMode" />
      <PaperFormField compact label="住院号" :model-value="snapshot.inpatientNo" readonly :print-mode="printMode" />
      <PaperFormField compact label="手术日期" :model-value="snapshot.surgeryDate" readonly :print-mode="printMode" />
      <PaperFormField compact label="付费方式" :model-value="snapshot.paymentMethod ?? '未记录'" readonly :print-mode="printMode" />
      <PaperFormField compact label="ASA" :model-value="snapshot.asa" readonly :print-mode="printMode" />

      <PaperFormField compact label="姓名" :model-value="snapshot.patientName" readonly :print-mode="printMode" />
      <PaperFormField compact label="性别" :model-value="snapshot.gender" readonly :print-mode="printMode" />
      <PaperFormField compact label="年龄" :model-value="`${snapshot.age}岁`" readonly :print-mode="printMode" />
      <PaperFormField compact label="体重" :model-value="`${snapshot.weight}kg`" readonly :print-mode="printMode" />
      <PaperFormField compact label="身高" :model-value="`${snapshot.height ?? '-'}cm`" readonly :print-mode="printMode" />
      <PaperFormField compact label="血型" :model-value="snapshot.bloodType ?? '-'" readonly :print-mode="printMode" />
    </div>

    <section class="header-block preop-block">
      <div class="block-title">术前信息</div>
      <div class="block-grid">
        <PaperFormField
          class="field-full"
          compact
          label="术前诊断"
          :model-value="snapshot.diagnosisPreop"
          readonly
          :print-mode="printMode"
          :span="6"
        />
        <PaperFormField
          compact
          label="术前用药"
          :model-value="snapshot.preMedication || '未记录'"
          readonly
          :print-mode="printMode"
          :span="4"
        />
        <PaperFormField
          compact
          label="术前禁食"
          :model-value="snapshot.fasting || '未记录'"
          readonly
          :print-mode="printMode"
          :span="2"
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
          :span="3"
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
          :span="3"
          placeholder="点击选择，多项用+连接"
          @update:model-value="emit('update:actualSurgeryName', $event)"
        />

        <PaperPickerField
          compact
          label="手术体位"
          :model-value="surgicalPosition ?? snapshot.surgicalPosition ?? ''"
          :options="positionOptions ?? []"
          :readonly="readOnly"
          :print-mode="printMode"
          :span="2"
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
          :span="4"
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
  padding: 4px 8px 0;
}

.record-header .print-heading {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-bottom: 2px;
}

.record-header .print-heading h2 {
  margin: 0;
  text-align: center;
  font-size: 16px;
  line-height: 1.2;
}

.record-header .doc-meta {
  justify-self: end;
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
}

.record-header .doc-meta i {
  font-style: normal;
  min-width: 56px;
  border-bottom: 1px solid #555;
}

.record-header .doc-meta strong {
  margin-left: 6px;
  font-size: 13px;
}

.patient-grid,
.block-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px 6px;
  font-size: 11px;
}

.patient-grid {
  padding: 4px 0;
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
  padding: 4px 0 2px;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.preop-block {
  background: #fafafa;
}

.preop-block .block-title {
  padding-left: 2px;
}

.block-grid {
  padding-bottom: 4px;
}

.block-grid :deep(.field-full) {
  grid-column: 1 / -1;
}

.intraop-block .block-grid {
  padding-top: 4px;
}
</style>
