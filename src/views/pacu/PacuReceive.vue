<template>
  <ModulePageShell title="PACU 接收" description="接收检查、床位分配与接收确认">
    <template #toolbar>
      <a-select v-model="selectedCaseId" style="width: 280px">
        <a-option v-for="item in pendingCases" :key="item.id" :value="item.id">{{ item.patientName }} · {{ item.room }}</a-option>
      </a-select>
    </template>
    <a-card v-if="currentCase" class="section-card" :bordered="false">
      <a-descriptions :column="3" bordered size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="患者">{{ currentCase.patientName }}</a-descriptions-item>
        <a-descriptions-item label="手术">{{ currentCase.surgeryName }}</a-descriptions-item>
        <a-descriptions-item label="麻醉">{{ currentCase.anesthesiaMethod }}</a-descriptions-item>
      </a-descriptions>
      <a-form :model="form" layout="vertical">
        <a-divider>接收检查</a-divider>
        <a-checkbox v-model="form.vitalsChecked">生命体征</a-checkbox>
        <a-checkbox v-model="form.consciousnessChecked">意识状态</a-checkbox>
        <a-checkbox v-model="form.airwayChecked">呼吸情况</a-checkbox>
        <a-checkbox v-model="form.circulationChecked">循环情况</a-checkbox>
        <a-checkbox v-model="form.tubeChecked">管道情况</a-checkbox>
        <a-checkbox v-model="form.skinChecked">皮肤情况</a-checkbox>
        <a-divider>核对清单</a-divider>
        <a-checkbox v-model="form.identityChecked">身份核对</a-checkbox>
        <a-checkbox v-model="form.siteChecked">手术部位核对</a-checkbox>
        <a-form-item label="分配床位">
          <a-select v-model="form.bedId" placeholder="选择空闲床位">
            <a-option v-for="bed in freeBeds" :key="bed.id" :value="bed.id">{{ bed.bedNo }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="入室首次体温(℃)">
          <a-input-number v-model="form.firstTemperature" :min="30" :max="42" :step="0.1" placeholder="如 36.2" />
        </a-form-item>
        <a-form-item label="入室 Aldrete 评分">
          <a-input-number v-model="form.aldrete" :min="0" :max="10" placeholder="如 8" />
        </a-form-item>
        <a-form-item label="接收护士"><a-input v-model="form.receiveNurse" /></a-form-item>
        <a-form-item label="交接备注"><a-textarea v-model="form.notes" /></a-form-item>
      </a-form>
      <a-space>
        <a-button type="primary" :disabled="!canSubmit" @click="submit">确认接收</a-button>
        <a-button @click="Message.info('打印接收单（Mock）')">打印接收单</a-button>
      </a-space>
    </a-card>
    <EmptyState v-else title="暂无待接收患者" icon="IconHeart" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealPacu } from '@/config/apiFlags';

const store = useAnesthesiaStore();
const pendingCases = computed(() => store.cases.filter((item) => ['苏醒中', '麻醉中', '手术中'].includes(item.status)));
const selectedCaseId = ref(pendingCases.value[0]?.id ?? '');
const currentCase = computed(() => store.cases.find((item) => item.id === selectedCaseId.value));
const freeBeds = computed(() => store.pacuRooms.flatMap((r) => r.beds).filter((b) => b.status === '空闲'));
const form = reactive({
  bedId: '',
  vitalsChecked: false,
  consciousnessChecked: false,
  airwayChecked: false,
  circulationChecked: false,
  tubeChecked: false,
  skinChecked: false,
  identityChecked: false,
  siteChecked: false,
  receiveNurse: 'PACU护士',
  notes: '',
  firstTemperature: undefined as number | undefined,
  aldrete: undefined as number | undefined,
});
const canSubmit = computed(() => currentCase.value && form.bedId && form.vitalsChecked && form.identityChecked);

const submit = async () => {
  if (!currentCase.value || !form.bedId) return;
  const bed = store.pacuRooms.flatMap((r) => r.beds).find((b) => b.id === form.bedId);

  if (useRealPacu()) {
    // 真实模式：调 admit 端点（患者信息前端补传，plan R1）
    try {
      await store.admitPacu({
        caseId: currentCase.value.id,
        patientName: currentCase.value.patientName,
        room: currentCase.value.room,
        operationId: currentCase.value.id,
        firstTemperature: form.firstTemperature,
        aldrete: form.aldrete,
        bedNo: bed?.bedNo,
        remark: form.notes,
      });
      Message.success('PACU 接收完成（已入室）');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '入室失败');
      return;
    }
  } else {
    store.receivePacuPatient({
      caseId: currentCase.value.id,
      patientName: currentCase.value.patientName,
      vitalsChecked: form.vitalsChecked,
      consciousnessChecked: form.consciousnessChecked,
      airwayChecked: form.airwayChecked,
      circulationChecked: form.circulationChecked,
      tubeChecked: form.tubeChecked,
      skinChecked: form.skinChecked,
      identityChecked: form.identityChecked,
      siteChecked: form.siteChecked,
      receiveNurse: form.receiveNurse,
      notes: form.notes,
      bedId: form.bedId,
    });
    Message.success('PACU 接收完成');
  }
  form.bedId = '';
  form.firstTemperature = undefined;
  form.aldrete = undefined;
};
</script>
