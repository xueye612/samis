<template>
  <div class="quality-page">
    <header class="quality-page-header">
      <div class="quality-page-header__main">
        <span class="quality-page-header__icon" aria-hidden="true">
          <icon-bar-chart />
        </span>
        <div>
          <h2 class="quality-page-header__title">麻醉专业质控指标</h2>
          <p class="quality-page-header__desc">26 项国家麻醉质控指标 · 单院部署演示</p>
        </div>
      </div>
      <span class="quality-hospital-badge">
        <icon-home />
        {{ HOSPITAL_NAME }}
      </span>
    </header>

    <a-card class="quality-filter-card section-card" :bordered="false">
      <template #title>
        <icon-filter />
        指标筛选
      </template>
      <template #extra>
        <div class="quality-filter-extra">
          <a-button type="primary" @click="store.refreshQualityIndicators">
            <template #icon><icon-search /></template>
            查询
          </a-button>
          <a-button @click="resetFilters">
            <template #icon><icon-refresh /></template>
            重置
          </a-button>
          <a-button @click="exportVisible = true">
            <template #icon><icon-download /></template>
            导出
          </a-button>
        </div>
      </template>

      <div class="time-filter-row">
        <div class="quick-periods">
          <span class="filter-label">
            <icon-calendar />
            快捷时间
          </span>
          <a-radio-group type="button" size="small" :model-value="store.qualityFilter.periodType" @change="setQuickPeriod">
            <a-radio value="月度">本月</a-radio>
            <a-radio value="季度">本季度</a-radio>
            <a-radio value="自定义">最近30天</a-radio>
            <a-radio value="年度">最近12个月</a-radio>
          </a-radio-group>
        </div>
        <a-form-item class="date-form-item">
          <template #label>
            <icon-schedule />
            时间范围
          </template>
          <a-range-picker
            class="date-range"
            mode="month"
            :model-value="monthRange"
            value-format="YYYY-MM"
            @change="onMonthRangeChange"
          />
        </a-form-item>
      </div>

      <div class="quality-filter">
        <a-form-item>
          <template #label>
            <icon-apps />
            指标分类
          </template>
          <a-select :model-value="store.qualityFilter.category" :options="categoryOptions" @change="setCategory" />
        </a-form-item>
        <a-form-item>
          <template #label>
            <icon-experiment />
            麻醉方式
          </template>
          <a-select v-model="store.qualityFilter.anesthesiaMethod" :options="anesthesiaOptions" />
        </a-form-item>
        <a-form-item>
          <template #label>
            <icon-location />
            手术间
          </template>
          <a-select v-model="store.qualityFilter.roomId" :options="roomOptions" />
        </a-form-item>
        <a-form-item>
          <template #label>
            <icon-user />
            麻醉医生
          </template>
          <a-select v-model="store.qualityFilter.doctorId" :options="doctorOptions" />
        </a-form-item>
        <a-button type="text" @click="showMoreFilters = !showMoreFilters">
          <template #icon><icon-menu /></template>
          {{ showMoreFilters ? '收起' : '更多' }}
        </a-button>
      </div>

      <div v-if="showMoreFilters" class="more-filter-panel">
        <a-form-item>
          <template #label>
            <icon-compass />
            手术地点
          </template>
          <a-select v-model="store.qualityFilter.locationType" :options="locationOptions" />
        </a-form-item>
        <a-form-item>
          <template #label>
            <icon-bookmark />
            手术类型
          </template>
          <a-select v-model="store.qualityFilter.surgeryType" :options="surgeryTypeOptions" />
        </a-form-item>
      </div>
    </a-card>

    <a-alert class="quality-demo-banner" type="info" show-icon>
      <template #icon><icon-info-circle /></template>
      演示数据：指标值由本地 Mock 病例（{{ store.qualityScope.totalCaseCount }} 例）推导；趋势与同比/环比为演示波形。
    </a-alert>

    <div class="quality-scope-bar">
      <a-tag color="arcoblue">
        <template #icon><icon-storage /></template>
        纳入 {{ store.qualityScope.matchedCaseCount }}/{{ store.qualityScope.totalCaseCount }} 例
      </a-tag>
      <a-tag>
        <template #icon><icon-unordered-list /></template>
        指标 {{ store.qualityScope.indicatorListCount }}/{{ store.qualityScope.indicatorListTotal }} 项
      </a-tag>
      <template v-for="label in store.qualityScope.activeFilterLabels" :key="label">
        <a-tag color="purple">{{ label }}</a-tag>
      </template>
      <a-tag v-if="store.qualityScope.timeScopeRelaxed" color="orangered">
        <template #icon><icon-clock-circle /></template>
        时间已放宽为全部演示病例
      </a-tag>
    </div>

    <a-alert
      v-if="store.qualityScope.emptyHint"
      type="warning"
      show-icon
      class="quality-empty-hint"
      :title="store.qualityScope.emptyHint"
    >
      <a-button type="primary" size="small" @click="resetFilters">重置筛选</a-button>
    </a-alert>

    <div class="quality-layout">
      <IndicatorList
        :indicators="store.indicatorDetails"
        :selected-code="store.selectedIndicatorCode"
        @select="store.setSelectedIndicator"
        @toggle-favorite="store.toggleFavoriteIndicator"
      />
      <IndicatorDetail v-if="selected" :detail="selected" :scope="store.qualityScope" @locate="goCaseDetail" />
    </div>

    <a-modal v-model:visible="exportVisible" title="导出当前指标" :footer="false">
      <a-alert type="info" show-icon>
        当前阶段为前端原型，导出按钮模拟导出当前筛选条件、图表和明细。后续接入后端后生成 Excel/PDF。
      </a-alert>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { HOSPITAL_NAME } from '@/config/hospital';
import IndicatorDetail from '@/components/quality/IndicatorDetail.vue';
import IndicatorList from '@/components/quality/IndicatorList.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { QualityCategory, QualityFilter } from '@/types/quality';

const router = useRouter();
const store = useAnesthesiaStore();
const exportVisible = ref(false);
const showMoreFilters = ref(false);

const monthRange = computed(() => [store.qualityFilter.startMonth, store.qualityFilter.endMonth]);

const onMonthRangeChange = (_value: unknown, _date: unknown, dateString?: (string | undefined)[]) => {
  if (!dateString || dateString.length < 2 || !dateString[0] || !dateString[1]) return;
  store.setQualityDateRange(dateString[0], dateString[1]);
};

const selected = computed(() => store.selectedIndicator ?? store.indicatorDetails[0]);
const goCaseDetail = (caseId: string) => router.push(`/surgery/detail/${caseId}`);
const setCategory = (value: string | number | boolean | Record<string, unknown> | Array<string | number | boolean | Record<string, unknown>>) => {
  const next = Array.isArray(value) ? value[0] : value;
  store.setQualityCategory((next || '全部') as '全部' | QualityCategory);
};

const setQuickPeriod = (value: string | number | boolean) => {
  const period = value as QualityFilter['periodType'];
  const now = dayjs();
  if (period === '月度') store.setQuickPeriod(period, now.startOf('month').format('YYYY-MM'), now.format('YYYY-MM'));
  if (period === '季度') {
    const quarterStartMonth = Math.floor(now.month() / 3) * 3;
    store.setQuickPeriod(period, now.month(quarterStartMonth).startOf('month').format('YYYY-MM'), now.format('YYYY-MM'));
  }
  if (period === '自定义') store.setQuickPeriod(period, now.subtract(30, 'day').format('YYYY-MM'), now.format('YYYY-MM'));
  if (period === '年度') store.setQuickPeriod(period, now.subtract(11, 'month').format('YYYY-MM'), now.format('YYYY-MM'));
};

const resetFilters = () => {
  store.resetQualityFilter();
  showMoreFilters.value = false;
};

const toOptions = (items: string[]) => items.map((item) => ({ label: item, value: item }));
const categoryOptions = [
  { label: '全部', value: '全部' },
  { label: '结构', value: 'structure' },
  { label: '过程', value: 'process' },
  { label: '结果', value: 'outcome' },
  { label: 'PACU', value: 'pacu' },
  { label: '术后', value: 'postoperative' },
  { label: '产科', value: 'obstetric' },
];
const anesthesiaOptions = toOptions(['全部', '全麻', '椎管内麻醉', '区域阻滞', 'MAC', '局麻监护']);
const locationOptions = toOptions(['全部', '手术室内', '手术室外', '内镜中心', '介入室', '产房']);
const surgeryTypeOptions = toOptions(['全部', '择期', '急诊', '日间', '产科', '介入']);
const doctorOptions = toOptions(['全部', '王睿', '沈卓', '梁琛', '顾南', '许清', '林琪']);
const roomOptions = toOptions(['全部', 'OR-01', 'OR-02', 'OR-03', 'OR-04', 'OR-05', 'OR-06', 'PACU', '室外麻醉点']);
</script>
