<template>
  <ModulePageShell
    title="麻醉系统前端原型优化框架"
    description="面向下一步开发的界面优化、组件职责、数据字典、质控字段与打印/导出原型，不修改麻醉记录单本体。"
    shell-class="prototype-page"
  >
    <template #chips>
      <a-tag color="arcoblue">专业化视觉</a-tag>
      <a-tag color="green">数据驱动组件</a-tag>
      <a-tag color="cyan">质控可提取</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-select v-model="selectedCaseId" class="case-selector" placeholder="选择演示病例">
          <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
            {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
          </a-option>
        </a-select>
        <a-button type="primary" @click="router.push(`/surgery/detail/${selectedCaseId}`)">查看患者详情</a-button>
        <a-button @click="router.push(`/surgery/record/${selectedCaseId}`)">进入记录单</a-button>
        <a-button @click="exportPrototype">导出原型字段 JSON</a-button>
      </a-space>
    </template>

    <template #stats>
      <MetricCard
        v-for="item in metricCards"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :hint="item.hint"
        :tag="item.tag"
        :variant="item.variant"
        :icon="item.icon"
      />
    </template>

    <section class="design-direction-band">
      <article v-for="item in designDirections" :key="item.title" class="design-direction-card">
        <span>{{ item.eyebrow }}</span>
        <strong>{{ item.title }}</strong>
        <p>{{ item.description }}</p>
      </article>
    </section>

    <section class="prototype-grid">
      <div class="prototype-main">
        <a-card class="section-card" :bordered="false">
          <template #title>全流程原型蓝图</template>
          <div class="workflow-strip">
            <article v-for="(node, index) in workflowBlueprint" :key="node.key" class="workflow-node">
              <div class="workflow-node__index">{{ index + 1 }}</div>
              <div>
                <h3>{{ node.title }}</h3>
                <p>{{ node.output }}</p>
                <a-space wrap size="mini">
                  <a-tag v-for="module in node.modules" :key="module" size="small">{{ componentTitle(module) }}</a-tag>
                </a-space>
              </div>
            </article>
          </div>
        </a-card>

        <a-card class="section-card prototype-tabs-card" :bordered="false">
          <a-tabs v-model:active-key="activeTab" type="rounded">
            <a-tab-pane key="components" title="组件规划">
              <a-table :data="prototypeComponentPlans" row-key="key" :pagination="false" class="compact-table" :scroll="{ x: 1080 }">
                <template #columns>
                  <a-table-column title="组件" :width="170">
                    <template #cell="{ record }">
                      <strong>{{ record.title }}</strong>
                      <p class="row-sub">{{ record.key }}</p>
                    </template>
                  </a-table-column>
                  <a-table-column title="职责边界" data-index="responsibility" :width="270" />
                  <a-table-column title="核心数据" :width="260">
                    <template #cell="{ record }">
                      <a-space wrap size="mini">
                        <a-tag v-for="field in record.primaryData" :key="field" color="arcoblue" size="small">{{ field }}</a-tag>
                      </a-space>
                    </template>
                  </a-table-column>
                  <a-table-column title="交互" :width="220">
                    <template #cell="{ record }">{{ record.interactions.join(' / ') }}</template>
                  </a-table-column>
                  <a-table-column title="落地建议" data-index="nextStep" :width="280" />
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="intraop" title="术中数据梳理">
              <div class="split-panel">
                <a-card class="inner-card" :bordered="false" title="当前病例生命体征趋势">
                  <SimpleChart
                    type="line"
                    :labels="vitalTrend.labels"
                    :values="vitalTrend.values"
                    series-name="HR"
                    :height="220"
                  />
                </a-card>
                <a-card class="inner-card" :bordered="false" title="关键入量/事件摘要">
                  <div class="summary-list">
                    <div class="summary-row">
                      <span>用药记录</span>
                      <strong>{{ currentSnapshot?.medicationCount ?? 0 }} 条</strong>
                    </div>
                    <div class="summary-row">
                      <span>液体入量</span>
                      <strong>{{ currentSnapshot?.fluidVolume ?? 0 }} ml</strong>
                    </div>
                    <div class="summary-row">
                      <span>血制品</span>
                      <strong>{{ currentSnapshot?.bloodProductCount ?? 0 }} 条</strong>
                    </div>
                    <div class="summary-row">
                      <span>异常生命体征</span>
                      <strong>{{ currentSnapshot?.abnormalVitalCount ?? 0 }} 点</strong>
                    </div>
                  </div>
                </a-card>
              </div>
              <a-table :data="intraopRows" row-key="caseId" :pagination="{ pageSize: 6 }" class="compact-table" :scroll="{ x: 1120 }">
                <template #columns>
                  <a-table-column title="患者/手术" :width="230">
                    <template #cell="{ record }">
                      <strong>{{ record.patientName }}</strong>
                      <p class="row-sub">{{ record.room }} · {{ record.surgeryName }}</p>
                    </template>
                  </a-table-column>
                  <a-table-column title="状态" :width="100">
                    <template #cell="{ record }"><a-tag color="arcoblue">{{ record.status }}</a-tag></template>
                  </a-table-column>
                  <a-table-column title="用药" data-index="medicationCount" :width="90" />
                  <a-table-column title="高警示未核对" :width="130">
                    <template #cell="{ record }">
                      <a-tag :color="record.highAlertUncheckedCount ? 'red' : 'green'">{{ record.highAlertUncheckedCount }}</a-tag>
                    </template>
                  </a-table-column>
                  <a-table-column title="液体/血制品" :width="150">
                    <template #cell="{ record }">{{ record.fluidVolume }} ml / {{ record.bloodProductCount }} 条</template>
                  </a-table-column>
                  <a-table-column title="出量" :width="90">
                    <template #cell="{ record }">{{ record.outputVolume }} ml</template>
                  </a-table-column>
                  <a-table-column title="异常/事件" :width="120">
                    <template #cell="{ record }">{{ record.abnormalVitalCount }} / {{ record.qualityEventCount }}</template>
                  </a-table-column>
                  <a-table-column title="完成度" :width="170">
                    <template #cell="{ record }">
                      <a-progress :percent="record.completionScore / 100" size="small" :show-text="false" />
                      <span class="progress-label">{{ record.completionScore }}%</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="操作" :width="120" fixed="right">
                    <template #cell="{ record }">
                      <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${record.caseId}`)">查看</a-button>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="dictionary" title="数据字典">
              <div class="dictionary-summary">
                <article v-for="item in dictionarySummary" :key="item.name" class="dictionary-card">
                  <span>{{ item.name }}</span>
                  <strong>{{ item.enabled }}/{{ item.count }}</strong>
                  <p>{{ item.remark }}</p>
                </article>
              </div>
              <a-table :data="baseDictionaryFields" row-key="field" :pagination="false" class="compact-table" :scroll="{ x: 980 }">
                <template #columns>
                  <a-table-column title="域" data-index="domain" :width="120" />
                  <a-table-column title="字段" data-index="field" :width="230" />
                  <a-table-column title="类型" data-index="type" :width="150" />
                  <a-table-column title="单位/选项/默认值" :width="260">
                    <template #cell="{ record }">
                      <div>{{ [record.unit, record.options, record.defaultValue].filter(Boolean).join('；') || '-' }}</div>
                    </template>
                  </a-table-column>
                  <a-table-column title="必填" :width="90">
                    <template #cell="{ record }"><a-tag :color="record.required ? 'red' : 'gray'">{{ record.required ? '是' : '建议' }}</a-tag></template>
                  </a-table-column>
                  <a-table-column title="来源" data-index="source" :width="190" />
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="quality" title="质控与统计">
              <a-table :data="qualityExtractionFields" row-key="code" :pagination="false" class="compact-table" :scroll="{ x: 1080 }">
                <template #columns>
                  <a-table-column title="编码" data-index="code" :width="120" />
                  <a-table-column title="质控数据点" data-index="label" :width="190" />
                  <a-table-column title="字段路径" data-index="path" :width="240" />
                  <a-table-column title="统计逻辑" data-index="statistic" :width="220" />
                  <a-table-column title="缺陷规则" data-index="rule" :width="270" />
                  <a-table-column title="归属组件" data-index="owner" :width="130" />
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="visual" title="视觉与打印导出">
              <div class="split-panel">
                <a-card class="inner-card" :bordered="false" title="可视化建议">
                  <div class="guideline-list">
                    <article v-for="item in visualGuidelines" :key="item.area" class="guideline-item">
                      <strong>{{ item.area }}</strong>
                      <p>{{ item.recommendation }}</p>
                      <code>{{ item.token }}</code>
                    </article>
                  </div>
                </a-card>
                <a-card class="inner-card print-preview-card" :bordered="false" title="打印/导出样式预览">
                  <article class="print-preview">
                    <header>
                      <strong>麻醉小结摘要预览</strong>
                      <span>非麻醉记录单本体</span>
                    </header>
                    <p>患者：{{ currentCase?.patientName }} · {{ currentCase?.gender }} / {{ currentCase?.age }}岁</p>
                    <p>手术：{{ currentCase?.surgeryName }}</p>
                    <p>统计：用药 {{ currentSnapshot?.medicationCount ?? 0 }} 条，液体 {{ currentSnapshot?.fluidVolume ?? 0 }} ml，事件 {{ currentSnapshot?.qualityEventCount ?? 0 }} 条</p>
                    <a-divider />
                    <small>打印时隐藏导航、筛选和交互按钮，仅保留摘要、表格和签名区。</small>
                  </article>
                </a-card>
              </div>
              <div class="print-profile-grid">
                <article v-for="item in printExportProfiles" :key="item.name" class="print-profile">
                  <h3>{{ item.name }}</h3>
                  <p><strong>范围：</strong>{{ item.scope }}</p>
                  <p><strong>排除：</strong>{{ item.excludes }}</p>
                  <p><strong>样式：</strong>{{ item.style }}</p>
                </article>
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </div>

      <aside class="prototype-aside">
        <a-card class="section-card patient-card" :bordered="false" title="演示病例上下文">
          <template v-if="currentCase">
            <div class="patient-name">{{ currentCase.patientName }}</div>
            <p class="row-sub">{{ currentCase.department }} · {{ currentCase.diagnosis }}</p>
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="手术">{{ currentCase.surgeryName }}</a-descriptions-item>
              <a-descriptions-item label="麻醉方式">{{ currentCase.anesthesiaMethod }}</a-descriptions-item>
              <a-descriptions-item label="ASA">{{ currentCase.asa }}</a-descriptions-item>
              <a-descriptions-item label="状态">{{ currentCase.status }}</a-descriptions-item>
            </a-descriptions>
          </template>
        </a-card>

        <a-card class="section-card" :bordered="false" title="快捷操作面板原型">
          <div class="quick-action-list">
            <a-button long type="primary" @click="router.push('/surgery/pre-visit')">录入术前访视</a-button>
            <a-button long @click="router.push('/surgery/medications')">查看术中用药</a-button>
            <a-button long @click="router.push('/surgery/fluids')">查看液体/输血</a-button>
            <a-button long @click="router.push('/postoperative/followup')">术后随访</a-button>
            <a-button long @click="router.push('/quality/overview')">质控总览</a-button>
          </div>
        </a-card>

        <a-card class="section-card" :bordered="false" title="当前优化重点">
          <a-timeline>
            <a-timeline-item label="界面">统一 ModulePageShell、统计卡片、克制色彩与右侧面板</a-timeline-item>
            <a-timeline-item label="数据">字段路径、单位、默认值、必填项显式化</a-timeline-item>
            <a-timeline-item label="交互">病例上下文贯穿访视、小结、术中列表与质控</a-timeline-item>
            <a-timeline-item label="质控">从业务记录直接派生可统计字段</a-timeline-item>
          </a-timeline>
        </a-card>
      </aside>
    </section>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import SimpleChart from '@/components/shared/SimpleChart.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import {
  baseDictionaryFields,
  buildDictionarySummary,
  buildIntraopSnapshots,
  buildPrototypeMetrics,
  printExportProfiles,
  prototypeComponentPlans,
  qualityExtractionFields,
  visualGuidelines,
  workflowBlueprint,
  type PrototypeModuleKey,
} from '@/config/anesthesiaPrototype';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { AppIconName } from '@/icons/registry';

const store = useAnesthesiaStore();
const router = useRouter();
const activeTab = ref('components');
const selectedCaseId = ref(store.cases[0]?.id ?? '');

const metrics = computed(() => buildPrototypeMetrics(store.cases, store.followUps, store.configVitals));
const intraopRows = computed(() => buildIntraopSnapshots(store.cases, store.configVitals));
const currentCase = computed(() => store.cases.find((item) => item.id === selectedCaseId.value) ?? store.cases[0]);
const currentSnapshot = computed(() => intraopRows.value.find((item) => item.caseId === currentCase.value?.id));
const dictionarySummary = computed(() => buildDictionarySummary(store.configDrugs, store.configFluids, store.configVitals, store.configEvents));
const componentMap = computed(() => new Map(prototypeComponentPlans.map((item) => [item.key, item.title])));
const designDirections = [
  { eyebrow: '视觉', title: '医疗蓝绿灰白', description: '减少装饰性渐变和重阴影，通过边界、留白和状态色建立层级。' },
  { eyebrow: '交互', title: '短路径操作', description: '主操作置于工具条，病例上下文与待处理事项保留在右侧面板。' },
  { eyebrow: '数据', title: '字典驱动原型', description: '药品、液体、事件、体征字段结构化，直接服务统计和质控。' },
];

const metricCards = computed<Array<{ label: string; value: string | number; hint: string; tag?: string; variant?: 'default' | 'warn' | 'danger'; icon: AppIconName }>>(() => [
  { label: '病例总数', value: metrics.value.caseCount, hint: '当前 Mock 临床数据', icon: 'IconList' },
  { label: '术前访视率', value: `${metrics.value.preVisitRate}%`, hint: `${metrics.value.completedPreVisitCount} 例已完成`, tag: metrics.value.preVisitRate < 90 ? '需提升' : '达标', variant: metrics.value.preVisitRate < 90 ? 'warn' : 'default', icon: 'IconFile' },
  { label: '术后随访率', value: `${metrics.value.followUpRate}%`, hint: `${metrics.value.followUpCount} 条随访记录`, tag: metrics.value.followUpRate < 90 ? '待闭环' : '达标', variant: metrics.value.followUpRate < 90 ? 'warn' : 'default', icon: 'IconCalendar' },
  { label: '术中用药', value: metrics.value.medicationCount, hint: `高警示未核对 ${metrics.value.highAlertUncheckedCount} 条`, tag: metrics.value.highAlertUncheckedCount ? '风险' : '正常', variant: metrics.value.highAlertUncheckedCount ? 'danger' : 'default', icon: 'IconExperiment' },
  { label: '液体/输血', value: `${metrics.value.fluidVolumeTotal}ml`, hint: `血制品 ${metrics.value.bloodProductCount} 条，未核对 ${metrics.value.uncheckedBloodProductCount} 条`, tag: metrics.value.uncheckedBloodProductCount ? '核对' : '正常', variant: metrics.value.uncheckedBloodProductCount ? 'danger' : 'default', icon: 'IconSwap' },
  { label: '质控待处理', value: metrics.value.missingItemCount, hint: `未处置异常 ${metrics.value.unhandledAbnormalVitalCount} 点，未上报事件 ${metrics.value.unreportedQualityEventCount} 条`, tag: metrics.value.missingItemCount ? '待办' : '清零', variant: metrics.value.missingItemCount ? 'warn' : 'default', icon: 'IconExclamationCircle' },
]);

const vitalTrend = computed(() => {
  const rows = (currentCase.value?.vitals ?? []).slice(-8);
  return {
    labels: rows.map((item) => new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })),
    values: rows.map((item) => item.HR ?? 0),
  };
});

const componentTitle = (key: PrototypeModuleKey) => componentMap.value.get(key) ?? key;

const exportPrototype = () => {
  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    metrics: metrics.value,
    workflowBlueprint,
    componentPlans: prototypeComponentPlans,
    dictionaryFields: baseDictionaryFields,
    qualityExtractionFields,
    visualGuidelines,
    printExportProfiles,
    currentOptimizationFocus: ['统一页面视觉层级', '组件职责清晰化', '数据字典驱动内容', '质控字段可统计', '打印/导出不包含麻醉记录单本体'],
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anesthesia-prototype-fields.json';
  link.click();
  URL.revokeObjectURL(url);
  Message.success('原型字段 JSON 已导出');
};
</script>

<style scoped>
.case-selector {
  width: min(420px, 100%);
}

.prototype-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: start;
}

.design-direction-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: var(--space-4);
}

.design-direction-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background:
    linear-gradient(180deg, var(--surface-blue), var(--surface));
  box-shadow: var(--shadow-xs);
}

.design-direction-card span {
  color: var(--primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.design-direction-card strong {
  display: block;
  margin-top: 6px;
  color: var(--text-primary);
  font-size: var(--font-size-lg);
}

.design-direction-card p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.prototype-main,
.prototype-aside,
.quick-action-list,
.guideline-list {
  display: grid;
  gap: var(--space-4);
}

.workflow-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: var(--space-3);
}

.workflow-node {
  min-height: 170px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, var(--surface), var(--surface-muted));
  box-shadow: var(--shadow-xs);
}

.workflow-node__index {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  margin-bottom: var(--space-3);
  border-radius: 50%;
  background: var(--primary);
  color: var(--color-neutral-0);
  font-weight: 700;
}

.workflow-node h3,
.print-profile h3 {
  margin: 0 0 6px;
  font-size: var(--font-size-md);
}

.workflow-node p,
.guideline-item p,
.print-profile p {
  margin: 0 0 8px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.prototype-tabs-card {
  min-width: 0;
}

.row-sub {
  margin: 3px 0 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.split-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.inner-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.summary-list,
.quick-action-list {
  display: grid;
  gap: var(--space-3);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.summary-row:last-child {
  border-bottom: 0;
}

.summary-row span,
.progress-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.summary-row strong {
  color: var(--text-primary);
}

.progress-label {
  display: inline-block;
  margin-top: 4px;
}

.dictionary-summary,
.print-profile-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.dictionary-card,
.print-profile,
.guideline-item,
.print-preview {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.dictionary-card span {
  display: block;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.dictionary-card strong {
  display: block;
  margin-top: 4px;
  color: var(--primary);
  font-size: 24px;
}

.dictionary-card p {
  margin: 6px 0 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.guideline-item code {
  color: var(--primary);
  font-size: var(--font-size-xs);
}

.print-preview header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.print-preview p {
  margin: 0 0 8px;
}

.patient-name {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
}

@media (max-width: 1280px) {
  .prototype-grid,
  .split-panel {
    grid-template-columns: 1fr;
  }

  .workflow-strip,
  .design-direction-band,
  .dictionary-summary,
  .print-profile-grid {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }
}

@media (max-width: 720px) {
  .workflow-strip,
  .design-direction-band,
  .dictionary-summary,
  .print-profile-grid {
    grid-template-columns: 1fr;
  }
}

@media print {
  :global(.app-sider),
  :global(.app-header),
  :global(.app-subnav),
  :global(.app-footer),
  :global(.prototype-page .page-toolbar),
  :global(.prototype-page button) {
    display: none !important;
  }

  :global(.app-content) {
    padding: 0;
  }

  .prototype-aside,
  .case-selector,
  .prototype-tabs-card :deep(.arco-tabs-nav) {
    display: none;
  }

  .prototype-grid,
  .split-panel {
    display: block;
  }
}
</style>
