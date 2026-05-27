<template>
  <div class="page-stack">
    <div class="page-toolbar">
      <div>
        <h2 class="page-title">我的待办</h2>
        <p class="page-desc">访视、缺陷整改、PACU 与随访等待办事项</p>
      </div>
      <a-space>
        <a-tag color="red">高优先级 {{ highCount }}</a-tag>
        <a-tag color="arcoblue">共 {{ store.todos.length }} 项</a-tag>
      </a-space>
    </div>
    <a-card class="section-card" :bordered="false">
      <a-table :data="store.todos" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="待办事项" data-index="title" />
          <a-table-column title="分类">
            <template #cell="{ record }">
              <a-tag class="todo-category-tag" :color="categoryColor(record.category)">{{ record.category }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="优先级">
            <template #cell="{ record }">
              <span :class="priorityClass(record.priority)">{{ record.priority }}</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" />
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button v-if="record.caseId" size="mini" type="primary" @click="router.push(`/surgery/detail/${record.caseId}`)">处理</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { TodoItem } from '@/types/system';

const router = useRouter();
const store = useAnesthesiaStore();
const highCount = computed(() => store.todos.filter((item) => item.priority === '高').length);

const priorityClass = (priority: TodoItem['priority']) => {
  if (priority === '高') return 'todo-priority-high';
  if (priority === '中') return 'todo-priority-mid';
  return '';
};

const categoryColor = (category: TodoItem['category']) => {
  const map: Record<TodoItem['category'], string> = {
    访视: 'arcoblue',
    缺陷: 'orangered',
    PACU: 'cyan',
    随访: 'purple',
    不良事件: 'red',
    审批: 'gray',
  };
  return map[category] ?? 'gray';
};
</script>
