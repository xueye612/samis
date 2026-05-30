<template>
  <ModulePageShell title="我的待办" description="访视、缺陷整改、PACU 与随访等待办事项">
    <template #chips>
      <a-tag color="red">高优先级 {{ highCount }}</a-tag>
      <a-tag color="arcoblue">共 {{ store.todos.length }} 项</a-tag>
      <a-tag v-if="overdueCount" color="orangered">已超时 {{ overdueCount }}</a-tag>
    </template>
    <template #toolbar>
      <a-radio-group v-model="activeTab" type="button">
        <a-radio value="全部">全部</a-radio>
        <a-radio value="待处理">待处理</a-radio>
        <a-radio value="已处理">已处理</a-radio>
        <a-radio value="已超时">已超时</a-radio>
      </a-radio-group>
    </template>
    <a-card class="section-card" :bordered="false">
      <a-table
        :data="filteredTodos"
        :pagination="false"
        row-key="id"
        :row-class="() => 'todo-row-clickable'"
        @row-click="openDetail"
      >
        <template #columns>
          <a-table-column title="待办事项" data-index="title" />
          <a-table-column title="分类">
            <template #cell="{ record }">
              <a-tag class="todo-category-tag" :color="categoryColor(record.category)">{{ record.category }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="优先级">
            <template #cell="{ record }">
              <a-tag :color="priorityTagColor(record.priority)">{{ record.priority }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="截止时间">
            <template #cell="{ record }">
              <span :class="{ 'todo-overdue': isOverdue(record) }">{{ formatDue(record.dueTime) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="状态">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="160">
            <template #cell="{ record }">
              <a-space>
                <a-button v-if="record.status !== '已完成'" size="mini" type="primary" @click.stop="markComplete(record.id)">标记完成</a-button>
                <a-button v-if="record.caseId" size="mini" @click.stop="router.push(`/surgery/detail/${record.caseId}`)">处理</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:visible="drawerVisible" title="待办详情" width="480px" :footer="false">
      <template v-if="selectedTodo">
        <a-descriptions :column="1" bordered size="medium">
          <a-descriptions-item label="事项">{{ selectedTodo.title }}</a-descriptions-item>
          <a-descriptions-item label="分类">
            <a-tag :color="categoryColor(selectedTodo.category)">{{ selectedTodo.category }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="优先级">
            <a-tag :color="priorityTagColor(selectedTodo.priority)">{{ selectedTodo.priority }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(selectedTodo.status)">{{ selectedTodo.status }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="截止时间">{{ formatDue(selectedTodo.dueTime) }}</a-descriptions-item>
          <a-descriptions-item v-if="selectedTodo.caseId" label="关联病例">{{ selectedTodo.caseId }}</a-descriptions-item>
        </a-descriptions>
        <div class="drawer-actions">
          <a-space>
            <a-button v-if="selectedTodo.status !== '已完成'" type="primary" @click="markComplete(selectedTodo.id)">标记完成</a-button>
            <a-button v-if="selectedTodo.caseId" @click="router.push(`/surgery/detail/${selectedTodo.caseId}`)">进入患者详情</a-button>
          </a-space>
        </div>
      </template>
    </a-drawer>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { TableData } from '@arco-design/web-vue/es/table/interface';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { TodoItem } from '@/types/system';

type TodoTab = '全部' | '待处理' | '已处理' | '已超时';

const router = useRouter();
const store = useAnesthesiaStore();
const activeTab = ref<TodoTab>('全部');
const drawerVisible = ref(false);
const selectedTodo = ref<TodoItem | null>(null);

const isOverdue = (item: TodoItem) => item.status !== '已完成' && item.dueTime && dayjs(item.dueTime).isBefore(dayjs());

const highCount = computed(() => store.todos.filter((item) => item.priority === '高').length);
const overdueCount = computed(() => store.todos.filter((item) => isOverdue(item)).length);

const filteredTodos = computed(() => {
  const items = store.todos;
  if (activeTab.value === '待处理') return items.filter((item) => item.status === '待处理' || item.status === '处理中');
  if (activeTab.value === '已处理') return items.filter((item) => item.status === '已完成');
  if (activeTab.value === '已超时') return items.filter((item) => isOverdue(item));
  return items;
});

const priorityTagColor = (priority: TodoItem['priority']) => {
  if (priority === '高') return 'red';
  if (priority === '中') return 'orangered';
  return 'gray';
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

const statusColor = (status: TodoItem['status']) => {
  if (status === '已完成') return 'green';
  if (status === '处理中') return 'arcoblue';
  return 'orangered';
};

const formatDue = (dueTime?: string) => (dueTime ? dayjs(dueTime).format('MM-DD HH:mm') : '—');

const openDetail = (record: TableData) => {
  selectedTodo.value = record as TodoItem;
  drawerVisible.value = true;
};

const markComplete = (todoId: string) => {
  store.updateTodoStatus(todoId, '已完成');
  if (selectedTodo.value?.id === todoId) {
    selectedTodo.value = { ...selectedTodo.value, status: '已完成' };
  }
  Message.success('已标记为完成');
};
</script>

<style scoped>
.drawer-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.todo-overdue {
  color: var(--danger);
  font-weight: 600;
}

:deep(.todo-row-clickable) {
  cursor: pointer;
}
</style>
