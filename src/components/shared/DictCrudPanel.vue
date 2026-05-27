<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">{{ title }}</h2>
        <p class="module-hero__desc">统一维护基础字典，确保业务页面的配置来源一致。</p>
      </div>
      <div class="module-hero__chips">
        <a-tag color="arcoblue">共 {{ rows.length }} 项</a-tag>
      </div>
    </section>
    <a-card class="section-card" :bordered="false">
      <template #title>{{ title }}</template>
      <template #extra>
        <a-button type="primary" @click="openCreate">新增</a-button>
      </template>
      <a-table :data="rows" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="编码" data-index="code" />
          <a-table-column title="状态">
            <template #cell="{ record }"><a-tag :color="record.enabled ? 'green' : 'gray'">{{ record.enabled ? '启用' : '停用' }}</a-tag></template>
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
    <a-modal v-model:visible="visible" :title="editingIndex >= 0 ? '编辑' : '新增'" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称"><a-input v-model="form.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="form.code" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="form.enabled" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { DictItem } from '@/types/system';

const props = defineProps<{ title: string; modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const visible = ref(false);
const editingIndex = ref(-1);
const form = reactive({ name: '', code: '', enabled: true });

const rows = computed<DictItem[]>(() => props.modelValue.map((name, index) => ({ id: `${index}`, code: name, name, enabled: true })));

const openCreate = () => {
  editingIndex.value = -1;
  form.name = '';
  form.code = '';
  form.enabled = true;
  visible.value = true;
};

const openEdit = (record: DictItem, index: number) => {
  editingIndex.value = index;
  form.name = record.name;
  form.code = record.code;
  form.enabled = record.enabled;
  visible.value = true;
};

const save = () => {
  const next = [...props.modelValue];
  const value = form.name.trim();
  if (!value) return;
  if (editingIndex.value >= 0) next[editingIndex.value] = value;
  else next.push(value);
  emit('update:modelValue', next);
  visible.value = false;
};

const remove = (index: number) => {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
};
</script>
