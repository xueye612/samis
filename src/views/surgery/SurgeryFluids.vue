<template>
  <ModulePageShell title="输液输血" description="汇总术中晶体液、胶体液、血制品和自体血回输，突出容量、核对与不良反应风险。">
    <template #chips>
      <a-tag color="green">入量 {{ fluidVolumeTotal }} ml</a-tag>
      <a-tag color="red">血制品 {{ bloodProductCount }}</a-tag>
      <a-tag :color="uncheckedBloodProductCount ? 'red' : 'green'">未核对 {{ uncheckedBloodProductCount }}</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-input-search v-model="keyword" class="toolbar-search" placeholder="搜索患者/液体/血制品" allow-clear />
        <a-select v-model="categoryFilter" class="filter-select" :options="categoryOptions" />
        <a-button type="primary" @click="router.push('/config/fluids')">维护液体/血制品字典</a-button>
      </a-space>
    </template>

    <template #stats>
      <MetricCard label="输注记录" :value="rows.length" hint="液体与血制品合计" icon="IconSwap" />
      <MetricCard label="液体入量" :value="`${fluidVolumeTotal}ml`" hint="不含血制品单位折算" icon="IconBarChart" />
      <MetricCard label="血制品" :value="bloodProductCount" hint="需双人核对" :variant="uncheckedBloodProductCount ? 'warn' : 'default'" icon="IconHeart" />
      <MetricCard label="未双核" :value="uncheckedBloodProductCount" hint="质控待处理" :variant="uncheckedBloodProductCount ? 'danger' : 'default'" icon="IconExclamationCircle" />
    </template>

    <section class="clinical-page-grid">
      <div class="clinical-panel">
        <a-card class="section-card" :bordered="false" title="输液输血明细">
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
          <a-table-column title="类别" :width="100">
            <template #cell="{ record }"><a-tag :color="record.category === '血液制品' ? 'red' : record.category === '自体血回输' ? 'orange' : 'green'">{{ record.category }}</a-tag></template>
          </a-table-column>
          <a-table-column title="时间" data-index="timeText" :width="160" />
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="容量" data-index="amountText" :width="100" />
          <a-table-column title="血型/核对" :width="130">
            <template #cell="{ record }">
              <span v-if="record.category === '血液制品'">{{ record.bloodType || '-' }} {{ record.rh || '' }}</span>
              <a-tag v-else color="green">普通输注</a-tag>
              <a-tag v-if="record.category === '血液制品'" :color="record.doubleCheck ? 'green' : 'red'">{{ record.doubleCheck ? '已核对' : '未核对' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="执行人" data-index="executor" :width="100" />
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }"><a-button size="mini" type="primary" @click="go(record.caseId)">查看</a-button></template>
          </a-table-column>
        </template>
      </a-table>
        </a-card>
      </div>

      <aside class="clinical-side-panel">
        <a-card class="section-card" :bordered="false" title="输血核对提醒">
          <div class="clinical-mini-list">
            <div v-for="item in uncheckedBloodRows" :key="item.id" class="clinical-mini-item">
              <strong>{{ item.name }} · {{ item.amountText }}</strong>
              <span>{{ item.patientName }} / {{ item.bloodType || '-' }} {{ item.rh || '' }} / {{ item.timeText }}</span>
            </div>
            <a-empty v-if="!uncheckedBloodRows.length" description="血制品均已核对" />
          </div>
        </a-card>
        <a-card class="section-card" :bordered="false" title="统计口径">
          <div class="clinical-mini-list">
            <div class="clinical-mini-item">
              <strong>液体入量</strong>
              <span>晶体液、胶体液、自体血回输按 ml 汇总</span>
            </div>
            <div class="clinical-mini-item">
              <strong>血制品</strong>
              <span>保留 U、ml、治疗量等原单位，重点核对双签</span>
            </div>
          </div>
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
import type { FluidRecord } from '@/types/anesthesia';

interface RowItem {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  surgeryName: string;
  category: FluidRecord['category'];
  timeText: string;
  name: string;
  volume: number;
  unit: string;
  amountText: string;
  bloodType?: string;
  rh?: string;
  doubleCheck?: boolean;
  executor?: string;
}

const store = useAnesthesiaStore();
const router = useRouter();
const keyword = ref('');
const categoryFilter = ref('全部');
const categoryOptions = ['全部', '晶体液', '胶体液', '血液制品', '自体血回输'];

const rows = computed<RowItem[]>(() => store.cases.flatMap((item) => item.fluids.map((row) => ({
  id: `${item.id}-${row.id}`,
  caseId: item.id,
  patientName: item.patientName,
  room: item.room,
  surgeryName: item.surgeryName,
  category: row.category,
  timeText: fluidTime(row),
  name: row.name,
  volume: row.volume,
  unit: row.unit ?? 'ml',
  amountText: `${row.volume}${row.unit ?? 'ml'}`,
  bloodType: row.bloodType,
  rh: row.rh,
  doubleCheck: row.doubleCheck,
  executor: row.executor,
}))));
const filteredRows = computed(() => {
  const q = keyword.value.trim();
  return rows.value.filter((item) => {
    const matchKeyword = !q || [item.patientName, item.room, item.surgeryName, item.name].some((value) => value.includes(q));
    const matchCategory = categoryFilter.value === '全部' || item.category === categoryFilter.value;
    return matchKeyword && matchCategory;
  });
});
const fluidVolumeTotal = computed(() => rows.value
  .filter((item) => item.category !== '血液制品' && item.unit === 'ml')
  .reduce((sum, item) => sum + (Number(item.volume) || 0), 0));
const bloodProductCount = computed(() => rows.value.filter((item) => item.category === '血液制品').length);
const uncheckedBloodProductCount = computed(() => rows.value.filter((item) => item.category === '血液制品' && !item.doubleCheck).length);
const uncheckedBloodRows = computed(() => rows.value.filter((item) => item.category === '血液制品' && !item.doubleCheck).slice(0, 6));

const formatTime = (value?: string) => (value ? dayjs(value).format('HH:mm') : '');
const fluidTime = (row: FluidRecord) => `${formatTime(row.startTime ?? row.time) || '-'} - ${formatTime(row.endTime) || '进行中'}`;
const go = (id: string) => router.push(`/surgery/record/${id}`);
</script>

<style scoped>
.filter-select {
  width: 150px;
}
</style>
