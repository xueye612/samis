<template>
  <a-table
    class="metric-detail-table"
    :data="rows"
    :loading="loading"
    :pagination="rows.length > pageSize ? { pageSize } : false"
    :scroll="{ x: 680, y: 260 }"
    row-key="id"
    size="small"
  >
    <template #columns>
      <a-table-column v-for="column in columns" :key="column.dataIndex" :title="column.title" :data-index="column.dataIndex" :width="column.width">
        <template #cell="{ record }">
          <a-tooltip v-if="isLong(record[column.dataIndex])" :content="format(record[column.dataIndex])">
            <span class="ellipsis-cell">{{ format(record[column.dataIndex]) }}</span>
          </a-tooltip>
          <span v-else class="ellipsis-cell">{{ format(record[column.dataIndex]) }}</span>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<script setup lang="ts">
type TableRow = Record<string, unknown> & { id: string };

withDefaults(defineProps<{
  rows: TableRow[];
  columns: Array<{ title: string; dataIndex: string; width?: number }>;
  loading?: boolean;
  pageSize?: number;
}>(), {
  loading: false,
  pageSize: 8,
});

const format = (value: unknown) => (Array.isArray(value) ? value.join('、') : value == null || value === '' ? '-' : String(value));
const isLong = (value: unknown) => format(value).length > 12;
</script>

<style scoped>
.metric-detail-table {
  max-width: 100%;
}

.ellipsis-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
