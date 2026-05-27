<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>液体/血制品字典</template>
      <template #extra>
        <a-button type="primary" @click="openCreate">新增</a-button>
      </template>
      <a-tabs v-model:active-key="activeSubCategory" type="rounded">
        <a-tab-pane v-for="cat in subCategories" :key="cat" :title="cat" />
      </a-tabs>
      <a-table :data="filteredRows" :pagination="false" row-key="id" style="margin-top: 12px">
        <template #columns>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="编码" data-index="code" />
          <a-table-column title="默认单位" data-index="defaultUnit" />
          <a-table-column title="默认量" data-index="defaultVolume" />
          <a-table-column title="双人核对">
            <template #cell="{ record }">
              <a-tag :color="record.requiresDoubleCheck ? 'red' : 'gray'">{{ record.requiresDoubleCheck ? '需要' : '不需要' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="备注" data-index="remark">
            <template #cell="{ record }">{{ record.remark || '—' }}</template>
          </a-table-column>
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

    <a-modal v-model:visible="visible" :title="editingId ? '编辑' : '新增'" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="子分类">
          <a-select v-model="form.subCategory" :options="subCategories.map((item) => ({ label: item, value: item }))" />
        </a-form-item>
        <a-form-item label="名称"><a-input v-model="form.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="form.code" placeholder="留空则使用名称" /></a-form-item>
        <a-form-item label="默认单位"><a-input v-model="form.defaultUnit" placeholder="如 ml、U" /></a-form-item>
        <a-form-item label="默认量"><a-input-number v-model="form.defaultVolume" :min="0" style="width: 100%" /></a-form-item>
        <a-form-item label="需要双人核对"><a-switch v-model="form.requiresDoubleCheck" /></a-form-item>
        <a-form-item label="备注"><a-input v-model="form.remark" placeholder="如 需交叉配血" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.enabled" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { FLUID_BLOOD_SUB_CATEGORIES } from '@/mock/configSeed';
import type { FluidBloodDictItem, FluidBloodSubCategory } from '@/types/system';

const props = defineProps<{ modelValue: FluidBloodDictItem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: FluidBloodDictItem[]] }>();

const subCategories = FLUID_BLOOD_SUB_CATEGORIES;
const activeSubCategory = ref<FluidBloodSubCategory>('晶体液');
const visible = ref(false);
const editingId = ref('');
const form = reactive({
  subCategory: '晶体液' as FluidBloodSubCategory,
  name: '',
  code: '',
  defaultUnit: 'ml',
  defaultVolume: 500,
  requiresDoubleCheck: false,
  remark: '',
  enabled: true,
});

const filteredRows = computed(() => props.modelValue.filter((item) => item.subCategory === activeSubCategory.value));

const cloneRows = () => JSON.parse(JSON.stringify(props.modelValue)) as FluidBloodDictItem[];

const openCreate = () => {
  editingId.value = '';
  form.subCategory = activeSubCategory.value;
  form.name = '';
  form.code = '';
  form.defaultUnit = activeSubCategory.value === '血液制品' ? 'U' : 'ml';
  form.defaultVolume = activeSubCategory.value === '血液制品' ? 1 : 500;
  form.requiresDoubleCheck = activeSubCategory.value === '血液制品';
  form.remark = '';
  form.enabled = true;
  visible.value = true;
};

const openEdit = (record: FluidBloodDictItem) => {
  editingId.value = record.id;
  form.subCategory = record.subCategory;
  form.name = record.name;
  form.code = record.code;
  form.defaultUnit = record.defaultUnit ?? 'ml';
  form.defaultVolume = record.defaultVolume ?? 0;
  form.requiresDoubleCheck = Boolean(record.requiresDoubleCheck);
  form.remark = record.remark ?? '';
  form.enabled = record.enabled;
  visible.value = true;
};

const save = () => {
  const name = form.name.trim();
  if (!name) return;
  const next = cloneRows();
  const payload: FluidBloodDictItem = {
    id: editingId.value || `fluid-${Date.now()}`,
    code: form.code.trim() || name,
    name,
    subCategory: form.subCategory,
    defaultUnit: form.defaultUnit.trim() || undefined,
    defaultVolume: form.defaultVolume,
    requiresDoubleCheck: form.requiresDoubleCheck,
    remark: form.remark.trim() || undefined,
    enabled: form.enabled,
  };
  const index = next.findIndex((item) => item.id === editingId.value);
  if (index >= 0) next[index] = payload;
  else next.push(payload);
  emit('update:modelValue', next);
  visible.value = false;
};

const remove = (record: FluidBloodDictItem) => {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== record.id));
};
</script>
