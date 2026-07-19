<script setup lang="ts">
import { computed } from 'vue';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import type { AbnormalVitalByDictionary, LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';
import type { RecordPrintCheck } from '@/types/anesthesiaRecord';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { AnesthesiaMethodKey, TemplateImpact } from '@/mock/anesthesiaRecordPrototype';
import type { DynamicModuleEntry } from '@/mock/anesthesiaRecordPrototype';
import type { SurgeryCase } from '@/types/anesthesia';
import { resolveTimeAxisIntervals } from '@/services/anesthesiaRecordEngine';
import {
  buildRecordPagination,
  PORTRAIT_PRINT_PAGE_DURATION_MINUTES,
} from '@/services/recordPaginationEngine';

const props = defineProps<{
  record: SurgeryCase;
  vitals: VitalSignDictItem[];
  drugs: DrugDictItem[];
  fluids: FluidBloodDictItem[];
  bloodTypes?: string[];
  rhTypes?: string[];
  transfusionReactions?: string[];
  monitorOrder?: string[];
  qualityChecks?: LiveRecordQualityCheck[];
  printChecks?: RecordPrintCheck[];
  layoutWarningCount?: number;
  appliedTemplateName?: string;
  appliedMethodLabels?: string[];
  appliedModules?: DynamicModuleEntry[];
  templateImpact?: TemplateImpact;
  methodKeys?: AnesthesiaMethodKey[];
  showAnesthesiaPlane?: boolean;
  sectionVisibility?: import('@/config/recordSections').RecordSectionVisibility;
  includeProfessionalAppendix?: boolean;
}>();

const emit = defineEmits<{
  print: [];
  close: [];
  confirmPrint: [];
}>();

const hasBlockingIssue = computed(() =>
  (props.printChecks ?? []).some((item) => item.status === '未通过')
  || (props.qualityChecks ?? []).some((item) => item.status === '未通过'),
);

const primaryDisabled = computed(() => !props.record.locked && hasBlockingIssue.value);
const primaryLabel = computed(() => (props.record.locked ? '打印已锁定记录' : '确认打印并锁定'));
const handlePrimaryAction = () => {
  if (props.record.locked) emit('print');
  else emit('confirmPrint');
};
const portraitPages = computed(() => {
  const intervals = resolveTimeAxisIntervals(props.record);
  return buildRecordPagination(props.record, {
    pageDurationMinutes: PORTRAIT_PRINT_PAGE_DURATION_MINUTES,
    minorInterval: intervals.minorInterval,
    majorInterval: intervals.majorInterval,
    minimumFirstPageMinutes: PORTRAIT_PRINT_PAGE_DURATION_MINUTES,
  }).pages;
});
</script>

<template>
  <div class="print-preview-shell">
    <header class="print-preview-toolbar no-print">
      <div>
        <strong>打印预览</strong>
        <span>共 {{ portraitPages.length }} 页 · A4 竖向 · 签名区在第 {{ portraitPages.length }} 页</span>
        <span v-if="layoutWarningCount" class="warn-chip">布局提示 {{ layoutWarningCount }} 项</span>
      </div>
      <div class="actions">
        <button type="button" @click="emit('close')">关闭</button>
        <button type="button" class="secondary" @click="emit('print')">直接打印</button>
        <button type="button" class="primary" :disabled="primaryDisabled" @click="handlePrimaryAction">{{ primaryLabel }}</button>
      </div>
    </header>

    <section v-if="(printChecks?.length || qualityChecks?.length)" class="print-check-panel no-print">
      <h4>打印前校验</h4>
      <ul>
        <li v-for="item in printChecks" :key="`print-${item.item}`" :class="item.status">{{ item.item }}：{{ item.message }}</li>
        <li v-for="item in qualityChecks" :key="`quality-${item.item}`" :class="item.status">{{ item.item }}：{{ item.message }}</li>
      </ul>
    </section>

    <div class="print-preview-pages">
      <LiveAnesthesiaSheet
        v-for="page in portraitPages"
        :key="`preview-page-${page.pageNo}`"
        class="print-preview-page"
        :record="record"
        :vitals="vitals"
        :drugs="drugs"
        :fluids="fluids"
        :blood-types="bloodTypes"
        :rh-types="rhTypes"
        :transfusion-reactions="transfusionReactions"
        :monitor-order="monitorOrder"
        :read-only="true"
        :page-no="page.pageNo"
        :page-config="page"
        :print-mode="true"
        :show-anesthesia-plane="showAnesthesiaPlane"
        :section-visibility="sectionVisibility"
        :include-professional-appendix="includeProfessionalAppendix"
        :applied-template-name="appliedTemplateName"
        :applied-method-labels="appliedMethodLabels"
        :applied-modules="appliedModules"
        :template-impact="templateImpact"
        :method-keys="methodKeys"
        :method-labels="appliedMethodLabels"
      />
    </div>
  </div>
</template>

<style scoped>
.print-preview-shell {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15, 23, 42, 0.45);
  overflow: auto;
  padding: 10px 12px 18px;
}

.print-preview-toolbar,
.print-check-panel {
  max-width: 1180px;
  margin: 0 auto 8px;
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.print-preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.print-preview-toolbar span {
  margin-left: 10px;
  color: #64748b;
  font-size: 12px;
}

.print-check-panel {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: start;
  max-height: 104px;
  overflow: auto;
  border-left: 4px solid #f59e0b;
}

.warn-chip {
  color: #b45309 !important;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}

.actions .primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.actions .primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.print-check-panel h4 {
  position: sticky;
  top: 0;
  margin: 0;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
}

.print-check-panel ul {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.25;
  columns: 2;
  column-gap: 24px;
}

.print-check-panel li {
  break-inside: avoid;
}

.print-check-panel li.未通过,
.print-check-panel li.警告 {
  color: #b45309;
}

.print-preview-pages {
  max-width: 794px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
  justify-items: center;
}

.print-preview-page {
  width: 794px;
  max-width: 100%;
  min-height: 1123px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  page-break-after: always;
  break-after: page;
}

.print-preview-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

@page {
  size: A4 portrait;
  margin: 2mm;
}

@media print {
  .print-preview-shell {
    position: static;
    background: #fff;
    padding: 0;
  }

  .print-preview-pages {
    display: block;
    max-width: none;
    margin: 0;
  }

  .no-print {
    display: none !important;
  }

  .print-preview-page {
    width: 100%;
    max-width: none;
    min-height: 0;
    transform: none;
    box-shadow: none;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .print-preview-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
</style>
