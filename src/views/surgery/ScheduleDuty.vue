<template>
  <ModulePageShell title="值班排班" description="麻醉科当日及备班人员安排">
    <a-card class="section-card" :bordered="false" title="值班表">
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
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
</script>
