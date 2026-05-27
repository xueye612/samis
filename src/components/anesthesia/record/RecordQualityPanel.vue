<template>
  <aside class="quality-panel">
    <a-card :bordered="false" class="quality-card">
      <template #title>记录状态</template>
      <div class="status-grid">
        <div><span>记录</span><strong>{{ record.recordStatus ?? '未开始' }}</strong></div>
        <div><span>采集</span><strong>{{ record.device?.collectStatus ?? record.collectStatus ?? '未连接' }}</strong></div>
        <div><span>频率</span><strong>{{ record.vitalFrequency ?? '5分钟' }}</strong></div>
        <div><span>完整度</span><strong>{{ completeness }}%</strong></div>
      </div>
    </a-card>

    <a-card v-if="record.rescue?.supplementReminder" :bordered="false" class="quality-card rescue">
      <template #title>抢救补记</template>
      <p>请补齐抢救经过、用药、参加人员和结束时间。</p>
    </a-card>

    <a-card :bordered="false" class="quality-card">
      <template #title>关键节点</template>
      <div class="checkpoint-list">
        <span v-for="item in checkpoints" :key="item.label" :class="{ done: item.done }">{{ item.done ? '✓' : '○' }} {{ item.label }}</span>
      </div>
    </a-card>

    <a-card :bordered="false" class="quality-card">
      <template #title>异常生命体征</template>
      <a-empty v-if="!abnormalVitals.length" description="暂无异常" />
      <div v-else class="abnormal-list">
        <div v-for="item in abnormalVitals.slice(0, 6)" :key="item.id">
          <strong>{{ formatTime(item.time) }} {{ item.metric }} {{ item.value }}{{ item.unit }}</strong>
          <span>{{ item.handled ? '已闭环' : '待处置' }}</span>
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
import type { SurgeryCase } from '@/types/anesthesia';
import type { AbnormalVitalByDictionary, LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';

const props = defineProps<{
  record: SurgeryCase;
  checks: LiveRecordQualityCheck[];
  abnormalVitals: AbnormalVitalByDictionary[];
}>();

const passCount = computed(() => props.checks.filter((item) => item.status === '通过').length);
const warnCount = computed(() => props.checks.filter((item) => item.status === '警告').length);
const failCount = computed(() => props.checks.filter((item) => item.status === '未通过').length);
const completeness = computed(() => Math.round((passCount.value / Math.max(props.checks.length, 1)) * 100));
const checkpoints = computed(() => [
  { label: '入室', done: props.record.events.some((item) => item.type.includes('入室')) },
  { label: '麻醉开始', done: Boolean(props.record.anesthesiaStart) },
  { label: '手术开始', done: Boolean(props.record.surgeryStart) },
  { label: '手术结束', done: Boolean(props.record.surgeryEnd) },
  { label: '拔管/气道', done: props.record.events.some((item) => item.type.includes('拔管')) || !props.record.anesthesiaMethod.includes('全身') },
  { label: '离室去向', done: Boolean(props.record.leaveRoomTime || props.record.transferTo) },
]);

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

.status-grid span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.checkpoint-list,
.abnormal-list,
.log-list {
  display: grid;
  gap: 8px;
}

.checkpoint-list span.done {
  color: #047857;
  font-weight: 700;
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
</style>
