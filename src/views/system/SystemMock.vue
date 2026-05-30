<template>
  <ModulePageShell title="模拟数据配置" description="维护原型演示数据集与刷新策略">
    <template #chips>
      <a-tag color="arcoblue">病例 {{ store.cases.length }}</a-tag>
      <a-tag>PACU {{ store.pacuPatients.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false">
      <a-space direction="vertical" fill>
        <a-alert type="info" show-icon>当前为前端 Mock 原型，所有业务数据来自 qualitySeed 与 clinical 同步。</a-alert>
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="手术病例">{{ store.cases.length }}</a-descriptions-item>
          <a-descriptions-item label="PACU 患者">{{ store.pacuPatients.length }}</a-descriptions-item>
          <a-descriptions-item label="质控缺陷">{{ store.qualityDefects.length }}</a-descriptions-item>
          <a-descriptions-item label="数据集版本">{{ store.datasetVersion }}</a-descriptions-item>
        </a-descriptions>
        <a-space>
          <a-button type="primary" @click="refresh">刷新临床模块 Mock</a-button>
          <a-button @click="router.push('/quality/dashboard')">查看质控数据集</a-button>
        </a-space>
      </a-space>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const refresh = () => {
  store.refreshClinicalModules();
  Message.success('Mock 数据已刷新');
};
</script>
