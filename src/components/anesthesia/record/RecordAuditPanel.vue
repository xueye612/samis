<script setup lang="ts">
import type { AnesthesiaRecordModificationLog } from '@/types/anesthesia';

defineProps<{
  logs: AnesthesiaRecordModificationLog[];
  printedAt?: string;
  locked?: boolean;
}>();
</script>

<template>
  <section class="record-audit-panel">
    <header>
      <strong>修改与审计</strong>
      <span v-if="printedAt">最近打印 {{ printedAt.slice(0, 16).replace('T', ' ') }}</span>
      <span v-if="locked" class="locked">已锁定</span>
    </header>
    <div v-if="!logs.length" class="empty">暂无修改记录</div>
    <ul v-else>
      <li v-for="item in logs" :key="item.id">
        <div class="row-head">
          <strong>{{ item.label }}</strong>
          <time>{{ item.time.slice(0, 16).replace('T', ' ') }}</time>
        </div>
        <p>{{ item.operator }}：{{ item.before || '空' }} → {{ item.after || '空' }}</p>
        <small>{{ item.reason }} · {{ item.status }}</small>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.record-audit-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

header span {
  font-size: 12px;
  color: #64748b;
}

.locked {
  color: #b45309 !important;
}

.empty {
  font-size: 12px;
  color: #94a3b8;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  max-height: 280px;
  overflow: auto;
}

li {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
}

.row-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

p {
  margin: 4px 0;
  color: #334155;
}

small {
  color: #64748b;
}
</style>
