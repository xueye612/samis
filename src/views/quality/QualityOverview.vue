<template>
  <ModulePageShell title="质控总览" description="日常质控抽查与 26 项专业指标看板入口">
    <template #chips>
      <a-tag color="red">不合格 {{ resultCount('不合格') }}</a-tag>
      <a-tag color="green">合格 {{ resultCount('合格') }}</a-tag>
      <a-tag color="orangered">待查 {{ resultCount('待查') }}</a-tag>
    </template>
    <template #stats>
      <MetricCard label="抽查项" :value="store.qualityChecks.length" icon="IconFile" />
      <MetricCard label="不合格" :value="resultCount('不合格')" icon="IconClose" variant="danger" />
      <MetricCard label="待整改" :value="rectifyCount" icon="IconExclamationCircle" variant="warn" />
    </template>
    <a-card class="section-card" :bordered="false">
      <template #title>26 项质控指标</template>
      <template #extra>
        <a-button type="primary" @click="router.push('/quality/dashboard')">
          进入质控看板
        </a-button>
      </template>
      <p class="bridge-desc">查看 26 项麻醉专业医疗质量控制指标的当前值、趋势分析与病例穿透。</p>
    </a-card>
    <a-card class="section-card" :bordered="false" title="质控抽查记录">
      <a-table :data="store.qualityChecks" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="检查项" data-index="checkItem" />
          <a-table-column title="标准" data-index="standard" />
          <a-table-column title="结果" :width="100">
            <template #cell="{ record }">
              <a-tag :color="checkResultColor(record.result)">{{ record.result }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="检查人" data-index="checker" :width="100" />
          <a-table-column title="检查日期" data-index="checkDate" :width="120" />
          <a-table-column title="问题描述" data-index="issueDesc" />
          <a-table-column title="整改状态" :width="100">
            <template #cell="{ record }">
              <a-tag v-if="record.rectifyStatus" :color="rectifyColor(record.rectifyStatus)">{{ record.rectifyStatus }}</a-tag>
              <span v-else class="muted">—</span>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { QualityCheckRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();

const resultCount = (result: QualityCheckRecord['result']) => store.qualityChecks.filter((item) => item.result === result).length;
const rectifyCount = computed(() => store.qualityChecks.filter((item) => item.rectifyStatus && item.rectifyStatus !== '已闭环').length);

const checkResultColor = (result: QualityCheckRecord['result']) => ({
  合格: 'green',
  不合格: 'red',
  待查: 'orangered',
}[result] ?? 'gray');

const rectifyColor = (status: NonNullable<QualityCheckRecord['rectifyStatus']>) => ({
  待整改: 'orangered',
  整改中: 'arcoblue',
  已闭环: 'green',
}[status] ?? 'gray');
</script>

<style scoped>
.bridge-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
</style>
