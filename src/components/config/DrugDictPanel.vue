<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>药品字典</template>
      <template #extra>
        <a-button type="primary" @click="openCreate">新增</a-button>
      </template>
      <a-table :data="rows" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="编码" data-index="code" />
          <a-table-column title="规格" data-index="specification" />
          <a-table-column title="默认剂量" data-index="defaultDose" />
          <a-table-column title="剂量单位" data-index="doseUnit" />
          <a-table-column title="默认途径" data-index="defaultRoute" />
          <a-table-column title="高警示">
            <template #cell="{ record }">
              <a-tag :color="record.highAlert ? 'red' : 'gray'">{{ record.highAlert ? '是' : '否' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="常用">
            <template #cell="{ record }">
              <a-tag :color="record.common ? 'arcoblue' : 'gray'">{{ record.common ? '常用' : '普通' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="排序" data-index="sortOrder" />
          <a-table-column title="状态">
            <template #cell="{ record }">
              <a-tag :color="record.enabled ? 'green' : 'gray'">{{ record.enabled ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="160">
            <template #cell="{ record, rowIndex }">
              <a-space>
                <a-button size="mini" @click="openEdit(record, rowIndex)">编辑</a-button>
                <a-button size="mini" status="danger" @click="remove(rowIndex)">删除</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="visible" :title="editingIndex >= 0 ? '编辑药品' : '新增药品'" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称"><a-input v-model="form.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="form.code" placeholder="留空则使用名称" /></a-form-item>
        <a-form-item label="规格"><a-input v-model="form.specification" placeholder="如 200mg/20ml" /></a-form-item>
        <a-form-item label="默认剂量"><a-input-number v-model="form.defaultDose" :min="0" style="width: 100%" /></a-form-item>
        <a-form-item label="剂量单位"><a-input v-model="form.doseUnit" placeholder="如 mg、μg、ml" /></a-form-item>
        <a-form-item label="默认途径"><a-input v-model="form.defaultRoute" placeholder="如 静脉、吸入" /></a-form-item>
        <a-form-item label="高警示药品"><a-switch v-model="form.highAlert" /></a-form-item>
        <a-form-item label="常用快捷药品"><a-switch v-model="form.common" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model="form.sortOrder" :min="1" style="width: 100%" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.enabled" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { DrugDictItem } from '@/types/system';

const props = defineProps<{ modelValue: DrugDictItem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: DrugDictItem[]] }>();

const rows = computed(() => props.modelValue);
const visible = ref(false);
const editingIndex = ref(-1);
const form = reactive({
  name: '',
  code: '',
  specification: '',
  defaultDose: undefined as number | undefined,
  doseUnit: '',
  defaultRoute: '',
  highAlert: false,
  common: true,
  sortOrder: 1,
  enabled: true,
});

const cloneRows = () => JSON.parse(JSON.stringify(props.modelValue)) as DrugDictItem[];

const openCreate = () => {
  editingIndex.value = -1;
  form.name = '';
  form.code = '';
  form.specification = '';
  form.defaultDose = undefined;
  form.doseUnit = '';
  form.defaultRoute = '';
  form.highAlert = false;
  form.common = true;
  form.sortOrder = props.modelValue.length + 1;
  form.enabled = true;
  visible.value = true;
};

const openEdit = (record: DrugDictItem, index: number) => {
  editingIndex.value = index;
  form.name = record.name;
  form.code = record.code;
  form.specification = record.specification;
  form.defaultDose = typeof record.defaultDose === 'number' ? record.defaultDose : Number(record.defaultDose) || undefined;
  form.doseUnit = record.doseUnit;
  form.defaultRoute = record.defaultRoute ?? '';
  form.highAlert = Boolean(record.highAlert);
  form.common = record.common ?? true;
  form.sortOrder = record.sortOrder ?? index + 1;
  form.enabled = record.enabled;
  visible.value = true;
};

const save = () => {
  const name = form.name.trim();
  if (!name) return;
  const next = cloneRows();
  const payload: DrugDictItem = {
    id: editingIndex.value >= 0 ? next[editingIndex.value].id : `drug-${Date.now()}`,
    code: form.code.trim() || name,
    name,
    specification: form.specification.trim(),
    defaultDose: form.defaultDose,
    doseUnit: form.doseUnit.trim(),
    defaultRoute: form.defaultRoute.trim() || undefined,
    highAlert: form.highAlert,
    common: form.common,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  };
  if (editingIndex.value >= 0) next[editingIndex.value] = payload;
  else next.push(payload);
  emit('update:modelValue', next);
  visible.value = false;
};

const remove = (index: number) => {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
};
</script>
