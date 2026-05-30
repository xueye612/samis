<template>
  <ModulePageShell title="麻醉小结" description="术中麻醉过程、恢复情况与效果评价">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px" placeholder="选择患者">
        <a-option v-for="item in caseOptions" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
    </template>
    <a-card v-if="record" class="section-card" :bordered="false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="患者"><a-input :model-value="record.patientName" disabled /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="麻醉方式"><a-input :model-value="record.anesthesiaMethod" disabled /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="麻醉效果">
              <a-select v-model="form.effectRating">
                <a-option value="优">优</a-option>
                <a-option value="良">良</a-option>
                <a-option value="中">中</a-option>
                <a-option value="差">差</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="术中记录"><a-textarea v-model="form.intraopNotes" :auto-size="{ minRows: 3 }" /></a-form-item>
        <a-form-item label="恢复情况"><a-textarea v-model="form.recoveryNotes" :auto-size="{ minRows: 3 }" /></a-form-item>
        <a-form-item label="并发症/特殊情况"><a-textarea v-model="form.complications" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-divider>签名</a-divider>
        <a-checkbox v-model="form.doctorSigned">麻醉医师签名</a-checkbox>
      </a-form>
      <div class="form-actions">
        <a-space>
          <a-button @click="save('草稿')">保存草稿</a-button>
          <a-button type="primary" @click="save('已提交')">提交小结</a-button>
        </a-space>
      </div>
    </a-card>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要填写麻醉小结的患者" icon="IconFile" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SummaryRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const caseOptions = computed(() => store.cases.filter((item) => ['已离室', 'PACU', '苏醒中'].includes(item.status)));
const selectedCaseId = ref(store.summaryRecords[0]?.caseId ?? caseOptions.value[0]?.id ?? '');

const record = computed(() => store.summaryRecords.find((item) => item.caseId === selectedCaseId.value));

const form = reactive({
  intraopNotes: '',
  recoveryNotes: '',
  complications: '',
  effectRating: '优' as SummaryRecord['effectRating'],
  doctorSigned: false,
});

watch([record, selectedCaseId], () => {
  const target = record.value;
  const caseItem = store.cases.find((item) => item.id === selectedCaseId.value);
  if (target) {
    Object.assign(form, {
      intraopNotes: target.intraopNotes,
      recoveryNotes: target.recoveryNotes,
      complications: target.complications,
      effectRating: target.effectRating,
      doctorSigned: target.doctorSigned,
    });
    return;
  }
  if (caseItem) {
    Object.assign(form, {
      intraopNotes: '麻醉过程平稳',
      recoveryNotes: '苏醒良好',
      complications: '无',
      effectRating: '优',
      doctorSigned: false,
    });
  }
}, { immediate: true });

const save = (status: SummaryRecord['status']) => {
  const caseItem = store.cases.find((item) => item.id === selectedCaseId.value);
  if (!caseItem) return;
  const payload: SummaryRecord = {
    id: record.value?.id ?? `summary-${caseItem.id}`,
    caseId: caseItem.id,
    patientName: caseItem.patientName,
    anesthesiaMethod: caseItem.anesthesiaMethod,
    ...form,
    status,
    signedAt: status === '已提交' ? dayjs().toISOString() : record.value?.signedAt,
  };
  store.saveSummaryRecord(payload);
  Message.success(status === '已提交' ? '麻醉小结已提交' : '草稿已保存');
};
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
