<template>
  <ModulePageShell title="术前访视/麻醉评估" description="统一展示患者基本情况、风险评估、病史与麻醉计划，形成术前质控入口。">
    <template #chips>
      <a-tag :color="assessment.status === 'submitted' ? 'green' : 'orange'">{{ statusText }}</a-tag>
      <a-tag :color="persistenceAvailable ? 'arcoblue' : 'red'">{{ persistenceAvailable ? '评估存储可用' : '评估存储未配置' }}</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-select v-model="selectedId" class="case-select" placeholder="选择访视患者">
          <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
            {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
          </a-option>
        </a-select>
        <a-button :loading="saving" :disabled="!canEdit" @click="saveDraft">保存草稿</a-button>
        <a-button type="primary" :loading="saving" :disabled="!canEdit" @click="submitAssessment">提交评估</a-button>
        <a-button :loading="saving" :disabled="assessment.status !== 'submitted' || !persistenceAvailable" @click="cancelSubmit">取消提交</a-button>
      </a-space>
    </template>

    <a-alert v-if="errorMessage" type="error" show-icon>{{ errorMessage }}</a-alert>
    <a-alert v-else-if="!persistenceAvailable" type="warning" show-icon>
      当前后端未配置术前麻醉评估存储；患者与手术信息仍来自手术通知单，真实保存已禁用。
    </a-alert>

    <section v-if="current" class="clinical-page-grid">
      <div class="clinical-panel">
        <a-card class="section-card patient-overview-card" :bordered="false">
          <template #title>患者与手术信息</template>
          <div class="patient-overview">
            <div>
              <div class="patient-name">{{ operationCase.patientName || '-' }}</div>
              <p>{{ operationCase.gender || '-' }} / {{ operationCase.age ?? '-' }}岁 · {{ operationCase.departmentName || '-' }}</p>
            </div>
            <a-space wrap>
              <a-tag color="green">{{ operationCase.status || current.status }}</a-tag>
              <a-tag>{{ operationCase.roomName || current.room }}</a-tag>
            </a-space>
          </div>
          <a-descriptions :column="2" bordered size="medium">
            <a-descriptions-item label="手术ID">{{ operationCase.operationId }}</a-descriptions-item>
            <a-descriptions-item label="拟行手术">{{ operationCase.operationName || '-' }}</a-descriptions-item>
            <a-descriptions-item label="计划时间">{{ operationCase.plannedStartTime || '-' }}</a-descriptions-item>
            <a-descriptions-item label="麻醉医生">{{ operationCase.anesthesiologistName || '-' }}</a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card class="section-card" :bordered="false" title="访视录入">
          <a-spin :loading="loading" style="width: 100%">
          <a-form :model="assessment" layout="vertical" :disabled="!canEdit">
            <a-row :gutter="16">
              <a-col :xs="24" :sm="8"><a-form-item label="ASA分级"><a-select :model-value="assessment.asaGrade ?? undefined" :options="['I', 'II', 'III', 'IV', 'V', 'VI']" allow-clear @update:model-value="setAsaGrade" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="过敏史"><a-textarea :model-value="assessment.allergyHistory ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.allergyHistory = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="既往麻醉史"><a-textarea :model-value="assessment.pastAnesthesiaHistory ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.pastAnesthesiaHistory = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="气道评估"><a-textarea :model-value="assessment.airwayAssessment ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.airwayAssessment = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="异常检查摘要"><a-textarea :model-value="assessment.abnormalExamSummary ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.abnormalExamSummary = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="风险摘要"><a-textarea :model-value="assessment.riskSummary ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.riskSummary = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="术前用药建议"><a-textarea :model-value="assessment.preMedicationAdvice ?? ''" :auto-size="{ minRows: 2 }" @update:model-value="assessment.preMedicationAdvice = $event" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="麻醉计划"><a-textarea :model-value="assessment.anesthesiaPlan ?? ''" :auto-size="{ minRows: 3 }" @update:model-value="assessment.anesthesiaPlan = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="评估医师"><a-input :model-value="assessment.evaluatorName ?? ''" @update:model-value="assessment.evaluatorName = $event" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="评估时间"><a-input :model-value="assessment.evaluatedAt ?? ''" placeholder="YYYY-MM-DD HH:mm:ss" @update:model-value="assessment.evaluatedAt = $event" /></a-form-item></a-col>
            </a-row>
          </a-form>
          </a-spin>
        </a-card>
      </div>

      <aside class="clinical-side-panel">
        <a-card class="section-card" :bordered="false" title="风险摘要">
          <div class="risk-score">
            <strong>{{ riskItems.length }}</strong>
            <span>需关注项目</span>
          </div>
          <div class="clinical-mini-list">
            <div v-for="item in riskChecklist" :key="item.label" class="clinical-mini-item">
              <strong>{{ item.label }}</strong>
              <span>{{ item.value || '待补充' }}</span>
            </div>
          </div>
        </a-card>
        <a-card class="section-card" :bordered="false" title="下一步建议">
          <a-timeline>
            <a-timeline-item label="术前">补齐过敏史、气道与禁食记录</a-timeline-item>
            <a-timeline-item label="入室">核对身份、手术部位、麻醉方式</a-timeline-item>
            <a-timeline-item label="质控">完成状态同步至访视完成率</a-timeline-item>
          </a-timeline>
        </a-card>
      </aside>
    </section>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import type { PreoperativeAssessmentApi } from '@/api/preoperative';
import {
  cancelPreoperativeAssessmentSubmit,
  emptyPreoperativeAssessment,
  loadPreoperativeAssessment,
  savePreoperativeAssessmentDraft,
  submitPreoperativeAssessment,
} from '@/services/anesthesia/preoperativeAssessmentService';

const store = useAnesthesiaStore();
const selectedId = ref(store.cases[0]?.id ?? '');
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));
const operationCase = reactive<OperationCase>({});
const assessment = reactive<PreoperativeAssessmentApi>(emptyPreoperativeAssessment(selectedId.value));
const loading = ref(false);
const saving = ref(false);
const persistenceAvailable = ref(true);
const errorMessage = ref('');
const canEdit = computed(() => Boolean(current.value) && persistenceAvailable.value && assessment.status !== 'submitted' && !loading.value);
const statusText = computed(() => ({ draft: '草稿', submitted: '已提交', cancelled: '已取消' }[assessment.status]));
const riskItems = computed(() => {
  return [
    assessment.asaGrade && !['I', 'II'].includes(assessment.asaGrade) ? 'ASA 高风险' : '',
    assessment.allergyHistory && assessment.allergyHistory !== '无' ? '过敏史' : '',
    assessment.airwayAssessment ? '气道风险' : '',
    assessment.riskSummary ? '综合风险' : '',
  ].filter(Boolean);
});
const riskChecklist = computed(() => [
  { label: 'ASA 分级', value: assessment.asaGrade },
  { label: '过敏史', value: assessment.allergyHistory },
  { label: '气道评估', value: assessment.airwayAssessment },
  { label: '风险摘要', value: assessment.riskSummary },
]);

function replaceReactive<T extends object>(target: T, value: T) {
  Object.keys(target).forEach((key) => delete (target as Record<string, unknown>)[key]);
  Object.assign(target, value);
}

function setAsaGrade(value: unknown) {
  assessment.asaGrade = typeof value === 'string' ? value : null;
}

async function loadDetail(operationId: string) {
  if (!operationId) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const detail = await loadPreoperativeAssessment(operationId);
    replaceReactive(operationCase, detail.operationCase);
    replaceReactive(assessment, detail.assessment ?? emptyPreoperativeAssessment(operationId));
    persistenceAvailable.value = detail.persistence.available;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '术前麻醉评估加载失败';
  } finally {
    loading.value = false;
  }
}

async function saveDraft() {
  saving.value = true;
  try {
    replaceReactive(assessment, await savePreoperativeAssessmentDraft(selectedId.value, assessment));
    Message.success('草稿已保存');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '草稿保存失败');
  } finally { saving.value = false; }
}

async function submitAssessment() {
  saving.value = true;
  try {
    await savePreoperativeAssessmentDraft(selectedId.value, assessment);
    replaceReactive(assessment, await submitPreoperativeAssessment(selectedId.value));
    Message.success('评估已提交');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '评估提交失败');
  } finally { saving.value = false; }
}

async function cancelSubmit() {
  saving.value = true;
  try {
    replaceReactive(assessment, await cancelPreoperativeAssessmentSubmit(selectedId.value));
    Message.success('评估已撤回为草稿');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '撤回失败');
  } finally { saving.value = false; }
}

watch(selectedId, loadDetail);
onMounted(async () => {
  if (!store.cases.length) await store.loadRemoteOperationList();
  if (!selectedId.value) selectedId.value = store.cases[0]?.id ?? '';
  else await loadDetail(selectedId.value);
});
</script>

<style scoped>
.case-select {
  width: min(420px, 100%);
}

.patient-overview-card {
  overflow: hidden;
}

.patient-overview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.patient-name {
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
}

.patient-overview p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.risk-score {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--surface-blue);
}

.risk-score strong {
  color: var(--primary);
  font-size: 34px;
  line-height: 1;
}

.risk-score span {
  color: var(--text-secondary);
}
</style>
