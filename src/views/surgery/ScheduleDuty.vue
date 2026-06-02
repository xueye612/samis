<template>
  <ModulePageShell title="值班排班" description="麻醉科当日及备班人员安排">
    <a-card v-if="nurseSummary.length" class="section-card" :bordered="false" title="当日手术人员排班（接口）">
      <a-table :data="nurseSummary" row-key="operationId" :pagination="{ pageSize: 6 }" size="small">
        <template #columns>
          <a-table-column title="手术间" data-index="room" :width="90" />
          <a-table-column title="台次" data-index="numberOfStations" :width="70" />
          <a-table-column title="麻醉医师" data-index="anesthesiologist" />
          <a-table-column title="护士" data-index="nurse" />
        </template>
      </a-table>
    </a-card>
    <a-card class="section-card" :bordered="false" title="值班表（演示）">
      <a-table :data="store.scheduleDuty" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="日期" data-index="date" :width="120" />
          <a-table-column title="班次" data-index="shift" :width="90" />
          <a-table-column title="科主任" data-index="doctor" />
          <a-table-column title="麻醉医师" data-index="anesthesiologist" />
          <a-table-column title="护士" data-index="nurse" />
          <a-table-column title="联系电话" data-index="phone" :width="140" />
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { loadNurseScheduleList, type NurseScheduleRow } from '@/services/anesthesia/scheduleService';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const nurseSummary = ref<NurseScheduleRow[]>([]);

onMounted(async () => {
  nurseSummary.value = await loadNurseScheduleList(dayjs().format('YYYY-MM-DD'));
});
</script>
