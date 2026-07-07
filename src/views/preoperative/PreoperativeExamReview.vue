<template>
  <ModulePageShell title="术前检查审核" description="检验与影像结果审核，确认术前准备是否达标">
    <template #chips>
      <a-tag color="green">通过 {{ resultCount('通过') }}</a-tag>
      <a-tag color="orangered">待补检 {{ resultCount('待补检') }}</a-tag>
      <a-tag color="red">异常 {{ resultCount('异常') }}</a-tag>
    </template>
    <template #toolbar>
      <a-select v-model="resultFilter" style="width: 140px" allow-clear placeholder="审核结果">
        <a-option value="通过">通过</a-option>
        <a-option value="待补检">待补检</a-option>
        <a-option value="异常">异常</a-option>
      </a-select>
      <a-button type="primary" status="success" :loading="loading" style="margin-left: 8px" @click="reload">
        <template #icon><IconRefresh /></template>刷新
      </a-button>
      <a-button type="primary" style="margin-left: 8px" @click="openCreate">
        <template #icon><IconPlus /></template>新增审核
      </a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="检查审核列表">
      <a-table :data="filtered" :pagination="{ pageSize: 8 }" :loading="loading" row-key="id">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="检验项目" data-index="labItems" />
          <a-table-column title="影像项目" data-index="imagingItems" />
          <a-table-column title="审核结果" :width="100">
            <template #cell="{ record }">
              <a-tag :color="reviewColor(record.reviewResult)">{{ record.reviewResult }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="审核人" data-index="reviewer" :width="100" />
          <a-table-column title="审核日期" data-index="reviewDate" :width="120" />
          <a-table-column title="操作" :width="130">
            <template #cell="{ record }">
              <a-space :size="4">
                <a-button size="mini" type="text" @click="openEdit(record)">编辑</a-button>
                <a-button size="mini" type="text" @click="router.push(`/surgery/detail/${record.caseId}`)">详情</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-modal :visible="formVisible" :title="formMode === 'create' ? '新增检查审核' : '编辑检查审核'" :width="560" @cancel="closeForm" @ok="submitForm">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="病例ID" required><a-input v-model="form.caseId" :disabled="formMode === 'edit'" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="患者姓名"><a-input v-model="form.patientName" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="检验项目"><a-input v-model="form.labItems" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="影像项目"><a-input v-model="form.imagingItems" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="审核结果">
            <a-select v-model="form.reviewResult"><a-option value="通过">通过</a-option><a-option value="待补检">待补检</a-option><a-option value="异常">异常</a-option></a-select>
          </a-form-item></a-col>
          <a-col :span="8"><a-form-item label="审核人"><a-input v-model="form.reviewer" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="审核日期"><a-date-picker v-model="form.reviewDate" value-format="YYYY-MM-DD" style="width: 100%" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { ExamReviewRecord } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const router = useRouter();
const resultFilter = ref<string | undefined>();
const loading = ref(false);

const reviewColor = (result: ExamReviewRecord['reviewResult']) => ({
  通过: 'green',
  待补检: 'orangered',
  异常: 'red',
}[result] ?? 'gray');

const resultCount = (result: ExamReviewRecord['reviewResult']) => store.examReviews.filter((item) => item.reviewResult === result).length;

const filtered = computed(() => {
  if (!resultFilter.value) return store.examReviews;
  return store.examReviews.filter((item) => item.reviewResult === resultFilter.value);
});

async function reload() {
  loading.value = true;
  try {
    await store.loadRemotePreopExamReviews();
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
  labItems: '',
  imagingItems: '',
  reviewResult: '通过' as ExamReviewRecord['reviewResult'],
  reviewer: '',
  reviewDate: '',
});

function resetForm() {
  form.caseId = '';
  form.patientName = '';
  form.labItems = '';
  form.imagingItems = '';
  form.reviewResult = '通过';
  form.reviewer = '';
  form.reviewDate = '';
}

function openCreate() {
  formMode.value = 'create';
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

function openEdit(record: ExamReviewRecord) {
  formMode.value = 'edit';
  editingId.value = record.id;
  Object.assign(form, {
    caseId: record.caseId,
    patientName: record.patientName,
    labItems: record.labItems,
    imagingItems: record.imagingItems,
    reviewResult: record.reviewResult,
    reviewer: record.reviewer,
    reviewDate: record.reviewDate,
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
      await store.upsertPreopExamReview({ id: `tmp-${Date.now()}`, ...form });
      Message.success('检查审核已创建');
    } else {
      await store.upsertPreopExamReview({ id: editingId.value, ...form });
      Message.success('检查审核已更新');
    }
    formVisible.value = false;
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '保存失败');
  }
}

onMounted(reload);
</script>
