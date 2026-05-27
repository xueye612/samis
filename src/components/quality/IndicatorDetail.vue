<template>
  <div class="indicator-detail">
    <div v-if="scope" class="indicator-scope-note">
      <span>统计范围：{{ scope.matchedCaseCount }} / {{ scope.totalCaseCount }} 例 Mock 病例</span>
      <span>表达式 {{ detail.expression }}</span>
      <span v-if="scope.timeScopeRelaxed" class="relaxed">时间筛选无匹配，已展示全部演示病例</span>
    </div>
    <MetricKpiCards :detail="detail" />

    <div class="overview-grid">
      <a-card :title="detail.chartTitle" class="section-card chart-card" :bordered="false">
        <div class="card-subtitle">
          <span class="section-icon"><icon-bar-chart /></span>
          年度趋势为演示波形（非真实按月汇总），当前策略：{{ sectionLabel(detail.yearTrendChartType) }}。
        </div>
        <IndicatorTrendChart :detail="detail" section="yearTrend" />
      </a-card>

      <IndicatorFormulaCard :detail="detail" />
    </div>

    <div class="section-chart-grid">
      <a-card title="季度对比" class="section-card chart-card" :bordered="false">
        <div class="card-subtitle">
          <span class="section-icon"><icon-calendar /></span>
          季度对比为演示数据，完成率类指标展示达标线。
        </div>
        <IndicatorTrendChart :detail="detail" section="quarterCompare" />
      </a-card>
      <a-card title="月份增长 / 环比变化" class="section-card chart-card" :bordered="false">
        <div class="card-subtitle">
          <span class="section-icon"><icon-bar-chart /></span>
          绿色表示按“{{ betterDirectionText }}”口径改善，红色表示需关注。
        </div>
        <IndicatorTrendChart :detail="detail" section="monthGrowth" />
      </a-card>
      <a-card title="维度分布" class="section-card chart-card distribution-card" :bordered="false">
        <div class="card-subtitle">
          <span class="section-icon"><icon-storage /></span>
          按科室、医生、手术间或麻醉方式观察差异。
        </div>
        <IndicatorTrendChart :detail="detail" section="dimensionDistribution" />
      </a-card>
    </div>

    <div class="analysis-grid">
      <a-card title="病例与数量穿透" class="section-card" :bordered="false">
        <div class="card-subtitle">
          <span class="section-icon"><icon-list /></span>
          点击下方数量查看对应病例清单
        </div>
        <div class="drill-stats">
          <button class="drill-stat numerator" type="button" @click="openDrawer(`${detail.numeratorLabel}明细`, detail.numeratorCases)">
            <span>{{ detail.numeratorLabel }}</span>
            <strong>{{ detail.numeratorValue }}</strong>
            <small>进入当前指标值的计入对象</small>
          </button>
          <button class="drill-stat denominator" type="button" @click="openDrawer(`${detail.denominatorLabel}明细`, detail.denominatorCases)">
            <span>{{ detail.denominatorLabel }}</span>
            <strong>{{ detail.denominatorValue }}</strong>
            <small>当前统计对象范围</small>
          </button>
          <button class="drill-stat defect" type="button" @click="openDrawer('异常病例明细', detail.defectCases)">
            <span>异常病例</span>
            <strong>{{ detail.defectCases.length }}</strong>
            <small>需要复核或整改的病例</small>
          </button>
        </div>
      </a-card>

      <a-card title="明细分析" class="section-card" :bordered="false">
        <div class="table-note">
          “{{ detail.numeratorShortLabel }}”对应 {{ detail.numeratorLabel }}；“{{ detail.denominatorShortLabel }}”对应 {{ detail.denominatorLabel }}。
        </div>
        <a-tabs default-active-key="unit" lazy-load>
          <a-tab-pane key="unit" title="子单元">
            <MetricDetailTable :rows="unitRows" :columns="analysisColumns('单元')" />
          </a-tab-pane>
          <a-tab-pane key="entity" title="子实体">
            <MetricDetailTable :rows="entityRows" :columns="analysisColumns('实体')" />
          </a-tab-pane>
          <a-tab-pane key="null" title="空值">
            <MetricDetailTable :rows="nullRows" :columns="nullColumns" />
          </a-tab-pane>
          <a-tab-pane key="defect" title="异常病例">
            <MetricDetailTable :rows="defectRows" :columns="defectColumns" />
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </div>

    <a-card title="数据来源追溯" class="section-card" :bordered="false">
      <div class="source-trace">
        <span><b>统计范围来源</b>{{ detail.dataSources[0] }}</span>
        <span><b>计入对象来源</b>{{ detail.dataSources.slice(1).join('、') || detail.dataSources[0] }}</span>
        <span><b>关联方式</b>case_id</span>
        <span><b>排除规则</b>{{ detail.exclusionRules.join('；') }}</span>
      </div>
    </a-card>

    <IndicatorDrillDrawer v-model:visible="drawerVisible" :title="drawerTitle" :cases="drawerCases" @locate="$emit('locate', $event)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import IndicatorDrillDrawer from '@/components/quality/IndicatorDrillDrawer.vue';
import IndicatorFormulaCard from '@/components/quality/IndicatorFormulaCard.vue';
import IndicatorTrendChart from '@/components/quality/IndicatorTrendChart.vue';
import MetricDetailTable from '@/components/quality/MetricDetailTable.vue';
import MetricKpiCards from '@/components/quality/MetricKpiCards.vue';
import type { CaseSummary, IndicatorDetail, QualityBetterDirection, QualityScopeMeta, QualitySectionChartType } from '@/types/quality';

const props = defineProps<{ detail: IndicatorDetail; scope?: QualityScopeMeta }>();
defineEmits<{ locate: [caseId: string] }>();

const drawerVisible = ref(false);
const drawerTitle = ref('');
const drawerCases = ref<CaseSummary[]>([]);

const openDrawer = (title: string, cases: CaseSummary[]) => {
  drawerTitle.value = title;
  drawerCases.value = cases;
  drawerVisible.value = true;
};

const sectionTypeLabels: Record<QualitySectionChartType, string> = {
  combo: '折线 + 柱状组合图',
  areaTarget: '面积折线图 + 目标线',
  line: '折线图',
  stackedBar: '堆叠柱状图',
  bar: '柱状图',
  barTarget: '柱状图 + 达标线',
  growthBar: '环比变化柱状图',
  horizontalBar: '横向条形图',
  groupedBar: '分组柱状图',
  stackedHorizontalBar: '堆叠条形图',
  abnormalBar: '异常数量柱状图',
};

const directionLabels: Record<QualityBetterDirection, string> = {
  higher: '越高越好',
  lower: '越低越好',
  neutral: '结构稳定',
};

const sectionLabel = (type: QualitySectionChartType) => sectionTypeLabels[type];
const betterDirectionText = computed(() => directionLabels[props.detail.betterDirection]);

const unitRows = computed(() =>
  props.detail.detailTabsData.subUnits.map((item, index) => ({
    id: `unit-${index}`,
    name: item.name,
    value: `${item.value}${props.detail.unit === '%' || props.detail.unit === '‰' ? props.detail.unit : ''}`,
    numerator: item.numeratorValue,
    denominator: item.denominatorValue,
  })),
);

const entityRows = computed(() =>
  props.detail.detailTabsData.subEntities.map((item, index) => ({
    id: `entity-${index}`,
    name: item.name,
    value: `${item.value}${props.detail.unit === '%' || props.detail.unit === '‰' ? props.detail.unit : ''}`,
    numerator: item.numeratorValue,
    denominator: item.denominatorValue,
  })),
);

const nullRows = computed(() =>
  props.detail.detailTabsData.nullValues.map((item, index) => ({
    id: `null-${index}`,
    fieldName: item.fieldName,
    missingCount: item.missingCount,
    caseNames: item.caseNames,
  })),
);

const defectRows = computed(() =>
  props.detail.detailTabsData.abnormalCases.map((item) => ({
    id: item.caseId,
    patientName: item.patientName,
    room: item.room,
    operationName: item.operationName,
    defectDesc: item.defectDesc ?? '指标异常病例',
  })),
);

const analysisColumns = (label: string) => [
  { title: label, dataIndex: 'name', width: 180 },
  { title: '指标值', dataIndex: 'value', width: 100 },
  { title: props.detail.numeratorShortLabel, dataIndex: 'numerator', width: 120 },
  { title: props.detail.denominatorShortLabel, dataIndex: 'denominator', width: 120 },
];

const nullColumns = [
  { title: '字段', dataIndex: 'fieldName', width: 160 },
  { title: '缺失数', dataIndex: 'missingCount', width: 100 },
  { title: '病例', dataIndex: 'caseNames', width: 360 },
];

const defectColumns = [
  { title: '患者', dataIndex: 'patientName', width: 120 },
  { title: '手术间', dataIndex: 'room', width: 90 },
  { title: '手术', dataIndex: 'operationName', width: 240 },
  { title: '缺陷说明', dataIndex: 'defectDesc', width: 320 },
];
</script>

<style scoped>
.indicator-detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.indicator-scope-note {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 8px 12px;
  border: 1px dashed #c9d7e5;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
  color: #4e5969;
}

.indicator-scope-note .relaxed {
  color: #d4380d;
}

.overview-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(390px, 1fr) 280px;
  gap: 12px;
  align-items: stretch;
}

.section-chart-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.distribution-card {
  grid-column: 1 / -1;
}

.chart-card {
  min-width: 0;
}

.card-subtitle,
.table-note {
  margin-bottom: 12px;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.table-note {
  padding: 9px 11px;
  border-radius: 6px;
  background: #f5f8fc;
}

.analysis-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(300px, 0.4fr) minmax(0, 0.6fr);
  gap: 14px;
  align-items: start;
}

.drill-stats {
  display: grid;
  gap: 10px;
}

.drill-stat {
  min-width: 0;
  width: 100%;
  padding: 13px;
  border: 1px solid #e4ebf3;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.drill-stat:hover {
  border-color: #b9d8ff;
  background: #fbfdff;
}

.drill-stat span,
.drill-stat small {
  display: block;
  overflow: hidden;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drill-stat span {
  color: #1d2733;
  font-weight: 600;
}

.drill-stat strong {
  display: block;
  margin: 6px 0;
  color: #0f5ca8;
  font-size: 26px;
  line-height: 32px;
}

.drill-stat.defect strong {
  color: #dc2626;
}

.source-trace {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.source-trace span {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f7fafc;
  color: #405064;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.source-trace b {
  display: block;
  margin-bottom: 4px;
  color: #1d2733;
}

@media (max-width: 1200px) {
  .overview-grid,
  .section-chart-grid,
  .analysis-grid,
  .source-trace {
    grid-template-columns: 1fr;
  }

  .distribution-card {
    grid-column: auto;
  }
}
</style>
