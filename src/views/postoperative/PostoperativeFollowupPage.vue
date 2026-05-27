<template>
  <div class="page-stack">
    <section class="module-hero">
      <div>
        <h2 class="module-hero__title">术后随访管理</h2>
        <p class="module-hero__desc">记录术后疼痛、并发症及处理意见，形成持续随访闭环。</p>
      </div>
      <div class="module-hero__chips">
        <a-tag color="arcoblue">随访 {{ store.followUps.length }}</a-tag>
      </div>
    </section>
    <a-card class="section-card" :bordered="false">
      <template #title>术后随访</template>
      <template #extra>
        <a-button type="primary" @click="openCreate">新增随访</a-button>
      </template>
      <a-table :data="store.followUps" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="患者"><template #cell="{ record }">{{ patientName(record.caseId) }}</template></a-table-column>
          <a-table-column title="随访类型" data-index="type" />
          <a-table-column title="VAS" data-index="vas" />
          <a-table-column title="处理意见" data-index="advice" />
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }"><a-button size="mini" @click="openEdit(record)">编辑</a-button></template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" title="随访记录" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="病例">
          <a-select v-model="form.caseId" :options="caseOptions" />
        </a-form-item>
        <a-form-item label="随访类型">
          <a-select v-model="form.type" :options="['术后镇痛随访', '全麻术后随访', '区域阻滞术后随访']" />
        </a-form-item>
        <a-form-item label="VAS"><a-input-number v-model="form.vas" :min="0" :max="10" /></a-form-item>
        <a-form-item label="处理意见"><a-textarea v-model="form.advice" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, ref } from 'vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PostoperativeFollowUp } from '@/types/anesthesia';

const store = useAnesthesiaStore();
const visible = ref(false);
const editingId = ref('');
const form = reactive({
  caseId: '',
  type: '术后镇痛随访' as PostoperativeFollowUp['type'],
  vas: 3,
  advice: '',
});

const caseOptions = computed(() => store.cases.map((item) => ({ label: `${item.patientName} · ${item.surgeryName}`, value: item.id })));
const patientName = (caseId: string) => store.cases.find((item) => item.id === caseId)?.patientName ?? caseId;

const openCreate = () => {
  editingId.value = '';
  form.caseId = store.cases[0]?.id ?? '';
  form.type = '术后镇痛随访';
  form.vas = 3;
  form.advice = '';
  visible.value = true;
};

const openEdit = (record: PostoperativeFollowUp) => {
  editingId.value = record.id;
  form.caseId = record.caseId;
  form.type = record.type;
  form.vas = record.vas;
  form.advice = record.advice;
  visible.value = true;
};

const save = () => {
  const payload: PostoperativeFollowUp = {
    id: editingId.value || `fu-${Date.now()}`,
    caseId: form.caseId,
    type: form.type,
    followTime: dayjs().toISOString(),
    vas: form.vas,
    nausea: false,
    headache: false,
    hoarseness: false,
    numbness: false,
    motorDisorder: false,
    awareness: false,
    respiratoryDepression: false,
    reintubation: false,
    transferredIcu: false,
    death: false,
    advice: form.advice,
  };
  store.upsertFollowUp(payload);
  visible.value = false;
};
</script>
