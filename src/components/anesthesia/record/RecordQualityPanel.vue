<template>
  <aside class="quality-panel">
    <a-card :bordered="false" class="quality-card">
      <template #title>记录状态</template>
      <div class="status-grid">
        <div><span>记录</span><strong>{{ record.recordStatus ?? '未开始' }}</strong></div>
        <div><span>采集</span><strong>{{ record.device?.collectStatus ?? record.collectStatus ?? '未连接' }}</strong></div>
        <div><span>频率</span><strong>{{ record.vitalFrequency ?? '5分钟' }}</strong></div>
        <div><span>完整度</span><strong>{{ completeness }}%</strong></div>
        <div class="status-span-2"><span>关键节点进度</span><strong>{{ milestoneProgress.done }}/{{ milestoneProgress.total }} 已记录</strong></div>
      </div>
    </a-card>

    <a-card v-if="record.rescue?.supplementReminder" :bordered="false" class="quality-card rescue">
      <template #title>抢救补记</template>
      <p>请补齐抢救经过、用药、参加人员和结束时间。</p>
    </a-card>

    <a-card v-if="qualityDefects.length" :bordered="false" class="quality-card defect-card">
      <template #title>质控缺陷</template>
      <div class="defect-list">
        <button
          v-for="item in qualityDefects.slice(0, 6)"
          :key="item.defectId"
          type="button"
          class="defect-item"
          @click="$emit('focus-defect', item)"
        >
          <a-tag :color="item.defectLevel === '严重' ? 'red' : 'orange'" size="small">{{ item.defectLevel }}</a-tag>
          <span>{{ item.defectType }}</span>
        </button>
      </div>
    </a-card>

    <a-card :bordered="false" class="quality-card">
      <template #title>异常生命体征</template>
      <a-empty v-if="!abnormalVitals.length" description="暂无异常" />
      <div v-else class="abnormal-list">
        <div v-for="item in abnormalVitals.slice(0, 6)" :key="item.id">
          <strong>{{ formatTime(item.time) }} {{ item.metric }} {{ item.value }}{{ item.unit }}</strong>
          <a-space>
            <span>{{ item.handled ? '已闭环' : '待处置' }}</span>
            <a-button v-if="!item.handled" size="mini" type="primary" @click="$emit('handle-abnormal', item)">处置</a-button>
          </a-space>
        </div>
      </div>
    </a-card>

    <a-card :bordered="false" class="quality-card">
      <template #title>完整性检查</template>
      <div class="quality-mini">
        <strong>{{ passCount }}</strong><span>通过</span>
        <strong>{{ warnCount }}</strong><span>警告</span>
        <strong>{{ failCount }}</strong><span>未通过</span>
      </div>
      <a-list :data="checks.slice(0, 6)" :bordered="false" size="small">
        <template #item="{ item }">
          <a-list-item>
            <a-tag :color="colorFor(item.status)">{{ item.status }}</a-tag>
            <span class="check-text">{{ item.item }}</span>
          </a-list-item>
        </template>
      </a-list>
    </a-card>

    <a-card :bordered="false" class="quality-card">
      <template #title>最近操作</template>
      <div class="log-list">
        <span v-for="log in record.operationLogs?.slice(0, 6)" :key="log">{{ log }}</span>
        <span v-if="!record.operationLogs?.length">暂无操作日志</span>
      </div>
    </a-card>
  </aside>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { deriveMethodSelectionFromCase, mergeSelectedMethods } from '@/services/anesthesiaRecordMethodEngine';
import { buildTimelineNodeStates } from '@/services/methodTimelineEngine';
import type { SurgeryCase } from '@/types/anesthesia';
import type { AbnormalVitalByDictionary, LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';
import type { QualityDefect } from '@/types/quality';

const props = withDefaults(defineProps<{
  record: SurgeryCase;
  checks: LiveRecordQualityCheck[];
  abnormalVitals: AbnormalVitalByDictionary[];
  qualityDefects?: QualityDefect[];
}>(), {
  qualityDefects: () => [],
});

defineEmits<{
  'focus-defect': [defect: QualityDefect];
  'handle-abnormal': [item: AbnormalVitalByDictionary];
}>();

const passCount = computed(() => props.checks.filter((item) => item.status === '通过').length);
const warnCount = computed(() => props.checks.filter((item) => item.status === '警告').length);
const failCount = computed(() => props.checks.filter((item) => item.status === '未通过').length);
const completeness = computed(() => Math.round((passCount.value / Math.max(props.checks.length, 1)) * 100));
const milestoneProgress = computed(() => {
  const selection = deriveMethodSelectionFromCase(props.record);
  const methodKeys = mergeSelectedMethods(selection.primary, selection.auxiliary);
  const nodes = buildTimelineNodeStates(props.record, methodKeys);
  return {
    done: nodes.filter((node) => node.recorded).length,
    total: nodes.length,
  };
});

const formatTime = (value: string) => dayjs(value).format('HH:mm');
const colorFor = (status: string) => status === '通过' ? 'green' : status === '警告' ? 'orange' : 'red';
</script>

<style scoped>
.quality-panel {
  display: grid;
  gap: 12px;
  align-content: start;
}

.quality-card {
  border-radius: 8px;
}

.quality-card.rescue {
  border: 1px solid #fecaca;
  background: #fff7f7;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.status-grid div {
  padding: 8px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  background: #f8fafc;
}

.status-grid .status-span-2 {
  grid-column: 1 / -1;
}

.status-grid span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.abnormal-list,
.log-list {
  display: grid;
  gap: 8px;
}

.abnormal-list div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: #fff7ed;
}

.quality-mini {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto 1fr;
  gap: 6px;
  align-items: baseline;
  margin-bottom: 8px;
}

.quality-mini strong {
  color: #165dff;
  font-size: 20px;
}

.check-text {
  margin-left: 6px;
}

.log-list span {
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
  color: #475569;
}

.defect-list {
  display: grid;
  gap: 8px;
}

.defect-item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  background: #fff7f7;
  text-align: left;
  cursor: pointer;
}
</style>
