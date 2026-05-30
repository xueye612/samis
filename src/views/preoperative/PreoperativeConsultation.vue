<template>
  <ModulePageShell title="麻醉会诊" description="跨科室会诊申请与麻醉评估意见">
    <template #chips>
      <a-tag color="orangered">待会诊 {{ pendingCount }}</a-tag>
      <a-tag color="green">已完成 {{ store.consultations.length - pendingCount }}</a-tag>
    </template>
    <a-row :gutter="16">
      <a-col :span="14">
        <a-card class="section-card" :bordered="false" title="会诊列表">
          <a-table
            :data="store.consultations"
            :pagination="false"
            row-key="id"
            :row-class="rowClass"
            @row-click="selectConsultation"
          >
            <template #columns>
              <a-table-column title="患者" data-index="patientName" />
              <a-table-column title="申请科室" data-index="requestDept" />
              <a-table-column title="会诊日期" data-index="consultDate" :width="120" />
              <a-table-column title="会诊医师" data-index="consultant" :width="100" />
              <a-table-column title="状态" :width="100">
                <template #cell="{ record }">
                  <a-tag :color="record.status === '已完成' ? 'green' : 'orangered'">{{ record.status }}</a-tag>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card class="section-card" :bordered="false" title="会诊意见">
          <template v-if="selected">
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="患者">{{ selected.patientName }}</a-descriptions-item>
              <a-descriptions-item label="申请科室">{{ selected.requestDept }}</a-descriptions-item>
              <a-descriptions-item label="会诊医师">{{ selected.consultant }}</a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="selected.status === '已完成' ? 'green' : 'orangered'">{{ selected.status }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
            <a-divider />
            <div class="opinion-block">
              <div class="opinion-label">麻醉评估意见</div>
              <p>{{ selected.opinion }}</p>
            </div>
            <a-button type="text" @click="router.push(`/surgery/detail/${selected.caseId}`)">查看患者详情</a-button>
          </template>
          <EmptyState v-else title="选择会诊记录" description="点击左侧列表查看会诊意见" icon="IconList" />
        </a-card>
      </a-col>
    </a-row>
  </ModulePageShell>
</template>

<script setup lang="ts">
import type { TableData } from '@arco-design/web-vue/es/table/interface';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { ConsultationRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();
const selectedId = ref(store.consultations[0]?.id ?? '');

const pendingCount = computed(() => store.consultations.filter((item) => item.status === '待会诊').length);
const selected = computed(() => store.consultations.find((item) => item.id === selectedId.value));

const selectConsultation = (record: TableData) => {
  selectedId.value = (record as ConsultationRecord).id;
};

const rowClass = (record: ConsultationRecord) => (record.id === selectedId.value ? 'row-active' : '');
</script>

<style scoped>
.opinion-block {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  margin-bottom: var(--space-3);
}
.opinion-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}
.opinion-block p {
  margin: 0;
  line-height: 1.6;
  color: var(--text-primary);
}
:deep(.row-active td) {
  background: rgb(219 234 254 / 40%);
}
</style>
