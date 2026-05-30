<template>
  <ModulePageShell title="麻醉计划" description="基于术前访视评估制定个体化麻醉方案">
    <template #toolbar>
      <a-select v-model="selectedId" style="width: 280px">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
          {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
        </a-option>
      </a-select>
    </template>
    <a-card v-if="current" class="section-card" :bordered="false">
      <a-descriptions :column="4" bordered size="medium">
        <a-descriptions-item label="患者">{{ current.patientName }}</a-descriptions-item>
        <a-descriptions-item label="性别/年龄">{{ current.gender }} / {{ current.age }}岁</a-descriptions-item>
        <a-descriptions-item label="科室">{{ current.department }}</a-descriptions-item>
        <a-descriptions-item label="手术">{{ current.surgeryName }}</a-descriptions-item>
      </a-descriptions>
      <a-form :model="current.preVisit" layout="vertical" style="margin-top: 16px">
        <a-row :gutter="14">
          <a-col :span="6"><a-form-item label="身高(cm)"><a-input-number v-model="current.preVisit.height" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="体重(kg)"><a-input-number v-model="current.preVisit.weight" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="BMI"><a-input :model-value="bmi" readonly /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="ASA分级"><a-select v-model="current.preVisit.asa" :options="['I', 'II', 'III', 'IV', 'V']" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="过敏史"><a-textarea v-model="current.preVisit.allergy" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="既往麻醉史"><a-textarea v-model="current.preVisit.anesthesiaHistory" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="困难气道评估"><a-textarea v-model="current.preVisit.difficultAirway" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="术前禁食"><a-textarea v-model="current.preVisit.fasting" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="术前用药"><a-textarea v-model="current.preVisit.preMedication" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="术前特殊情况"><a-textarea v-model="current.preVisit.specialCondition" /></a-form-item></a-col>
          <a-col :span="18"><a-form-item label="麻醉计划"><a-textarea v-model="current.preVisit.plan" :auto-size="{ minRows: 3 }" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="访视医师签名"><a-input v-model="current.preVisit.doctorSignature" /></a-form-item></a-col>
          <a-col :span="24"><a-checkbox v-model="current.preVisit.completed">访视完成并提交</a-checkbox></a-col>
        </a-row>
      </a-form>
      <div class="form-actions">
        <a-space>
          <a-button type="primary" @click="Message.success('麻醉计划已保存')">保存计划</a-button>
          <a-button @click="router.push(buildRecordRoute(current.id, 'plan'))">进入记录单</a-button>
        </a-space>
      </div>
    </a-card>
    <EmptyState v-else title="请选择患者" description="从上方下拉框选择需要制定麻醉计划的患者" icon="IconFile" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { buildRecordRoute } from '@/services/recordNavigation';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const router = useRouter();
const selectedId = ref(store.cases[0]?.id ?? '');

const current = computed(() => store.cases.find((item) => item.id === selectedId.value));

const bmi = computed(() => {
  if (!current.value) return '';
  const height = current.value.preVisit.height / 100;
  return (current.value.preVisit.weight / (height * height)).toFixed(1);
});
</script>

<style scoped>
.form-actions {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
</style>
