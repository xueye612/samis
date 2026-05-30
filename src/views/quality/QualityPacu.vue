<template>
  <ModulePageShell title="PACU专项" description="恢复室质控指标：停留时长、首次体温与转出管理">
    <template #chips>
      <a-tag color="arcoblue">在室 {{ inRoomCount }}</a-tag>
      <a-tag color="orangered">超时 {{ delayCount }}</a-tag>
      <a-tag>占用率 {{ store.pacuBedStats.occupancy }}%</a-tag>
    </template>
    <template #stats>
      <MetricCard label="总床位" :value="store.pacuBedStats.total" icon="IconHome" />
      <MetricCard label="使用中" :value="store.pacuBedStats.used" icon="IconHeart" />
      <MetricCard label="空闲" :value="store.pacuBedStats.free" icon="IconCheckCircle" />
      <MetricCard label="超时(>120min)" :value="delayCount" icon="IconClockCircle" :variant="delayCount ? 'warn' : 'default'" />
    </template>
    <a-card class="section-card" :bordered="false" title="PACU 患者质控指标">
      <a-table :data="store.pacuPatients" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="来源手术间" data-index="room" />
          <a-table-column title="入PACU">
            <template #cell="{ record }">{{ formatTime(record.inTime) }}</template>
          </a-table-column>
          <a-table-column title="停留时长">
            <template #cell="{ record }">
              <a-tag :color="stayMinutes(record) > 120 ? 'red' : 'green'">{{ stayMinutes(record) }} 分</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="HR" data-index="HR" :width="60" />
          <a-table-column title="BP" data-index="BP" :width="90" />
          <a-table-column title="SpO2" data-index="SpO2" :width="70" />
          <a-table-column title="首次体温">
            <template #cell="{ record }">
              <a-tag v-if="record.firstTemperature != null" :color="record.firstTemperature < 36 ? 'red' : 'green'">
                {{ record.firstTemperature }}℃
              </a-tag>
              <span v-else class="muted">未记录</span>
            </template>
          </a-table-column>
          <a-table-column title="状态">
            <template #cell="{ record }"><StatusTag :value="record.status" /></template>
          </a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="text" @click="router.push(`/pacu/record/${record.id}`)">恢复记录</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import StatusTag from '@/components/StatusTag.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuPatient } from '@/types/anesthesia';

const store = useAnesthesiaStore();
const router = useRouter();

const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');
const formatTime = (value: string) => dayjs(value).format('HH:mm');

const inRoomCount = computed(() => store.pacuPatients.filter((item) => item.status !== '已转出').length);
const delayCount = computed(() => store.pacuPatients.filter((item) => stayMinutes(item) > 120 && item.status !== '已转出').length);
</script>
