<template>
  <a-card class="workflow-panel" :bordered="false">
    <template #title>
      <div class="panel-title">
        <strong>术中记录工作台</strong>
        <a-tag color="arcoblue">{{ stage }}</a-tag>
      </div>
    </template>

    <section class="stage-summary">
      <div>
        <span>麻醉方式</span>
        <strong>{{ methodLabels.join(' + ') || '待确认' }}</strong>
      </div>
      <div>
        <span>方案</span>
        <strong>{{ selectedTemplateName || '未初始化模板' }}</strong>
      </div>
      <div>
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

    <section class="workflow-section">
      <header>
        <strong>待确认落单</strong>
        <a-button size="mini" type="primary" :disabled="locked || !pendingItems.length" @click="$emit('confirm-all')">全部确认</a-button>
      </header>
      <div v-if="pendingItems.length" class="landing-list">
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
      <a-empty v-else description="暂无待确认项" />
    </section>

    <section class="workflow-section">
      <header>
        <strong>待补字段 / 质控提醒</strong>
        <span>{{ completionGaps.length }}项</span>
      </header>
      <div v-if="completionGaps.length" class="gap-list">
        <div v-for="gap in completionGaps" :key="gap.id" class="gap-item" :class="`gap-${gap.level}`">
          <a-tag size="small" :color="gap.level === '预警' ? 'red' : gap.level === '关注' ? 'orange' : 'blue'">{{ gap.level }}</a-tag>
          <span>{{ gap.text }}</span>
        </div>
      </div>
      <a-alert v-else type="success" show-icon>当前阶段暂无明显缺项</a-alert>
    </section>
  </a-card>
</template>

<script setup lang="ts">
import type { CompletionGap, IntraopStage, QuickEventOption, TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';

defineProps<{
  stage: IntraopStage;
  methodLabels: string[];
  selectedTemplateName?: string;
  recentEventLabel?: string;
  quickEvents: QuickEventOption[];
  pendingItems: TemplateLandingItem[];
  completionGaps: CompletionGap[];
  locked?: boolean;
}>();

defineEmits<{
  'quick-event': [eventName: string];
  'confirm-all': [];
  'confirm-item': [landingId: string];
}>();

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

.stage-summary > div {
  display: grid;
  gap: 3px;
  padding: 8px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #f8fbff;
}

.stage-summary span,
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
.gap-list {
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

.gap-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 8px;
  border-radius: 6px;
  background: #f8fafc;
}

.gap-关注 {
  background: #fff7ed;
}

.gap-预警 {
  background: #fff1f0;
}
</style>
