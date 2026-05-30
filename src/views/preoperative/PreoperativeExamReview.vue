<template>
  <ModulePageShell title="术前检查审核" description="检验与影像结果审核，确认术前准备是否达标">
    <template #chips>
      <a-tag color="green">通过 {{ resultCount('通过') }}</a-tag>
      <a-tag color="orangered">待补检 {{ resultCount('待补检') }}</a-tag>
      <a-tag color="red">异常 {{ resultCount('异常') }}</a-tag>
    </template>
    <template #toolbar>
      <a-select v-model="resultFilter" style="width: 140px" allow-clear placeholder="审核结果">
        <a-option value="通过">通过</a-option>
        <a-option value="待补检">待补检</a-option>
        <a-option value="异常">异常</a-option>
      </a-select>
    </template>
    <a-card class="section-card" :bordered="false" title="检查审核列表">
      <a-table :data="filtered" :pagination="{ pageSize: 8 }" row-key="id">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="检验项目" data-index="labItems" />
          <a-table-column title="影像项目" data-index="imagingItems" />
          <a-table-column title="审核结果" :width="100">
            <template #cell="{ record }">
              <a-tag :color="reviewColor(record.reviewResult)">{{ record.reviewResult }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="审核人" data-index="reviewer" :width="100" />
          <a-table-column title="审核日期" data-index="reviewDate" :width="120" />
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }">
              <a-button size="mini" type="text" @click="router.push(`/surgery/detail/${record.caseId}`)">详情</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { ExamReviewRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();
const resultFilter = ref<string | undefined>();

const reviewColor = (result: ExamReviewRecord['reviewResult']) => ({
  通过: 'green',
  待补检: 'orangered',
  异常: 'red',
}[result] ?? 'gray');

const resultCount = (result: ExamReviewRecord['reviewResult']) => store.examReviews.filter((item) => item.reviewResult === result).length;

const filtered = computed(() => {
  if (!resultFilter.value) return store.examReviews;
  return store.examReviews.filter((item) => item.reviewResult === resultFilter.value);
});
</script>
