<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false" title="知情同意">
      <a-table :data="rows" :pagination="{ pageSize: 8 }" row-key="id">
        <template #columns>
          <a-table-column title="名称/患者" data-index="label" />
          <a-table-column title="说明" data-index="desc" />
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }"><a-button size="mini" type="primary" @click="go(record)">查看</a-button></template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAnesthesiaStore } from '@/stores/anesthesia';

interface RowItem { id: string; label: string; desc: string; link?: string }

const store = useAnesthesiaStore();
const router = useRouter();
const rows = computed(() => buildRows('cases'));

function buildRows(k: string): RowItem[] {
  if (k === 'todos') return store.todos.map((item) => ({ id: item.id, label: item.title, desc: item.category, link: item.caseId }));
  if (k === 'qualityDefects') return store.qualityDefects.map((item) => ({ id: item.defectId, label: item.defectType, desc: item.defectDesc, link: item.caseId }));
  if (k === 'indicatorDetails') return store.indicatorDetails.slice(0, 10).map((item) => ({ id: item.code, label: item.name, desc: String(item.displayValue), link: '' }));
  if (k === 'qualityReportCache') return store.qualityReportCache.map((item) => ({ id: item.period, label: item.period, desc: item.generatedAt, link: '' }));
  if (k === 'pdcaRecords') return store.pdcaRecords.map((item) => ({ id: item.id, label: item.title, desc: item.problem, link: '' }));
  if (k === 'auditLogs') return store.auditLogs.map((item) => ({ id: item.id, label: item.action, desc: item.detail, link: item.target }));
  if (k === 'integrationEndpoints') return store.integrationEndpoints.map((item) => ({ id: item.id, label: item.name, desc: item.endpoint, link: item.id }));
  if (k === 'systemUsers') return store.systemUsers.map((item) => ({ id: item.id, label: item.name, desc: item.role, link: '' }));
  if (k === 'pacuPatients') return store.pacuPatients.map((item) => ({ id: item.id, label: item.patientName, desc: item.room, link: item.caseId }));
  if (k === 'followUps') return store.followUps.map((item) => ({ id: item.id, label: item.type, desc: String(item.vas), link: item.caseId }));
  if (k === 'qualityDataset') return store.qualityDataset.events.filter((item) => item.isQualityEvent).map((item) => ({ id: item.eventId, label: item.eventType, desc: item.description, link: item.caseId }));
  if (k === 'roles') return [{ id: 'admin', label: '质控管理员', desc: '全部权限', link: '' }, { id: 'anes', label: '麻醉医师', desc: '临床操作', link: '' }];
  if (k === 'mock') return [{ id: 'seed', label: 'Mock 数据集', desc: 'qualitySeed + clinical 同步', link: '' }];
  return store.cases.map((item) => ({ id: item.id, label: item.patientName, desc: item.surgeryName, link: item.id }));
}

const go = (record: RowItem) => {
  if (record.link) router.push(`/surgery/record/${record.link}`);
};
</script>
