<template>
  <ModulePageShell title="质控总览" description="日常质控抽查与 26 项专业指标看板入口">
    <template #chips>
      <a-tag color="red">不合格 {{ resultCount('不合格') }}</a-tag>
      <a-tag color="green">合格 {{ resultCount('合格') }}</a-tag>
      <a-tag color="orangered">待查 {{ resultCount('待查') }}</a-tag>
      <a-tag v-if="useReal">抽查来源 {{ checksSource }}</a-tag>
    </template>
    <template #stats>
      <MetricCard label="抽查项" :value="store.qualityChecks.length" icon="IconFile" />
      <MetricCard label="不合格" :value="resultCount('不合格')" icon="IconClose" variant="danger" />
      <MetricCard label="待整改" :value="rectifyCount" icon="IconExclamationCircle" variant="warn" />
    </template>
    <a-card class="section-card" :bordered="false">
      <template #title>26 项质控指标</template>
      <template #extra>
        <a-button type="primary" @click="router.push('/quality/dashboard')">
          进入质控看板
        </a-button>
      </template>
      <p class="bridge-desc">查看 26 项麻醉专业医疗质量控制指标的当前值、趋势分析与病例穿透。</p>
    </a-card>
    <a-card class="section-card" :bordered="false">
      <template #title>质控抽查记录</template>
      <template #extra>
        <a-space>
          <a-button size="small" :loading="loading" @click="reloadChecks">刷新</a-button>
          <a-button size="small" type="primary" @click="openCreate">新增抽查</a-button>
        </a-space>
      </template>
      <a-table :data="store.qualityChecks" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="检查项" data-index="checkItem" />
          <a-table-column title="标准" data-index="standard" />
          <a-table-column title="结果" :width="100">
            <template #cell="{ record }">
              <a-tag :color="checkResultColor(record.result)">{{ record.result }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="检查人" data-index="checker" :width="100" />
          <a-table-column title="检查日期" data-index="checkDate" :width="120" />
          <a-table-column title="问题描述" data-index="issueDesc" />
          <a-table-column title="整改状态" :width="100">
            <template #cell="{ record }">
              <a-tag v-if="record.rectifyStatus" :color="rectifyColor(record.rectifyStatus)">{{ record.rectifyStatus }}</a-tag>
              <span v-else class="muted">—</span>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="150">
            <template #cell="{ record }">
              <a-space size="mini">
                <a-button size="mini" type="text" @click="markClosed(record)">闭环</a-button>
                <a-button size="mini" type="text" status="danger" @click="removeCheck(record)">删除</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="createVisible" title="新增质控抽查" @ok="submitCreate" :ok-loading="submitting">
      <a-form :model="createForm" layout="vertical">
        <a-form-item field="checkItem" label="检查项" required>
          <a-input v-model="createForm.checkItem" placeholder="如：术前访视记录完整性" />
        </a-form-item>
        <a-form-item field="standard" label="标准">
          <a-input v-model="createForm.standard" placeholder="如：100% 覆盖" />
        </a-form-item>
        <a-form-item field="result" label="结果">
          <a-select v-model="createForm.result">
            <a-option value="合格">合格</a-option>
            <a-option value="不合格">不合格</a-option>
            <a-option value="待查">待查</a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="checker" label="检查人">
          <a-input v-model="createForm.checker" />
        </a-form-item>
        <a-form-item field="checkDate" label="检查日期">
          <a-date-picker v-model="createForm.checkDate" style="width: 100%" />
        </a-form-item>
        <a-form-item field="issueDesc" label="问题描述">
          <a-textarea v-model="createForm.issueDesc" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item field="rectifyStatus" label="整改状态">
          <a-select v-model="createForm.rectifyStatus">
            <a-option value="待整改">待整改</a-option>
            <a-option value="整改中">整改中</a-option>
            <a-option value="已闭环">已闭环</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import dayjs from 'dayjs';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealQuality } from '@/config/apiFlags';
import type { QualityCheckRecord } from '@/types/clinicalModules';
import type { QualityCheckResultApi, QualityRectifyStatusApi } from '@/api/quality';

const store = useAnesthesiaStore();
const router = useRouter();
const useReal = useRealQuality();
const loading = ref(false);
const submitting = ref(false);
const createVisible = ref(false);

const checksSource = computed(() => store.remoteQualityChecksSource);

const createForm = reactive({
  checkItem: '',
  standard: '',
  result: '待查' as QualityCheckResultApi,
  checker: '',
  checkDate: dayjs().format('YYYY-MM-DD'),
  issueDesc: '',
  rectifyStatus: '待整改' as QualityRectifyStatusApi,
});

const resultCount = (result: QualityCheckRecord['result']) => store.qualityChecks.filter((item) => item.result === result).length;
const rectifyCount = computed(() => store.qualityChecks.filter((item) => item.rectifyStatus && item.rectifyStatus !== '已闭环').length);

const checkResultColor = (result: QualityCheckRecord['result']) => ({
  合格: 'green',
  不合格: 'red',
  待查: 'orangered',
}[result] ?? 'gray');

const rectifyColor = (status: NonNullable<QualityCheckRecord['rectifyStatus']>) => ({
  待整改: 'orangered',
  整改中: 'arcoblue',
  已闭环: 'green',
}[status] ?? 'gray');

const reloadChecks = async () => {
  loading.value = true;
  try {
    await store.loadRemoteQualityChecks();
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  createForm.checkItem = '';
  createForm.standard = '';
  createForm.result = '待查';
  createForm.checker = '';
  createForm.checkDate = dayjs().format('YYYY-MM-DD');
  createForm.issueDesc = '';
  createForm.rectifyStatus = '待整改';
  createVisible.value = true;
};

const submitCreate = async () => {
  if (!createForm.checkItem.trim()) {
    Message.warning('检查项不能为空');
    return;
  }
  submitting.value = true;
  try {
    await store.createQualityCheck({
      checkItem: createForm.checkItem.trim(),
      standard: createForm.standard || undefined,
      result: createForm.result,
      checker: createForm.checker || undefined,
      checkDate: createForm.checkDate || undefined,
      issueDesc: createForm.issueDesc || undefined,
      rectifyStatus: createForm.rectifyStatus,
    });
    createVisible.value = false;
    Message.success('已新增抽查记录');
  } catch (e) {
    Message.error(`新增失败：${(e as Error).message}`);
  } finally {
    submitting.value = false;
  }
};

const markClosed = async (record: QualityCheckRecord) => {
  try {
    await store.updateQualityCheck(record.id, { rectifyStatus: '已闭环' });
    Message.success('已置为已闭环');
  } catch (e) {
    Message.error(`更新失败：${(e as Error).message}`);
  }
};

const removeCheck = async (record: QualityCheckRecord) => {
  try {
    await store.deleteQualityCheck(record.id);
    Message.success('已删除');
  } catch (e) {
    Message.error(`删除失败：${(e as Error).message}`);
  }
};

onMounted(() => {
  if (useReal) {
    reloadChecks();
  }
});
</script>

<style scoped>
.bridge-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}
</style>
