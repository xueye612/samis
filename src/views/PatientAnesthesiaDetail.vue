<template>
  <div v-if="current" class="page-stack">
    <section class="detail-hero">
      <div>
        <div class="detail-hero__eyebrow">{{ current.room }} · {{ current.status }}</div>
        <h1>{{ current.patientName }} · {{ current.surgeryName }}</h1>
        <p>{{ current.department }} / {{ current.diagnosis }} / {{ current.anesthesiaMethod }}</p>
      </div>
      <a-space>
        <a-button @click="router.back()">返回</a-button>
        <a-button type="primary" @click="router.push(buildRecordRoute(selectedId))">进入麻醉记录单</a-button>
        <a-button @click="router.push('/surgery/schedule')">查看排班</a-button>
      </a-space>
    </section>
    <a-card class="section-card" :bordered="false">
      <template #title>患者麻醉详情</template>
      <template #extra>
        <a-select v-model="selectedId" style="width: 260px">
          <a-option v-for="item in store.cases" :key="item.id" :value="item.id">{{ item.room }} · {{ item.patientName }}</a-option>
        </a-select>
      </template>
      <a-descriptions :column="4" bordered>
        <a-descriptions-item label="患者">{{ current.patientName }} {{ current.gender }} {{ current.age }}岁</a-descriptions-item>
        <a-descriptions-item label="科室">{{ current.department }}</a-descriptions-item>
        <a-descriptions-item label="诊断">{{ current.diagnosis }}</a-descriptions-item>
        <a-descriptions-item label="ASA">{{ current.asa }}</a-descriptions-item>
        <a-descriptions-item label="手术">{{ current.surgeryName }}</a-descriptions-item>
        <a-descriptions-item label="麻醉方式">{{ current.anesthesiaMethod }}</a-descriptions-item>
        <a-descriptions-item label="麻醉医师">{{ current.anesthesiologist }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ current.status }}</a-descriptions-item>
      </a-descriptions>
    </a-card>
    <a-row :gutter="14">
      <a-col :span="14">
        <a-card title="麻醉全过程时间轴" class="section-card" :bordered="false">
          <a-timeline>
            <a-timeline-item label="术前">访视：{{ current.preVisit.completed ? '已完成' : '未完成' }}；计划：{{ current.preVisit.plan }}</a-timeline-item>
            <a-timeline-item label="入室">计划开始：{{ formatTime(current.plannedStart) }}</a-timeline-item>
            <a-timeline-item v-for="event in current.events" :key="event.id" :label="formatTime(event.time)">
              {{ event.type }} · {{ event.stage }} · {{ event.treatment || '待补记' }}
            </a-timeline-item>
            <a-timeline-item label="PACU/转归">转归：{{ current.transferTo ?? '未转出' }}</a-timeline-item>
          </a-timeline>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card title="质控关联" class="section-card" :bordered="false">
          <a-alert v-for="item in relatedDefects" :key="item.defectId" :type="item.defectLevel === '严重' ? 'error' : 'warning'" show-icon>
            {{ item.defectType }}：{{ item.defectDesc }}
          </a-alert>
          <a-empty v-if="!relatedDefects.length" description="暂无质控缺陷" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildRecordRoute } from '@/services/recordNavigation';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const selectedId = ref(String(route.params.id || store.cases[0]?.id));
watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
});
watch(selectedId, (id) => {
  if (route.params.id !== id) history.replaceState(null, '', `/surgery/detail/${id}`);
});
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));
const relatedDefects = computed(() => store.qualityDefects.filter((item) => item.caseId === selectedId.value));
const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '-');
</script>

<style scoped>
.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(100deg, rgb(37 99 235 / 6%), transparent 36%),
    var(--surface);
}

.detail-hero__eyebrow {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.detail-hero h1 {
  margin: 6px 0;
  font-size: 22px;
  color: var(--text-primary);
}

.detail-hero p {
  margin: 0;
  color: var(--text-secondary);
}
</style>
