<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="输液输血">
      <a-table :data="rows" :pagination="{ pageSize: 8 }" row-key="id" :scroll="{ x: 980 }">
        <template #columns>
          <a-table-column title="患者/手术" :width="210">
            <template #cell="{ record }">
              <strong>{{ record.patientName }}</strong>
              <p class="row-sub">{{ record.room }} · {{ record.surgeryName }}</p>
            </template>
          </a-table-column>
          <a-table-column title="类别" :width="100">
            <template #cell="{ record }"><a-tag :color="record.category === '血液制品' ? 'red' : record.category === '自体血回输' ? 'orange' : 'green'">{{ record.category }}</a-tag></template>
          </a-table-column>
          <a-table-column title="时间" data-index="timeText" :width="160" />
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="容量" data-index="amountText" :width="100" />
          <a-table-column title="血型/核对" :width="130">
            <template #cell="{ record }">
              <span v-if="record.category === '血液制品'">{{ record.bloodType || '-' }} {{ record.rh || '' }}</span>
              <a-tag v-else color="green">普通输注</a-tag>
              <a-tag v-if="record.category === '血液制品'" :color="record.doubleCheck ? 'green' : 'red'">{{ record.doubleCheck ? '已核对' : '未核对' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="执行人" data-index="executor" :width="100" />
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
import type { FluidRecord } from '@/types/anesthesia';

interface RowItem {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  surgeryName: string;
  category: FluidRecord['category'];
  timeText: string;
  name: string;
  amountText: string;
  bloodType?: string;
  rh?: string;
  doubleCheck?: boolean;
  executor?: string;
}

const store = useAnesthesiaStore();
const router = useRouter();

const rows = computed<RowItem[]>(() => store.cases.flatMap((item) => item.fluids.map((row) => ({
  id: `${item.id}-${row.id}`,
  caseId: item.id,
  patientName: item.patientName,
  room: item.room,
  surgeryName: item.surgeryName,
  category: row.category,
  timeText: fluidTime(row),
  name: row.name,
  amountText: `${row.volume}${row.unit ?? 'ml'}`,
  bloodType: row.bloodType,
  rh: row.rh,
  doubleCheck: row.doubleCheck,
  executor: row.executor,
}))));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const fluidTime = (row: FluidRecord) => `${formatTime(row.startTime ?? row.time) || '-'} - ${formatTime(row.endTime) || '进行中'}`;
const go = (id: string) => router.push(`/surgery/record/${id}`);
</script>

<style scoped>
.row-sub {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 12px;
}
</style>
