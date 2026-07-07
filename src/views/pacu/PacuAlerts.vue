<template>
  <ModulePageShell title="PACU 质控预警" description="停留超时与入室低体温预警">
    <template #chips>
      <a-tag color="orangered">预警 {{ alerts.length }}</a-tag>
      <a-tag color="red">超时 {{ delayAlerts.length }}</a-tag>
      <a-tag color="orange">低体温 {{ lowTempAlerts.length }}</a-tag>
      <a-tag color="purple">Aldrete&lt;{{ PACU_ALDRETE_LOW_THRESHOLD }} {{ aldreteAlerts.length }}</a-tag>
      <a-tag color="magenta">SpO2&lt;{{ PACU_SPO2_LOW_THRESHOLD }} {{ spo2Alerts.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="预警列表">
      <a-table :data="alerts" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="来源手术间" data-index="room" :width="100" />
          <a-table-column title="预警类型" data-index="alertType" :width="140" />
          <a-table-column title="说明" data-index="detail" />
          <a-table-column title="严重程度" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.severity === '严重' ? 'red' : 'orange'">{{ record.severity }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="goRecord(record.caseId)">恢复记录</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
      <EmptyState v-if="!alerts.length" title="暂无 PACU 预警" description="当前在室患者指标正常" icon="IconCheckCircle" />
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuPatient } from '@/types/anesthesia';
import {
  PACU_ALDRETE_LOW_THRESHOLD,
  PACU_LOW_TEMP_SEVERE,
  PACU_LOW_TEMP_THRESHOLD,
  PACU_SPO2_LOW_THRESHOLD,
  PACU_STAY_LIMIT_MINUTES,
} from '@/config/pacuThresholds';

interface PacuAlertRow {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  alertType: string;
  detail: string;
  severity: '一般' | '严重';
}

const store = useAnesthesiaStore();
const router = useRouter();

const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');

const activePatients = computed(() => store.pacuPatients.filter((p) => p.status !== '已转出'));

const delayAlerts = computed(() =>
  activePatients.value
    .filter((p) => stayMinutes(p) > PACU_STAY_LIMIT_MINUTES)
    .map((p) => ({
      id: `delay-${p.id}`,
      caseId: p.caseId,
      patientName: p.patientName,
      room: p.room,
      alertType: 'PACU停留超时',
      detail: `已停留 ${stayMinutes(p)} 分钟，超过 ${PACU_STAY_LIMIT_MINUTES} 分钟需说明转出延迟原因`,
      severity: '严重' as const,
    })),
);

const lowTempAlerts = computed(() =>
  activePatients.value
    .filter((p) => p.firstTemperature === undefined || (typeof p.firstTemperature === 'number' && p.firstTemperature < PACU_LOW_TEMP_THRESHOLD))
    .map((p) => ({
      id: `temp-${p.id}`,
      caseId: p.caseId,
      patientName: p.patientName,
      room: p.room,
      alertType: p.firstTemperature === undefined ? 'PACU首次体温缺失' : 'PACU入室低体温',
      detail:
        p.firstTemperature === undefined
          ? '入室 30 分钟内未记录首次体温'
          : `入室首次体温 ${p.firstTemperature}℃，低于 ${PACU_LOW_TEMP_THRESHOLD}℃`,
      severity: (p.firstTemperature !== undefined && p.firstTemperature < PACU_LOW_TEMP_SEVERE ? '严重' : '一般') as '一般' | '严重',
    })),
);

const aldreteAlerts = computed(() =>
  activePatients.value
    .filter((p) => typeof p.aldrete === 'number' && p.aldrete < PACU_ALDRETE_LOW_THRESHOLD)
    .map((p) => ({
      id: `aldrete-${p.id}`,
      caseId: p.caseId,
      patientName: p.patientName,
      room: p.room,
      alertType: 'Aldrete 评分偏低',
      detail: `入室 Aldrete 评分 ${p.aldrete}，低于 ${PACU_ALDRETE_LOW_THRESHOLD}（转出需 ≥9）`,
      severity: (p.aldrete < 7 ? '严重' : '一般') as '一般' | '严重',
    })),
);

const spo2Alerts = computed(() =>
  activePatients.value
    .filter((p) => typeof p.SpO2 === 'number' && p.SpO2 > 0 && p.SpO2 < PACU_SPO2_LOW_THRESHOLD)
    .map((p) => ({
      id: `spo2-${p.id}`,
      caseId: p.caseId,
      patientName: p.patientName,
      room: p.room,
      alertType: 'SpO2 偏低',
      detail: `SpO2 ${p.SpO2}%，低于 ${PACU_SPO2_LOW_THRESHOLD}%`,
      severity: (p.SpO2 < 85 ? '严重' : '一般') as '一般' | '严重',
    })),
);

const alerts = computed(() => [...delayAlerts.value, ...lowTempAlerts.value, ...aldreteAlerts.value, ...spo2Alerts.value] satisfies PacuAlertRow[]);

const goRecord = (caseId: string) => router.push(`/pacu/record/${caseId}`);
</script>
