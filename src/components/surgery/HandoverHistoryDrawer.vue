<template>
  <a-drawer :visible="visible" :width="760" title="交班历史" unmount-on-close @cancel="$emit('update:visible', false)">
    <a-table :data="history" :pagination="false" row-key="handoverVersionId" size="small">
      <template #columns>
        <a-table-column title="版本" data-index="version" :width="72" />
        <a-table-column title="状态" data-index="status" :width="100" />
        <a-table-column title="交班医生" data-index="outgoingDoctorName" />
        <a-table-column title="接班医生" data-index="incomingDoctorName" />
        <a-table-column title="交班时间" data-index="handoverAt" :width="170" />
        <a-table-column title="接收时间" data-index="acceptedAt" :width="170" />
      </template>
    </a-table>
  </a-drawer>
</template>

<script setup lang="ts">
import type { AnesthesiaHandoverApi } from '@/api/anesthesiaWorkflow';
defineProps<{ visible: boolean; history: AnesthesiaHandoverApi[] }>();
defineEmits<{ 'update:visible': [value: boolean] }>();
</script>

<style scoped>
:deep(.arco-timeline-item-content) { font-size: var(--font-size-sm); line-height: 1.6; }
</style>
