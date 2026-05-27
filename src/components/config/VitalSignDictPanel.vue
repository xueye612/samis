<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>生命体征字典</template>
      <template #extra>
        <a-button type="primary" @click="openCreate">新增</a-button>
      </template>
      <a-alert type="info" show-icon style="margin-bottom: 12px">
        启用的体征项将用于麻醉记录单录入与趋势展示。
      </a-alert>
      <a-table :data="sortedRows" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="显示名" data-index="name" />
          <a-table-column title="编码" data-index="shortCode" />
          <a-table-column title="单位" data-index="unit" />
          <a-table-column title="正常范围" data-index="normalRange">
            <template #cell="{ record }">{{ record.normalRange || '—' }}</template>
          </a-table-column>
          <a-table-column title="下限" data-index="lowerLimit" />
          <a-table-column title="上限" data-index="upperLimit" />
          <a-table-column title="曲线">
            <template #cell="{ record }">
              <a-tag :color="record.chartEnabled ? 'arcoblue' : 'gray'">{{ record.chartEnabled ? '显示' : '隐藏' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="小数位" data-index="decimalPlaces" />
          <a-table-column title="排序" data-index="sortOrder" />
          <a-table-column title="状态">
            <template #cell="{ record }">
              <a-tag :color="record.enabled ? 'green' : 'gray'">{{ record.enabled ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="160">
            <template #cell="{ record }">
              <a-space>
                <a-button size="mini" @click="openEdit(record)">编辑</a-button>
                <a-button size="mini" status="danger" @click="remove(record)">删除</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="visible" :title="editingIndex >= 0 ? '编辑体征项' : '新增体征项'" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="显示名"><a-input v-model="form.name" placeholder="如 心率 HR" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="form.shortCode" placeholder="如 HR" /></a-form-item>
        <a-form-item label="单位"><a-input v-model="form.unit" placeholder="如 bpm、mmHg" /></a-form-item>
        <a-form-item label="正常范围"><a-input v-model="form.normalRange" placeholder="如 60-100" /></a-form-item>
        <a-form-item label="下限"><a-input-number v-model="form.lowerLimit" style="width: 100%" /></a-form-item>
        <a-form-item label="上限"><a-input-number v-model="form.upperLimit" style="width: 100%" /></a-form-item>
        <a-form-item label="默认值"><a-input-number v-model="form.defaultValue" style="width: 100%" /></a-form-item>
        <a-form-item label="用于纸质曲线"><a-switch v-model="form.chartEnabled" /></a-form-item>
        <a-form-item label="曲线颜色"><a-input v-model="form.chartColor" placeholder="#2563eb" /></a-form-item>
        <a-form-item label="曲线符号">
          <a-select v-model="form.chartSymbol" :options="symbolOptions" />
        </a-form-item>
        <a-form-item label="小数位"><a-input-number v-model="form.decimalPlaces" :min="0" :max="2" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model="form.sortOrder" :min="1" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.enabled" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { VitalSignDictItem } from '@/types/system';

const props = defineProps<{ modelValue: VitalSignDictItem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: VitalSignDictItem[]] }>();

const sortedRows = computed(() => [...props.modelValue].sort((a, b) => a.sortOrder - b.sortOrder));
const visible = ref(false);
const editingIndex = ref(-1);
const form = reactive({
  name: '',
  shortCode: '',
  unit: '',
  normalRange: '',
  lowerLimit: undefined as number | undefined,
  upperLimit: undefined as number | undefined,
  defaultValue: undefined as number | undefined,
  chartEnabled: false,
  chartColor: '',
  chartSymbol: 'text' as NonNullable<VitalSignDictItem['chartSymbol']>,
  decimalPlaces: 0,
  sortOrder: 1,
  enabled: true,
});

const symbolOptions = [
  { label: '下三角', value: 'triangle-down' },
  { label: '上三角', value: 'triangle-up' },
  { label: '圆点', value: 'circle' },
  { label: '菱形', value: 'diamond' },
  { label: '星形', value: 'star' },
  { label: '方形', value: 'square' },
  { label: '文本', value: 'text' },
];

const cloneRows = () => JSON.parse(JSON.stringify(props.modelValue)) as VitalSignDictItem[];

const openCreate = () => {
  editingIndex.value = -1;
  form.name = '';
  form.shortCode = '';
  form.unit = '';
  form.normalRange = '';
  form.lowerLimit = undefined;
  form.upperLimit = undefined;
  form.defaultValue = undefined;
  form.chartEnabled = false;
  form.chartColor = '';
  form.chartSymbol = 'text';
  form.decimalPlaces = 0;
  form.sortOrder = props.modelValue.length + 1;
  form.enabled = true;
  visible.value = true;
};

const openEdit = (record: VitalSignDictItem) => {
  editingIndex.value = props.modelValue.findIndex((item) => item.id === record.id);
  form.name = record.name;
  form.shortCode = record.shortCode;
  form.unit = record.unit;
  form.normalRange = record.normalRange ?? '';
  form.lowerLimit = record.lowerLimit;
  form.upperLimit = record.upperLimit;
  form.defaultValue = typeof record.defaultValue === 'number' ? record.defaultValue : Number(record.defaultValue) || undefined;
  form.chartEnabled = Boolean(record.chartEnabled);
  form.chartColor = record.chartColor ?? '';
  form.chartSymbol = record.chartSymbol ?? 'text';
  form.decimalPlaces = record.decimalPlaces ?? 0;
  form.sortOrder = record.sortOrder;
  form.enabled = record.enabled;
  visible.value = true;
};

const save = () => {
  const name = form.name.trim();
  const shortCode = form.shortCode.trim();
  if (!name || !shortCode) return;
  const next = cloneRows();
  const payload: VitalSignDictItem = {
    id: editingIndex.value >= 0 ? next[editingIndex.value].id : `vital-${Date.now()}`,
    code: `V-${shortCode}`,
    name,
    shortCode,
    unit: form.unit.trim(),
    normalRange: form.normalRange.trim() || undefined,
    lowerLimit: form.lowerLimit,
    upperLimit: form.upperLimit,
    defaultValue: form.defaultValue,
    chartEnabled: form.chartEnabled,
    chartColor: form.chartColor.trim() || undefined,
    chartSymbol: form.chartSymbol,
    decimalPlaces: form.decimalPlaces,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  };
  const originalIndex = editingIndex.value >= 0 ? props.modelValue.findIndex((item) => item.id === payload.id) : -1;
  if (originalIndex >= 0) next[originalIndex] = payload;
  else next.push(payload);
  emit('update:modelValue', next);
  visible.value = false;
};

const remove = (record: VitalSignDictItem) => {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== record.id));
};
</script>
