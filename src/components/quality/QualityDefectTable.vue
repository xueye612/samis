<template>
  <a-table :data="defects" :pagination="{ pageSize: 10 }" row-key="defectId">
    <template #columns>
      <a-table-column title="患者" data-index="patientName" />
      <a-table-column title="手术间" data-index="room" />
      <a-table-column title="缺陷类型" data-index="defectType" />
      <a-table-column title="等级">
        <template #cell="{ record }">
          <a-tag :color="record.defectLevel === '严重' ? 'red' : record.defectLevel === '重要' ? 'orange' : 'blue'">{{ record.defectLevel }}</a-tag>
        </template>
      </a-table-column>
      <a-table-column title="说明" data-index="defectDesc" />
      <a-table-column title="责任人" data-index="responsibleStaff" />
      <a-table-column title="状态">
        <template #cell="{ record }">
          <a-tag :color="record.status === '已关闭' || record.status === '已整改' ? 'green' : 'orange'">{{ record.status }}</a-tag>
        </template>
      </a-table-column>
      <a-table-column title="整改说明" data-index="rectificationNote" />
      <a-table-column title="操作" :width="220">
        <template #cell="{ record }">
          <a-space>
            <a-button size="small" type="primary" @click="$emit('locate', record.caseId)">定位</a-button>
            <a-dropdown v-if="record.status !== '已关闭'">
              <a-button size="small">闭环</a-button>
              <template #content>
                <a-doption @click="$emit('update-status', record.defectId, { status: '待整改' })">待整改</a-doption>
                <a-doption @click="$emit('update-status', record.defectId, { status: '已整改', rectificationNote: '已补充记录并提交复核。' })">已整改</a-doption>
                <a-doption @click="$emit('update-status', record.defectId, { status: '已关闭', rectificationNote: '质控审核通过并关闭。' })">已关闭</a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import type { QualityDefect } from '@/types/quality';

defineProps<{ defects: QualityDefect[] }>();
defineEmits<{ locate: [caseId: string]; 'update-status': [defectId: string, patch: Partial<QualityDefect>] }>();
</script>
