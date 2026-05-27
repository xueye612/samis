<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="PDCA 持续改进">
      <template #extra><a-button type="primary" @click="openCreate">登记项目</a-button></template>
      <a-table :data="store.pdcaRecords" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="项目" data-index="title" />
          <a-table-column title="关联指标" data-index="indicatorCode" />
          <a-table-column title="问题" data-index="problem" />
          <a-table-column title="负责人" data-index="owner" />
          <a-table-column title="状态" data-index="status" />
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" title="PDCA 项目" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="标题"><a-input v-model="form.title" /></a-form-item>
        <a-form-item label="指标编码"><a-input v-model="form.indicatorCode" /></a-form-item>
        <a-form-item label="问题"><a-textarea v-model="form.problem" /></a-form-item>
        <a-form-item label="计划"><a-textarea v-model="form.plan" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { reactive, ref } from 'vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const visible = ref(false);
const form = reactive({ title: '', indicatorCode: '', problem: '', plan: '' });

const openCreate = () => {
  form.title = '';
  form.indicatorCode = '';
  form.problem = '';
  form.plan = '';
  visible.value = true;
};

const save = () => {
  store.savePdcaRecord({
    id: `pdca-${Date.now()}`,
    title: form.title,
    indicatorCode: form.indicatorCode,
    problem: form.problem,
    plan: form.plan,
    doAction: '',
    checkResult: '',
    actSummary: '',
    owner: '质控管理员',
    status: '进行中',
    updatedAt: dayjs().toISOString(),
  });
  visible.value = false;
};
</script>
