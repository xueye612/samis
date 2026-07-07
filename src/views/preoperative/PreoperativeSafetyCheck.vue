<template>
  <ModulePageShell title="手术安全核查" description="WHO 三阶段安全核查：Sign In · Time Out · Sign Out">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px" placeholder="选择患者" @change="(value) => onCaseChange(String(value))">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">{{ item.patientName }}</a-option>
      </a-select>
    </template>
    <a-card v-if="record" class="section-card" :bordered="false">
      <template #title>
        {{ record.patientName }} · 安全核查
        <a-tag :color="record.status === '已完成' ? 'green' : 'orangered'" style="margin-left: 8px">{{ record.status }}</a-tag>
      </template>
      <a-descriptions :column="3" bordered size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="核查人">{{ record.checker }}</a-descriptions-item>
        <a-descriptions-item label="核查日期">{{ record.checkDate }}</a-descriptions-item>
        <a-descriptions-item label="完成进度">{{ completedPhases }}/3 阶段</a-descriptions-item>
      </a-descriptions>
      <a-form :model="form" layout="vertical">
        <a-divider orientation="left">Sign In · 麻醉诱导前</a-divider>
        <a-checkbox v-model="form.signInComplete">患者身份、手术部位、知情同意、设备检查已完成</a-checkbox>
        <a-divider orientation="left">Time Out · 切皮前</a-divider>
        <a-checkbox v-model="form.timeOutComplete">团队介绍、关键步骤、预计时长、备血/影像确认已完成</a-checkbox>
        <a-divider orientation="left">Sign Out · 离室前</a-divider>
        <a-checkbox v-model="form.signOutComplete">器械清点、标本标记、术后注意事项确认已完成</a-checkbox>
      </a-form>
      <div class="form-actions">
        <a-button type="primary" :loading="saving" @click="save">保存核查</a-button>
      </div>
    </a-card>
    <a-card v-else-if="loading" class="section-card" :bordered="false" title="安全核查">
      <a-skeleton :rows="3" />
    </a-card>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要核查的手术" icon="IconCheckCircle" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SafetyCheckRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const selectedCaseId = ref(store.cases[0]?.id ?? '');
const loading = ref(false);
const saving = ref(false);

const record = computed(() => store.safetyChecks.find((item) => item.caseId === selectedCaseId.value));
const currentCase = computed(() => store.cases.find((item) => item.id === selectedCaseId.value));

const form = reactive({
  signInComplete: false,
  timeOutComplete: false,
  signOutComplete: false,
});

const completedPhases = computed(() => [form.signInComplete, form.timeOutComplete, form.signOutComplete].filter(Boolean).length);

function syncForm(value?: SafetyCheckRecord) {
  if (!value) return;
  form.signInComplete = value.signInComplete;
  form.timeOutComplete = value.timeOutComplete;
  form.signOutComplete = value.signOutComplete;
}

watch(record, (value) => syncForm(value), { immediate: true });

/** 切换病例：按 caseId 读唯一核查，无则创建（未完成）。 */
async function onCaseChange(caseId: string) {
  if (!caseId) return;
  loading.value = true;
  try {
    const existing = await store.fetchPreopSafetyCheckByCaseId(caseId);
    if (!existing && currentCase.value) {
      const draft: SafetyCheckRecord = {
        id: `tmp-${Date.now()}`,
        caseId,
        patientName: currentCase.value.patientName,
        signInComplete: false,
        timeOutComplete: false,
        signOutComplete: false,
        checker: '',
        checkDate: dayjs().format('YYYY-MM-DD'),
        status: '未完成',
      };
      await store.upsertPreopSafetyCheck(draft);
    }
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '加载安全核查失败');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!record.value) return;
  saving.value = true;
  try {
    await store.upsertPreopSafetyCheck({
      ...record.value,
      ...form,
    });
    Message.success('安全核查已保存');
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
