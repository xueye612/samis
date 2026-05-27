<template>
  <div class="page-stack">
    <div class="stat-grid">
      <MetricCard label="今日手术数" :value="summary.surgeries" hint="含手术室外麻醉" icon="IconCalendar" />
      <MetricCard label="麻醉中" :value="summary.anesthetizing" color="blue" tag="实时" icon="IconExperiment" />
      <MetricCard label="PACU中" :value="summary.pacu" color="cyan" tag="恢复" icon="IconHeart" />
      <MetricCard label="已离室" :value="summary.left" icon="IconHome" />
      <MetricCard label="取消手术" :value="summary.canceled" color="red" tag="需复核" icon="IconClose" />
      <MetricCard label="质控预警" :value="summary.warnings" color="orange" tag="自动" icon="IconExclamationCircle" />
      <MetricCard label="不良事件待审核" :value="summary.adversePending" color="red" tag="待办" icon="IconFile" />
    </div>

    <a-alert type="warning" show-icon>
      今日重点：OR-02 手术预计超过120分钟但未记录体温，PACU-02 停留超过2小时，OR-05 非计划转ICU事件处理措施待补记。
    </a-alert>

    <a-card title="手术间态势" class="section-card" :bordered="false">
      <div class="room-grid">
        <div v-for="item in store.cases" :key="item.id" class="room-card">
          <div class="room-head">
            <span class="room-name">{{ item.room }}</span>
            <StatusTag :value="item.status" />
          </div>
          <div class="patient-title">{{ item.patientName }} {{ item.gender }} {{ item.age }}岁</div>
          <div class="muted">{{ item.department }} · {{ item.surgeryName }}</div>
          <a-divider />
          <a-space wrap>
            <a-tag>{{ item.anesthesiaMethod }}</a-tag>
            <a-tag color="arcoblue">ASA {{ item.asa }}</a-tag>
            <a-tag :color="item.urgency === '急诊' ? 'red' : 'green'">{{ item.urgency }}</a-tag>
          </a-space>
          <div class="room-card__warnings">
            <a-space wrap>
              <a-tag v-for="warning in roomWarnings(item.id)" :key="warning" color="orange">{{ warning }}</a-tag>
            </a-space>
          </div>
          <div class="room-card__footer toolbar">
            <span class="muted">麻醉：{{ item.anesthesiologist }}</span>
            <a-button size="small" type="primary" @click="router.push(`/surgery/record/${item.id}`)">
              <template #icon><icon-file /></template>
              记录单
            </a-button>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const summary = computed(() => store.todaySummary);
const roomWarnings = (caseId: string) =>
  store.qualityDefects.filter((item) => item.caseId === caseId).slice(0, 3).map((item) => item.defectType);
</script>
