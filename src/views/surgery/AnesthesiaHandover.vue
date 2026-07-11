<template>
  <ModulePageShell title="麻醉交班" description="术中责任交接、核查与双方确认">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 320px" placeholder="选择患者">
        <a-option v-for="item in caseOptions" :key="item.id" :value="item.id">{{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
    </template>
    <a-alert v-if="workflow.error" type="error" :title="workflow.error">
      <template #action><a-button size="mini" @click="loadHandover">重试</a-button></template>
    </a-alert>
    <a-spin :loading="workflow.loading" style="width: 100%">
      <a-card v-if="caseItem" class="section-card" :bordered="false">
        <template #title>交班记录 · {{ handoverStatusLabel(current?.status) }}</template>
        <template #extra><a-tag :color="statusColor">版本 {{ current?.version ?? 1 }}</a-tag></template>
        <a-form :model="form" layout="vertical" :disabled="readOnly">
          <a-row :gutter="16">
            <a-col :span="8"><a-form-item label="患者"><a-input :model-value="caseItem.patientName" disabled /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="交班类型"><a-select v-model="form.handoverType" :options="handoverTypes" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="交班医师"><a-input :model-value="current?.outgoingDoctorName || caseItem.anesthesiologist" disabled /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="接班医师工号" required><a-input v-model="form.incomingDoctorId" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="接班医师姓名"><a-input v-model="form.incomingDoctorName" /></a-form-item></a-col>
          </a-row>
          <a-divider>交班重点</a-divider>
          <a-form-item label="重点关注"><a-textarea v-model="form.priorityNotes" :auto-size="{ minRows: 2 }" /></a-form-item>
          <a-form-item label="特殊说明"><a-textarea v-model="form.specialNotes" :auto-size="{ minRows: 2 }" /></a-form-item>
          <a-form-item label="待办事项"><a-input v-model="form.pendingTasks" placeholder="多个待办用逗号分隔" /></a-form-item>
          <a-form-item v-if="form.handoverType === 'emergency'" label="紧急交班原因" required><a-textarea v-model="form.emergencyReason" /></a-form-item>
          <a-divider>核查确认</a-divider>
          <div class="check-grid">
            <div v-for="check in form.checks" :key="check.itemCode" class="check-item">
              <strong>{{ check.label }}</strong>
              <a-radio-group v-model="check.result" type="button" size="small">
                <a-radio value="normal">正常</a-radio><a-radio value="exception">异常</a-radio>
              </a-radio-group>
              <a-input v-if="check.result === 'exception'" v-model="check.remark" placeholder="必须填写异常说明" />
            </div>
          </div>
        </a-form>
        <div class="form-actions">
          <a-space>
            <a-button :loading="workflow.saving" :disabled="readOnly" @click="saveDraft">保存草稿</a-button>
            <a-button v-if="current?.status !== 'submitted'" type="primary" :loading="workflow.saving" :disabled="readOnly" @click="submit">提交交班</a-button>
            <a-button v-if="current?.status === 'submitted'" type="primary" :loading="workflow.saving" @click="accept">接班确认</a-button>
          </a-space>
        </div>
      </a-card>
      <EmptyState v-else title="请选择患者" description="从上方选择需要交班的手术患者" icon="IconSwap" />
    </a-spin>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useAnesthesiaHandoverStore } from '@/stores/anesthesiaWorkflow';

const store = useAnesthesiaStore();
const workflow = useAnesthesiaHandoverStore();
const caseOptions = computed(() => store.cases.filter((item) => item.status !== '已取消'));
const selectedCaseId = ref(caseOptions.value[0]?.id ?? '');
const caseItem = computed(() => caseOptions.value.find((item) => item.id === selectedCaseId.value));
const current = computed(() => workflow.detail?.activeHandover ?? null);
const readOnly = computed(() => ['accepted', 'cancelled'].includes(current.value?.status ?? ''));
const statusColor = computed(() => current.value?.status === 'accepted' ? 'green' : current.value?.status === 'submitted' ? 'orange' : 'arcoblue');
const handoverStatusLabel = (status?: string) => ({ draft: '草稿', submitted: '待接班', accepted: '已接班', cancelled: '已取消' }[status ?? 'draft']);
const handoverTypes = [{ label: '常规换班', value: 'shift_change' }, { label: '临时交班', value: 'temporary' }, { label: '紧急交班', value: 'emergency' }];
const form = reactive({
  handoverType: 'shift_change', incomingDoctorId: '', incomingDoctorName: '', priorityNotes: '', specialNotes: '', pendingTasks: '', emergencyReason: '',
  checks: [
    { itemCode: 'equipment', label: '设备运行与备用设备', result: 'normal', remark: '' },
    { itemCode: 'medication', label: '持续用药与特殊药品', result: 'normal', remark: '' },
    { itemCode: 'airway', label: '气道与通气状态', result: 'normal', remark: '' },
    { itemCode: 'hemodynamics', label: '循环与出入量', result: 'normal', remark: '' },
  ],
});

function hydrateForm() {
  const item = current.value;
  if (!item) return;
  Object.assign(form, {
    handoverType: item.handoverType, incomingDoctorId: item.incomingDoctorId ?? '', incomingDoctorName: item.incomingDoctorName ?? '',
    priorityNotes: item.priorityNotes ?? '', specialNotes: item.specialNotes ?? '', pendingTasks: (item.pendingTasks ?? []).join(','), emergencyReason: item.emergencyReason ?? '',
  });
  form.checks.forEach((check) => {
    const saved = item.checks.find((candidate) => candidate.itemCode === check.itemCode);
    if (saved) Object.assign(check, { result: saved.result, remark: saved.remark });
  });
}

function payload() {
  return {
    handoverType: form.handoverType, incomingDoctorId: form.incomingDoctorId, incomingDoctorName: form.incomingDoctorName,
    priorityNotes: form.priorityNotes, specialNotes: form.specialNotes,
    pendingTasks: form.pendingTasks.split(/[,，]/).map((item) => item.trim()).filter(Boolean), emergencyReason: form.emergencyReason,
    checks: form.checks.map(({ itemCode, result, remark }) => ({ itemCode, result, remark })),
  };
}

async function loadHandover() {
  if (!selectedCaseId.value) return;
  try { await workflow.load(selectedCaseId.value); hydrateForm(); } catch { /* store exposes the error */ }
}
async function saveDraft() {
  try { await workflow.saveDraft(payload()); hydrateForm(); Message.success('交班草稿已保存'); } catch { /* store exposes the error */ }
}
async function submit() {
  if (!form.incomingDoctorId.trim()) { Message.warning('请填写接班医师工号'); return; }
  if (form.checks.some((item) => item.result === 'exception' && !item.remark.trim())) { Message.warning('异常核查项必须填写说明'); return; }
  try { await workflow.saveDraft(payload()); await workflow.submit(); await workflow.load(selectedCaseId.value); hydrateForm(); Message.success('交班已提交，等待指定医生接班'); } catch { /* store exposes the error */ }
}
async function accept() {
  try { await workflow.accept(); await workflow.load(selectedCaseId.value); hydrateForm(); Message.success('接班确认完成'); } catch { /* store exposes the error */ }
}
watch(selectedCaseId, loadHandover, { immediate: true });
</script>

<style scoped>
.check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.check-item { display: grid; gap: var(--space-2); padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.form-actions { margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border); }
@media (max-width: 900px) { .check-grid { grid-template-columns: 1fr; } }
</style>
