<template>
  <div class="quality-page quality-dashboard-restored">
    <header class="quality-page-header">
      <div class="quality-page-header__main">
        <span class="quality-page-header__icon"><icon-bar-chart /></span>
        <div>
          <h2 class="quality-page-header__title">麻醉专业质控指标</h2>
          <p class="quality-page-header__desc">真实服务端指标、计算口径、异常分布与病例穿透</p>
        </div>
      </div>
      <a-tag color="green">真实数据</a-tag>
    </header>

    <a-card class="quality-filter-card section-card" :bordered="false" title="指标筛选">
      <template #extra>
        <a-space>
          <a-button type="primary" :loading="loading" @click="reload"><template #icon><icon-search /></template>查询</a-button>
          <a-button @click="reset"><template #icon><icon-refresh /></template>重置</a-button>
          <a-button :disabled="!indicators.length" @click="exportCsv"><template #icon><icon-download /></template>导出当前指标</a-button>
        </a-space>
      </template>
      <div class="dashboard-filter-grid">
        <a-form-item label="统计月份">
          <a-range-picker v-model="months" mode="month" value-format="YYYY-MM" />
        </a-form-item>
        <a-form-item label="指标分类">
          <a-select v-model="category" :options="categoryOptions" />
        </a-form-item>
        <a-form-item label="手术间"><a-input v-model="roomId" allow-clear placeholder="全部手术间" /></a-form-item>
        <a-form-item label="麻醉医生"><a-input v-model="doctorId" allow-clear placeholder="全部医生" /></a-form-item>
      </div>
    </a-card>

    <a-alert v-if="error" type="error" show-icon>{{ error }}</a-alert>
    <a-alert v-else-if="!loading && !indicators.length" type="warning" show-icon>
      当前筛选范围没有可计算的真实指标。页面与图表未删除，请调整月份或确认服务端病例数据已进入质控计算范围。
    </a-alert>

    <a-spin :loading="loading" style="width: 100%">
      <div class="quality-kpis">
        <a-card v-for="item in kpis" :key="item.label" class="quality-kpi" :bordered="false">
          <span>{{ item.label }}</span><strong :class="item.tone">{{ item.value }}</strong><small>{{ item.hint }}</small>
        </a-card>
      </div>

      <QualityPortfolioCharts :status-rows="statusSummary" :category-rows="categorySummary" />

      <div class="quality-main-grid">
        <a-card class="section-card indicator-browser" :bordered="false" title="26项专业指标">
          <a-input-search v-model="keyword" allow-clear placeholder="搜索指标编码或名称" />
          <div class="real-indicator-list">
            <button
              v-for="item in visibleCards"
              :key="item.code"
              type="button"
              class="real-indicator-card"
              :class="{ active: item.code === selectedCode }"
              @click="selectIndicator(item.code)"
            >
              <span class="indicator-title"><b>{{ item.code }}</b>{{ item.name }}</span>
              <strong>{{ item.displayValue }}</strong>
              <span>{{ item.numerator }} / {{ item.denominator }}</span>
              <a-tag :color="statusColor(item.status)">{{ item.statusLabel }}</a-tag>
            </button>
            <a-empty v-if="!visibleCards.length" description="当前分类无匹配指标" />
          </div>
        </a-card>

        <div class="indicator-real-detail">
          <a-card v-if="selected" class="section-card" :bordered="false">
            <template #title>{{ selected.code }} · {{ selected.name }}</template>
            <template #extra><a-tag :color="statusColor(selected.status)">{{ selected.displayValue }} / {{ statusText(selected.status) }}</a-tag></template>
            <div class="formula-grid">
              <div><span>分子定义</span><strong>{{ selected.numeratorDefinition }}</strong></div>
              <div><span>分母定义</span><strong>{{ selected.denominatorDefinition }}</strong></div>
              <div><span>计算表达式</span><strong>{{ selected.expression }}</strong></div>
              <div><span>目标值</span><strong>{{ selected.target || '未配置' }}</strong></div>
            </div>
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="排除条件">{{ selected.exclusions.join('；') || '无' }}</a-descriptions-item>
              <a-descriptions-item label="证据字段">{{ selected.evidenceFields.join('；') || '未配置' }}</a-descriptions-item>
              <a-descriptions-item label="时间口径">{{ selected.timeWindow.anchor }} / {{ selected.timeWindow.granularity }} / {{ selected.timeWindow.timezone }}</a-descriptions-item>
              <a-descriptions-item label="整改动作">{{ selected.remediationAction || '—' }}</a-descriptions-item>
            </a-descriptions>
          </a-card>

          <a-card class="section-card" :bordered="false" title="病例穿透">
            <a-tabs v-model:active-key="drillKind">
              <a-tab-pane key="numerator" :title="`分子病例 ${detail?.numeratorCases?.length ?? 0}`" />
              <a-tab-pane key="denominator" :title="`分母病例 ${detail?.denominatorCases?.length ?? 0}`" />
              <a-tab-pane key="defect" :title="`异常病例 ${detail?.defectCases?.length ?? 0}`" />
            </a-tabs>
            <a-spin :loading="detailLoading">
              <a-table :data="drillRows" row-key="caseId" :pagination="{ pageSize: 8 }" :scroll="{ x: 760 }">
                <template #columns>
                  <a-table-column title="病例ID" data-index="caseId" :width="170" />
                  <a-table-column title="患者" data-index="patientName" :width="100" />
                  <a-table-column title="手术" data-index="operationName" :width="180" />
                  <a-table-column title="手术间" data-index="room" :width="90" />
                  <a-table-column title="麻醉方式" data-index="anesthesiaMethod" :width="120" />
                  <a-table-column title="异常说明" data-index="defectDesc" :width="180" />
                  <a-table-column title="操作" :width="80"><template #cell="{ record }"><a-link @click="goCase(record.caseId)">穿透</a-link></template></a-table-column>
                </template>
              </a-table>
            </a-spin>
          </a-card>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import QualityPortfolioCharts from '@/components/quality/QualityPortfolioCharts.vue';
import { qualityApi, type QualityIndicatorApi, type QualityIndicatorDetailApi } from '@/api/quality';
import {
  buildCategorySummary,
  buildIndicatorCards,
  buildStatusSummary,
  normalizeDrilldownRows,
  qualityStatusLabel,
} from '@/services/quality/qualityDashboardPresentation';
import { downloadTextFile } from '@/services/clinicalSync';
import type { QualityCategory } from '@/types/quality';

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const error = ref('');
const indicators = ref<QualityIndicatorApi[]>([]);
const detail = ref<QualityIndicatorDetailApi | null>(null);
const selectedCode = ref('');
const keyword = ref('');
const category = ref<'全部' | QualityCategory>('全部');
const roomId = ref('');
const doctorId = ref('');
const months = ref([dayjs().startOf('year').format('YYYY-MM'), dayjs().format('YYYY-MM')]);
const drillKind = ref<'numerator' | 'denominator' | 'defect'>('defect');

const categoryOptions = [
  { label: '全部', value: '全部' }, { label: '结构', value: 'structure' }, { label: '过程', value: 'process' },
  { label: '结果', value: 'outcome' }, { label: 'PACU', value: 'pacu' }, { label: '术后', value: 'postoperative' }, { label: '产科', value: 'obstetric' },
];
const cards = computed(() => buildIndicatorCards(indicators.value));
const visibleCards = computed(() => {
  const word = keyword.value.trim().toLowerCase();
  return cards.value.filter((item) => (!word || `${item.code}${item.name}`.toLowerCase().includes(word)) && (category.value === '全部' || item.category === category.value));
});
const selected = computed(() => indicators.value.find((row) => row.code === selectedCode.value) ?? null);
const categorySummary = computed(() => buildCategorySummary(indicators.value));
const statusSummary = computed(() => buildStatusSummary(indicators.value));
const drillRows = computed(() => normalizeDrilldownRows(detail.value, drillKind.value));
const kpis = computed(() => [
  { label: '质控指标', value: indicators.value.length, hint: '服务端返回指标数', tone: '' },
  { label: '有数据指标', value: indicators.value.filter((x) => x.status !== 'no-data').length, hint: '分母具备计算条件', tone: 'positive' },
  { label: '异常/预警', value: indicators.value.filter((x) => x.status === 'abnormal' || x.status === 'warning').length, hint: '需要复核与整改', tone: 'danger' },
  { label: '无数据', value: indicators.value.filter((x) => x.status === 'no-data').length, hint: '不以模拟值填充', tone: 'muted' },
]);

const query = () => ({ startMonth: months.value[0], endMonth: months.value[1], roomId: roomId.value || undefined, doctorId: doctorId.value || undefined });
async function reload() {
  loading.value = true; error.value = '';
  try {
    indicators.value = await qualityApi.getIndicators(query());
    selectedCode.value = indicators.value.some((row) => row.code === selectedCode.value) ? selectedCode.value : (indicators.value[0]?.code ?? '');
    await loadDetail();
  } catch (e) {
    indicators.value = []; detail.value = null; error.value = `加载失败：${(e as Error).message}`;
  } finally { loading.value = false; }
}
async function loadDetail() {
  if (!selectedCode.value) { detail.value = null; return; }
  detailLoading.value = true;
  try { detail.value = await qualityApi.getIndicatorDetail(selectedCode.value, query()); }
  catch (e) { detail.value = null; Message.error(`病例穿透加载失败：${(e as Error).message}`); }
  finally { detailLoading.value = false; }
}
async function selectIndicator(code: string) { selectedCode.value = code; await loadDetail(); }
function reset() { category.value = '全部'; roomId.value = ''; doctorId.value = ''; months.value = [dayjs().startOf('year').format('YYYY-MM'), dayjs().format('YYYY-MM')]; void reload(); }
function statusColor(status: QualityIndicatorApi['status']) { return status === 'normal' ? 'green' : status === 'warning' ? 'orange' : status === 'abnormal' ? 'red' : 'gray'; }
const statusText = qualityStatusLabel;
function goCase(caseId: string) { router.push({ name: 'record', params: { id: caseId }, query: { from: 'quality' } }); }
function exportCsv() {
  const rows = [['code', 'name', 'category', 'numerator', 'denominator', 'displayValue', 'status'], ...indicators.value.map((x) => [x.code, x.name, x.category, String(x.numerator), String(x.denominator), x.displayValue, x.status])];
  downloadTextFile(`quality-indicators-${months.value.join('-')}.csv`, rows.map((row) => row.map((v) => `"${v.split('"').join('""')}"`).join(',')).join('\n'));
}
onMounted(reload);
</script>

<style scoped>
.quality-dashboard-restored { display: flex; flex-direction: column; gap: 12px; }
.dashboard-filter-grid { display: grid; grid-template-columns: minmax(260px, 1.4fr) repeat(3, minmax(150px, 1fr)); gap: 12px; }
.dashboard-filter-grid :deep(.arco-form-item) { margin-bottom: 0; }
.quality-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.quality-kpi span, .quality-kpi small { display: block; color: #86909c; }
.quality-kpi strong { display: block; margin: 8px 0; color: #165dff; font-size: 28px; }
.quality-kpi strong.positive { color: #00a870; }.quality-kpi strong.danger { color: #f53f3f; }.quality-kpi strong.muted { color: #86909c; }
.quality-main-grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 12px; margin-top: 12px; align-items: start; }
.indicator-browser { position: sticky; top: 8px; }
.real-indicator-list { max-height: 720px; margin-top: 10px; overflow: auto; display: grid; gap: 8px; }
.real-indicator-card { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; width: 100%; padding: 11px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fff; text-align: left; cursor: pointer; }
.real-indicator-card:hover, .real-indicator-card.active { border-color: #165dff; background: #f2f7ff; }
.indicator-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.indicator-title b { margin-right: 6px; color: #165dff; }
.indicator-real-detail { min-width: 0; display: grid; gap: 12px; }
.formula-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.formula-grid div { padding: 12px; border-radius: 8px; background: #f7f8fa; }.formula-grid span { display: block; margin-bottom: 5px; color: #86909c; }.formula-grid strong { line-height: 1.5; }
@media (max-width: 1180px) { .dashboard-filter-grid, .quality-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }.quality-main-grid { grid-template-columns: 1fr; }.indicator-browser { position: static; } }
</style>
