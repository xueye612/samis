<template>
  <ModulePageShell title="PACU 预约" description="术后 PACU 床位预约与接收状态">
    <a-card class="section-card" :bordered="false" title="预约列表">
      <a-table :data="store.pacuBookings" row-key="id" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="复苏室" :width="120">
            <template #cell="{ record }">{{ roomName(record.pacuRoomId) }}</template>
          </a-table-column>
          <a-table-column title="预约时间" data-index="bookingTime" :width="160" />
          <a-table-column title="预约医师" data-index="bookingDoctor" />
          <a-table-column title="类型" data-index="bookingType" :width="110" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="goCase(record.caseId)">病例</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuBooking } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();

const roomName = (roomId: string) => store.pacuRooms.find((r) => r.id === roomId)?.name ?? roomId;
const statusColor = (status: PacuBooking['status']) =>
  ({ 待接收: 'orange', 已接收: 'green', 已取消: 'gray' })[status] ?? 'gray';
const goCase = (caseId: string) => router.push(`/surgery/detail/${caseId}`);
</script>
