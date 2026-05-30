<template>
  <ModulePageShell title="知情同意" description="麻醉风险告知、方案说明与签名确认">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px" placeholder="选择患者">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
    </template>
    <a-card v-if="record" class="section-card" :bordered="false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="患者"><a-input :model-value="record.patientName" disabled /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="手术"><a-input :model-value="record.surgeryName" disabled /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="拟行麻醉"><a-input :model-value="record.anesthesiaMethod" disabled /></a-form-item></a-col>
        </a-row>
        <a-divider>风险告知确认</a-divider>
        <a-checkbox v-model="form.commonRisks">已告知常见风险</a-checkbox>
        <a-checkbox v-model="form.severeRisks">已告知严重风险</a-checkbox>
        <a-checkbox v-model="form.specialRisks">已告知特殊风险</a-checkbox>
        <a-divider>方案与理解确认</a-divider>
        <a-checkbox v-model="form.planAccepted">接受麻醉方案</a-checkbox>
        <a-checkbox v-model="form.questionAnswered">疑问已解答</a-checkbox>
        <a-divider>签名</a-divider>
        <a-space>
          <a-checkbox v-model="form.patientSigned">患者签名</a-checkbox>
          <a-checkbox v-model="form.familySigned">家属签名</a-checkbox>
          <a-checkbox v-model="form.doctorSigned">医生签名</a-checkbox>
        </a-space>
      </a-form>
      <div class="form-actions">
        <a-space>
          <a-button @click="save('草稿')">保存草稿</a-button>
          <a-button type="primary" @click="save('已提交')">提交</a-button>
          <a-button @click="printPreview">打印</a-button>
        </a-space>
      </div>
    </a-card>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要签署知情同意的患者" icon="IconFile" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const selectedCaseId = ref(store.cases[0]?.id ?? '');
const record = computed(() => store.consentRecords.find((item) => item.caseId === selectedCaseId.value));
const form = reactive({
  commonRisks: false,
  severeRisks: false,
  specialRisks: false,
  planAccepted: false,
  questionAnswered: false,
  patientSigned: false,
  familySigned: false,
  doctorSigned: false,
});

watch(record, (value) => {
  if (!value) return;
  Object.assign(form, {
    commonRisks: value.commonRisks,
    severeRisks: value.severeRisks,
    specialRisks: value.specialRisks,
    planAccepted: value.planAccepted,
    questionAnswered: value.questionAnswered,
    patientSigned: value.patientSigned,
    familySigned: value.familySigned,
    doctorSigned: value.doctorSigned,
  });
}, { immediate: true });

const save = (status: '草稿' | '已提交') => {
  if (!record.value) return;
  store.saveConsentRecord({
    ...record.value,
    ...form,
    status,
    signedAt: status === '已提交' ? dayjs().toISOString() : record.value.signedAt,
    updatedAt: dayjs().toISOString(),
  });
  Message.success(status === '已提交' ? '知情同意已提交' : '草稿已保存');
};

const printPreview = () => Message.info('打印预览（Mock）');
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
