<template>
  <ModulePageShell title="PACU 评分与医嘱" description="分项评分记录、医嘱管理和强制出室">
    <template #toolbar>
      <a-select v-model="operationId" placeholder="选择手术病例" style="width: 320px" allow-clear @change="onOperationIdChange">
        <a-option v-for="item in cases" :key="String(item.operationId)" :value="String(item.operationId)">{{ item.patientName ?? '—' }} · {{ item.operationName ?? '—' }}</a-option>
      </a-select>
      <a-button :loading="detailLoading" @click="loadAll">加载</a-button>
    </template>

    <a-spin :loading="detailLoading || ext.loading" style="width: 100%">
      <!-- 工作流状态 -->
      <a-card v-if="pacuDetail" class="section-card" :bordered="false">
        <a-descriptions :column="4" bordered size="small">
          <a-descriptions-item label="患者">{{ pacuDetail.operationCase?.patientName ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="手术">{{ pacuDetail.operationCase?.operationName ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="PACU状态"><StatusTag :value="pacuStatus" /></a-descriptions-item>
          <a-descriptions-item label="入室时间">{{ pacuDetail.pacuRecord?.admittedAt ?? '—' }}</a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-alert v-if="ext.error" type="error" :title="ext.error" closable @close="ext.error = null" style="margin: 12px 0" />

      <EmptyState v-if="!operationId" title="请输入 operationId" description="输入手术ID后加载评分和医嘱" icon="IconFile" />

      <template v-else>
        <!-- 评分管理 -->
        <a-card class="section-card" :bordered="false" title="Aldrete 分项评分" style="margin-top: 12px">
          <template #extra>
            <a-button v-if="canOrder && !isTerminal" type="primary" size="small" @click="showScoreModal = true">新增评分</a-button>
          </template>
          <a-table v-if="ext.scores.length" :data="ext.scores" row-key="scoreId" :pagination="{ pageSize: 5 }" size="small">
            <template #columns>
              <a-table-column title="时间" data-index="scoredAt" :width="160" />
              <a-table-column title="活动" data-index="activity" :width="60" align="center" />
              <a-table-column title="呼吸" data-index="respiration" :width="60" align="center" />
              <a-table-column title="循环" data-index="circulation" :width="60" align="center" />
              <a-table-column title="意识" data-index="consciousness" :width="60" align="center" />
              <a-table-column title="SpO2" data-index="spo2" :width="60" align="center" />
              <a-table-column title="总分" :width="70" align="center">
                <template #cell="{ record }">
                  <a-tag :color="record.total >= 9 ? 'green' : 'red'" size="large">{{ record.total }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="疼痛" data-index="painScore" :width="60" align="center" />
              <a-table-column title="镇静" data-index="sedationScore" :width="60" align="center" />
              <a-table-column title="恶心呕吐" data-index="ponvScore" :width="80" align="center" />
              <a-table-column title="寒战" data-index="shiveringScore" :width="60" align="center" />
            </template>
          </a-table>
          <a-empty v-else description="暂无评分记录" />
        </a-card>

        <!-- 医嘱管理 -->
        <a-card class="section-card" :bordered="false" title="PACU 医嘱" style="margin-top: 12px">
          <template #extra>
            <a-button v-if="canOrder && !isTerminal" type="primary" size="small" @click="showOrderModal = true">新建医嘱</a-button>
          </template>
          <a-table v-if="ext.orders.length" :data="ext.orders" row-key="orderId" :pagination="{ pageSize: 5 }" size="small" @row-click="onOrderRowClick as any">
            <template #columns>
              <a-table-column title="类型" data-index="orderType" :width="100" />
              <a-table-column title="内容">
                <template #cell="{ record }">{{ formatOrderContent(record.content) }}</template>
              </a-table-column>
              <a-table-column title="状态" :width="90">
                <template #cell="{ record }"><a-tag :color="record.status === 'active' ? 'green' : 'gray'">{{ record.status === 'active' ? '活跃' : '已停止' }}</a-tag></template>
              </a-table-column>
              <a-table-column title="下达时间" data-index="orderedAt" :width="160" />
              <a-table-column title="操作" :width="200" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-button v-if="canOrder && record.status === 'active' && !isTerminal" size="mini" type="primary" :loading="ext.saving" @click.stop="onExecuteOrder(record.orderId)">执行</a-button>
                    <a-button v-if="canOrder && record.status === 'active' && !isTerminal" size="mini" status="warning" :loading="ext.saving" @click.stop="onStopOrder(record.orderId)">停止</a-button>
                    <a-button size="mini" @click.stop="ext.loadExecutions(record.orderId)">执行记录</a-button>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <a-empty v-else description="暂无医嘱" />

          <!-- 执行记录弹窗 -->
          <a-modal v-model:visible="execModalVisible" title="执行记录" :footer="false" width="600px">
            <a-table v-if="currentExecutions.length" :data="currentExecutions" row-key="executionId" size="small" :pagination="false">
              <template #columns>
                <a-table-column title="执行人" data-index="executedBy" :width="100" />
                <a-table-column title="时间" data-index="executedAt" :width="160" />
                <a-table-column title="结果" data-index="result" />
                <a-table-column title="异常" data-index="exceptionNote" />
              </template>
            </a-table>
            <a-empty v-else description="无执行记录" />
          </a-modal>
        </a-card>

        <!-- 出室操作 -->
        <a-card class="section-card" :bordered="false" title="出室管理" style="margin-top: 12px">
          <a-space>
            <a-tag v-if="isTerminal" color="gray">当前为终态（{{ pacuStatus }}），不可操作</a-tag>
            <template v-else>
              <a-button v-if="canWorkflow" :disabled="!canNormalDischarge" @click="onNormalDischarge">普通出室</a-button>
              <a-button v-if="canForce && canForceDischarge" status="danger" @click="onForceDischarge">强制出室</a-button>
            </template>
          </a-space>
          <a-alert v-if="!canNormalDischarge && !isTerminal" type="info" style="margin-top: 8px">
            普通出室需要 Aldrete 评分 ≥ 9 且状态为 ready_to_discharge。当前最高评分：{{ ext.latestScore?.total ?? '未评分' }}
          </a-alert>
        </a-card>
      </template>
    </a-spin>

    <!-- 评分弹窗 -->
    <a-modal v-model:visible="showScoreModal" title="新增 Aldrete 分项评分" @ok="onCreateScore" :confirm-loading="ext.saving" :mask-closable="false">
      <a-form :model="scoreForm" layout="vertical">
        <a-row :gutter="14">
          <a-col :span="4" v-for="item in aldreteItems" :key="item.key">
            <a-form-item :label="item.label">
              <a-input-number v-model="scoreForm[item.key]" :min="0" :max="2" :step="1" style="width:100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">附加评分</a-divider>
        <a-row :gutter="14">
          <a-col :span="6"><a-form-item label="疼痛(VAS 0-10)"><a-input-number v-model="scoreForm.painScore" :min="0" :max="10" :step="0.5" style="width:100%" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="镇静(0-10)"><a-input-number v-model="scoreForm.sedationScore" :min="0" :max="10" :step="0.5" style="width:100%" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="恶心呕吐(0-10)"><a-input-number v-model="scoreForm.ponvScore" :min="0" :max="10" :step="0.5" style="width:100%" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="寒战(0-10)"><a-input-number v-model="scoreForm.shiveringScore" :min="0" :max="10" :step="0.5" style="width:100%" /></a-form-item></a-col>
        </a-row>
        <a-alert type="info" style="margin-top: 8px">服务端将自动计算 Aldrete 总分（{{ aldreteTotal }}）。总分 ≥ 9 满足出室评分条件。</a-alert>
      </a-form>
    </a-modal>

    <!-- 医嘱弹窗 -->
    <a-modal v-model:visible="showOrderModal" title="新建 PACU 医嘱" @ok="onCreateOrder" :confirm-loading="ext.saving" :mask-closable="false">
      <a-form :model="orderForm" layout="vertical">
        <a-form-item label="医嘱类型">
          <a-select v-model="orderForm.orderType"><a-option value="medication">用药</a-option><a-option value="fluid">液体</a-option><a-option value="examination">检查</a-option><a-option value="nursing">护理</a-option></a-select>
        </a-form-item>
        <a-form-item label="医嘱内容（JSON）">
          <a-textarea v-model="orderForm.contentText" :auto-size="{ minRows: 3 }" placeholder='例: {"drugName":"芬太尼","dose":"0.1mg","route":"IV"}' />
        </a-form-item>
      </a-form>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import StatusTag from '@/components/StatusTag.vue';
import { usePacuExtensionStore } from '@/stores/pacuExtension';
import { pacuApi } from '@/api/pacu';
import { authApi } from '@/api/auth';
import { loadOperationCases } from '@/services/preoperative/preoperativeFiveFlowsService';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { hasPacuPermission, pacuAction } from '@/services/anesthesia/pacuWorkflow';

const ext = usePacuExtensionStore();

const operationId = ref('');
const cases = ref<OperationCase[]>([]);
const permissions = ref<string[]>([]);
const pacuDetail = ref<Record<string, any> | null>(null);
const detailLoading = ref(false);
const showScoreModal = ref(false);
const showOrderModal = ref(false);
const execModalVisible = ref(false);
const currentExecutions = ref<any[]>([]);

const aldreteItems = [
  { key: 'activity' as const, label: '活动' },
  { key: 'respiration' as const, label: '呼吸' },
  { key: 'circulation' as const, label: '循环' },
  { key: 'consciousness' as const, label: '意识' },
  { key: 'spo2' as const, label: 'SpO2' },
];

const scoreForm = ref({
  activity: 2, respiration: 2, circulation: 2, consciousness: 2, spo2: 2,
  painScore: undefined as number | undefined, sedationScore: undefined as number | undefined,
  ponvScore: undefined as number | undefined, shiveringScore: undefined as number | undefined,
});

const orderForm = ref({ orderType: 'medication', contentText: '' });

const pacuStatus = computed(() => (pacuDetail.value?.pacuRecord?.status as string) ?? '');
const isTerminal = computed(() => ['discharged', 'voided'].includes(pacuStatus.value));
const canNormalDischarge = computed(() => pacuStatus.value === 'ready_to_discharge' && (ext.latestScore?.total ?? 0) >= 9);
const canForceDischarge = computed(() => ['admitted', 'recovering', 'ready_to_discharge'].includes(pacuStatus.value));
const canOrder = computed(() => hasPacuPermission(permissions.value, 'pacu.order.manage'));
const canWorkflow = computed(() => hasPacuPermission(permissions.value, 'pacu.workflow.manage'));
const canForce = computed(() => hasPacuPermission(permissions.value, 'pacu.force_discharge'));
const aldreteTotal = computed(() => scoreForm.value.activity + scoreForm.value.respiration + scoreForm.value.circulation + scoreForm.value.consciousness + scoreForm.value.spo2);

const onOperationIdChange = async (val: any) => {
  operationId.value = val ?? '';
  pacuDetail.value = null;
  ext.reset();
};

const loadAll = async () => {
  if (!operationId.value) return;
  detailLoading.value = true;
  try {
    pacuDetail.value = await pacuApi.detail(operationId.value) as any;
    await ext.load(operationId.value);
  } catch (e) {
    Message.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    detailLoading.value = false;
  }
};

const onCreateScore = async () => {
  try {
    await ext.createScore({
      operationId: operationId.value,
      pacuRecordId: pacuDetail.value?.pacuRecord?.pacuRecordId ?? '',
      ...scoreForm.value,
    });
    Message.success(`评分已保存，总分：${ext.latestScore?.total}`);
    showScoreModal.value = false;
    // Reload PACU detail to reflect score-based state changes
    pacuDetail.value = await pacuApi.detail(operationId.value) as any;
  } catch (e) {
    Message.error(ext.error ?? '保存失败');
  }
};

const onCreateOrder = async () => {
  let content: Record<string, unknown> = {};
  try { content = orderForm.value.contentText ? JSON.parse(orderForm.value.contentText) : {}; } catch { Message.error('医嘱内容必须是合法 JSON'); return; }
  try {
    await ext.createOrder({
      operationId: operationId.value,
      pacuRecordId: pacuDetail.value?.pacuRecord?.pacuRecordId ?? '',
      orderType: orderForm.value.orderType,
      content,
    });
    Message.success('医嘱已创建');
    showOrderModal.value = false;
    orderForm.value.contentText = '';
  } catch (e) {
    Message.error(ext.error ?? '创建失败');
  }
};

const onExecuteOrder = async (orderId: string) => {
  try {
    await ext.executeOrder(orderId);
    Message.success('医嘱已执行');
  } catch { Message.error(ext.error ?? '执行失败'); }
};

const onStopOrder = async (orderId: string) => {
  try {
    await ext.stopOrder(orderId, '页面停止');
    Message.success('医嘱已停止');
  } catch { Message.error(ext.error ?? '停止失败'); }
};

const onOrderRowClick = async (record: any) => {
  if (!record?.orderId) return;
  await ext.loadExecutions(record.orderId);
  currentExecutions.value = ext.executions[record.orderId] ?? [];
  execModalVisible.value = true;
};

const onNormalDischarge = async () => {
  try {
    pacuDetail.value = await pacuAction('discharge', { operationId: operationId.value, expectedVersion: pacuDetail.value?.pacuRecord?.version, dischargeDestination: '病房' });
    Message.success('已出室');
  } catch (e) { Message.error(e instanceof Error ? e.message : '出室失败'); }
};

const onForceDischarge = () => {
  Modal.warning({
    title: '强制出室确认',
    content: '强制出室将跳过出室条件检查。请填写原因和审批人。',
    hideCancel: false,
    onOk: async () => {
      const reason = prompt('请输入强制出室原因');
      if (!reason) return;
      const reasonCode = prompt('请输入原因编码（如 medical_judgment / bed_shortage）') ?? 'other';
      const approverId = prompt('请输入审批人工号') ?? undefined;
      try {
        pacuDetail.value = await pacuAction('forceDischarge', { operationId: operationId.value, expectedVersion: pacuDetail.value?.pacuRecord?.version, reason, reasonCode, approverId });
        Message.success('强制出室成功');
      } catch { Message.error(ext.error ?? '强制出室失败'); }
    },
  });
};

const formatOrderContent = (content: unknown): string => {
  if (!content || typeof content !== 'object') return '—';
  const obj = content as Record<string, unknown>;
  const parts = Object.entries(obj).slice(0, 3).map(([k, v]) => `${k}:${v}`);
  return parts.join(' · ') || '—';
};

onMounted(async () => {
  const [loadedCases, granted] = await Promise.all([loadOperationCases(), authApi.myPermissions()]);
  cases.value = loadedCases.filter((item) => Boolean(item.operationId));
  permissions.value = Array.isArray(granted?.permissions) ? granted.permissions.map(String) : [];
});
</script>
