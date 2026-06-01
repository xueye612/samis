<template>
  <ModulePageShell title="特殊事件/抢救记录" description="术中特殊事件与抢救过程记录">
    <template #chips>
      <a-tag color="arcoblue">事件 {{ eventRows.length }}</a-tag>
      <a-tag :color="qualityPendingCount ? 'orange' : 'green'">待上报 {{ qualityPendingCount }}</a-tag>
      <a-tag color="red">危急 {{ criticalCount }}</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-input-search v-model="keyword" class="toolbar-search" placeholder="搜索患者/事件/处理措施" allow-clear />
        <a-select v-model="severityFilter" class="filter-select" :options="severityOptions" />
        <a-button type="primary" @click="router.push('/config/events')">维护事件字典</a-button>
      </a-space>
    </template>

    <template #stats>
      <MetricCard label="事件记录" :value="eventRows.length" hint="术中与苏醒期事件" icon="IconExclamationCircle" />
      <MetricCard label="纳入质控" :value="qualityEventCount" hint="需审核/上报" :variant="qualityPendingCount ? 'warn' : 'default'" icon="IconFile" />
      <MetricCard label="待上报" :value="qualityPendingCount" hint="质控闭环缺口" :variant="qualityPendingCount ? 'danger' : 'default'" icon="IconCalendar" />
      <MetricCard label="危急事件" :value="criticalCount" hint="抢救和严重异常优先" :variant="criticalCount ? 'warn' : 'default'" icon="IconHeart" />
    </template>

    <section class="clinical-page-grid">
      <div class="clinical-panel">
        <a-card class="section-card" :bordered="false" title="事件明细">
          <a-table :data="filteredRows" row-key="id" :pagination="{ pageSize: 10 }" class="compact-table" :scroll="{ x: 1080 }">
        <template #columns>
          <a-table-column title="患者" :width="160">
            <template #cell="{ record }">
              <div class="clinical-row-title">
                <strong>{{ record.patientName }}</strong>
                <span>{{ record.caseId }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="事件类型" :width="150">
            <template #cell="{ record }"><a-tag :color="record.qualityIncluded ? 'orange' : 'arcoblue'">{{ record.type }}</a-tag></template>
          </a-table-column>
          <a-table-column title="阶段" data-index="stage" :width="100" />
          <a-table-column title="严重程度" :width="110">
            <template #cell="{ record }"><a-tag :color="severityColor(record.severity)">{{ record.severity }}</a-tag></template>
          </a-table-column>
          <a-table-column title="时间" data-index="time" />
          <a-table-column title="处理措施" data-index="treatment" />
          <a-table-column title="质控" :width="100">
            <template #cell="{ record }">
              <a-tag :color="!record.qualityIncluded ? 'gray' : record.reported ? 'green' : 'orange'">
                {{ !record.qualityIncluded ? '普通' : record.reported ? '已上报' : '待上报' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${record.caseId}`)">详情</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
        </a-card>
      </div>

      <aside class="clinical-side-panel">
        <a-card class="section-card" :bordered="false" title="质控待办">
          <div class="clinical-mini-list">
            <div v-for="item in pendingQualityRows" :key="item.id" class="clinical-mini-item">
              <strong>{{ item.type }} · {{ item.severity }}</strong>
              <span>{{ item.patientName }} / {{ item.stage }} / {{ item.time }}</span>
            </div>
            <a-empty v-if="!pendingQualityRows.length" description="暂无待上报质控事件" />
          </div>
        </a-card>
        <a-card class="section-card" :bordered="false" title="流程提示">
          <a-timeline>
            <a-timeline-item label="记录">按时间记录事件类型、阶段、严重程度</a-timeline-item>
            <a-timeline-item label="处置">补充处理措施、参与人员、结果</a-timeline-item>
            <a-timeline-item label="质控">纳入质控事件需上报并完成审核</a-timeline-item>
          </a-timeline>
        </a-card>
      </aside>
    </section>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { Severity } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const keyword = ref('');
const severityFilter = ref('全部');
const severityOptions = ['全部', '轻度', '中度', '重度', '危急'];
const eventRows = computed(() => store.cases.flatMap((item) => item.events.map((event) => ({
  id: event.id,
  caseId: item.id,
  patientName: item.patientName,
  type: event.type,
  stage: event.stage,
  severity: event.severity,
  treatment: event.treatment || '待补记',
  time: dayjs(event.time).format('MM-DD HH:mm'),
  reported: event.reported,
  qualityIncluded: event.qualityIncluded,
}))));
const filteredRows = computed(() => {
  const q = keyword.value.trim();
  return eventRows.value.filter((item) => {
    const matchKeyword = !q || [item.patientName, item.type, item.stage, item.treatment].some((value) => value.includes(q));
    const matchSeverity = severityFilter.value === '全部' || item.severity === severityFilter.value;
    return matchKeyword && matchSeverity;
  });
});
const qualityEventCount = computed(() => eventRows.value.filter((item) => item.qualityIncluded).length);
const qualityPendingCount = computed(() => eventRows.value.filter((item) => item.qualityIncluded && !item.reported).length);
const criticalCount = computed(() => eventRows.value.filter((item) => item.severity === '危急').length);
const pendingQualityRows = computed(() => eventRows.value.filter((item) => item.qualityIncluded && !item.reported).slice(0, 6));
const severityColor = (severity: Severity) => {
  if (severity === '危急') return 'red';
  if (severity === '重度') return 'orangered';
  if (severity === '中度') return 'orange';
  return 'green';
};
</script>

<style scoped>
.filter-select {
  width: 120px;
}
</style>
