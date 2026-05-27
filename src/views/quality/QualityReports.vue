<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="月度质控报表">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="generate">生成报表</a-button>
          <a-button @click="store.exportQualityIndicators">导出 CSV</a-button>
        </a-space>
      </template>
      <a-table :data="store.qualityReportCache" :pagination="false" row-key="period">
        <template #columns>
          <a-table-column title="统计周期" data-index="period" />
          <a-table-column title="指标数" data-index="indicatorCount" />
          <a-table-column title="缺陷数" data-index="defectCount" />
          <a-table-column title="生成时间" data-index="generatedAt" />
          <a-table-column title="格式" data-index="exportFormat" />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const generate = () => store.refreshQualityIndicators();
</script>
