<template>
  <div class="page-stack">
    <section class="workbench-hero">
      <div class="workbench-hero__main">
        <div class="workbench-hero__eyebrow">{{ todayText }} · {{ store.currentDoctorName }}</div>
        <h1>今日手术 {{ summary.surgeries }} 台</h1>
        <p class="workbench-hero__summary">
          麻醉进行中 {{ summary.anesthetizing }} 台，PACU {{ summary.pacu }} 人，质控预警 {{ summary.warnings }} 项。
        </p>
        <div class="workbench-hero__chips">
          <span class="workbench-hero__chip">已离室 {{ summary.left }}</span>
          <span class="workbench-hero__chip">取消 {{ summary.canceled }}</span>
          <span v-if="emergencyCases.length" class="workbench-hero__chip workbench-hero__chip--warn">急诊 {{ emergencyCases.length }} 台</span>
        </div>
      </div>
      <div class="workbench-quick-actions">
        <button type="button" class="workbench-quick-btn" @click="router.push('/surgery/schedule')">手术排班</button>
        <button type="button" class="workbench-quick-btn" @click="router.push('/workbench/todos')">我的待办</button>
        <button type="button" class="workbench-quick-btn" @click="router.push('/quality/defects')">质控缺陷</button>
        <button type="button" class="workbench-quick-btn" @click="router.push('/pacu/list')">PACU</button>
      </div>
    </section>

    <a-alert v-if="emergencyCases.length" type="error" show-icon>
      当前存在 {{ emergencyCases.length }} 台急诊插单，请优先确认患者详情、术前评估与到位人员。
    </a-alert>

    <div class="stat-grid">
      <MetricCard label="今日手术数" :value="summary.surgeries" hint="含手术室外麻醉" icon="IconCalendar" />
      <MetricCard label="麻醉中" :value="summary.anesthetizing" tag="实时" icon="IconExperiment" />
      <MetricCard label="PACU中" :value="summary.pacu" tag="恢复" icon="IconHeart" />
      <MetricCard label="已离室" :value="summary.left" icon="IconCheckCircle" />
      <MetricCard label="取消手术" :value="summary.canceled" tag="需复核" icon="IconClose" />
      <MetricCard label="质控预警" :value="summary.warnings" tag="自动" icon="IconExclamationCircle" variant="warn" />
      <MetricCard label="不良事件待审核" :value="summary.adversePending" tag="待办" icon="IconFile" variant="danger" />
    </div>

    <div class="doctor-workbench-grid">
      <a-card class="section-card current-case-card" :bordered="false">
        <template #title>
          <span>当前负责手术</span>
          <a-tag color="arcoblue" size="small">{{ store.currentDoctorName }}</a-tag>
        </template>
        <div v-if="activeCase" class="current-case-main">
          <div>
            <div class="case-room-line">
              <strong>{{ activeCase.room }}</strong>
              <StatusTag :value="activeCase.status" />
              <a-tag v-if="activeCase.emergencyInserted || activeCase.urgency === '急诊'" color="red" size="small">急诊</a-tag>
            </div>
            <h2>{{ activeCase.patientName }} · {{ activeCase.surgeryName }}</h2>
            <p class="muted">{{ activeCase.department }} / {{ activeCase.diagnosis }}</p>
            <div class="case-meta-line">
              <span>{{ formatRange(activeCase) }}</span>
              <span>ASA {{ activeCase.asa }}</span>
              <span>{{ activeCase.anesthesiaMethod }}</span>
            </div>
          </div>
          <a-space>
            <a-button type="primary" @click="router.push(`/surgery/detail/${activeCase.id}`)">进入患者详情</a-button>
            <a-button @click="router.push('/surgery/schedule')">查看排班</a-button>
          </a-space>
        </div>
        <a-empty v-else description="当前没有进行中的本人手术" />
      </a-card>

      <a-card class="section-card next-case-card" :bordered="false" title="下一台">
        <div v-if="nextCase" class="next-case">
          <strong>{{ formatRange(nextCase) }} · {{ nextCase.room }}</strong>
          <span class="muted">{{ nextCase.patientName }} / {{ nextCase.surgeryName }}</span>
          <a-button size="small" type="primary" @click="router.push(`/surgery/detail/${nextCase.id}`)">查看</a-button>
        </div>
        <a-empty v-else description="暂无下一台手术" />
      </a-card>
    </div>

    <a-card class="section-card" :bordered="false" title="我的今日手术时间轴">
      <a-timeline class="doctor-timeline">
        <a-timeline-item v-for="item in myCases" :key="item.id" :label="formatRange(item)" :dot-color="timelineColor(item)">
          <div class="timeline-case">
            <div>
              <strong>{{ item.room }} · {{ item.patientName }}</strong>
              <span class="muted">{{ item.surgeryName }}</span>
            </div>
            <div class="timeline-actions">
              <a-tag v-if="item.emergencyInserted || item.urgency === '急诊'" color="red" size="small">急诊</a-tag>
              <StatusTag :value="item.status" />
              <a-button size="mini" @click="router.push(`/surgery/detail/${item.id}`)">详情</a-button>
            </div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-card>

    <a-card class="section-card" :bordered="false" title="手术间状态墙">
      <div class="room-wall">
        <div
          v-for="group in roomSchedule"
          :key="group.roomId"
          class="room-wall-card"
          :class="group.cases.length ? 'room-wall-card--busy' : 'room-wall-card--idle'"
        >
          <div class="room-wall-head">
            <strong>{{ group.roomName }}</strong>
            <a-tag :color="group.cases.length ? 'arcoblue' : 'gray'" size="small">{{ group.cases.length }} 台</a-tag>
          </div>
          <div v-if="group.cases.length" class="room-wall-list">
            <button v-for="item in group.cases" :key="item.id" type="button" @click="router.push(`/surgery/detail/${item.id}`)">
              <span>{{ formatRange(item) }}</span>
              <strong>{{ item.patientName }}</strong>
              <StatusTag :value="item.status" />
            </button>
          </div>
          <a-empty v-else description="空闲" />
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SurgeryCase } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const summary = computed(() => store.todaySummary);
const myCases = computed(() => store.myTodayCases);
const activeCase = computed(() => store.currentDoctorActiveCase);
const nextCase = computed(() => store.nextDoctorCase);
const emergencyCases = computed(() => myCases.value.filter((item) => item.emergencyInserted || item.urgency === '急诊'));
const roomSchedule = computed(() => store.roomSchedule.filter((item) => item.roomId.startsWith('OR-')));
const todayText = dayjs().format('M月D日');

const formatRange = (item: SurgeryCase) => {
  const start = item.scheduledStart ?? item.plannedStart;
  const end = item.scheduledEnd ?? item.surgeryEnd ?? dayjs(start).add(item.expectedDurationMinutes || 60, 'minute').toISOString();
  return `${dayjs(start).format('HH:mm')} - ${dayjs(end).format('HH:mm')}`;
};

const timelineColor = (item: SurgeryCase) => {
  if (item.emergencyInserted || item.urgency === '急诊') return 'red';
  if (['麻醉诱导', '麻醉中', '手术中'].includes(item.status)) return 'blue';
  if (item.status === '已离室') return 'green';
  return 'gray';
};
</script>

<style scoped>
.workbench-hero__chip--warn {
  border-color: var(--color-warning-100);
  color: var(--warning);
  background: rgb(255 247 237);
}

.current-case-main h2 {
  margin: 8px 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
