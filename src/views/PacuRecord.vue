<template>
  <div v-if="current" class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">PACU恢复记录</h2>
        <p class="module-hero__desc">{{ current.patientName }} · {{ current.room }} · 停留 {{ stayMinutes(current) }} 分钟</p>
      </div>
      <div class="module-hero__chips">
        <a-tag :color="stayMinutes(current) > 120 ? 'red' : 'green'">{{ stayMinutes(current) > 120 ? '超2小时' : '停留正常' }}</a-tag>
        <a-tag :color="current.firstTemperature && current.firstTemperature < 36 ? 'orangered' : 'arcoblue'">
          首温 {{ current.firstTemperature ?? '未记录' }}
        </a-tag>
      </div>
    </section>

    <a-card class="section-card" :bordered="false">
      <template #title>PACU恢复记录</template>
      <template #extra>
        <a-radio-group v-model="viewMode" type="button" size="small">
          <a-radio value="form">表单录入</a-radio>
          <a-radio value="sheet">纸面记录单</a-radio>
        </a-radio-group>
        <a-select v-model="selectedId" class="toolbar-search">
          <a-option v-for="item in store.pacuPatients" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.room }}</a-option>
        </a-select>
      </template>

      <a-alert v-if="stayMinutes(current) > 120" class="record-alert" type="error" show-icon>PACU停留超过2小时，请记录转出延迟原因。</a-alert>
      <a-alert v-if="current.firstTemperature && current.firstTemperature < 36" class="record-alert" type="warning" show-icon>首次体温低于36摄氏度，请记录复温措施。</a-alert>

      <div v-if="viewMode === 'sheet' && linkedCase" class="pacu-sheet-wrap">
        <LiveAnesthesiaSheet
          :record="pacuSheetRecord"
          :vitals="vitalCatalog"
          :drugs="drugCatalog"
          :fluids="fluidCatalog"
          :monitor-order="monitorOrder"
          :read-only="linkedCase.locked"
          :method-keys="['general']"
          :method-labels="[linkedCase.anesthesiaMethod]"
          @save-vital="savePacuVital"
        />
      </div>

      <a-form v-else :model="current" layout="vertical">
        <a-row :gutter="14">
          <a-col :span="6"><a-form-item label="入PACU时间"><a-input :model-value="formatTime(current.inTime)" readonly /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="首次体温"><a-input-number v-model="current.firstTemperature" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="HR"><a-input-number v-model="current.HR" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="BP"><a-input v-model="current.BP" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="SpO2"><a-input-number v-model="current.SpO2" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="RR"><a-input-number v-model="current.RR" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="Aldrete评分"><a-input-number v-model="current.aldrete" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="VAS评分"><a-input-number v-model="current.vas" /></a-form-item></a-col>
          <a-col :span="24">
            <a-space wrap>
              <a-checkbox v-model="current.nausea">恶心呕吐</a-checkbox>
              <a-checkbox v-model="current.shivering">寒战</a-checkbox>
              <a-checkbox v-model="current.agitation">躁动</a-checkbox>
              <a-checkbox v-model="current.reintubation">二次插管</a-checkbox>
            </a-space>
          </a-col>
          <a-col :span="8"><a-form-item label="转出时间"><a-input :model-value="formatTime(current.outTime)" placeholder="未转出" readonly /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="转出地点"><a-select v-model="current.transferTo" :options="['病房', 'ICU', '日间病房', '留观']" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="当前状态"><a-select v-model="current.status" :options="['观察中', '待转出', '已转出']" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item label="交接记录"><a-textarea v-model="current.handover" :auto-size="{ minRows: 4 }" /></a-form-item></a-col>
        </a-row>
      </a-form>

      <div class="page-toolbar">
        <a-button type="primary" @click="saveRecord">
          <template #icon><icon-file /></template>
          保存记录
        </a-button>
        <a-button @click="router.push('/pacu/transfer')">
          <template #icon><icon-swap /></template>
          转出管理
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LiveAnesthesiaSheet from '@/components/anesthesia/record/LiveAnesthesiaSheet.vue';
import { buildDrugCatalog, buildFluidCatalog, buildVitalCatalog, ensureRecordDocument } from '@/services/anesthesiaRecordEngine';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PacuPatient, SurgeryCase, VitalSign } from '@/types/anesthesia';

const route = useRoute();
const router = useRouter();
const store = useAnesthesiaStore();
const selectedId = ref(String(route.params.id || store.pacuPatients[0]?.id));
const viewMode = ref<'form' | 'sheet'>('form');

watch(() => route.params.id, (id) => {
  if (id) selectedId.value = String(id);
});

const current = computed(() => store.pacuPatients.find((item) => item.id === selectedId.value));
const linkedCase = computed(() => store.cases.find((item) => item.id === current.value?.caseId));
const vitalCatalog = computed(() => buildVitalCatalog(store.configVitals));
const drugCatalog = computed(() => buildDrugCatalog(store.configDrugs));
const fluidCatalog = computed(() => buildFluidCatalog(store.configFluids));
const monitorOrder = computed(() => ['HR', 'SBP', 'SpO2', 'RR', 'TEMP']);

const pacuSheetRecord = computed((): SurgeryCase => {
  const base = linkedCase.value;
  if (!base || !current.value) return base as SurgeryCase;
  const doc = ensureRecordDocument(base);
  return {
    ...base,
    roomInTime: current.value.inTime,
    anesthesiaStart: current.value.inTime,
    recordDocument: {
      ...doc,
      recordType: 'pacu',
      hospitalName: doc.hospitalName,
    },
    recordSummary: {
      ...(base.recordSummary ?? {}),
      destination: current.value.transferTo,
      handoverNote: current.value.handover,
    },
    recoveryRecord: {
      ...(base.recoveryRecord ?? {}),
      pacuInTime: current.value.inTime,
      pacuOutTime: current.value.outTime,
      aldrete: current.value.aldrete,
      painScore: current.value.vas,
      handoverNote: current.value.handover,
      destination: current.value.transferTo === 'ICU' ? 'ICU' : '病房',
    },
    vitals: [
      ...(base.vitals ?? []),
      {
        id: `pacu-vital-${current.value.id}`,
        time: current.value.inTime,
        HR: current.value.HR,
        SpO2: current.value.SpO2,
        RR: current.value.RR,
        TEMP: current.value.firstTemperature,
        source: '手工录入',
      },
    ],
  };
});

watch([selectedId, linkedCase], () => {
  if (linkedCase.value) store.syncRecordDocument(linkedCase.value.id);
}, { immediate: true });

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const stayMinutes = (item: PacuPatient) => dayjs(item.outTime ?? new Date()).diff(dayjs(item.inTime), 'minute');

const saveRecord = () => {
  if (current.value) store.upsertPacuPatient(current.value);
};

const savePacuVital = (row: VitalSign) => {
  if (!linkedCase.value) return;
  store.upsertVital(linkedCase.value.id, row);
};
</script>

<style scoped>
.record-alert {
  margin-bottom: 14px;
}

.pacu-sheet-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  background: var(--surface);
}
</style>
