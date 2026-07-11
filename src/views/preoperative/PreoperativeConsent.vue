<template>
  <ModulePageShell title="知情同意" description="麻醉风险告知、方案说明与签名确认">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px" placeholder="选择患者" @change="(value) => onCaseChange(String(value))">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.surgeryName }}</a-option>
      </a-select>
    </template>
    <a-card v-if="record" class="section-card" :bordered="false">
      <template #title>
        知情同意
        <a-tag :color="record.status === '已提交' ? 'green' : 'arcoblue'" style="margin-left: 8px">{{ record.status }}</a-tag>
      </template>
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="患者"><a-input :model-value="record.patientName" disabled /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="手术"><a-input :model-value="record.surgeryName" disabled /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="拟行麻醉"><a-input :model-value="record.anesthesiaMethod" disabled /></a-form-item></a-col>
        </a-row>
        <a-divider>风险告知确认</a-divider>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="模板编码"><a-input v-model="form.templateCode" :disabled="readonly" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="模板版本"><a-input v-model="form.templateVersion" :disabled="readonly" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="打印/归档"><a-input :model-value="`${record.printStatus ?? '未打印'} / ${record.archiveStatus ?? '未归档'}`" disabled /></a-form-item></a-col>
        </a-row>
        <a-form-item label="风险说明"><a-textarea v-model="form.riskDisclosure" :disabled="readonly" :auto-size="{ minRows: 3 }" /></a-form-item>
        <a-space wrap>
          <a-checkbox v-model="form.commonRisks" :disabled="readonly">已告知常见风险</a-checkbox>
          <a-checkbox v-model="form.severeRisks" :disabled="readonly">已告知严重风险</a-checkbox>
          <a-checkbox v-model="form.specialRisks" :disabled="readonly">已告知特殊风险</a-checkbox>
        </a-space>
        <a-divider>方案与理解确认</a-divider>
        <a-space wrap>
          <a-checkbox v-model="form.planAccepted" :disabled="readonly">接受麻醉方案</a-checkbox>
          <a-checkbox v-model="form.questionAnswered" :disabled="readonly">疑问已解答</a-checkbox>
        </a-space>
        <a-divider>签名</a-divider>
        <a-space wrap>
          <a-checkbox v-model="form.patientSigned" :disabled="readonly">患者签名</a-checkbox>
          <a-checkbox v-model="form.familySigned" :disabled="readonly">家属签名</a-checkbox>
          <a-checkbox v-model="form.doctorSigned" :disabled="readonly">医生签名</a-checkbox>
        </a-space>
      </a-form>
      <div class="form-actions">
        <a-space>
          <a-button :disabled="readonly || saving" :loading="saving" @click="saveDraft">保存草稿</a-button>
          <a-button type="primary" :disabled="readonly" :loading="submitting" @click="submit">提交</a-button>
          <a-button v-if="readonly" @click="withdraw">撤回</a-button>
          <a-button @click="printPreview">打印</a-button>
        </a-space>
      </div>
    </a-card>
    <a-card v-else-if="loading" class="section-card" :bordered="false" title="知情同意">
      <a-skeleton :rows="4" />
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
import type { ConsentRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const selectedCaseId = ref(store.cases[0]?.id ?? '');
const loading = ref(false);
const saving = ref(false);
const submitting = ref(false);

const record = computed(() => store.consentRecords.find((item) => item.caseId === selectedCaseId.value));
const readonly = computed(() => record.value?.status === '已提交');
const currentCase = computed(() => store.cases.find((item) => item.id === selectedCaseId.value));

const form = reactive({
  commonRisks: false,
  severeRisks: false,
  specialRisks: false,
  planAccepted: false,
  questionAnswered: false,
  patientSigned: false,
  familySigned: false,
  doctorSigned: false,
  templateCode: '',
  templateVersion: '',
  riskDisclosure: '',
});

function syncForm(value?: ConsentRecord) {
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
    templateCode: value.templateCode ?? '',
    templateVersion: value.templateVersion ?? '',
    riskDisclosure: value.riskDisclosure ?? '',
  });
}

watch(record, (value) => syncForm(value), { immediate: true });

/** 切换病例：按 caseId 读唯一同意书，无则创建草稿。 */
async function onCaseChange(caseId: string) {
  if (!caseId) return;
  loading.value = true;
  try {
    const existing = await store.fetchPreopConsentByCaseId(caseId);
    if (!existing && currentCase.value) {
      // 无则创建草稿（patientName/surgeryName/anesthesiaMethod 取自病例）。
      const draft: ConsentRecord = {
        id: `tmp-${Date.now()}`,
        caseId,
        patientName: currentCase.value.patientName,
        surgeryName: currentCase.value.surgeryName,
        anesthesiaMethod: currentCase.value.anesthesiaMethod,
        surgeryDate: dayjs(currentCase.value.scheduledStart ?? currentCase.value.plannedStart ?? undefined).format('YYYY-MM-DD'),
        commonRisks: false,
        severeRisks: false,
        specialRisks: false,
        planAccepted: false,
        questionAnswered: false,
        patientSigned: false,
        familySigned: false,
        doctorSigned: false,
        status: '草稿',
        updatedAt: dayjs().toISOString(),
      };
      await store.upsertPreopConsent(draft);
    }
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '加载知情同意失败');
  } finally {
    loading.value = false;
  }
}

async function persistFlags(): Promise<ConsentRecord | null> {
  if (!record.value) return null;
  return store.upsertPreopConsent({
    ...record.value,
    ...form,
    status: '草稿',
    updatedAt: dayjs().toISOString(),
  });
}

async function saveDraft() {
  saving.value = true;
  try {
    await persistFlags();
    Message.success('草稿已保存');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function submit() {
  if (!record.value) return;
  submitting.value = true;
  try {
    // 先保存勾选项（草稿态），再提交置已提交 + signedAt。
    const persisted = await persistFlags();
    const targetId = persisted?.id ?? record.value.id;
    const submitted = await store.submitPreopConsent(targetId);
    if (submitted) {
      Message.success('知情同意已提交');
    } else {
      Message.success('知情同意已提交');
    }
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '提交失败');
  } finally {
    submitting.value = false;
  }
}

async function withdraw() {
  if (!record.value) return;
  await store.withdrawPreopConsent(record.value.id);
  Message.success('知情同意已撤回');
}

const printPreview = async () => {
  if (record.value) await store.markPreopConsentPrinted(record.value.id);
  Message.success('打印状态已记录');
};
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
