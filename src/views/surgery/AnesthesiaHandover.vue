<template>
  <ModulePageShell title="麻醉交班" description="术中交班记录、重点关注与设备药品核查">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px" placeholder="选择患者">
        <a-option v-for="item in caseOptions" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
    </template>
    <a-card v-if="record" class="section-card" :bordered="false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="患者"><a-input :model-value="record.patientName" disabled /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="交班类型">
              <a-select v-model="form.handoverType">
                <a-option value="常规交班">常规交班</a-option>
                <a-option value="紧急交班">紧急交班</a-option>
                <a-option value="临时交班">临时交班</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8"><a-form-item label="交班医师"><a-input v-model="form.handoverDoctor" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="接班医师"><a-input v-model="form.receiveDoctor" /></a-form-item></a-col>
        </a-row>
        <a-divider>交班内容</a-divider>
        <a-form-item label="重点关注"><a-textarea v-model="form.focusPoints" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item label="当前用药"><a-textarea v-model="form.medications" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item label="生命体征"><a-input v-model="form.vitals" /></a-form-item>
        <a-form-item label="特殊说明"><a-textarea v-model="form.specialNotes" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item label="待办事项"><a-textarea v-model="form.pendingItems" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-divider>核查确认</a-divider>
        <a-space>
          <a-checkbox v-model="form.equipmentChecked">设备已核查</a-checkbox>
          <a-checkbox v-model="form.drugChecked">药品已核查</a-checkbox>
        </a-space>
      </a-form>
      <div class="form-actions">
        <a-space>
          <a-button @click="save('草稿')">保存草稿</a-button>
          <a-button type="primary" @click="save('已提交')">提交交班</a-button>
        </a-space>
      </div>
    </a-card>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要填写交班记录的患者" icon="IconSwap" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { HandoverRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const caseOptions = computed(() => store.cases.filter((item) => item.status !== '已取消'));
const selectedCaseId = ref(store.handoverRecords[0]?.caseId ?? caseOptions.value[0]?.id ?? '');

const record = computed(() => store.handoverRecords.find((item) => item.caseId === selectedCaseId.value));

const form = reactive({
  handoverType: '常规交班' as HandoverRecord['handoverType'],
  handoverDoctor: '',
  receiveDoctor: '',
  focusPoints: '',
  medications: '',
  vitals: '',
  specialNotes: '',
  pendingItems: '',
  equipmentChecked: false,
  drugChecked: false,
});

watch([record, selectedCaseId], () => {
  const target = record.value;
  const caseItem = store.cases.find((item) => item.id === selectedCaseId.value);
  if (target) {
    Object.assign(form, {
      handoverType: target.handoverType,
      handoverDoctor: target.handoverDoctor,
      receiveDoctor: target.receiveDoctor,
      focusPoints: target.focusPoints,
      medications: target.medications,
      vitals: target.vitals,
      specialNotes: target.specialNotes,
      pendingItems: target.pendingItems,
      equipmentChecked: target.equipmentChecked,
      drugChecked: target.drugChecked,
    });
    return;
  }
  if (caseItem) {
    Object.assign(form, {
      handoverType: '常规交班',
      handoverDoctor: caseItem.anesthesiologist,
      receiveDoctor: '',
      focusPoints: `${caseItem.anesthesiaMethod}，关注生命体征`,
      medications: '',
      vitals: '',
      specialNotes: '',
      pendingItems: '',
      equipmentChecked: false,
      drugChecked: false,
    });
  }
}, { immediate: true });

const save = (status: HandoverRecord['status']) => {
  const caseItem = store.cases.find((item) => item.id === selectedCaseId.value);
  if (!caseItem) return;
  const payload: HandoverRecord = {
    id: record.value?.id ?? `handover-${caseItem.id}`,
    caseId: caseItem.id,
    patientName: caseItem.patientName,
    ...form,
    status,
    signedAt: status === '已提交' ? dayjs().toISOString() : record.value?.signedAt,
  };
  store.saveHandoverRecord(payload);
  Message.success(status === '已提交' ? '交班记录已提交' : '草稿已保存');
};
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
