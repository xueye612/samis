<template>
  <ModulePageShell title="术前访视/麻醉评估" description="统一展示患者基本情况、风险评估、病史与麻醉计划，形成术前质控入口。">
    <template #chips>
      <a-tag color="arcoblue">访视完成率 {{ completionRate }}%</a-tag>
      <a-tag :color="unfinishedElective.length ? 'orange' : 'green'">未完成 {{ unfinishedElective.length }}</a-tag>
      <a-tag color="cyan">BMI 自动计算</a-tag>
    </template>

    <template #toolbar>
      <a-space wrap>
        <a-select v-model="selectedId" class="case-select" placeholder="选择访视患者">
          <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
            {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
          </a-option>
        </a-select>
        <a-button type="primary" :disabled="!current" @click="markCompleted">完成访视</a-button>
        <a-button :disabled="!current" @click="current && (current.preVisit.completed = false)">退回补充</a-button>
      </a-space>
    </template>

    <template #stats>
      <MetricCard label="择期病例" :value="electiveCases.length" hint="需完成术前访视" icon="IconCalendar" />
      <MetricCard label="已完成访视" :value="completedElective.length" :hint="`完成率 ${completionRate}%`" icon="IconFile" />
      <MetricCard label="待补充" :value="unfinishedElective.length" hint="影响麻醉前访视率" :variant="unfinishedElective.length ? 'warn' : 'default'" icon="IconExclamationCircle" />
      <MetricCard label="当前风险项" :value="riskItems.length" hint="过敏、气道、ASA 等" :variant="riskItems.length ? 'warn' : 'default'" icon="IconExperiment" />
    </template>

    <a-alert v-if="unfinishedElective.length" type="warning" show-icon>
      择期手术未完成术前访视：{{ unfinishedElective.map((item) => item.patientName).join('、') }}，将影响“择期手术麻醉前访视率”。
    </a-alert>

    <section v-if="current" class="clinical-page-grid">
      <div class="clinical-panel">
        <a-card class="section-card patient-overview-card" :bordered="false">
          <template #title>患者与手术信息</template>
          <div class="patient-overview">
            <div>
              <div class="patient-name">{{ current.patientName }}</div>
              <p>{{ current.gender }} / {{ current.age }}岁 · {{ current.department }} · ASA {{ current.preVisit.asa || current.asa }}</p>
            </div>
            <a-space wrap>
              <a-tag :color="current.urgency === '急诊' ? 'red' : 'arcoblue'">{{ current.urgency }}</a-tag>
              <a-tag color="green">{{ current.status }}</a-tag>
              <a-tag>{{ current.room }}</a-tag>
            </a-space>
          </div>
          <a-descriptions :column="2" bordered size="medium">
            <a-descriptions-item label="诊断">{{ current.diagnosis }}</a-descriptions-item>
            <a-descriptions-item label="拟行手术">{{ current.surgeryName }}</a-descriptions-item>
            <a-descriptions-item label="麻醉方式">{{ current.anesthesiaMethod }}</a-descriptions-item>
            <a-descriptions-item label="麻醉医生">{{ current.anesthesiologist }}</a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card class="section-card" :bordered="false" title="访视录入">
          <a-form :model="current.preVisit" layout="vertical">
            <a-row :gutter="16">
              <a-col :xs="24" :sm="12" :md="6"><a-form-item label="身高(cm)"><a-input-number v-model="current.preVisit.height" /></a-form-item></a-col>
              <a-col :xs="24" :sm="12" :md="6"><a-form-item label="体重(kg)"><a-input-number v-model="current.preVisit.weight" /></a-form-item></a-col>
              <a-col :xs="24" :sm="12" :md="6"><a-form-item label="BMI"><a-input :model-value="bmi" readonly /></a-form-item></a-col>
              <a-col :xs="24" :sm="12" :md="6"><a-form-item label="ASA分级"><a-select v-model="current.preVisit.asa" :options="['I', 'II', 'III', 'IV', 'V']" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="过敏史"><a-textarea v-model="current.preVisit.allergy" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="既往麻醉史"><a-textarea v-model="current.preVisit.anesthesiaHistory" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="困难气道评估"><a-textarea v-model="current.preVisit.difficultAirway" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="术前禁食"><a-textarea v-model="current.preVisit.fasting" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="术前用药"><a-textarea v-model="current.preVisit.preMedication" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="12"><a-form-item label="术前特殊情况"><a-textarea v-model="current.preVisit.specialCondition" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="18"><a-form-item label="麻醉计划"><a-textarea v-model="current.preVisit.plan" :auto-size="{ minRows: 3 }" /></a-form-item></a-col>
              <a-col :xs="24" :md="6"><a-form-item label="访视医师签名"><a-input v-model="current.preVisit.doctorSignature" /></a-form-item></a-col>
              <a-col :span="24"><a-checkbox v-model="current.preVisit.completed">访视完成并提交</a-checkbox></a-col>
            </a-row>
          </a-form>
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
              <span>{{ item.value }}</span>
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
import { computed, ref } from 'vue';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const selectedId = ref(store.cases[5]?.id ?? store.cases[0]?.id);
const current = computed(() => store.cases.find((item) => item.id === selectedId.value));
const bmi = computed(() => {
  if (!current.value) return '';
  const height = current.value.preVisit.height / 100;
  return (current.value.preVisit.weight / (height * height)).toFixed(1);
});
const electiveCases = computed(() => store.cases.filter((item) => item.urgency === '择期'));
const completedElective = computed(() => electiveCases.value.filter((item) => item.preVisit.completed));
const unfinishedElective = computed(() => electiveCases.value.filter((item) => !item.preVisit.completed));
const completionRate = computed(() => (electiveCases.value.length ? Math.round((completedElective.value.length / electiveCases.value.length) * 100) : 0));
const riskItems = computed(() => {
  if (!current.value) return [];
  const visit = current.value.preVisit;
  return [
    visit.asa && !['I', 'II'].includes(visit.asa) ? 'ASA 高风险' : '',
    visit.allergy && visit.allergy !== '无' ? '过敏史' : '',
    visit.difficultAirway && visit.difficultAirway !== '无' ? '困难气道' : '',
    visit.specialCondition && visit.specialCondition !== '无' ? '特殊情况' : '',
  ].filter(Boolean);
});
const riskChecklist = computed(() => {
  const visit = current.value?.preVisit;
  if (!visit) return [];
  return [
    { label: 'ASA 分级', value: visit.asa || '待评估' },
    { label: '过敏史', value: visit.allergy || '待补充' },
    { label: '困难气道', value: visit.difficultAirway || '待评估' },
    { label: '禁食情况', value: visit.fasting || '待确认' },
  ];
});
const markCompleted = () => {
  if (!current.value) return;
  current.value.preVisit.completed = true;
  current.value.preVisit.doctorSignature = current.value.preVisit.doctorSignature || store.currentDoctorName;
};
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
