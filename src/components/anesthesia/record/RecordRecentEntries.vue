<template>
  <section class="recent-entries">
    <header>
      <strong>最近录入</strong>
      <span>{{ entries.length }} 条</span>
    </header>
    <a-empty v-if="!entries.length" description="快捷录入后将显示在这里" />
    <button
      v-for="item in entries"
      :key="item.id"
      type="button"
      class="recent-entry"
      @click="$emit('locate', item)"
    >
      <span class="recent-time">{{ formatTime(item.time) }}</span>
      <a-tag size="small" :color="kindColor(item.kind)">{{ kindLabel(item.kind) }}</a-tag>
      <span class="recent-label">{{ item.label }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { RecordRecentEntry } from '@/types/recordRecent';

defineProps<{
  entries: RecordRecentEntry[];
}>();

defineEmits<{
  locate: [entry: RecordRecentEntry];
}>();

const formatTime = (value: string) => dayjs(value).format('HH:mm');
const kindLabel = (kind: RecordRecentEntry['kind']) => ({
  event: '事件',
  timeline: '时间',
  medication: '用药',
  fluid: '输液',
  vital: '体征',
  landing: '落单',
}[kind]);
const kindColor = (kind: RecordRecentEntry['kind']) => ({
  event: 'arcoblue',
  timeline: 'purple',
  medication: 'green',
  fluid: 'cyan',
  vital: 'orange',
  landing: 'gold',
}[kind]);
</script>

<style scoped>
.recent-entries {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #fff;
}

.recent-entries header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}

.recent-entries header strong {
  color: #0f172a;
}

.recent-entry {
  display: grid;
  grid-template-columns: 52px auto 1fr;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  text-align: left;
  cursor: pointer;
}

.recent-entry:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.recent-time {
  font-weight: 700;
  color: #165dff;
}

.recent-label {
  color: #334155;
  font-size: 12px;
}
</style>
