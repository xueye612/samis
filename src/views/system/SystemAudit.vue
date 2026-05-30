<template>
  <ModulePageShell title="审计日志" description="关键操作留痕与追溯">
    <template #toolbar>
      <a-input-search v-model="keyword" placeholder="搜索用户、模块、操作" allow-clear style="width: 280px" />
    </template>
    <a-card class="section-card" :bordered="false" title="操作日志">
      <a-table :data="filteredLogs" row-key="id" :pagination="{ pageSize: 12 }">
        <template #columns>
          <a-table-column title="时间" :width="180">
            <template #cell="{ record }">{{ formatTime(record.time) }}</template>
          </a-table-column>
          <a-table-column title="用户" data-index="user" :width="120" />
          <a-table-column title="模块" data-index="module" :width="120" />
          <a-table-column title="操作" data-index="action" :width="100" />
          <a-table-column title="对象" data-index="target" :width="140" />
          <a-table-column title="详情" data-index="detail" />
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const keyword = ref('');

const filteredLogs = computed(() => {
  const word = keyword.value.trim();
  if (!word) return store.auditLogs;
  return store.auditLogs.filter((item) =>
    `${item.user}${item.module}${item.action}${item.target}${item.detail}`.includes(word),
  );
});

const formatTime = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss');
</script>
