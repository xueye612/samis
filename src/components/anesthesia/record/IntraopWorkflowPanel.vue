<template>
  <a-card class="workflow-panel" :bordered="false">
    <template #title>
      <div class="panel-title">
        <strong>场景化术中记录工作台</strong>
        <a-tag color="arcoblue">{{ stage }}</a-tag>
      </div>
    </template>

    <section class="context-controls">
      <label>
        <span>手术场景</span>
        <a-select :model-value="scenario" size="small" :options="scenarioSelectOptions" @change="handleScenarioChange" />
      </label>
      <label>
        <span>当前阶段</span>
        <a-select :model-value="stage" size="small" :options="stageSelectOptions" @change="handleStageChange" />
      </label>
    </section>

    <section class="stage-summary">
      <div>
        <span>麻醉方式</span>
        <strong>{{ methodLabels.join(' + ') || '待确认' }}</strong>
      </div>
      <div>
        <span>方案</span>
        <strong>{{ selectedTemplateName || '未初始化模板' }}</strong>
      </div>
      <div :class="{ 'recent-active': recentEventLabel }">
        <span>最近记录</span>
        <strong>{{ recentEventLabel || '暂无快捷事件' }}</strong>
      </div>
    </section>

    <section class="workflow-section">
      <header>
        <strong>当前阶段推荐动作</strong>
        <span>{{ quickEvents.length }}项</span>
      </header>
      <a-space wrap>
        <a-button
          v-for="event in quickEvents"
          :key="event.name"
          size="small"
          :status="event.severity === '中度' || event.severity === '重度' || event.severity === '危急' ? 'danger' : 'normal'"
          :disabled="locked"
          @click="$emit('quick-event', event.name)"
        >
          {{ event.name }}
        </a-button>
      </a-space>
    </section>

    <section v-if="recommendedItems.length" class="workflow-section">
      <header>
        <strong>当前推荐记录</strong>
        <span>{{ recommendedItems.length }}项</span>
      </header>
      <div class="guidance-list">
        <div v-for="item in recommendedItems" :key="item.id" class="guidance-item">
          <a-tag size="small" :color="levelColor(item.level)">{{ item.level }}</a-tag>
          <span>{{ item.text }}</span>
        </div>
      </div>
    </section>

    <section v-if="pendingItems.length" class="workflow-section">
      <header>
        <strong>待确认落单</strong>
        <a-button size="mini" type="primary" :disabled="locked || !pendingItems.length" @click="$emit('confirm-all')">全部确认</a-button>
      </header>
      <div class="landing-list">
        <button
          v-for="item in pendingItems"
          :key="item.landingId"
          type="button"
          class="landing-item"
          :disabled="locked"
          @click="$emit('confirm-item', item.landingId)"
        >
          <a-tag size="small" :color="kindColor(item.kind)">{{ kindLabel(item.kind) }}</a-tag>
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.value }}</small>
          </span>
        </button>
      </div>
    </section>

    <section class="workflow-section">
      <header>
        <strong>待补字段 / 质控提醒</strong>
        <span>{{ displayGaps.length }}项</span>
      </header>
      <div v-if="displayGaps.length" class="gap-list">
        <div v-for="gap in displayGaps" :key="gap.id" class="gap-item" :class="`gap-${gap.level}`">
          <a-tag size="small" :color="levelColor(gap.level)">{{ gap.level }}</a-tag>
          <span>{{ gap.text }}</span>
        </div>
      </div>
      <a-alert v-else type="success" show-icon>当前阶段暂无明显缺项</a-alert>
    </section>

    <section v-if="riskItems.length" class="workflow-section">
      <header>
        <strong>风险提醒</strong>
        <span>{{ riskItems.length }}项</span>
      </header>
      <div class="risk-list">
        <a-alert v-for="item in riskItems" :key="item.id" :type="item.level === '预警' ? 'warning' : 'info'" show-icon>
          {{ item.text }}
        </a-alert>
      </div>
    </section>

    <section v-if="nextSteps.length" class="workflow-section">
      <header>
        <strong>下一步建议</strong>
        <span>{{ nextSteps.length }}项</span>
      </header>
      <div class="next-list">
        <div v-for="item in nextSteps" :key="item.id">{{ item.text }}</div>
      </div>
    </section>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CompletionGap, IntraopStage, QuickEventOption, SurgeryScenarioKey, SurgeryScenarioOption, TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';
import type { WorkflowGuidanceItem } from '@/services/anesthesiaRecordMethodEngine';

const props = defineProps<{
  stage: IntraopStage;
  stageOptions: IntraopStage[];
  scenario: SurgeryScenarioKey;
  scenarioOptions: SurgeryScenarioOption[];
  methodLabels: string[];
  selectedTemplateName?: string;
  recentEventLabel?: string;
  quickEvents: QuickEventOption[];
  pendingItems: TemplateLandingItem[];
  completionGaps: CompletionGap[];
  recommendedItems: WorkflowGuidanceItem[];
  pendingGuidance: WorkflowGuidanceItem[];
  riskItems: WorkflowGuidanceItem[];
  nextSteps: WorkflowGuidanceItem[];
  locked?: boolean;
}>();

const emit = defineEmits<{
  'update:stage': [stage: IntraopStage];
  'update:scenario': [scenario: SurgeryScenarioKey];
  'quick-event': [eventName: string];
  'confirm-all': [];
  'confirm-item': [landingId: string];
}>();

const stageSelectOptions = computed(() => props.stageOptions.map((value) => ({ label: value, value })));
const scenarioSelectOptions = computed(() => props.scenarioOptions.map((item) => ({ label: item.label, value: item.key })));
const displayGaps = computed(() => props.pendingGuidance.length ? props.pendingGuidance : props.completionGaps.map((item) => ({ ...item, kind: 'pending' as const })));

const kindLabel = (kind: TemplateLandingItem['kind']) => ({
  event: '事件',
  medication: '用药',
  monitor: '监测',
  field: '字段',
}[kind]);

const kindColor = (kind: TemplateLandingItem['kind']) => ({
  event: 'arcoblue',
  medication: 'green',
  monitor: 'purple',
  field: 'orange',
}[kind]);

const levelColor = (level: '提示' | '关注' | '预警') => level === '预警' ? 'red' : level === '关注' ? 'orange' : 'blue';
const normalizeSelectValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
const handleStageChange = (value: unknown) => emit('update:stage', String(normalizeSelectValue(value)) as IntraopStage);
const handleScenarioChange = (value: unknown) => emit('update:scenario', String(normalizeSelectValue(value)) as SurgeryScenarioKey);
</script>

<style scoped>
.workflow-panel {
  border: 1px solid #dbe6f3;
  background: #fff;
}

.panel-title,
.workflow-section header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stage-summary {
  display: grid;
  gap: 8px;
}

.context-controls {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 8px;
  margin-bottom: 10px;
}

.context-controls label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.stage-summary > div {
  display: grid;
  gap: 3px;
  padding: 8px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #f8fbff;
}

.stage-summary > div.recent-active {
  border-color: #165dff;
  background: #f6fbff;
}

.stage-summary span,
.context-controls span,
.workflow-section header span,
.landing-item small {
  color: #64748b;
  font-size: 12px;
}

.workflow-section {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #dbe6f3;
}

.landing-list,
.gap-list,
.guidance-list,
.risk-list,
.next-list {
  display: grid;
  gap: 8px;
}

.landing-list {
  max-height: 320px;
  overflow: auto;
  padding-right: 2px;
}

.landing-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  width: 100%;
  padding: 8px;
  border: 1px solid #e5edf5;
  border-radius: 6px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.landing-item:hover {
  border-color: #165dff;
  background: #f6fbff;
}

.landing-item span {
  display: grid;
  min-width: 0;
}

.landing-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guidance-item,
.gap-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.guidance-item {
  border: 1px solid #e5edf5;
  background: #fbfdff;
}

.gap-关注 {
  background: #fff7ed;
}

.gap-预警 {
  background: #fff1f0;
}

.next-list div {
  padding: 8px 10px;
  border-left: 3px solid #165dff;
  border-radius: 6px;
  background: #f6fbff;
  color: #1d2939;
}

@media (max-width: 520px) {
  .context-controls {
    grid-template-columns: 1fr;
  }
}
</style>
