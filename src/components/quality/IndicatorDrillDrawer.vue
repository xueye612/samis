<template>
  <a-drawer :visible="visible" :width="drawerWidth" :title="title" @cancel="$emit('update:visible', false)">
    <a-table
      :data="cases"
      :pagination="{ pageSize: 8 }"
      :scroll="{ x: 940, y: 520 }"
      row-key="caseId"
      size="small"
    >
      <template #columns>
        <a-table-column title="患者" data-index="patientName" :width="110">
          <template #cell="{ record }"><EllipsisText :text="record.patientName" /></template>
        </a-table-column>
        <a-table-column title="演示场景" data-index="demoTag" :width="160">
          <template #cell="{ record }">
            <a-tag v-if="record.demoTag" color="arcoblue" size="small">{{ record.demoTag }}</a-tag>
            <span v-else class="muted">—</span>
          </template>
        </a-table-column>
        <a-table-column title="手术间" data-index="room" :width="90" />
        <a-table-column title="科室" data-index="department" :width="120">
          <template #cell="{ record }"><EllipsisText :text="record.department" /></template>
        </a-table-column>
        <a-table-column title="手术" data-index="operationName" :width="220">
          <template #cell="{ record }"><EllipsisText :text="record.operationName" /></template>
        </a-table-column>
        <a-table-column title="麻醉方式" data-index="anesthesiaMethod" :width="140">
          <template #cell="{ record }"><EllipsisText :text="record.anesthesiaMethod" /></template>
        </a-table-column>
        <a-table-column title="麻醉医生" data-index="doctorName" :width="110">
          <template #cell="{ record }"><EllipsisText :text="record.doctorName" /></template>
        </a-table-column>
        <a-table-column title="状态" data-index="status" :width="110">
          <template #cell="{ record }"><a-tag color="arcoblue">{{ record.status }}</a-tag></template>
        </a-table-column>
        <a-table-column title="操作" :width="120" fixed="right">
          <template #cell="{ record }">
            <a-button size="small" type="primary" @click="$emit('locate', record.caseId)">查看记录</a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue';
import type { CaseSummary } from '@/types/quality';

defineProps<{ visible: boolean; title: string; cases: CaseSummary[] }>();
defineEmits<{ 'update:visible': [value: boolean]; locate: [caseId: string] }>();

const drawerWidth = computed(() => Math.min(960, Math.max(720, Math.floor(window.innerWidth * 0.72))));

const EllipsisText = defineComponent({
  props: { text: { type: String, default: '' } },
  setup(props) {
    return () =>
      h(
        'span',
        {
          class: 'ellipsis-text',
          title: props.text,
        },
        props.text || '-',
      );
  },
});
</script>

<style scoped>
.ellipsis-text {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: #86909c;
}
</style>
