<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import PaperFormField from '@/components/anesthesia/record/sheet/PaperFormField.vue';
import PaperPickerField from '@/components/anesthesia/record/sheet/PaperPickerField.vue';
import AnesthesiaMethodPickerField from '@/components/anesthesia/record/sheet/AnesthesiaMethodPickerField.vue';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaRecordSnapshot } from '@/types/anesthesiaRecord';
import {
  resolveDisplaySurgery,
  resolveHeaderRiskFlags,
  resolveSurgeryChanged,
} from '@/services/anesthesia/recordHeaderSummary';

const props = defineProps<{
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
  // 摘要补充字段：屏幕模式折叠为单行所需的风险与扩展信息。
  allergy?: string;
  difficultAirway?: string;
  methodLabel?: string;
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
  dirtyChange: [dirty: boolean];
}>();

const fastingOptions = ['已禁食', '未禁食', '禁食不足', '不适用', '未评估'];
const surgeryTypeOptions = ['择期', '急诊', '日间'];
const surgeryLevelOptions = ['一级', '二级', '三级', '四级'];
const commonPreopConditions = ['高血压', '糖尿病', '高脂血症', '冠心病', '慢性阻塞性肺病', '肾功能不全', '贫血'];
const formatAge = (value: unknown) => {
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 ? `${age}岁` : '—';
};

// ---- 折叠摘要 / 编辑草稿 ----
// 屏幕模式默认折叠为单行摘要；打印模式与展开编辑态始终渲染完整标准表头。
interface HeaderDraft {
  fastingStatus: string;
  preMedications: string;
  preoperativeConditions: string;
  actualSurgeryName: string;
  surgeryType: string;
  surgeryLevel: string;
  postoperativeDiagnosis: string;
  surgicalPosition: string;
  methodPrimary: AnesthesiaMethodKey;
  methodAuxiliary: AnesthesiaMethodKey[];
  anesthesiologist: string;
  surgeon: string;
  circulatingNurses: string;
  scrubNurses: string;
}

const expanded = ref(false);
const draft = ref<HeaderDraft | null>(null);

const summaryMode = computed(() => !props.printMode && !expanded.value);

const collectDraft = (): HeaderDraft => ({
  fastingStatus: props.fastingStatus ?? props.snapshot.fastingStatus ?? '未评估',
  preMedications: props.preMedications ?? props.snapshot.preMedications?.join('、') ?? props.snapshot.preMedication ?? '',
  preoperativeConditions: props.preoperativeConditions ?? props.snapshot.preoperativeConditions?.join('、') ?? '',
  actualSurgeryName: props.actualSurgeryName ?? props.snapshot.surgeryActual ?? props.snapshot.surgeryPlanned ?? '',
  surgeryType: props.surgeryType ?? props.snapshot.surgeryType ?? '择期',
  surgeryLevel: props.surgeryLevel ?? props.snapshot.surgeryLevel ?? '',
  postoperativeDiagnosis: props.postoperativeDiagnosis ?? props.snapshot.diagnosisPostop ?? '',
  surgicalPosition: props.surgicalPosition ?? props.snapshot.surgicalPosition ?? '',
  methodPrimary: props.methodPrimary ?? 'general',
  methodAuxiliary: props.methodAuxiliary ? [...props.methodAuxiliary] : [],
  anesthesiologist: props.anesthesiologist ?? props.snapshot.anesthesiologistName,
  surgeon: props.surgeon ?? props.snapshot.surgeonName,
  circulatingNurses: props.circulatingNurses ?? props.snapshot.circulatingNurseNames ?? props.snapshot.nurseName,
  scrubNurses: props.scrubNurses ?? props.snapshot.scrubNurseNames ?? '',
});

const startEdit = () => {
  draft.value = collectDraft();
  expanded.value = true;
};

const cancelEdit = () => {
  draft.value = null;
  expanded.value = false;
};

const collapseView = () => {
  // 锁定/终态仅展开查看，不进入草稿编辑，收起即回到摘要。
  draft.value = null;
  expanded.value = false;
};

const saveEdit = () => {
  const d = draft.value;
  if (!d) return;
  emit('update:fastingStatus', d.fastingStatus);
  emit('update:preMedications', d.preMedications);
  emit('update:preoperativeConditions', d.preoperativeConditions);
  emit('update:actualSurgeryName', d.actualSurgeryName);
  emit('update:surgeryType', d.surgeryType);
  emit('update:surgeryLevel', d.surgeryLevel);
  emit('update:postoperativeDiagnosis', d.postoperativeDiagnosis);
  emit('update:surgicalPosition', d.surgicalPosition);
  emit('applyMethodSelection', { primary: d.methodPrimary, auxiliary: d.methodAuxiliary });
  emit('update:anesthesiologist', d.anesthesiologist);
  emit('update:surgeon', d.surgeon);
  emit('update:circulatingNurses', d.circulatingNurses);
  emit('update:scrubNurses', d.scrubNurses);
  draft.value = null;
  expanded.value = false;
};

const dirty = computed(() => {
  const d = draft.value;
  if (!d || props.readOnly) return false;
  const orig = collectDraft();
  return (Object.keys(d) as (keyof HeaderDraft)[]).some((key) => {
    const next = d[key];
    const prev = orig[key];
    if (Array.isArray(next) && Array.isArray(prev)) return next.join('|') !== prev.join('|');
    return next !== prev;
  });
});

// 草稿字段读写：展开态优先读草稿，写入草稿（不即时提交）。
const draftValue = <K extends keyof HeaderDraft>(key: K) => (draft.value ? draft.value[key] : collectDraft()[key]);
const setDraft = <K extends keyof HeaderDraft>(key: K, value: HeaderDraft[K]) => {
  if (draft.value && !props.readOnly) draft.value[key] = value;
};
const onDraftMethod = (payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }) => {
  if (draft.value && !props.readOnly) {
    draft.value.methodPrimary = payload.primary;
    draft.value.methodAuxiliary = payload.auxiliary;
  }
};

// 摘要展示：风险标识始终可见；术式变更标记。
const riskFlags = computed(() => resolveHeaderRiskFlags({
  allergy: props.allergy,
  difficultAirway: props.difficultAirway,
  preoperativeConditions: props.snapshot.preoperativeConditions,
}));
const surgeryChanged = computed(() => resolveSurgeryChanged(
  props.snapshot.surgeryPlanned,
  props.actualSurgeryName ?? props.snapshot.surgeryActual,
));
const displaySurgery = computed(() => resolveDisplaySurgery(
  props.actualSurgeryName,
  props.snapshot.surgeryPlanned,
  props.snapshot.surgeryActual,
));
const methodDisplay = computed(() => ((props.methodLabel ?? props.snapshot.anesthesiaMethod) || '未记录').trim());

// 未保存草稿：刷新/离开页面需确认；脏状态变化上抛供父级拦截切换患者。
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
};
watch(dirty, (value) => {
  emit('dirtyChange', value);
  if (typeof window === 'undefined') return;
  if (value) window.addEventListener('beforeunload', onBeforeUnload);
  else window.removeEventListener('beforeunload', onBeforeUnload);
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', onBeforeUnload);
});

defineExpose({ isDirty: dirty, startEdit, cancelEdit });
</script>

<template>
  <div class="record-header" :class="{ 'is-summary': summaryMode }">
    <!-- 折叠摘要：屏幕模式默认单行，打印/预览不渲染（由完整表头负责）。 -->
    <div v-if="summaryMode" class="record-header-summary no-print" data-testid="record-header-summary">
      <div class="rhs-main">
        <strong class="rhs-name" :title="snapshot.patientName">{{ snapshot.patientName }}</strong>
        <span class="rhs-text">{{ snapshot.gender }} · {{ formatAge(snapshot.age) }}</span>
        <span class="rhs-dot" aria-hidden="true">·</span>
        <span class="rhs-text">住院号 {{ snapshot.inpatientNo || '—' }}</span>
        <span class="rhs-dot" aria-hidden="true">·</span>
        <span class="rhs-text rhs-asa">ASA {{ snapshot.asa || '—' }}</span>
        <span class="rhs-dot rhs-dot--surgery" aria-hidden="true">·</span>
        <span
          class="rhs-text rhs-surgery"
          :class="{ 'is-changed': surgeryChanged }"
          :title="displaySurgery"
        >{{ displaySurgery }}<em v-if="surgeryChanged" class="rhs-changed-tag">术式已变更</em></span>
        <span class="rhs-dot" aria-hidden="true">·</span>
        <span class="rhs-text rhs-method">{{ methodDisplay }}</span>
        <span v-if="snapshot.department" class="rhs-text rhs-extra">· {{ snapshot.department }}{{ snapshot.bedNo ? ` ${snapshot.bedNo}床` : '' }}</span>
        <span v-if="snapshot.weight" class="rhs-text rhs-extra">· {{ snapshot.weight }}kg</span>
      </div>
      <div class="rhs-risk">
        <span
          v-for="risk in riskFlags"
          :key="risk.key"
          class="rhs-risk-tag"
          :class="`rhs-risk-tag--${risk.tone}`"
        >{{ risk.label }}</span>
      </div>
      <button
        type="button"
        class="rhs-edit-btn"
        data-testid="record-header-edit"
        @click="startEdit"
      >{{ readOnly ? '查看信息' : '编辑信息' }}</button>
    </div>

    <template v-else>
      <div v-if="!printMode" class="header-edit-bar no-print" data-testid="record-header-expanded">
        <strong>{{ readOnly ? '患者信息（只读）' : '编辑患者信息' }}</strong>
        <span v-if="!readOnly && dirty" class="header-edit-dirty">有未保存修改</span>
        <div class="header-edit-actions">
          <button v-if="!readOnly" type="button" class="btn small" @click="cancelEdit">取消</button>
          <button v-if="!readOnly" type="button" class="btn small primary" :disabled="!dirty" @click="saveEdit">保存</button>
          <button v-if="readOnly" type="button" class="btn small" @click="collapseView">收起</button>
        </div>
      </div>

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
            :model-value="draftValue('fastingStatus')"
            :options="fastingOptions"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="5"
            :allow-custom="false"
            @update:model-value="setDraft('fastingStatus', $event)"
          />
          <PaperPickerField
            compact
            multiple
            label="术前用药"
            :model-value="draftValue('preMedications')"
            :options="[]"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="7"
            placeholder="无术前用药"
            @update:model-value="setDraft('preMedications', $event)"
          />
          <PaperPickerField
            compact
            multiple
            label="术前状况"
            :model-value="draftValue('preoperativeConditions')"
            :options="commonPreopConditions"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="24"
            placeholder="无特殊情况"
            @update:model-value="setDraft('preoperativeConditions', $event)"
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
            :model-value="draftValue('actualSurgeryName')"
            :options="surgeryOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="12"
            placeholder="点击选择，多项用+连接"
            @update:model-value="setDraft('actualSurgeryName', $event)"
          />
          <PaperPickerField
            compact
            label="手术类型"
            :model-value="draftValue('surgeryType')"
            :options="surgeryTypeOptions"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="4"
            :allow-custom="false"
            @update:model-value="setDraft('surgeryType', $event)"
          />
          <PaperPickerField
            compact
            label="手术等级"
            :model-value="draftValue('surgeryLevel')"
            :options="surgeryLevelOptions"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="4"
            :allow-custom="false"
            placeholder="待评定"
            @update:model-value="setDraft('surgeryLevel', $event)"
          />
          <div class="bmi-field" :class="{ alert: (snapshot.bmi ?? 0) >= 28 }" style="grid-column: span 4">
            <PaperFormField compact label="BMI" :model-value="snapshot.bmi ? String(snapshot.bmi) : '未计算'" readonly :print-mode="printMode" />
          </div>
          <PaperPickerField
            compact
            label="术后诊断"
            :model-value="draftValue('postoperativeDiagnosis')"
            :options="[]"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="12"
            placeholder="待术后确认"
            @update:model-value="setDraft('postoperativeDiagnosis', $event)"
          />

          <PaperPickerField
            compact
            label="手术体位"
            :model-value="draftValue('surgicalPosition')"
            :options="positionOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="8"
            placeholder="点击选择体位"
            :allow-custom="false"
            @update:model-value="setDraft('surgicalPosition', $event)"
          />
          <AnesthesiaMethodPickerField
            compact
            :primary="draftValue('methodPrimary')"
            :auxiliary="draftValue('methodAuxiliary')"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="16"
            @apply="onDraftMethod"
          />

          <PaperPickerField
            compact
            multiple
            pinyin-search
            label="麻醉医师"
            :model-value="draftValue('anesthesiologist')"
            :options="anesthesiologistOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="6"
            placeholder="点击选择"
            :allow-custom="false"
            @update:model-value="setDraft('anesthesiologist', $event)"
          />
          <PaperPickerField
            compact
            multiple
            pinyin-search
            label="手术医师"
            :model-value="draftValue('surgeon')"
            :options="surgeonOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="6"
            placeholder="点击选择"
            :allow-custom="false"
            @update:model-value="setDraft('surgeon', $event)"
          />
          <PaperPickerField
            compact
            multiple
            pinyin-search
            label="巡回护士"
            :model-value="draftValue('circulatingNurses')"
            :options="nurseOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="6"
            placeholder="点击选择"
            :allow-custom="false"
            @update:model-value="setDraft('circulatingNurses', $event)"
          />
          <PaperPickerField
            compact
            multiple
            pinyin-search
            label="洗手护士"
            :model-value="draftValue('scrubNurses')"
            :options="nurseOptions ?? []"
            :readonly="readOnly"
            :print-mode="printMode"
            :interaction-mode="interactionMode"
            :span="6"
            placeholder="点击选择"
            :allow-custom="false"
            @update:model-value="setDraft('scrubNurses', $event)"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.record-header {
  padding: 6px 10px 0;
}

.record-header.is-summary {
  padding: 0;
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

/* 展开态编辑工具条 */
.header-edit-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border: 1px solid #dbe6f3;
  border-radius: 6px 6px 0 0;
  background: #f8fbff;
  font-size: 12px;
  color: #0f172a;
}

.header-edit-bar strong {
  font-weight: 700;
}

.header-edit-dirty {
  color: #b45309;
  font-weight: 600;
}

.header-edit-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

/* 折叠摘要：单行紧凑，1366 宽度不横向溢出 */
.record-header-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 10px;
  border: 1px solid #dbe6f3;
  border-radius: 6px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  font-size: 12.5px;
  line-height: 1.4;
}

.rhs-main {
  display: flex;
  align-items: baseline;
  gap: 4px 6px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1 1 auto;
}

.rhs-name {
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
}

.rhs-text {
  color: #334155;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.rhs-asa {
  font-weight: 700;
  color: #1d4ed8;
}

.rhs-dot {
  color: #cbd5e1;
  font-weight: 700;
}

.rhs-dot--surgery {
  display: none;
}

.rhs-surgery {
  color: #0f172a;
  font-weight: 700;
  max-width: 22em;
}

.rhs-surgery.is-changed {
  color: #b45309;
}

.rhs-changed-tag {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}

.rhs-method {
  color: #1d4ed8;
  font-weight: 700;
}

.rhs-extra {
  color: #64748b;
}

.rhs-risk {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.rhs-risk-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.rhs-risk-tag--danger {
  background: #fee2e2;
  color: #b91c1c;
}

.rhs-risk-tag--warning {
  background: #fef3c7;
  color: #b45309;
}

.rhs-edit-btn {
  flex: 0 0 auto;
  padding: 3px 10px;
  border: 1px solid var(--primary-6, rgb(22, 93, 255));
  border-radius: 4px;
  background: #fff;
  color: var(--primary-6, rgb(22, 93, 255));
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

@media (max-width: 1380px) {
  .rhs-dot--surgery {
    display: inline;
  }
  .rhs-surgery {
    max-width: 16em;
  }
}

@media (max-width: 760px) {
  .record-header-summary {
    font-size: 12px;
  }
  .rhs-surgery {
    max-width: 100%;
  }
}
</style>
