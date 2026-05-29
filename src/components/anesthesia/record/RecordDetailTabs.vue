<template>
  <a-tabs v-model:active-key="activeKey" class="record-detail-tabs" lazy-load>
    <a-tab-pane key="patient" title="患者信息">
      <a-descriptions :column="3" bordered>
        <a-descriptions-item label="患者">{{ record.patientName }} {{ record.gender }} {{ record.age }}岁</a-descriptions-item>
        <a-descriptions-item label="住院号">{{ record.patientId ?? record.id }}</a-descriptions-item>
        <a-descriptions-item label="科室">{{ record.department }}</a-descriptions-item>
        <a-descriptions-item label="诊断">{{ record.diagnosis }}</a-descriptions-item>
        <a-descriptions-item label="手术">{{ record.surgeryName }}</a-descriptions-item>
        <a-descriptions-item label="身高/体重">{{ record.preVisit.height }}cm / {{ record.preVisit.weight }}kg</a-descriptions-item>
        <a-descriptions-item label="ASA">{{ record.asa }}</a-descriptions-item>
        <a-descriptions-item label="过敏史">{{ record.preVisit.allergy }}</a-descriptions-item>
        <a-descriptions-item label="禁食">{{ record.preVisit.fasting }}</a-descriptions-item>
      </a-descriptions>
    </a-tab-pane>

    <a-tab-pane key="anesthesia" title="麻醉信息">
      <div class="tab-grid">
        <a-card title="关键时间" :bordered="false">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="计划">{{ formatTime(record.plannedStart) }} - {{ formatTime(record.scheduledEnd) }}</a-descriptions-item>
            <a-descriptions-item label="启动">{{ formatTime(record.actualStart) || '-' }}</a-descriptions-item>
            <a-descriptions-item label="麻醉开始">{{ formatTime(record.anesthesiaStart) || '-' }}</a-descriptions-item>
            <a-descriptions-item label="手术开始">{{ formatTime(record.surgeryStart) || '-' }}</a-descriptions-item>
            <a-descriptions-item label="手术结束">{{ formatTime(record.surgeryEnd) || '-' }}</a-descriptions-item>
            <a-descriptions-item label="离室">{{ formatTime(record.leaveRoomTime) || '-' }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
        <a-card title="快速事件" :bordered="false">
          <a-space wrap>
            <a-button v-for="event in eventOptions" :key="event" size="small" :disabled="record.locked" @click="$emit('event', event)">{{ event }}</a-button>
          </a-space>
        </a-card>
      </div>
    </a-tab-pane>

    <a-tab-pane key="vitals" title="生命体征">
      <a-table :data="record.vitals" :pagination="{ pageSize: 8 }" size="small" :scroll="{ x: 980 }">
        <template #columns>
          <a-table-column title="时间" :width="96">
            <template #cell="{ record: row }">{{ formatTime(row.time) }}</template>
          </a-table-column>
          <a-table-column v-for="item in vitalItems" :key="item.shortCode" :title="item.shortCode" :width="86">
            <template #cell="{ record: row }">
              <a-tag v-if="isAbnormal(row, item)" color="red">{{ row[item.shortCode] }}</a-tag>
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
          <a-table :data="record.medications" :pagination="false" size="small">
            <template #columns>
              <a-table-column title="时间" :width="84"><template #cell="{ record: row }">{{ formatTime(row.time ?? row.startTime) }}</template></a-table-column>
              <a-table-column title="药品" data-index="drug" />
              <a-table-column title="剂量"><template #cell="{ record: row }">{{ row.dose ?? '' }}{{ row.unit ?? '' }}</template></a-table-column>
              <a-table-column title="途径" data-index="route" />
              <a-table-column title="核对"><template #cell="{ record: row }"><a-tag :color="row.highAlert && !row.checker ? 'red' : 'green'">{{ row.checker || '未核对' }}</a-tag></template></a-table-column>
            </template>
          </a-table>
        </a-card>
        <a-card title="输液输血" :bordered="false">
          <template #extra>
            <a-space>
              <a-select size="small" placeholder="从字典加输注" :options="fluidOptions" :disabled="record.locked" @change="(value) => $emit('fluid', String(value))" />
            </a-space>
          </template>
          <a-table :data="record.fluids" :pagination="false" size="small">
            <template #columns>
              <a-table-column title="类别" data-index="category" :width="90" />
              <a-table-column title="名称" data-index="name" />
              <a-table-column title="量"><template #cell="{ record: row }">{{ row.volume }}{{ row.unit ?? 'ml' }}</template></a-table-column>
              <a-table-column title="时间"><template #cell="{ record: row }">{{ formatTime(row.startTime) }} - {{ formatTime(row.endTime) || '进行中' }}</template></a-table-column>
              <a-table-column title="核对"><template #cell="{ record: row }"><a-tag :color="row.category === '血液制品' && !row.doubleCheck ? 'red' : 'green'">{{ row.doubleCheck ? '已核对' : '未核对' }}</a-tag></template></a-table-column>
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
import { quickEventOptions } from '@/mock/anesthesiaRecordPrototype';
import type { SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { LiveRecordQualityCheck } from '@/services/anesthesiaRecordEngine';

const props = defineProps<{
  record: SurgeryCase;
  activeTab?: string;
  vitalItems: VitalSignDictItem[];
  drugItems: DrugDictItem[];
  fluidItems: FluidBloodDictItem[];
  qualityChecks: LiveRecordQualityCheck[];
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

const eventOptions = quickEventOptions.map((item) => item.name);
const drugOptions = computed(() => props.drugItems.filter((item) => item.enabled).map((item) => ({ label: item.name, value: item.name })));
const fluidOptions = computed(() => props.fluidItems.filter((item) => item.enabled).map((item) => ({ label: `${item.subCategory} / ${item.name}`, value: item.name })));
const sortedEvents = computed(() => [...props.record.events].sort((a, b) => a.time.localeCompare(b.time)));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const eventTime = (type: string) => formatTime(props.record.events.find((item) => item.type === type)?.time);
const isAbnormal = (row: VitalSign, item: VitalSignDictItem) => {
  const value = row[item.shortCode as keyof VitalSign];
  return typeof value === 'number' && ((typeof item.lowerLimit === 'number' && value < item.lowerLimit) || (typeof item.upperLimit === 'number' && value > item.upperLimit));
};
const qualityColor = (status: string) => status === '通过' ? 'green' : status === '警告' ? 'orange' : 'red';
</script>

<style scoped>
.record-detail-tabs {
  margin-top: 12px;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1200px) {
  .tab-grid {
    grid-template-columns: 1fr;
  }
}
</style>
