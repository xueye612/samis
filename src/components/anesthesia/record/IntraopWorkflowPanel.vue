<template>
  <a-card class="workflow-panel" :bordered="false">
    <template #title>
      <div class="panel-title">
        <strong>当前任务</strong>
        <a-tag color="arcoblue" size="small">{{ stage }}</a-tag>
      </div>
    </template>

    <section class="context-controls">
      <label>
        <span>手术场景</span>
        <a-select
          :model-value="scenario"
          size="small"
          popup-container="body"
          :options="scenarioSelectOptions"
          @update:model-value="handleScenarioChange"
        />
      </label>
      <label>
        <span>当前阶段</span>
        <a-select
          :model-value="stage"
          size="small"
          popup-container="body"
          :options="stageSelectOptions"
          @update:model-value="handleStageChange"
        />
      </label>
    </section>

    <section v-if="recentEventLabel" class="recent-summary" :class="{ 'recent-active': recentEventLabel }">
      <span>最近记录</span>
      <strong>{{ recentEventLabel }}</strong>
    </section>

    <section v-if="pendingItems.length" class="workflow-section">
      <header>
        <strong>待确认记录</strong>
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

    <p v-else class="empty-hint">暂无待确认记录</p>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IntraopStage, SurgeryScenarioKey, SurgeryScenarioOption, TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';

const props = defineProps<{
  stage: IntraopStage;
  stageOptions: IntraopStage[];
  scenario: SurgeryScenarioKey;
  scenarioOptions: SurgeryScenarioOption[];
  recentEventLabel?: string;
  pendingItems: TemplateLandingItem[];
  locked?: boolean;
}>();

const emit = defineEmits<{
  'update:stage': [stage: IntraopStage];
  'update:scenario': [scenario: SurgeryScenarioKey];
  'confirm-all': [];
  'confirm-item': [landingId: string];
}>();

const stageSelectOptions = computed(() => props.stageOptions.map((value) => ({ label: value, value })));
const scenarioSelectOptions = computed(() => props.scenarioOptions.map((item) => ({ label: item.label, value: item.key })));

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

.context-controls {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 8px;
  margin-bottom: 8px;
}

.context-controls label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recent-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 6px 8px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #f8fbff;
}

.recent-summary.recent-active {
  border-color: #165dff;
  background: #f6fbff;
}

.recent-summary span,
.context-controls span,
.workflow-section header span,
.landing-item small {
  color: #64748b;
  font-size: 12px;
}

.workflow-section {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #dbe6f3;
}

.landing-list {
  display: grid;
  gap: 8px;
  max-height: none;
  overflow: visible;
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

.empty-hint {
  margin: 8px 0 0;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 520px) {
  .context-controls {
    grid-template-columns: 1fr;
  }
}
</style>
