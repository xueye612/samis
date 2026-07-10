<template>
  <ModulePageShell title="并发症追踪" description="术后异常事件登记与病例回溯">
    <template #chips>
      <a-tag color="orangered">记录 {{ store.complications.length }}</a-tag>
    </template>
    <template #toolbar>
      <a-button :disabled="!form.caseId" @click="refreshDetail">刷新回读</a-button>
      <a-button type="primary" @click="openCreate">登记并发症</a-button>
    </template>
    <a-card v-if="detail" class="section-card" :bordered="false" title="OperationCase / 结构化并发症">
      <div>{{ detail.operationCase.patientName ?? '-' }} · {{ detail.operationCase.operationName ?? '-' }} · {{ detail.operationCase.operationId }}</div>
      <a-table :data="detail.complications" row-key="complicationId" :pagination="false" style="margin-top: 12px">
        <template #columns>
          <a-table-column title="类型" data-index="complicationType" /><a-table-column title="严重度" data-index="severity" />
          <a-table-column title="状态" data-index="reportStatus" /><a-table-column title="转归" data-index="outcome" />
          <a-table-column title="操作"><template #cell="{ record }"><a-button size="mini" status="danger" :disabled="record.reportStatus === 'voided'" @click="voidCurrent(record.complicationId)">作废</a-button></template></a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-card class="section-card" :bordered="false" title="并发症列表">
      <a-table :data="store.complications" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="类型" data-index="type" />
          <a-table-column title="严重程度" data-index="severity" :width="100" />
          <a-table-column title="阶段" data-index="stage" :width="90" />
          <a-table-column title="转归" data-index="outcome" />
          <a-table-column title="上报时间" data-index="reportTime" :width="150" />
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.status === '已提交' ? 'green' : 'gray'">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="220" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button size="mini" @click="openEdit(record)">编辑</a-button>
                <a-button size="mini" status="danger" :loading="deletingId === record.id" @click="onDelete(record)">删除</a-button>
                <a-button size="mini" type="primary" @click="goCase(record.caseId)">病例</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:visible="visible" :title="editingId ? '编辑并发症' : '登记并发症'" width="640px" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="关联病例" required>
          <a-select v-model="form.caseId" :options="caseOptions" placeholder="选择患者" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="并发症类型" required>
              <a-select v-model="form.type" :options="typeOptions" allow-create />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="严重程度" required>
              <a-select v-model="form.severity" :options="['轻度', '中度', '重度', '危及生命']" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="发生阶段">
          <a-select v-model="form.stage" :options="['术前', '术中', '术后', 'PACU', '随访']" />
        </a-form-item>
        <a-form-item label="症状描述"><a-textarea v-model="form.symptoms" /></a-form-item>
        <a-form-item label="处理措施"><a-textarea v-model="form.treatment" /></a-form-item>
        <a-form-item label="转归"><a-input v-model="form.outcome" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealPostoperative } from '@/config/apiFlags';
import type { ComplicationRecord } from '@/types/clinicalModules';
import type { PostoperativeDetail } from '@/services/anesthesia/postoperativeWorkflow';
import { loadPostoperativeDetail, saveComplication, voidComplication } from '@/services/anesthesia/postoperativeWorkflow';

const store = useAnesthesiaStore();
const router = useRouter();
const visible = ref(false);
const editingId = ref('');
const saving = ref(false);
const deletingId = ref('');
const detail = ref<PostoperativeDetail | null>(null);
const typeOptions = ['恶心呕吐', '呼吸抑制', '低体温', '低血压', '出血', '感染', '其他'];

const form = reactive({
  caseId: '',
  type: '其他',
  severity: '中度' as ComplicationRecord['severity'],
  stage: '术后',
  symptoms: '',
  treatment: '',
  outcome: '观察中',
});

const caseOptions = computed(() =>
  store.cases.map((item) => ({ label: `${item.patientName} · ${item.surgeryName}`, value: item.id })),
);
const operationCaseOf = (operationId: string) => { const row=store.cases.find((item)=>item.id===operationId); return row?{operationId:row.id,patientName:row.patientName,operationName:row.surgeryName}:{operationId}; };
const refreshDetail = async () => { if(form.caseId) detail.value=await loadPostoperativeDetail(form.caseId,operationCaseOf(form.caseId)); };
const voidCurrent = async (complicationId:string) => { if(form.caseId) detail.value=await voidComplication(form.caseId,complicationId,'页面作废'); };

const resetForm = () => {
  form.caseId = store.cases[0]?.id ?? '';
  form.type = '其他';
  form.severity = '中度';
  form.stage = '术后';
  form.symptoms = '';
  form.treatment = '';
  form.outcome = '观察中';
};

const openCreate = () => {
  editingId.value = '';
  resetForm();
  visible.value = true;
};

const openEdit = (record: ComplicationRecord) => {
  editingId.value = record.id;
  form.caseId = record.caseId;
  form.type = record.type;
  form.severity = record.severity;
  form.stage = record.stage;
  form.symptoms = record.symptoms;
  form.treatment = record.treatment;
  form.outcome = record.outcome;
  visible.value = true;
};

const save = async () => {
  if (!form.caseId) {
    Message.warning('请选择关联病例');
    return;
  }
  const patient = store.cases.find((item) => item.id === form.caseId);
  const payload: ComplicationRecord = {
    id: editingId.value || `comp-${Date.now()}`,
    caseId: form.caseId,
    patientName: patient?.patientName ?? '',
    type: form.type,
    severity: form.severity,
    stage: form.stage,
    symptoms: form.symptoms,
    treatment: form.treatment,
    outcome: form.outcome,
    reportTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    status: '已提交',
  };
  saving.value = true;
  try {
    if (useRealPostoperative()) {
      detail.value = await saveComplication({ operationId: form.caseId, complicationId: /^\d+$/.test(editingId.value) ? editingId.value : undefined, complicationType: form.type, severity: ({轻度:'mild',中度:'moderate',重度:'severe',危及生命:'life_threatening'} as const)[form.severity], occurredAt: payload.reportTime, description: form.symptoms, treatment: form.treatment, outcome: form.outcome, reportStatus: 'reported' }, operationCaseOf(form.caseId));
    } else {
      store.saveComplication(payload);
    }
    Message.success('并发症记录已保存');
    visible.value = false;
  } catch (error) {
    Message.warning(error instanceof Error ? error.message : '保存并发症失败');
  } finally {
    saving.value = false;
  }
};

const onDelete = async (record: ComplicationRecord) => {
  deletingId.value = record.id;
  try {
    if (useRealPostoperative()) {
      await store.deleteComplicationRemote(record.id);
    } else {
      store.complications = store.complications.filter((item) => item.id !== record.id);
    }
    Message.success('并发症记录已删除');
  } catch (error) {
    Message.warning(error instanceof Error ? error.message : '删除失败');
  } finally {
    deletingId.value = '';
  }
};

onMounted(() => {
  if (useRealPostoperative()) { void store.loadRemoteComplications(); if(form.caseId) void refreshDetail(); }
});

const goCase = (caseId: string) => router.push(`/surgery/detail/${caseId}`);
</script>
