<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">PACU恢复室总览</h2>
        <p class="module-hero__desc">统一查看恢复患者、低体温风险与转出状态。</p>
      </div>
      <div class="module-hero__chips">
        <a-tag color="arcoblue">在室 {{ currentPatients.length }}</a-tag>
        <a-tag color="orangered">超时 {{ delayPatients.length }}</a-tag>
      </div>
    </section>
    <div class="stat-grid">
      <MetricCard label="PACU当前患者" :value="currentPatients.length" icon="IconHeart" />
      <MetricCard label="今日已转出" :value="outPatients.length" icon="IconHome" />
      <MetricCard label="超2小时预警" :value="delayPatients.length" color="red" tag="红色" icon="IconExclamationCircle" />
      <MetricCard label="低体温预警" :value="lowTempPatients.length" color="orange" tag="复温" icon="IconExperiment" />
    </div>

    <a-card class="section-card" :bordered="false">
      <template #title>PACU恢复室列表</template>
      <template #extra>
        <a-space>
          <a-button @click="router.push('/pacu/transfer')">
            <template #icon><icon-swap /></template>
            转出管理
          </a-button>
        </a-space>
      </template>
      <a-table :data="store.pacuPatients" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="手术间" data-index="room" />
          <a-table-column title="入PACU时间"><template #cell="{ record }">{{ formatTime(record.inTime) }}</template></a-table-column>
          <a-table-column title="停留时长"><template #cell="{ record }"><a-tag :color="stayMinutes(record) > 120 ? 'red' : 'green'">{{ stayMinutes(record) }}分钟</a-tag></template></a-table-column>
          <a-table-column title="首次体温"><template #cell="{ record }"><a-tag :color="record.firstTemperature && record.firstTemperature < 36 ? 'red' : 'arcoblue'">{{ record.firstTemperature ?? '未记录' }}</a-tag></template></a-table-column>
          <a-table-column title="Aldrete" data-index="aldrete" />
          <a-table-column title="VAS" data-index="vas" />
          <a-table-column title="当前状态"><template #cell="{ record }"><StatusTag :value="record.status" /></template></a-table-column>
          <a-table-column title="转出地点" data-index="transferTo" />
          <a-table-column title="操作" :width="140">
            <template #cell="{ record }">
              <a-button size="small" type="primary" @click="router.push(`/pacu/record/${record.id}`)">
                <template #icon><icon-file /></template>
                恢复记录
              </a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
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
import type { PacuPatient } from '@/types/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');
const formatTime = (value: string) => dayjs(value).format('HH:mm');
const currentPatients = computed(() => store.pacuPatients.filter((item) => item.status !== '已转出'));
const outPatients = computed(() => store.pacuPatients.filter((item) => item.status === '已转出'));
const delayPatients = computed(() => store.pacuPatients.filter((item) => stayMinutes(item) > 120 && item.status !== '已转出'));
const lowTempPatients = computed(() => store.pacuPatients.filter((item) => typeof item.firstTemperature === 'number' && item.firstTemperature < 36));
</script>
