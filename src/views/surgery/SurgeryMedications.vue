<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="术中用药">
      <a-table :data="rows" :pagination="{ pageSize: 8 }" row-key="id" :scroll="{ x: 980 }">
        <template #columns>
          <a-table-column title="患者/手术" :width="210">
            <template #cell="{ record }">
              <strong>{{ record.patientName }}</strong>
              <p class="row-sub">{{ record.room }} · {{ record.surgeryName }}</p>
            </template>
          </a-table-column>
          <a-table-column title="类型" :width="90">
            <template #cell="{ record }"><a-tag :color="record.mode === '持续泵入' ? 'arcoblue' : 'gray'">{{ record.mode === '持续泵入' ? '持续' : '单次' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="时间" data-index="timeText" :width="160" />
          <a-table-column title="药品" data-index="drug" />
          <a-table-column title="剂量/泵速" data-index="amountText" :width="190" />
          <a-table-column title="途径" data-index="route" :width="90" />
          <a-table-column title="核对" :width="100">
            <template #cell="{ record }"><a-tag :color="record.highAlert && !record.checker ? 'red' : 'green'">{{ record.checker || '未核对' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }"><a-button size="mini" type="primary" @click="go(record.caseId)">查看</a-button></template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { MedicationRecord } from '@/types/anesthesia';

interface RowItem {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  surgeryName: string;
  mode: MedicationRecord['mode'];
  timeText: string;
  drug: string;
  amountText: string;
  route?: string;
  checker?: string;
  highAlert?: boolean;
}

const store = useAnesthesiaStore();
const router = useRouter();

const rows = computed<RowItem[]>(() => store.cases.flatMap((item) => item.medications.map((row) => ({
  id: `${item.id}-${row.id}`,
  caseId: item.id,
  patientName: item.patientName,
  room: item.room,
  surgeryName: item.surgeryName,
  mode: row.mode,
  timeText: medicationTime(row),
  drug: row.drug,
  amountText: medicationAmount(row),
  route: row.route,
  checker: row.checker,
  highAlert: row.highAlert,
}))));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
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
const go = (id: string) => router.push(`/surgery/record/${id}`);
</script>

<style scoped>
.row-sub {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 12px;
}
</style>
