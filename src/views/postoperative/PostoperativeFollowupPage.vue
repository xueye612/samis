<template>
  <ModulePageShell title="术后随访管理" description="疼痛评分、满意度与随访闭环">
    <template #chips>
      <a-tag color="arcoblue">随访 {{ store.followUps.length }}</a-tag>
    </template>
    <template #toolbar>
      <a-button type="primary" @click="openCreate">新增随访</a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="随访记录">
      <a-table :data="store.followUps" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" :width="100">
            <template #cell="{ record }">{{ patientName(record.caseId) }}</template>
          </a-table-column>
          <a-table-column title="类型" data-index="type" />
          <a-table-column title="VAS" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.vas >= 7 ? 'red' : record.vas >= 4 ? 'orange' : 'green'">{{ record.vas }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="满意度" :width="200">
            <template #cell="{ record }">{{ formatSatisfaction(record.advice) }}</template>
          </a-table-column>
          <a-table-column title="处理意见" data-index="advice" />
          <a-table-column title="操作" :width="200" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button size="mini" @click="openEdit(record)">编辑</a-button>
                <a-button size="mini" status="danger" :loading="deletingId === record.id" @click="onDelete(record)">删除</a-button>
                <a-button size="mini" @click="printMock(record)">打印</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" title="随访记录" width="640px" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="病例">
          <a-select v-model="form.caseId" :options="caseOptions" />
        </a-form-item>
        <a-form-item label="随访类型">
          <a-select v-model="form.type" :options="['术后镇痛随访', '全麻术后随访', '区域阻滞术后随访']" />
        </a-form-item>
        <a-form-item label="VAS 疼痛评分 (0-10)">
          <div class="vas-row">
            <a-slider v-model="form.vas" :min="0" :max="10" :step="1" show-ticks />
            <strong class="vas-value">{{ form.vas }}</strong>
          </div>
        </a-form-item>
        <a-divider>满意度评价</a-divider>
        <a-form-item label="麻醉服务">
          <a-rate v-model="form.satisfactionAnesthesia" allow-half />
        </a-form-item>
        <a-form-item label="镇痛效果">
          <a-rate v-model="form.satisfactionPain" allow-half />
        </a-form-item>
        <a-form-item label="整体满意度">
          <a-rate v-model="form.satisfactionOverall" allow-half />
        </a-form-item>
        <a-form-item label="处理意见"><a-textarea v-model="form.advice" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealPostoperative } from '@/config/apiFlags';
import type { PostoperativeFollowUp } from '@/types/anesthesia';

const SAT_PREFIX = '[满意度]';

const store = useAnesthesiaStore();
const visible = ref(false);
const editingId = ref('');
const saving = ref(false);

const form = reactive({
  caseId: '',
  type: '术后镇痛随访' as PostoperativeFollowUp['type'],
  vas: 3,
  satisfactionAnesthesia: 4,
  satisfactionPain: 4,
  satisfactionOverall: 4,
  advice: '',
});

const caseOptions = computed(() =>
  store.cases.map((item) => ({ label: `${item.patientName} · ${item.surgeryName}`, value: item.id })),
);
const patientName = (caseId: string) => store.cases.find((item) => item.id === caseId)?.patientName ?? caseId;

const parseSatisfaction = (advice: string) => {
  const match = advice.match(/\[满意度\]\s*麻醉([\d.]+)\/镇痛([\d.]+)\/整体([\d.]+)/);
  return {
    anesthesia: match ? Number(match[1]) : 4,
    pain: match ? Number(match[2]) : 4,
    overall: match ? Number(match[3]) : 4,
    note: advice.replace(/\[满意度\][^\n]*\n?/, '').trim(),
  };
};

const buildAdvice = () => {
  const sat = `${SAT_PREFIX} 麻醉${form.satisfactionAnesthesia}/镇痛${form.satisfactionPain}/整体${form.satisfactionOverall}`;
  const note = form.advice.trim();
  return note ? `${sat}\n${note}` : sat;
};

const formatSatisfaction = (advice: string) => {
  const s = parseSatisfaction(advice);
  return `麻醉 ${s.anesthesia} · 镇痛 ${s.pain} · 整体 ${s.overall}`;
};

const openCreate = () => {
  editingId.value = '';
  form.caseId = store.cases[0]?.id ?? '';
  form.type = '术后镇痛随访';
  form.vas = 3;
  form.satisfactionAnesthesia = 4;
  form.satisfactionPain = 4;
  form.satisfactionOverall = 4;
  form.advice = '';
  visible.value = true;
};

const openEdit = (record: PostoperativeFollowUp) => {
  editingId.value = record.id;
  const s = parseSatisfaction(record.advice);
  form.caseId = record.caseId;
  form.type = record.type;
  form.vas = record.vas;
  form.satisfactionAnesthesia = s.anesthesia;
  form.satisfactionPain = s.pain;
  form.satisfactionOverall = s.overall;
  form.advice = s.note;
  visible.value = true;
};

const save = async () => {
  const nowIso = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const payload: PostoperativeFollowUp = {
    id: editingId.value || `fu-${Date.now()}`,
    caseId: form.caseId,
    type: form.type,
    followTime: nowIso,
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
    advice: buildAdvice(),
  };
  saving.value = true;
  try {
    if (useRealPostoperative()) {
      await store.upsertFollowupRemote(payload);
      await store.loadRemoteFollowups();
    } else {
      store.upsertFollowUp(payload);
    }
    visible.value = false;
    Message.success('随访记录已保存');
  } catch (error) {
    Message.warning(error instanceof Error ? error.message : '保存随访记录失败');
  } finally {
    saving.value = false;
  }
};

const printMock = (record: PostoperativeFollowUp) => {
  const name = patientName(record.caseId);
  Message.info(`打印随访单（Mock）：${name} · VAS ${record.vas} · ${formatSatisfaction(record.advice)}`);
};

const deletingId = ref('');
const onDelete = async (record: PostoperativeFollowUp) => {
  deletingId.value = record.id;
  try {
    if (useRealPostoperative()) {
      await store.deleteFollowupRemote(record.id);
    } else {
      store.followUps = store.followUps.filter((item) => item.id !== record.id);
    }
    Message.success('随访记录已删除');
  } catch (error) {
    Message.warning(error instanceof Error ? error.message : '删除失败');
  } finally {
    deletingId.value = '';
  }
};

onMounted(() => {
  if (useRealPostoperative()) void store.loadRemoteFollowups();
});
</script>

<style scoped>
.vas-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.vas-row :deep(.arco-slider) {
  flex: 1;
}
.vas-value {
  min-width: 24px;
  font-size: var(--font-size-lg);
  color: var(--color-brand-600);
}
</style>
