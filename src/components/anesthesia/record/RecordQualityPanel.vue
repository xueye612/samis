<template>
  <aside class="quality-panel">
    <a-collapse v-model:active-key="activeKeys" :bordered="false" expand-icon-position="right">
      <a-collapse-item key="abnormal" header="异常生命体征">
        <div v-if="!abnormalGroups.length" class="abnormal-empty">
          <p>暂无异常生命体征</p>
          <span>{{ abnormalEmptyHint }}</span>
        </div>
        <div v-else class="abnormal-list">
          <div v-for="item in visibleAbnormalGroups" :key="item.id" class="abnormal-item" :class="item.severity">
            <div class="abnormal-main">
              <strong>{{ formatTime(item.latestTime) }} {{ item.summary }}</strong>
              <span>{{ item.latestValue }}{{ item.unit }}</span>
            </div>
            <a-button size="mini" type="primary" @click="$emit('handle-abnormal-group', item)">处置</a-button>
          </div>
        </div>
        <a-button
          v-if="abnormalGroups.length > defaultVisibleCount"
          type="text"
          size="mini"
          class="abnormal-expand"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起历史' : `展开全部（${abnormalGroups.length}）` }}
        </a-button>
      </a-collapse-item>

      <a-collapse-item key="status" header="记录状态">
        <div class="status-grid">
          <div><span>记录</span><strong>{{ record.recordStatus ?? '未开始' }}</strong></div>
          <div><span>采集</span><strong>{{ record.device?.collectStatus ?? record.collectStatus ?? '未连接' }}</strong></div>
          <div><span>频率</span><strong>{{ record.vitalFrequency ?? '5分钟' }}</strong></div>
          <div><span>完整度</span><strong>{{ completeness }}%</strong></div>
        </div>
      </a-collapse-item>

      <a-collapse-item v-if="pendingFields.length" key="pending" header="待完善列表">
        <div class="pending-list">
          <div v-for="item in pendingFields" :key="item.key" class="pending-item">
            <strong>{{ item.label }}</strong>
            <span v-if="item.hint">{{ item.hint }}</span>
          </div>
        </div>
      </a-collapse-item>


      <a-collapse-item v-if="qualityDefects.length" key="defects" header="质控缺陷">
        <div class="defect-list">
          <button
            v-for="item in qualityDefects.slice(0, 4)"
            :key="item.defectId"
            type="button"
            class="defect-item"
            @click="$emit('focus-defect', item)"
          >
            <a-tag :color="item.defectLevel === '严重' ? 'red' : 'orange'" size="small">{{ item.defectLevel }}</a-tag>
            <span>{{ item.defectType }}</span>
          </button>
        </div>
      </a-collapse-item>

      <a-collapse-item key="quality" header="完整性检查">
        <div class="quality-mini">
          <strong>{{ passCount }}</strong><span>通过</span>
          <strong>{{ warnCount }}</strong><span>警告</span>
          <strong>{{ failCount }}</strong><span>未通过</span>
        </div>
      </a-collapse-item>
    </a-collapse>
  </aside>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import type { SurgeryCase } from '@/types/anesthesia';
import type { AggregatedAbnormalVital, LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';
import type { QualityDefect } from '@/types/quality';
import type { RecordPendingField } from '@/services/anesthesia/recordFieldCompleteness';

const props = withDefaults(defineProps<{
  record: SurgeryCase;
  checks: LiveRecordQualityCheck[];
  abnormalGroups: AggregatedAbnormalVital[];
  qualityDefects?: QualityDefect[];
  pendingFields?: RecordPendingField[];
  deviceCollecting?: boolean;
  defaultVisibleCount?: number;
}>(), {
  qualityDefects: () => [],
  pendingFields: () => [],
  deviceCollecting: false,
  defaultVisibleCount: 3,
});

defineEmits<{
  'focus-defect': [defect: QualityDefect];
  'handle-abnormal-group': [item: AggregatedAbnormalVital];
}>();

const activeKeys = ref(['abnormal']);
const expanded = ref(false);

const passCount = computed(() => props.checks.filter((item) => item.status === '通过').length);
const warnCount = computed(() => props.checks.filter((item) => item.status === '警告').length);
const failCount = computed(() => props.checks.filter((item) => item.status === '未通过').length);
const completeness = computed(() => Math.round((passCount.value / Math.max(props.checks.length, 1)) * 100));
const abnormalEmptyHint = computed(() => (
  props.deviceCollecting ? '最近采集正常' : '设备未采集'
));
const visibleAbnormalGroups = computed(() => (
  expanded.value ? props.abnormalGroups : props.abnormalGroups.slice(0, props.defaultVisibleCount)
));

const formatTime = (value: string) => dayjs(value).format('HH:mm');
</script>

<style scoped>
.quality-panel {
  display: grid;
  gap: 8px;
  align-content: start;
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

.pending-list {
  display: grid;
  gap: 6px;
}

.pending-item {
  padding: 6px 8px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
}

.pending-item strong {
  display: block;
}

.pending-item span {
  color: #64748b;
  font-size: 11px;
}

.abnormal-list {
  display: grid;
  gap: 8px;
}

.abnormal-empty {
  padding: 8px 10px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  background: #f8fafc;
  min-height: 52px;
}

.abnormal-empty p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.abnormal-empty span {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 11px;
}

.abnormal-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-radius: 6px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.abnormal-item.severe {
  background: #fef2f2;
  border-color: #fecaca;
}

.abnormal-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.abnormal-main strong {
  font-size: 12px;
}

.abnormal-main span {
  color: #64748b;
  font-size: 11px;
}

.abnormal-expand {
  margin-top: 4px;
  padding-left: 0;
}

.quality-mini {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto 1fr;
  gap: 6px;
  align-items: baseline;
}

.quality-mini strong {
  color: #165dff;
  font-size: 18px;
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
