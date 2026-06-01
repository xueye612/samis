<template>
  <ModulePageShell title="术中用药" description="按病例、用药模式与高警示核对状态汇总术中用药，便于补录、核查与质控提取。">
    <template #chips>
      <a-tag color="arcoblue">用药 {{ rows.length }}</a-tag>
      <a-tag :color="highAlertUncheckedCount ? 'red' : 'green'">高警示未核对 {{ highAlertUncheckedCount }}</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-input-search v-model="keyword" class="toolbar-search" placeholder="搜索患者/手术/药品" allow-clear />
        <a-select v-model="modeFilter" class="filter-select" :options="modeOptions" />
        <a-button type="primary" @click="router.push('/config/drugs')">维护药品字典</a-button>
      </a-space>
    </template>

    <template #stats>
      <MetricCard label="用药记录" :value="rows.length" hint="来自术中病例记录" icon="IconExperiment" />
      <MetricCard label="持续泵入" :value="continuousCount" hint="需关注停泵时间与总量" icon="IconSwap" />
      <MetricCard label="高警示药品" :value="highAlertCount" hint="需双人核对" :variant="highAlertUncheckedCount ? 'warn' : 'default'" icon="IconExclamationCircle" />
      <MetricCard label="未核对" :value="highAlertUncheckedCount" hint="质控待处理" :variant="highAlertUncheckedCount ? 'danger' : 'default'" icon="IconFile" />
    </template>

    <section class="clinical-page-grid">
      <div class="clinical-panel">
        <a-card class="section-card" :bordered="false" title="用药明细">
          <a-table :data="filteredRows" :pagination="{ pageSize: 8 }" row-key="id" :scroll="{ x: 1080 }" class="compact-table">
        <template #columns>
          <a-table-column title="患者/手术" :width="230">
            <template #cell="{ record }">
              <div class="clinical-row-title">
                <strong>{{ record.patientName }}</strong>
                <span>{{ record.room }} · {{ record.surgeryName }}</span>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="类型" :width="90">
            <template #cell="{ record }"><a-tag :color="record.mode === '持续泵入' ? 'arcoblue' : 'gray'">{{ record.mode === '持续泵入' ? '持续' : '单次' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="时间" data-index="timeText" :width="160" />
          <a-table-column title="药品" data-index="drug" />
          <a-table-column title="剂量/泵速" data-index="amountText" :width="190" />
          <a-table-column title="途径" data-index="route" :width="90" />
          <a-table-column title="核对" :width="100">
            <template #cell="{ record }"><a-tag :color="record.highAlert && !record.checker ? 'red' : 'green'">{{ record.checker || '未核对' }}</a-tag></template>
          </a-table-column>
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }"><a-button size="mini" type="primary" @click="go(record.caseId)">查看</a-button></template>
          </a-table-column>
        </template>
      </a-table>
        </a-card>
      </div>

      <aside class="clinical-side-panel">
        <a-card class="section-card" :bordered="false" title="高警示核对清单">
          <div class="clinical-mini-list">
            <div v-for="item in uncheckedHighAlertRows" :key="item.id" class="clinical-mini-item">
              <strong>{{ item.drug }} · {{ item.amountText }}</strong>
              <span>{{ item.patientName }} / {{ item.timeText }} / {{ item.route || '未记录途径' }}</span>
            </div>
            <a-empty v-if="!uncheckedHighAlertRows.length" description="暂无未核对高警示药品" />
          </div>
        </a-card>
        <a-card class="section-card" :bordered="false" title="组件优化建议">
          <a-timeline>
            <a-timeline-item label="字典">从药品字典生成常用药和默认剂量</a-timeline-item>
            <a-timeline-item label="录入">单次、持续泵入、追加用药分模式录入</a-timeline-item>
            <a-timeline-item label="质控">高警示药品未核对直接进入待办</a-timeline-item>
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
import type { MedicationRecord } from '@/types/anesthesia';

interface RowItem {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  surgeryName: string;
  mode: MedicationRecord['mode'];
  timeText: string;
  drug: string;
  amountText: string;
  route?: string;
  checker?: string;
  highAlert?: boolean;
}

const store = useAnesthesiaStore();
const router = useRouter();
const keyword = ref('');
const modeFilter = ref('全部');
const modeOptions = ['全部', '单次用药', '持续泵入', '间断追加'];

const rows = computed<RowItem[]>(() => store.cases.flatMap((item) => item.medications.map((row) => ({
  id: `${item.id}-${row.id}`,
  caseId: item.id,
  patientName: item.patientName,
  room: item.room,
  surgeryName: item.surgeryName,
  mode: row.mode,
  timeText: medicationTime(row),
  drug: row.drug,
  amountText: medicationAmount(row),
  route: row.route,
  checker: row.checker,
  highAlert: row.highAlert,
}))));
const filteredRows = computed(() => {
  const q = keyword.value.trim();
  return rows.value.filter((item) => {
    const matchKeyword = !q || [item.patientName, item.room, item.surgeryName, item.drug].some((value) => value.includes(q));
    const matchMode = modeFilter.value === '全部' || item.mode === modeFilter.value;
    return matchKeyword && matchMode;
  });
});
const continuousCount = computed(() => rows.value.filter((item) => item.mode === '持续泵入').length);
const highAlertCount = computed(() => rows.value.filter((item) => item.highAlert).length);
const highAlertUncheckedCount = computed(() => rows.value.filter((item) => item.highAlert && !item.checker).length);
const uncheckedHighAlertRows = computed(() => rows.value.filter((item) => item.highAlert && !item.checker).slice(0, 6));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const medicationTime = (row: MedicationRecord) => {
  const start = formatTime(row.startTime ?? row.time) || '-';
  return row.mode === '持续泵入' ? `${start} - ${formatTime(row.stopTime ?? row.endTime) || '进行中'}` : start;
};
const medicationAmount = (row: MedicationRecord) => {
  const dose = `${row.dose ?? ''}${row.unit ?? ''}` || '-';
  return row.mode === '持续泵入'
    ? [row.pumpRate, row.totalAmount ? `总量${row.totalAmount}` : '', row.concentration].filter(Boolean).join(' / ') || dose
    : dose;
};
const go = (id: string) => router.push(`/surgery/record/${id}`);
</script>

<style scoped>
.filter-select {
  width: 140px;
}
</style>
