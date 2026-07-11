<template>
  <ModulePageShell title="非计划事件管理" description="事件创建、上报、审核、处置和闭环">
    <template #toolbar>
      <a-select v-model="selectedOperationId" style="width: 280px" placeholder="选择手术病例" allow-clear @change="onSelectChange as any">
        <a-option v-for="item in store.cases" :key="item.id" :value="item.id">
          {{ item.room }} · {{ item.patientName }} · {{ item.surgeryName }}
        </a-option>
      </a-select>
    </template>

    <a-spin :loading="ue.loading" style="width: 100%">
      <a-alert v-if="ue.error" type="error" :title="ue.error" closable @close="ue.error = null" style="margin-bottom: 16px" />

      <EmptyState v-if="!selectedOperationId" title="请选择手术病例" description="选择病例后查看或创建非计划事件" icon="IconFile" />

      <template v-else>
        <!-- 事件列表 -->
        <a-card class="section-card" :bordered="false" title="事件列表">
          <template #extra>
            <a-button type="primary" size="small" @click="onCreateDraft">新建事件</a-button>
          </template>
          <a-table :data="ue.list" row-key="eventId" :pagination="{ pageSize: 5 }" size="small" @row-click="(record: any) => onRowClick(record)">
            <template #columns>
              <a-table-column title="事件类型" data-index="eventType" />
              <a-table-column title="严重程度" :width="100">
                <template #cell="{ record }">
                  <a-tag :color="severityColor(record.severity)">{{ severityLabel(record.severity) }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="状态" :width="120">
                <template #cell="{ record }"><StatusTag :value="record.status" /></template>
              </a-table-column>
              <a-table-column title="发生时间" data-index="occurredAt" :width="160" />
              <a-table-column title="关联缺陷" :width="80">
                <template #cell="{ record }">
                  <a-tag v-if="record.qualityDefectId" color="orangered">{{ record.qualityDefectId }}</a-tag>
                  <span v-else>—</span>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-card>

        <!-- 事件详情 -->
        <a-card v-if="ue.detail" class="section-card" :bordered="false" style="margin-top: 16px">
          <template #title>
            <span>事件详情 · </span>
            <StatusTag :value="ue.detail.status" />
            <a-tag v-if="ue.isReadOnly" color="gray" style="margin-left: 8px">只读</a-tag>
            <a-tag v-if="ue.detail.qualityDefectId" color="orangered" style="margin-left: 8px">关联缺陷 #{{ ue.detail.qualityDefectId }}</a-tag>
          </template>
          <template #extra>
            <a-space>
              <a-button v-if="ue.canReport" type="primary" :loading="ue.saving" @click="onReport">上报</a-button>
              <a-button v-if="ue.canStartReview" :loading="ue.saving" @click="onStartReview">开始审核</a-button>
              <a-button v-if="ue.canConfirm" type="primary" :loading="ue.saving" @click="onConfirm">确认</a-button>
              <a-button v-if="ue.canExclude" status="warning" :loading="ue.saving" @click="onExclude">排除</a-button>
              <a-button v-if="ue.canClose" :loading="ue.saving" @click="onClose">关闭</a-button>
            </a-space>
          </template>

          <a-descriptions :column="3" bordered size="medium">
            <a-descriptions-item label="事件ID">{{ ue.detail.eventId }}</a-descriptions-item>
            <a-descriptions-item label="版本">v{{ ue.detail.version }}</a-descriptions-item>
            <a-descriptions-item label="严重程度">
              <a-tag :color="severityColor(ue.detail.severity)">{{ severityLabel(ue.detail.severity) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="发生时间">{{ ue.detail.occurredAt ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="发现来源">{{ ue.detail.discoverySource ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="上报时间">{{ ue.detail.reportedAt ?? '—' }}</a-descriptions-item>
            <a-descriptions-item label="审核时间">{{ ue.detail.reviewedAt ?? '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="ue.detail.exclusionReason" label="排除原因">{{ ue.detail.exclusionReason }}</a-descriptions-item>
            <a-descriptions-item v-if="ue.detail.closeReason" label="关闭原因">{{ ue.detail.closeReason }}</a-descriptions-item>
          </a-descriptions>

          <!-- 草稿编辑表单 -->
          <a-form v-if="ue.detail.status === 'draft'" :model="draftForm" layout="vertical" style="margin-top: 16px">
            <a-row :gutter="14">
              <a-col :span="8"><a-form-item label="事件类型"><a-input v-model="draftForm.eventType" placeholder="如 非计划转ICU" /></a-form-item></a-col>
              <a-col :span="6"><a-form-item label="严重程度"><a-select v-model="draftForm.severity"><a-option value="low">低</a-option><a-option value="medium">中</a-option><a-option value="high">高</a-option><a-option value="life_threatening">危及生命</a-option></a-select></a-form-item></a-col>
              <a-col :span="10"><a-form-item label="发现来源"><a-input v-model="draftForm.discoverySource" placeholder="如 护士发现/医生发现" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="原因分析"><a-textarea v-model="draftForm.cause" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="处置措施"><a-textarea v-model="draftForm.treatment" :auto-size="{ minRows: 2 }" /></a-form-item></a-col>
              <a-col :span="24"><a-form-item label="转归"><a-textarea v-model="draftForm.outcome" :auto-size="{ minRows: 1 }" /></a-form-item></a-col>
              <a-col :span="24">
                <a-space>
                  <a-button type="outline" :loading="ue.saving" @click="onSaveDraft">保存草稿</a-button>
                  <a-button type="primary" :loading="ue.saving" @click="onReport">上报</a-button>
                </a-space>
              </a-col>
            </a-row>
            <a-alert v-if="draftForm.severity === 'high' || draftForm.severity === 'life_threatening'" type="warning" message="严重事件上报后将自动创建关联质控缺陷" style="margin-top: 12px" />
          </a-form>

          <!-- 审核操作 -->
          <div v-if="ue.canConfirm || ue.canExclude" style="margin-top: 16px">
            <a-divider orientation="left">审核操作</a-divider>
            <a-row :gutter="14">
              <a-col :span="20"><a-input v-model="reviewOpinion" placeholder="复核意见（确认时可选，排除时建议填写）" /></a-col>
              <a-col :span="4"><a-button type="primary" long :loading="ue.saving" @click="onConfirmWithOpinion">确认</a-button></a-col>
            </a-row>
          </div>
        </a-card>
      </template>
    </a-spin>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useUnplannedEventStore } from '@/stores/unplannedEvent';

const store = useAnesthesiaStore();
const ue = useUnplannedEventStore();
const selectedOperationId = ref('');

const draftForm = ref({ eventType: '', severity: 'medium', discoverySource: '', cause: '', treatment: '', outcome: '' });
const reviewOpinion = ref('');

const severityColor = (s: string) => ({ low: 'green', medium: 'orange', high: 'red', life_threatening: 'red' }[s] ?? 'gray');
const severityLabel = (s: string) => ({ low: '低', medium: '中', high: '高', life_threatening: '危及生命' }[s] ?? s);

const onSelectChange = async (val: string | undefined) => {
  selectedOperationId.value = val ?? '';
  ue.reset();
  if (selectedOperationId.value) {
    try {
      await ue.loadList(selectedOperationId.value);
    } catch { /* error in store */ }
  }
};

const onRowClick = async (record: { eventId: string }) => {
  if (!record?.eventId) return;
  try {
    await ue.loadDetail(record.eventId);
    syncFormFromDetail();
  } catch { /* error in store */ }
};

const syncFormFromDetail = () => {
  const d = ue.detail;
  if (d) {
    draftForm.value = {
      eventType: d.eventType,
      severity: d.severity,
      discoverySource: d.discoverySource ?? '',
      cause: d.cause ?? '',
      treatment: d.treatment ?? '',
      outcome: d.outcome ?? '',
    };
  }
};

const onCreateDraft = async () => {
  ue.reset();
  draftForm.value = { eventType: '', severity: 'medium', discoverySource: '', cause: '', treatment: '', outcome: '' };
  try {
    await ue.saveDraft({ operationId: selectedOperationId.value, eventType: '非计划事件', severity: 'medium' });
    syncFormFromDetail();
    Message.success('草稿已创建');
    await ue.loadList(selectedOperationId.value);
  } catch { Message.error(ue.error ?? '创建失败'); }
};

const onSaveDraft = async () => {
  try {
    await ue.saveDraft({ operationId: selectedOperationId.value, ...draftForm.value });
    Message.success('草稿已保存');
  } catch { Message.error(ue.error ?? '保存失败'); }
};

const onReport = async () => {
  try {
    await ue.report({ operationId: selectedOperationId.value, ...draftForm.value });
    Message.success('已上报');
    if (ue.detail?.qualityDefectId) Message.warning(`已创建关联质控缺陷 #${ue.detail.qualityDefectId}`);
    await ue.loadList(selectedOperationId.value);
  } catch { Message.error(ue.error ?? '上报失败'); }
};

const onStartReview = async () => { try { await ue.startReview(); Message.success('已开始审核'); } catch { Message.error(ue.error ?? '操作失败'); } };
const onConfirm = async () => { try { await ue.confirm(); Message.success('已确认'); } catch { Message.error(ue.error ?? '操作失败'); } };
const onConfirmWithOpinion = async () => { try { await ue.confirm(reviewOpinion.value || undefined); Message.success('已确认'); } catch { Message.error(ue.error ?? '操作失败'); } };

const onExclude = async () => {
  const reason = prompt('请输入排除原因');
  if (!reason) return;
  try { await ue.exclude(reason); Message.success('已排除'); if (ue.detail?.qualityDefectId) Message.info(`关联缺陷 #${ue.detail.qualityDefectId} 已系统关闭`); await ue.loadList(selectedOperationId.value); } catch { Message.error(ue.error ?? '操作失败'); }
};

const onClose = async () => {
  const reason = prompt('请输入关闭原因');
  if (!reason) return;
  try { await ue.close(reason); Message.success('已关闭'); await ue.loadList(selectedOperationId.value); } catch { Message.error(ue.error ?? '操作失败'); }
};
</script>
