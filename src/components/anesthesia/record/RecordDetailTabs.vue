<template>
  <a-tabs v-model:active-key="activeKey" class="record-detail-tabs" lazy-load>
    <a-tab-pane key="patient" title="患者信息">
      <div class="detail-info-grid">
        <div class="detail-info-item"><span>姓名</span><strong>{{ record.patientName }}</strong></div>
        <div class="detail-info-item"><span>性别/年龄</span><strong>{{ record.gender }} {{ formatAge(record.age) }}</strong></div>
        <div class="detail-info-item"><span>住院号</span><strong>{{ record.patientId ?? record.id }}</strong></div>
        <div class="detail-info-item"><span>科室</span><strong>{{ record.department || '—' }}</strong></div>
        <div class="detail-info-item"><span>ASA</span><strong>{{ record.asa || '—' }}</strong></div>
        <div class="detail-info-item"><span>身高/体重</span><strong>{{ record.preVisit.height }}cm / {{ record.preVisit.weight }}kg</strong></div>
        <div class="detail-info-item"><span>过敏史</span><strong>{{ record.preVisit.allergy || '无' }}</strong></div>
        <div class="detail-info-item"><span>禁食</span><strong>{{ record.preVisit.fasting || '—' }}</strong></div>
        <div class="detail-info-item detail-info-item--full"><span>诊断</span><strong>{{ record.diagnosis || '—' }}</strong></div>
        <div class="detail-info-item detail-info-item--full"><span>拟施手术</span><strong>{{ record.surgeryName || '—' }}</strong></div>
        <div class="detail-info-item detail-info-item--full"><span>实施手术</span><strong>{{ record.actualSurgeryName || record.surgeryName || '—' }}</strong></div>
      </div>
    </a-tab-pane>

    <a-tab-pane key="anesthesia" title="麻醉信息">
      <a-descriptions :column="2" bordered size="small" class="anesthesia-summary">
        <a-descriptions-item label="麻醉方式">{{ record.anesthesiaMethod }}</a-descriptions-item>
        <a-descriptions-item label="记录状态">{{ record.recordStatus ?? '未开始' }}</a-descriptions-item>
        <a-descriptions-item label="插管时间">{{ formatTime(record.airwayRecord?.intubationTime) || eventTime('插管') || '未记录' }}</a-descriptions-item>
        <a-descriptions-item label="拔管时间">{{ formatTime(record.airwayRecord?.extubationTime) || eventTime('拔管') || '未记录' }}</a-descriptions-item>
        <a-descriptions-item label="离室时间">{{ formatTime(record.leaveRoomTime) || '未记录' }}</a-descriptions-item>
        <a-descriptions-item label="离室去向">{{ record.transferTo ?? record.recoveryRecord?.destination ?? '未记录' }}</a-descriptions-item>
      </a-descriptions>
      <a-alert type="info" show-icon class="timeline-edit-hint">
        关键时间节点请在记录单右侧「关键时间」面板录入；此处仅展示摘要。
      </a-alert>
    </a-tab-pane>

    <a-tab-pane key="vitals" title="生命体征">
      <a-table :data="record.vitals" :pagination="{ pageSize: 8 }" size="small" :scroll="{ x: 980 }">
        <template #empty>
          <a-empty description="暂无生命体征记录" />
        </template>
        <template #columns>
          <a-table-column title="时间" :width="96" fixed="left">
            <template #cell="{ record: row }">{{ formatTime(row.time) }}</template>
          </a-table-column>
          <a-table-column v-for="item in vitalItems" :key="item.shortCode" :title="item.shortCode" :width="86">
            <template #cell="{ record: row }">
              <a-tag v-if="isAbnormal(row, item)" color="red">{{ row[item.shortCode] }}{{ abnormalDirection(row, item) }}</a-tag>
              <span v-else>{{ row[item.shortCode] ?? '-' }}</span>
            </template>
          </a-table-column>
          <a-table-column title="来源" data-index="source" :width="120" />
          <a-table-column title="备注" data-index="remark" />
        </template>
      </a-table>
    </a-tab-pane>

    <a-tab-pane key="medication" title="用药/出入量">
      <div class="tab-grid">
        <a-card title="术中用药" :bordered="false">
          <template #extra>
            <a-select size="small" placeholder="从字典加药" :options="drugOptions" :disabled="record.locked" @change="(value) => $emit('drug', String(value))" />
          </template>
          <a-table :data="record.medications" :pagination="false" size="small" :scroll="{ x: 760 }">
            <template #columns>
              <a-table-column title="类型" :width="82">
                <template #cell="{ record: row }"><a-tag :color="row.mode === '持续泵入' ? 'arcoblue' : 'gray'">{{ row.mode === '持续泵入' ? '持续' : '单次' }}</a-tag></template>
              </a-table-column>
              <a-table-column title="时间" :width="150"><template #cell="{ record: row }">{{ medicationTime(row) }}</template></a-table-column>
              <a-table-column title="药品" data-index="drug" />
              <a-table-column title="剂量/泵速" :width="170"><template #cell="{ record: row }">{{ medicationAmount(row) }}</template></a-table-column>
              <a-table-column title="途径" data-index="route" :width="90" />
              <a-table-column title="核对" :width="96"><template #cell="{ record: row }"><a-tag :color="row.highAlert && !row.checker ? 'red' : 'green'">{{ row.checker || '未核对' }}</a-tag></template></a-table-column>
            </template>
          </a-table>
        </a-card>
        <a-card title="输液输血" :bordered="false">
          <template #extra>
            <a-space>
              <a-select size="small" placeholder="从字典加输注" :options="fluidOptions" :disabled="record.locked" @change="(value) => $emit('fluid', String(value))" />
            </a-space>
          </template>
          <a-table :data="record.fluids" :pagination="false" size="small" :scroll="{ x: 760 }">
            <template #columns>
              <a-table-column title="类别" data-index="category" :width="90" />
              <a-table-column title="名称" data-index="name" />
              <a-table-column title="量" :width="90"><template #cell="{ record: row }">{{ row.volume }}{{ row.unit ?? 'ml' }}</template></a-table-column>
              <a-table-column title="时间" :width="150"><template #cell="{ record: row }">{{ fluidTime(row) }}</template></a-table-column>
              <a-table-column title="核对" :width="96"><template #cell="{ record: row }"><a-tag :color="row.category === '血液制品' && !row.doubleCheck ? 'red' : 'green'">{{ row.doubleCheck ? '已核对' : '未核对' }}</a-tag></template></a-table-column>
            </template>
          </a-table>
        </a-card>
      </div>
    </a-tab-pane>

    <a-tab-pane key="airway" title="气道事件">
      <div class="tab-grid">
        <a-card title="气道记录" :bordered="false">
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="方式">{{ record.airwayRecord?.airwayMethod ?? (record.anesthesiaMethod.includes('全身') ? '气管插管' : '面罩通气') }}</a-descriptions-item>
            <a-descriptions-item label="插管">{{ formatTime(record.airwayRecord?.intubationTime) || eventTime('插管') || '未记录' }}</a-descriptions-item>
            <a-descriptions-item label="拔管">{{ formatTime(record.airwayRecord?.extubationTime) || eventTime('拔管') || '未记录' }}</a-descriptions-item>
            <a-descriptions-item label="困难气道">{{ record.airwayRecord?.difficultAirway ? record.airwayRecord.difficultMeasure : '无' }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
        <a-card title="事件时间线" :bordered="false">
          <a-timeline>
            <a-timeline-item v-for="event in sortedEvents" :key="event.id" :label="formatTime(event.time)" :dot-color="event.severity === '危急' || event.severity === '重度' ? 'red' : 'blue'">
              <strong>{{ event.type }}</strong> · {{ event.treatment }}
            </a-timeline-item>
          </a-timeline>
        </a-card>
      </div>
    </a-tab-pane>

    <a-tab-pane key="recovery" title="复苏交接">
      <a-descriptions :column="2" bordered>
        <a-descriptions-item label="离室时间">{{ formatTime(record.leaveRoomTime) || '-' }}</a-descriptions-item>
        <a-descriptions-item label="去向">{{ record.transferTo ?? record.recoveryRecord?.destination ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="Aldrete">{{ record.recoveryRecord?.aldrete ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="疼痛">{{ record.recoveryRecord?.painScore ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="交接护士">{{ record.recoveryRecord?.handoverNurse ?? record.anesthesiaNurse }}</a-descriptions-item>
        <a-descriptions-item label="接收人">{{ record.recoveryRecord?.receiver ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="交接备注" :span="2">{{ record.recoveryRecord?.handoverNote ?? '待记录' }}</a-descriptions-item>
      </a-descriptions>
    </a-tab-pane>

    <a-tab-pane key="quality" title="质控签名">
      <a-card v-if="(qualityDefects ?? []).length" title="当前病例质控缺陷" :bordered="false" class="defect-card">
        <a-table :data="qualityDefects ?? []" :pagination="false" size="small">
          <template #columns>
            <a-table-column title="缺陷" data-index="defectType" />
            <a-table-column title="级别" :width="90">
              <template #cell="{ record: row }"><a-tag :color="row.defectLevel === '严重' ? 'red' : 'orange'">{{ row.defectLevel }}</a-tag></template>
            </a-table-column>
            <a-table-column title="说明" data-index="defectDesc" />
          </template>
        </a-table>
      </a-card>
      <a-table :data="qualityChecks" :pagination="false" size="small">
        <template #columns>
          <a-table-column title="检查项" data-index="item" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record: row }"><a-tag :color="qualityColor(row.status)">{{ row.status }}</a-tag></template>
          </a-table-column>
          <a-table-column title="说明" data-index="message" />
        </template>
      </a-table>
    </a-tab-pane>
  </a-tabs>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { type AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { FluidRecord, MedicationRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';
import type { QualityDefect } from '@/types/quality';

const props = defineProps<{
  record: SurgeryCase;
  activeTab?: string;
  methodKeys: AnesthesiaMethodKey[];
  vitalItems: VitalSignDictItem[];
  drugItems: DrugDictItem[];
  fluidItems: FluidBloodDictItem[];
  qualityChecks: LiveRecordQualityCheck[];
  qualityDefects?: QualityDefect[];
}>();
const emit = defineEmits<{
  'update:activeTab': [value: string];
  event: [type: string];
  drug: [name: string];
  fluid: [name: string];
}>();

const activeKey = ref(props.activeTab ?? 'patient');
watch(() => props.activeTab, (value) => { if (value) activeKey.value = value; });
watch(activeKey, (value) => emit('update:activeTab', value));

const drugOptions = computed(() => props.drugItems.filter((item) => item.enabled).map((item) => ({ label: item.name, value: item.name })));
const fluidOptions = computed(() => props.fluidItems.filter((item) => item.enabled).map((item) => ({ label: `${item.subCategory} / ${item.name}`, value: item.name })));
const sortedEvents = computed(() => [...props.record.events].sort((a, b) => a.time.localeCompare(b.time)));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const formatAge = (value: unknown) => {
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 ? `${age}岁` : '—';
};
const medicationTime = (row: MedicationRecord) => {
  const start = formatTime(row.startTime ?? row.time) || '-';
  return row.mode === '持续泵入' ? `${start} - ${formatTime(row.stopTime ?? row.endTime) || '进行中'}` : start;
};
const medicationAmount = (row: MedicationRecord) => {
  const dose = `${row.dose ?? ''}${row.unit ?? ''}` || '-';
  return row.mode === '持续泵入'
    ? [row.pumpRate, row.totalAmount ? `总量${row.totalAmount}` : '', row.concentration].filter(Boolean).join(' / ') || dose
    : dose;
};
const fluidTime = (row: FluidRecord) => `${formatTime(row.startTime ?? row.time) || '-'} - ${formatTime(row.endTime) || '进行中'}`;
const eventTime = (type: string) => formatTime(props.record.events.find((item) => item.type === type)?.time);
const isAbnormal = (row: VitalSign, item: VitalSignDictItem) => {
  const value = row[item.shortCode as keyof VitalSign];
  return typeof value === 'number' && ((typeof item.lowerLimit === 'number' && value < item.lowerLimit) || (typeof item.upperLimit === 'number' && value > item.upperLimit));
};
const abnormalDirection = (row: VitalSign, item: VitalSignDictItem) => {
  const value = Number(row[item.shortCode as keyof VitalSign]);
  if (!Number.isFinite(value)) return '';
  if (typeof item.lowerLimit === 'number' && value < item.lowerLimit) return '↓';
  if (typeof item.upperLimit === 'number' && value > item.upperLimit) return '↑';
  return '';
};
const qualityColor = (status: string) => status === '通过' ? 'green' : status === '警告' ? 'orange' : 'red';
</script>

<style scoped>
.record-detail-tabs {
  margin-top: 12px;
}

/* 患者信息响应式描述网格：标签列固定宽度，内容列占剩余宽度，诊断/手术整行，
   长文本正常换行，绝不再逐字竖排（不使用 table-layout:fixed 的窄表格）。 */
.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.detail-info-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 6px;
  align-items: baseline;
  padding: 7px 9px;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  background: #f8fafc;
}

.detail-info-item--full {
  grid-column: 1 / -1;
}

.detail-info-item span {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.detail-info-item strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.defect-card {
  margin-bottom: 12px;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.timeline-edit-hint {
  margin-top: 10px;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }
}
</style>
