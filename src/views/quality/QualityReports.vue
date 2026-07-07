<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="月度质控报表">
      <template #extra>
        <a-space>
          <a-button type="primary" :loading="loading" @click="generate">{{ useReal ? '拉取服务端报表' : '生成报表' }}</a-button>
          <a-button @click="handleExport">导出 CSV</a-button>
        </a-space>
      </template>

      <!-- 真实服务端报表（VITE_USE_REAL_QUALITY=true） -->
      <template v-if="useReal">
        <a-empty v-if="!report && !loading" description="点击右上角拉取服务端月度报表" />
        <div v-if="report">
          <a-table
            v-for="period in report.periods"
            :key="period.month"
            :data="period.indicators"
            :pagination="false"
            row-key="code"
            style="margin-bottom: 16px"
          >
            <template #title>
              <a-space>
                <b>{{ period.month }}</b>
                <span v-for="sub in period.categorySubtotals" :key="sub.category">
                  <a-tag>{{ categoryLabel[sub.category] }} 达标 {{ sub.met }}/{{ sub.withData }}</a-tag>
                </span>
              </a-space>
            </template>
            <template #columns>
              <a-table-column title="指标" data-index="name" />
              <a-table-column title="分类" data-index="category">
                <template #cell="{ record }">{{ categoryLabel[record.category as QualityCategory] ?? record.category }}</template>
              </a-table-column>
              <a-table-column title="分子" data-index="numerator" />
              <a-table-column title="分母" data-index="denominator" />
              <a-table-column title="当前值" data-index="displayValue" />
              <a-table-column title="状态" data-index="status">
                <template #cell="{ record }">
                  <a-tag :color="statusColor[record.status]">{{ statusText[record.status] }}</a-tag>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </template>

      <!-- Mock 兜底报表 -->
      <a-table v-else :data="store.qualityReportCache" :pagination="false" row-key="period">
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
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealQuality } from '@/config/apiFlags';
import { qualityApi, type QualityReportApi } from '@/api/quality';
import { exportQualityCsv, downloadTextFile } from '@/services/clinicalSync';
import { appendAuditLog } from '@/services/datasetStore';
import dayjs from 'dayjs';
import type { QualityCategory } from '@/types/quality';

const store = useAnesthesiaStore();
const useReal = useRealQuality();
const loading = ref(false);
const report = ref<QualityReportApi | null>(null);

const categoryLabel: Record<QualityCategory, string> = {
  structure: '结构',
  process: '过程',
  outcome: '结果',
  pacu: 'PACU',
  postoperative: '术后',
  obstetric: '产科',
};

const statusColor: Record<string, string> = {
  normal: 'green',
  warning: 'orange',
  abnormal: 'red',
  'no-data': 'gray',
};
const statusText: Record<string, string> = {
  normal: '达标',
  warning: '预警',
  abnormal: '异常',
  'no-data': '无数据',
};

const generate = async () => {
  if (!useReal) {
    store.refreshQualityIndicators();
    return;
  }
  loading.value = true;
  try {
    const now = new Date();
    const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    report.value = await qualityApi.getReport({ startMonth, endMonth });
  } catch (e) {
    Message.error(`服务端报表拉取失败：${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
};

const handleExport = async () => {
  if (!useReal) {
    store.exportQualityIndicators();
    return;
  }
  loading.value = true;
  try {
    // 真实模式：从后端 indicators 拉取当前筛选指标生成 CSV（plan 3.2）。
    const indicators = await qualityApi.getIndicators(store.qualityFilter);
    const csv = exportQualityCsv(indicators);
    downloadTextFile(`quality-indicators-${dayjs().format('YYYY-MM')}.csv`, csv);
    appendAuditLog({ user: '质控管理员', module: '麻醉质控', action: '导出', target: 'indicators', detail: `导出真实模式指标 CSV（${indicators.length} 项）` });
  } catch (e) {
    Message.error(`导出失败：${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
};
</script>
