<script setup lang="ts">
import { computed } from 'vue';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import type { AbnormalVitalByDictionary, LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';
import type { RecordPrintCheck } from '@/types/anesthesiaRecord';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { AnesthesiaMethodKey, TemplateImpact } from '@/mock/anesthesiaRecordPrototype';
import type { DynamicModuleEntry } from '@/mock/anesthesiaRecordPrototype';
import type { SurgeryCase } from '@/types/anesthesia';

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
</script>

<template>
  <div class="print-preview-shell">
    <header class="print-preview-toolbar no-print">
      <div>
        <strong>打印预览</strong>
        <span>共 {{ record.recordDocument?.pageCount ?? 1 }} 页 · 横版 A4 · 签名区在第 {{ record.recordDocument?.pageCount ?? 1 }} 页</span>
        <span v-if="layoutWarningCount" class="warn-chip">布局提示 {{ layoutWarningCount }} 项</span>
      </div>
      <div class="actions">
        <button type="button" @click="emit('close')">关闭</button>
        <button type="button" class="secondary" @click="emit('print')">直接打印</button>
        <button type="button" class="primary" :disabled="hasBlockingIssue" @click="emit('confirmPrint')">确认打印并锁定</button>
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
        v-for="pageNo in (record.recordDocument?.pageCount ?? 1)"
        :key="`preview-page-${pageNo}`"
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
        :page-no="pageNo"
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
  padding: 16px;
}

.print-preview-toolbar,
.print-check-panel {
  max-width: 1180px;
  margin: 0 auto 12px;
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
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
  margin: 0 0 8px;
}

.print-check-panel ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
}

.print-check-panel li.未通过,
.print-check-panel li.警告 {
  color: #b45309;
}

.print-preview-pages {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.print-preview-page {
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  page-break-after: always;
}

@page {
  size: A4 landscape;
  margin: 8mm;
}

@media print {
  .print-preview-shell {
    position: static;
    background: #fff;
    padding: 0;
  }

  .no-print {
    display: none !important;
  }

  .print-preview-page {
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
