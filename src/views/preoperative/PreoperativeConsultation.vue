<template>
  <ModulePageShell title="麻醉会诊" description="跨科室会诊申请与麻醉评估意见">
    <template #chips>
      <a-tag color="orangered">待会诊 {{ pendingCount }}</a-tag>
      <a-tag color="green">已完成 {{ store.consultations.length - pendingCount }}</a-tag>
    </template>
    <template #toolbar>
      <a-button type="primary" status="success" :loading="loading" style="margin-right: 8px" @click="reload">
        <template #icon><IconRefresh /></template>刷新
      </a-button>
      <a-button type="primary" @click="openCreate">
        <template #icon><IconPlus /></template>新增会诊
      </a-button>
    </template>
    <a-row :gutter="16">
      <a-col :span="14">
        <a-card class="section-card" :bordered="false" title="会诊列表">
          <a-table
            :data="store.consultations"
            :pagination="false"
            :loading="loading"
            row-key="id"
            :row-class="rowClass"
            @row-click="selectConsultation"
          >
            <template #columns>
              <a-table-column title="患者" data-index="patientName" />
              <a-table-column title="申请科室" data-index="requestDept" />
              <a-table-column title="会诊日期" data-index="consultDate" :width="160" />
              <a-table-column title="会诊医师" data-index="consultant" :width="100" />
              <a-table-column title="状态" :width="100">
                <template #cell="{ record }">
                  <a-tag :color="record.status === '已完成' ? 'green' : 'orangered'">{{ record.status }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="操作" :width="90">
                <template #cell="{ record }">
                  <a-button size="mini" type="text" @click.stop="openEdit(record)">编辑</a-button>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card class="section-card" :bordered="false" title="会诊意见">
          <template v-if="selected">
            <a-descriptions :column="1" bordered size="small">
              <a-descriptions-item label="患者">{{ selected.patientName }}</a-descriptions-item>
              <a-descriptions-item label="申请科室">{{ selected.requestDept }}</a-descriptions-item>
              <a-descriptions-item label="会诊医师">{{ selected.consultant }}</a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="selected.status === '已完成' ? 'green' : 'orangered'">{{ selected.status }}</a-tag>
              </a-descriptions-item>
            </a-descriptions>
            <a-divider />
            <div class="opinion-block">
              <div class="opinion-label">麻醉评估意见</div>
              <p>{{ selected.opinion }}</p>
            </div>
            <a-button type="text" @click="router.push(`/surgery/detail/${selected.caseId}`)">查看患者详情</a-button>
          </template>
          <EmptyState v-else title="选择会诊记录" description="点击左侧列表查看会诊意见" icon="IconList" />
        </a-card>
      </a-col>
    </a-row>

    <a-modal :visible="formVisible" :title="formMode === 'create' ? '新增会诊' : '编辑会诊'" :width="560" @cancel="closeForm" @ok="submitForm">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="病例ID" required><a-input v-model="form.caseId" :disabled="formMode === 'edit'" placeholder="caseId" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="患者姓名"><a-input v-model="form.patientName" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="申请科室"><a-input v-model="form.requestDept" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="会诊医师"><a-input v-model="form.consultant" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="会诊时间"><a-date-picker v-model="form.consultDate" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="状态">
            <a-select v-model="form.status"><a-option value="待会诊">待会诊</a-option><a-option value="已完成">已完成</a-option></a-select>
          </a-form-item></a-col>
        </a-row>
        <a-form-item label="评估意见"><a-textarea v-model="form.opinion" :auto-size="{ minRows: 3 }" /></a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import type { TableData } from '@arco-design/web-vue/es/table/interface';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { ConsultationRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();
const loading = ref(false);
const selectedId = ref(store.consultations[0]?.id ?? '');

const pendingCount = computed(() => store.consultations.filter((item) => item.status === '待会诊').length);
const selected = computed(() => store.consultations.find((item) => item.id === selectedId.value));

const selectConsultation = (record: TableData) => {
  selectedId.value = (record as ConsultationRecord).id;
};

const rowClass = (record: ConsultationRecord) => (record.id === selectedId.value ? 'row-active' : '');

async function reload() {
  loading.value = true;
  try {
    await store.loadRemotePreopConsultations();
  } finally {
    loading.value = false;
  }
}

// ---- 表单 ----
const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingId = ref('');
const form = reactive({
  caseId: '',
  patientName: '',
  requestDept: '',
  consultDate: '',
  consultant: '',
  opinion: '',
  status: '待会诊' as ConsultationRecord['status'],
});

function resetForm() {
  form.caseId = '';
  form.patientName = '';
  form.requestDept = '';
  form.consultDate = '';
  form.consultant = '';
  form.opinion = '';
  form.status = '待会诊';
}

function openCreate() {
  formMode.value = 'create';
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

function openEdit(record: ConsultationRecord) {
  formMode.value = 'edit';
  editingId.value = record.id;
  Object.assign(form, {
    caseId: record.caseId,
    patientName: record.patientName,
    requestDept: record.requestDept,
    consultDate: record.consultDate,
    consultant: record.consultant,
    opinion: record.opinion,
    status: record.status,
  });
  formVisible.value = true;
}

function closeForm() {
  formVisible.value = false;
}

async function submitForm() {
  if (!form.caseId) {
    Message.warning('请填写病例ID');
    return;
  }
  try {
    if (formMode.value === 'create') {
      const created = await store.upsertPreopConsultation({
        id: `tmp-${Date.now()}`,
        caseId: form.caseId,
        patientName: form.patientName,
        requestDept: form.requestDept,
        consultDate: form.consultDate,
        consultant: form.consultant,
        opinion: form.opinion,
        status: form.status,
      });
      if (created) selectedId.value = created.id;
      Message.success('会诊已创建');
    } else {
      await store.upsertPreopConsultation({
        id: editingId.value,
        caseId: form.caseId,
        patientName: form.patientName,
        requestDept: form.requestDept,
        consultDate: form.consultDate,
        consultant: form.consultant,
        opinion: form.opinion,
        status: form.status,
      });
      Message.success('会诊已更新');
    }
    formVisible.value = false;
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存失败');
  }
}

onMounted(reload);
</script>

<style scoped>
.opinion-block {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  margin-bottom: var(--space-3);
}
.opinion-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}
.opinion-block p {
  margin: 0;
  line-height: 1.6;
  color: var(--text-primary);
}
:deep(.row-active td) {
  background: rgb(219 234 254 / 40%);
}
</style>
