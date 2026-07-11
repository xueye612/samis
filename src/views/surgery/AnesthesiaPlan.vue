<template>
  <ModulePageShell title="麻醉计划" description="基于术前评估制定并版本化提交麻醉方案">
    <template #toolbar>
      <a-select v-model="selectedId" style="width: 320px" placeholder="选择手术患者">
        <a-option v-for="item in caseOptions" :key="item.id" :value="item.id">
          {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
        </a-option>
      </a-select>
    </template>

    <a-alert v-if="workflow.error" type="error" :title="workflow.error" closable>
      <template #action><a-button size="mini" @click="loadPlan">重试</a-button></template>
    </a-alert>

    <a-spin :loading="workflow.loading" style="width: 100%">
      <template v-if="currentCase">
        <a-card class="section-card" :bordered="false" title="病例与版本">
          <template #extra>
            <a-space>
              <a-tag>版本 {{ currentPlan?.version ?? 1 }}</a-tag>
              <a-tag :color="statusColor">{{ planStatusLabel(currentPlan?.status) }}</a-tag>
            </a-space>
          </template>
          <a-descriptions :column="4" bordered size="medium">
            <a-descriptions-item label="患者">{{ currentCase.patientName }}</a-descriptions-item>
            <a-descriptions-item label="性别/年龄">{{ currentCase.gender }} / {{ currentCase.age }}岁</a-descriptions-item>
            <a-descriptions-item label="ASA">{{ currentCase.asa }}</a-descriptions-item>
            <a-descriptions-item label="手术">{{ currentCase.surgeryName }}</a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card class="section-card" :bordered="false" title="麻醉方法与气道计划">
          <a-form :model="form" layout="vertical" :disabled="readOnly">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="主要麻醉方式" required>
                  <a-select v-model="form.primaryMethodCode">
                    <a-option value="general">全身麻醉</a-option>
                    <a-option value="neuraxial">椎管内麻醉</a-option>
                    <a-option value="nerve_block">神经阻滞</a-option>
                    <a-option value="combined">复合麻醉</a-option>
                    <a-option value="sedation">镇静麻醉</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8"><a-form-item label="气道策略" required><a-select v-model="form.airwayStrategy" :options="airwayOptions" /></a-form-item></a-col>
              <a-col :span="8"><a-form-item label="术后去向" required><a-select v-model="form.postoperativeDestination" :options="destinationOptions" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="备选麻醉方式"><a-input v-model="form.alternativeMethods" placeholder="多个方式用逗号分隔" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="特殊风险"><a-input v-model="form.specialRisks" placeholder="多个风险用逗号分隔" /></a-form-item></a-col>
            </a-row>
          </a-form>
        </a-card>

        <a-card class="section-card" :bordered="false" title="监测与围术期策略">
          <a-form :model="form" layout="vertical" :disabled="readOnly">
            <a-form-item label="监测计划" required>
              <a-checkbox-group v-model="form.monitoringItems" :options="monitoringOptions" />
            </a-form-item>
            <a-row :gutter="16">
              <a-col :span="12"><a-form-item label="诱导计划"><a-textarea v-model="form.inductionPlan" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="维持计划"><a-textarea v-model="form.maintenancePlan" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="镇痛计划"><a-textarea v-model="form.analgesiaPlan" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="液体与备血"><a-textarea v-model="form.fluidAndBloodPlan" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
            </a-row>
            <a-form-item label="补充说明"><a-textarea v-model="form.notes" :auto-size="{ minRows: 2 }" /></a-form-item>
          </a-form>
          <div class="form-actions">
            <a-space>
              <a-button :loading="workflow.saving" :disabled="readOnly" @click="saveDraft">保存草稿</a-button>
              <a-button type="primary" :loading="workflow.saving" :disabled="readOnly" @click="submitPlan">提交计划</a-button>
              <a-button @click="router.push(buildRecordRoute(currentCase.id, 'plan'))">进入记录单</a-button>
            </a-space>
          </div>
        </a-card>
      </template>
      <EmptyState v-else title="请选择患者" description="从上方选择需要制定麻醉计划的患者" icon="IconFile" />
    </a-spin>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { buildRecordRoute } from '@/services/recordNavigation';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useAnesthesiaPlanStore } from '@/stores/anesthesiaWorkflow';

const store = useAnesthesiaStore();
const workflow = useAnesthesiaPlanStore();
const router = useRouter();
const caseOptions = computed(() => store.cases.filter((item) => item.status !== '已取消'));
const selectedId = ref(caseOptions.value[0]?.id ?? '');
const currentCase = computed(() => caseOptions.value.find((item) => item.id === selectedId.value));
const currentPlan = computed(() => workflow.detail?.currentPlan ?? null);
const readOnly = computed(() => ['submitted', 'cancelled'].includes(currentPlan.value?.status ?? ''));
const statusColor = computed(() => currentPlan.value?.status === 'submitted' ? 'green' : currentPlan.value?.status === 'cancelled' ? 'gray' : 'orange');
const planStatusLabel = (status?: string) => ({ draft: '草稿', submitted: '已提交', cancelled: '已取消' }[status ?? 'draft']);

const airwayOptions = ['气管插管', '喉罩', '保留自主呼吸', '区域阻滞无需气道'].map((label) => ({ label, value: label }));
const destinationOptions = ['PACU', 'ICU', '病房', '日间观察'].map((label) => ({ label, value: label }));
const monitoringOptions = ['ECG', 'NIBP', 'SpO2', 'EtCO2', '体温', 'BIS', '有创动脉压', '中心静脉压'];

const form = reactive({
  primaryMethodCode: 'general', alternativeMethods: '', airwayStrategy: '气管插管', monitoringItems: ['ECG', 'NIBP', 'SpO2', 'EtCO2'],
  inductionPlan: '', maintenancePlan: '', analgesiaPlan: '', fluidAndBloodPlan: '', postoperativeDestination: 'PACU', specialRisks: '', notes: '',
});

function hydrateForm() {
  const plan = currentPlan.value;
  if (!plan) return;
  Object.assign(form, {
    primaryMethodCode: plan.primaryMethodCode ?? 'general',
    alternativeMethods: (plan.alternativeMethods ?? []).join(','),
    airwayStrategy: String(plan.airwayPlan?.strategy ?? '气管插管'),
    monitoringItems: Array.isArray(plan.monitoringPlan?.items) ? plan.monitoringPlan.items : ['ECG', 'NIBP', 'SpO2', 'EtCO2'],
    inductionPlan: plan.inductionPlan ?? '', maintenancePlan: plan.maintenancePlan ?? '', analgesiaPlan: plan.analgesiaPlan ?? '',
    fluidAndBloodPlan: [plan.fluidPlan, plan.bloodPreparation].filter(Boolean).join('\n'),
    postoperativeDestination: plan.postoperativeDestination ?? 'PACU',
    specialRisks: (plan.specialRisks ?? []).join(','), notes: plan.notes ?? '',
  });
}

function payload() {
  return {
    primaryMethodCode: form.primaryMethodCode,
    primaryMethodName: ({ general: '全身麻醉', neuraxial: '椎管内麻醉', nerve_block: '神经阻滞', combined: '复合麻醉', sedation: '镇静麻醉' } as Record<string, string>)[form.primaryMethodCode],
    alternativeMethods: form.alternativeMethods.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    airwayPlan: { strategy: form.airwayStrategy }, monitoringPlan: { items: form.monitoringItems },
    inductionPlan: form.inductionPlan, maintenancePlan: form.maintenancePlan, analgesiaPlan: form.analgesiaPlan,
    fluidPlan: form.fluidAndBloodPlan, bloodPreparation: form.fluidAndBloodPlan,
    postoperativeDestination: form.postoperativeDestination,
    specialRisks: form.specialRisks.split(/[,，]/).map((item) => item.trim()).filter(Boolean), notes: form.notes,
  };
}

async function loadPlan() {
  if (!selectedId.value) return;
  try { await workflow.load(selectedId.value); hydrateForm(); } catch { /* store exposes the error */ }
}

async function saveDraft() {
  try { await workflow.saveDraft(payload()); hydrateForm(); Message.success('麻醉计划草稿已保存'); } catch { /* store exposes the error */ }
}

async function submitPlan() {
  if (!form.primaryMethodCode || !form.airwayStrategy || !form.monitoringItems.length || !form.postoperativeDestination) {
    Message.warning('请完整填写麻醉方式、气道、监测和术后去向');
    return;
  }
  try {
    if (!currentPlan.value) await workflow.saveDraft(payload());
    else await workflow.saveDraft(payload());
    await workflow.submit();
    await workflow.load(selectedId.value);
    hydrateForm();
    Message.success('麻醉计划已提交并锁定当前版本');
  } catch { /* store exposes the error */ }
}

watch(selectedId, loadPlan, { immediate: true });
</script>

<style scoped>
.form-actions { margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border); }
</style>
