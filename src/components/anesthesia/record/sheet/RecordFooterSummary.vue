<script setup lang="ts">
import { computed } from 'vue';
import type { RecordSummaryFields } from '@/types/anesthesiaRecord';

const props = defineProps<{
  summary: RecordSummaryFields;
  autologousTotal?: number;
  signatures?: {
    anesthesiologist?: string;
    nurse?: string;
    signedAt?: string;
  };
  readOnly?: boolean;
  printMode?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  'update:anesthesiaEffect': [value: string];
  'update:destination': [value: string];
  'update:analgesiaMethod': [value: string];
  'update:handoverNote': [value: string];
}>();

const effectOptions = ['优', '良', '差'] as const;

const inputItems = computed(() => [
  { label: '晶体', value: props.summary.crystalTotal ?? 0 },
  { label: '胶体', value: props.summary.colloidTotal ?? 0 },
  { label: '自体血', value: props.autologousTotal ?? 0 },
  { label: '总', value: props.summary.inputTotal ?? 0, emphasis: true },
]);

const bloodProductSummary = computed(() => props.summary.bloodProductSummary?.trim() ?? '');

const outputItems = computed(() => [
  { label: '尿量', value: props.summary.urineTotal ?? 0 },
  { label: '出血', value: props.summary.bloodLossTotal ?? 0 },
  { label: '引流', value: props.summary.drainageTotal ?? 0 },
  { label: '总', value: props.summary.outputTotal ?? 0, emphasis: true },
]);

const completedAt = computed(() => (
  props.summary.completedAt
    ? props.summary.completedAt.slice(0, 16).replace('T', ' ')
    : (props.signatures?.signedAt ? props.signatures.signedAt.slice(0, 16).replace('T', ' ') : '未完成')
));

const onFieldUpdate = (key: string, value: string) => {
  if (key === 'anesthesiaEffect') emit('update:anesthesiaEffect', value);
  if (key === 'destination') emit('update:destination', value);
  if (key === 'analgesiaMethod') emit('update:analgesiaMethod', value);
  if (key === 'handoverNote') emit('update:handoverNote', value);
};
</script>

<template>
  <div class="record-footer-summary" :class="{ compact, 'is-print': printMode }">
    <div v-if="printMode" class="footer-io-print-table">
      <table>
        <thead>
          <tr>
            <th colspan="4">入量 (ml)</th>
            <th colspan="4">出量 (ml)</th>
          </tr>
          <tr>
            <th v-for="item in inputItems" :key="`in-head-${item.label}`">{{ item.label }}</th>
            <th v-for="item in outputItems" :key="`out-head-${item.label}`">{{ item.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td v-for="item in inputItems" :key="`in-val-${item.label}`" :class="{ emphasis: item.emphasis }">{{ item.value }}</td>
            <td v-for="item in outputItems" :key="`out-val-${item.label}`" :class="{ emphasis: item.emphasis }">{{ item.value }}</td>
          </tr>
          <tr v-if="bloodProductSummary">
            <td colspan="4" class="footer-blood-products-print">
              血制品：{{ bloodProductSummary }}
            </td>
            <td colspan="4"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="footer-io-row">
      <div class="footer-io-block footer-io-block-input">
        <strong class="footer-io-title">入量 (ml)</strong>
        <div class="footer-io-items">
          <span
            v-for="item in inputItems"
            :key="item.label"
            class="footer-io-item"
            :class="{ emphasis: item.emphasis }"
          >
            <em>{{ item.label }}</em>
            <b>{{ item.value }}</b>
          </span>
        </div>
        <p v-if="bloodProductSummary" class="footer-blood-products">
          <em>血制品</em>
          <span>{{ bloodProductSummary }}</span>
        </p>
      </div>
      <div class="footer-io-block">
        <strong class="footer-io-title">出量 (ml)</strong>
        <div class="footer-io-items">
          <span
            v-for="item in outputItems"
            :key="item.label"
            class="footer-io-item"
            :class="{ emphasis: item.emphasis }"
          >
            <em>{{ item.label }}</em>
            <b>{{ item.value }}</b>
          </span>
        </div>
      </div>
    </div>

    <div class="footer-fields">
      <div class="footer-field">
        <label>麻醉效果</label>
        <select
          v-if="!readOnly && !printMode"
          class="footer-input"
          :value="summary.anesthesiaEffect ?? ''"
          @change="onFieldUpdate('anesthesiaEffect', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">未记录</option>
          <option v-for="item in effectOptions" :key="item" :value="item">{{ item }}</option>
        </select>
        <span v-else class="footer-value">{{ summary.anesthesiaEffect || '未记录' }}</span>
      </div>

      <div class="footer-field">
        <label>去向</label>
        <input
          v-if="!readOnly && !printMode"
          class="footer-input"
          type="text"
          :value="summary.destination ?? ''"
          placeholder="未记录"
          @input="onFieldUpdate('destination', ($event.target as HTMLInputElement).value)"
        >
        <span v-else class="footer-value">{{ summary.destination || '未记录' }}</span>
      </div>

      <div class="footer-field">
        <label>镇痛方式</label>
        <input
          v-if="!readOnly && !printMode"
          class="footer-input"
          type="text"
          :value="summary.analgesiaMethod ?? ''"
          placeholder="未记录"
          @input="onFieldUpdate('analgesiaMethod', ($event.target as HTMLInputElement).value)"
        >
        <span v-else class="footer-value">{{ summary.analgesiaMethod || '未记录' }}</span>
      </div>

      <div class="footer-field readonly">
        <label>醒复时间</label>
        <span class="footer-value">{{ summary.recoveryTime ?? '未记录' }}</span>
      </div>

      <div class="footer-field readonly">
        <label>拔管时间</label>
        <span class="footer-value">{{ summary.extubationTime ?? '未记录' }}</span>
      </div>

      <div class="footer-field">
        <label>交班情况</label>
        <input
          v-if="!readOnly && !printMode"
          class="footer-input"
          type="text"
          :value="summary.handoverNote ?? ''"
          placeholder="未记录"
          @input="onFieldUpdate('handoverNote', ($event.target as HTMLInputElement).value)"
        >
        <span v-else class="footer-value">{{ summary.handoverNote || '未记录' }}</span>
      </div>
    </div>

    <div class="footer-meta">
      <div class="footer-signature">
        <strong>签名</strong>
        <span class="sig-item">
          <em>麻醉</em>
          <b>{{ signatures?.anesthesiologist ?? '-' }}</b>
        </span>
        <span class="sig-item">
          <em>护士</em>
          <b>{{ signatures?.nurse ?? '-' }}</b>
        </span>
      </div>
      <div class="footer-completed">
        <strong>完成时间</strong>
        <span>{{ completedAt }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.record-footer-summary {
  display: grid;
  gap: 10px;
  margin-top: 8px;
  padding: 10px 12px 12px;
  border-top: 2px solid #111827;
  background: #fafafa;
  font-size: 12px;
}

.record-footer-summary.is-print {
  gap: 6px;
  margin-top: 0;
  padding: 6px 0 0;
  background: #fff;
}

.footer-io-print-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.footer-io-print-table th,
.footer-io-print-table td {
  border: 1px solid #111827;
  padding: 4px 6px;
  text-align: center;
}

.footer-io-print-table th {
  background: #f8fafc;
  font-weight: 700;
}

.footer-io-print-table td.emphasis {
  font-weight: 700;
}

.footer-io-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.footer-io-block {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
}

.footer-io-title {
  display: block;
  margin-bottom: 6px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.footer-io-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.footer-io-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: #334155;
}

.footer-io-item em {
  color: #64748b;
  font-style: normal;
  font-size: 11px;
}

.footer-io-item b {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.footer-blood-products {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #dbeafe;
  color: #334155;
  font-size: 12px;
  line-height: 1.4;
}

.footer-blood-products em {
  color: #64748b;
  font-style: normal;
  font-weight: 600;
}

.footer-blood-products span {
  color: #0f172a;
  font-weight: 700;
}

.footer-blood-products-print {
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #0f172a;
}

.footer-io-item.emphasis b {
  color: #1d4ed8;
}

.footer-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 10px;
}

.record-footer-summary.is-print .footer-fields {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.record-footer-summary.compact .footer-fields {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.footer-field {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}

.record-footer-summary.is-print .footer-field {
  border-radius: 0;
  border-color: #94a3b8;
  padding: 4px 6px;
}

.footer-field.readonly {
  background: #f8fafc;
}

.footer-field label {
  color: #475569;
  font-size: 11px;
  font-weight: 600;
}

.footer-input,
.footer-value {
  min-height: 24px;
  padding: 4px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.35;
}

.footer-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 12%);
}

.footer-value {
  display: flex;
  align-items: center;
  border-color: #e2e8f0;
  background: #f8fafc;
}

.footer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 8px 10px;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  background: #fff;
}

.record-footer-summary.is-print .footer-meta {
  border-radius: 0;
  border-color: #111827;
  padding: 6px 8px;
}

.footer-signature {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 18px;
}

.footer-signature > strong,
.footer-completed strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.sig-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 8px;
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  background: #f8fafc;
}

.record-footer-summary.is-print .sig-item {
  border-style: solid;
  border-radius: 0;
}

.sig-item em {
  color: #64748b;
  font-style: normal;
  font-size: 11px;
}

.sig-item b {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.footer-completed {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  color: #334155;
  font-size: 12px;
}

@media (max-width: 900px) {
  .footer-io-row,
  .footer-fields {
    grid-template-columns: 1fr;
  }
}
</style>
