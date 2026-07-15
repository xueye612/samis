<template>
  <a-drawer :visible="visible" :width="820" title="麻醉小结版本历史" unmount-on-close @cancel="$emit('update:visible', false)">
    <a-table :data="history" :pagination="false" row-key="summaryVersionId" size="small">
      <template #columns>
        <a-table-column title="版本" data-index="version" :width="72" />
        <a-table-column title="状态" data-index="status" :width="100" />
        <a-table-column title="来源记录版本" data-index="sourceRecordRevisionId" />
        <a-table-column title="修订原因" data-index="revisionReason" />
        <a-table-column title="提交时间" data-index="submittedAt" :width="170" />
        <a-table-column title="内容哈希" :width="180"><template #cell="{ record }">{{ shortHash(record.contentHash) }}</template></a-table-column>
      </template>
    </a-table>
  </a-drawer>
</template>

<script setup lang="ts">
import type { AnesthesiaSummaryApi } from '@/api/anesthesiaWorkflow';
defineProps<{ visible: boolean; history: AnesthesiaSummaryApi[] }>();
defineEmits<{ 'update:visible': [value: boolean] }>();
const shortHash = (value?: string | null) => value ? `${value.slice(0, 12)}…` : '—';
</script>
