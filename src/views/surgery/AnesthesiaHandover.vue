<template>
  <ModulePageShell title="麻醉交班" description="病例来自 OperationCase；交班内容、核查和临床快照保存于 SAMIS">
    <template #toolbar>
      <a-select v-model="selectedOperationId" :loading="caseLoading" style="width: 360px" placeholder="选择手术病例" allow-search>
        <a-option v-for="item in cases" :key="item.operationId!" :value="item.operationId!">
          {{ item.roomName || '未排手术间' }} · {{ item.patientName || '—' }} · {{ item.operationName || item.plannedOperationName || '—' }}
        </a-option>
      </a-select>
      <a-button :loading="caseLoading || workflow.loading" @click="reload">刷新</a-button>
      <a-button v-if="workflow.detail?.history.length" @click="historyVisible = true">历史版本</a-button>
    </template>

    <a-alert v-if="caseError || workflow.error" type="error" show-icon style="margin-bottom: 12px">
      {{ caseError || workflow.error }}
    </a-alert>
    <a-spin :loading="caseLoading || workflow.loading" style="width: 100%">
      <template v-if="selectedCase">
        <a-card class="section-card" :bordered="false" title="患者与手术信息">
          <OperationCaseSummary :case-data="workflow.detail?.operationCase || selectedCase" />
        </a-card>

        <a-card class="section-card" :bordered="false">
          <template #title>
            <span>交班记录</span>
            <a-tag v-if="isCancelled" color="red" class="status-pill">已取消</a-tag>
            <a-tag v-else color="arcoblue" class="status-pill">{{ statusLabel(current?.status) }}</a-tag>
          </template>
          <template #extra><a-tag color="arcoblue">版本 {{ current?.version ?? 0 }}</a-tag></template>

          <!-- 状态步骤：未创建 → 草稿 → 待接班 → 已接班；取消单独突出 -->
          <a-steps :current="statusStepIndex" size="small" class="handover-steps">
            <a-step title="未创建" description="尚未建立交班" />
            <a-step title="草稿" description="编辑中，可反复保存" />
            <a-step title="待接班" description="已提交，等待接班确认" />
            <a-step title="已接班" description="接班医生已确认" />
          </a-steps>
          <a-alert v-if="isCancelled" type="error" show-icon class="cancel-banner">
            此交班已取消{{ current?.cancelReason ? `，原因：${current.cancelReason}` : '' }}，不再进入接班流程。
          </a-alert>

          <!-- 交班医生 → 接班医生 人员卡片 -->
          <div class="person-flow">
            <div class="person-card">
              <div class="person-role">交班医生</div>
              <div class="person-name">{{ current?.outgoingDoctorName || currentUserLabel }}</div>
              <div class="person-meta">工号：{{ current?.outgoingDoctorId || '当前登录用户' }}</div>
              <div class="person-meta">交班时间：{{ current?.handoverAt || '—' }}</div>
            </div>
            <div class="person-arrow">→</div>
            <div class="person-card" :class="{ 'person-card--responsible': !!responsibleDoctor }">
              <div class="person-role">接班医生</div>
              <div class="person-name">{{ incomingDoctorLabel || '—' }}</div>
              <div class="person-meta">工号：{{ form.incomingDoctorId || (current?.incomingDoctorId ?? '—') }}</div>
              <div class="person-meta">接收时间：{{ current?.acceptedAt || '—' }}</div>
              <div v-if="responsibleDoctor" class="person-current">当前责任人：{{ responsibleDoctor.doctorName }}</div>
            </div>
          </div>

          <a-form :model="form" layout="vertical" :disabled="readOnly" class="handover-form">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="交班类型">
                  <a-select v-model="form.handoverType" :options="handoverTypes" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="交班医师">
                  <a-input :model-value="current?.outgoingDoctorName || '由当前登录用户确定'" disabled />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="接班医师（启用麻醉医生）" required>
                  <a-select
                    v-model="form.incomingDoctorId"
                    :options="doctorOptions"
                    :loading="doctorLoading"
                    allow-search
                    :fallback-option="incomingDoctorFallback"
                    placeholder="搜索姓名或工号选择接班医生"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-divider>结构化交班内容</a-divider>
            <div class="struct-grid">
              <div class="struct-card">
                <div class="struct-head"><strong>当前问题</strong><a-button size="mini" type="text" @click="addProblem">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.activeProblems" :key="`p-${idx}`" class="struct-row">
                  <a-input v-model="item.description" placeholder="问题描述" />
                  <a-button size="mini" type="text" status="danger" @click="form.activeProblems.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.activeProblems.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>风险</strong><a-button size="mini" type="text" @click="addRisk">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.riskItems" :key="`r-${idx}`" class="struct-row">
                  <a-input v-model="item.label" placeholder="风险点" style="flex: 1 1 60%" />
                  <a-select v-model="item.level" placeholder="级别" allow-clear style="width: 90px">
                    <a-option value="high">高</a-option><a-option value="medium">中</a-option><a-option value="low">低</a-option>
                  </a-select>
                  <a-button size="mini" type="text" status="danger" @click="form.riskItems.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.riskItems.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>设备</strong><a-button size="mini" type="text" @click="addEquipment">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.equipment" :key="`e-${idx}`" class="struct-row">
                  <a-input v-model="item.name" placeholder="设备名称" style="flex: 1 1 45%" />
                  <a-select v-model="item.status" placeholder="状态" style="width: 110px">
                    <a-option value="normal">正常</a-option><a-option value="standby">备用</a-option><a-option value="abnormal">异常</a-option>
                  </a-select>
                  <a-input v-model="item.note" placeholder="说明" style="flex: 1 1 40%" />
                  <a-button size="mini" type="text" status="danger" @click="form.equipment.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.equipment.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>管路</strong><a-button size="mini" type="text" @click="addLine">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.lines" :key="`l-${idx}`" class="struct-row">
                  <a-input v-model="item.type" placeholder="管路类型" style="flex: 1 1 40%" />
                  <a-input v-model="item.site" placeholder="部位" style="flex: 1 1 35%" />
                  <a-select v-model="item.status" placeholder="状态" style="width: 90px">
                    <a-option value="active">在用</a-option><a-option value="removed">已拔</a-option>
                  </a-select>
                  <a-button size="mini" type="text" status="danger" @click="form.lines.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.lines.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>持续用药</strong><a-button size="mini" type="text" @click="addMedication">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.activeMedications" :key="`m-${idx}`" class="struct-row">
                  <a-input v-model="item.name" placeholder="药物名称" style="flex: 1 1 38%" />
                  <a-input v-model="item.rate" placeholder="速度/剂量" style="flex: 1 1 30%" />
                  <a-input v-model="item.route" placeholder="途径" style="flex: 1 1 22%" />
                  <a-button size="mini" type="text" status="danger" @click="form.activeMedications.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.activeMedications.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>待办</strong><a-button size="mini" type="text" @click="addTask">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.pendingTasks" :key="`t-${idx}`" class="struct-row">
                  <a-input v-model="item.description" placeholder="待办事项" />
                  <a-button size="mini" type="text" status="danger" @click="form.pendingTasks.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.pendingTasks.length" class="struct-empty">暂无</span>
              </div>

              <div class="struct-card">
                <div class="struct-head"><strong>职责（交接事项）</strong><a-button size="mini" type="text" @click="addResp">+ 新增</a-button></div>
                <div v-for="(item, idx) in form.responsibilities" :key="`resp-${idx}`" class="struct-row">
                  <a-input v-model="item.description" placeholder="交接职责/事项" />
                  <a-button size="mini" type="text" status="danger" @click="form.responsibilities.splice(idx, 1)">删除</a-button>
                </div>
                <span v-if="!form.responsibilities.length" class="struct-empty">暂无</span>
              </div>
            </div>

            <a-form-item label="重点提示" style="margin-top: 12px">
              <a-textarea v-model="form.priorityNotes" :auto-size="{ minRows: 2 }" />
            </a-form-item>
            <a-form-item label="特殊说明">
              <a-textarea v-model="form.specialNotes" :auto-size="{ minRows: 2 }" />
            </a-form-item>
            <a-form-item v-if="form.handoverType === 'emergency'" label="紧急交班原因" required>
              <a-textarea v-model="form.emergencyReason" :auto-size="{ minRows: 2 }" />
            </a-form-item>

            <a-divider>核查确认</a-divider>
            <div class="check-grid">
              <div v-for="check in form.checks" :key="check.itemCode" class="check-item" :class="{ 'check-item--pending': check.result === 'pending' }">
                <strong>{{ check.label }}</strong>
                <a-radio-group v-model="check.result" type="button" size="small">
                  <a-radio value="pending">待确认</a-radio>
                  <a-radio value="confirmed">正常</a-radio>
                  <a-radio value="exception">异常</a-radio>
                </a-radio-group>
                <a-input v-if="check.result === 'exception'" v-model="check.remark" placeholder="异常项必须填写说明" />
                <span v-else-if="check.result === 'pending'" class="check-hint">提交前须逐项确认</span>
              </div>
            </div>
          </a-form>

          <!-- 临床快照：分组展示，异常项醒目 -->
          <div v-if="snapshotGroups.length" class="snapshot-grid">
            <span v-if="snapshotConfigNote" class="snapshot-config-note">{{ snapshotConfigNote }}</span>
            <div v-for="group in snapshotGroups" :key="group.key" class="snapshot-card" :class="{ 'snapshot-card--alert': group.abnormal }">
              <div class="snapshot-head">
                <strong>{{ group.title }}</strong>
                <span :class="group.abnormal ? 'snapshot-count--alert' : ''">{{ group.items.length }} 条{{ group.abnormal ? '（含异常）' : '' }}</span>
              </div>
              <ul class="snapshot-list">
                <li v-for="(row, i) in group.items.slice(0, 6)" :key="i" :class="{ 'snapshot-abnormal': row.abnormal }">
                  {{ row.text }}
                </li>
                <li v-if="group.items.length > 6" class="snapshot-more">…还有 {{ group.items.length - 6 }} 条</li>
              </ul>
            </div>
          </div>
          <div v-else-if="current?.clinicalSnapshot" class="snapshot-empty">暂无可展示的临床快照明细。</div>
        </a-card>

        <EmptyState v-if="!selectedCase" title="暂无手术病例" description="服务端当前没有可用于交班的 OperationCase" icon="IconSwap" />
      </template>
      <EmptyState v-else title="暂无手术病例" description="服务端当前没有可用于交班的 OperationCase" icon="IconSwap" />
    </a-spin>

    <!-- 固定底部操作栏 -->
    <div class="handover-action-bar no-print">
      <div class="action-bar-reason">{{ primaryDisabledReason || '可执行以下操作' }}</div>
      <a-space wrap>
        <a-tooltip :content="reasonFor('write') || ''" :disabled="!reasonFor('write')">
          <a-button v-if="can('handover.write')" :loading="workflow.saving" :disabled="!!reasonFor('write')" @click="saveDraft">保存草稿</a-button>
        </a-tooltip>
        <a-tooltip :content="reasonFor('submit') || ''" :disabled="!reasonFor('submit')">
          <a-button v-if="can('handover.submit')" type="primary" :loading="workflow.saving" :disabled="!!reasonFor('submit')" @click="submit">提交交班</a-button>
        </a-tooltip>
        <a-tooltip :content="reasonFor('accept') || ''" :disabled="!reasonFor('accept')">
          <a-button v-if="can('handover.accept')" type="primary" :loading="workflow.saving" :disabled="!!reasonFor('accept')" @click="accept">确认接班</a-button>
        </a-tooltip>
        <a-input v-if="canCancel" v-model="cancelReason" style="width: 200px" placeholder="取消原因（必填）" :disabled="readOnly" />
        <a-button v-if="canCancel" status="danger" :loading="workflow.saving" :disabled="!cancelReason.trim()" @click="cancel">取消交班</a-button>
      </a-space>
    </div>

    <HandoverHistoryDrawer v-model:visible="historyVisible" :history="workflow.detail?.history ?? []" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useRoute } from 'vue-router';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import HandoverHistoryDrawer from '@/components/surgery/HandoverHistoryDrawer.vue';
import { loadOperationCases } from '@/services/preoperative/preoperativeFiveFlowsService';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';
import { useAnesthesiaHandoverStore } from '@/stores/anesthesiaWorkflow';
import { authApi } from '@/api/auth';
import { loadStaffCatalog } from '@/services/anesthesia/anesthesiaDictConfigService';
import { mapClinicalSnapshot, mergeStructuredItem } from '@/services/anesthesia/handoverSnapshotMapper';
import type { StaffDictItem } from '@/types/system';

type CheckResult = 'pending' | 'confirmed' | 'exception';
// _original 保存该行从后端回读的完整对象（含 status/action/note/dueAt 及未知扩展字段），
// payload 以它为基础做字段级合并，确保编辑不丢失未展示字段、不重生成既有 code/id。
type OriginalCarrier = { _original?: Record<string, unknown> };
interface ProblemItem extends OriginalCarrier { code: string; description: string }
interface RiskItem extends OriginalCarrier { code: string; label: string; level?: string }
interface EquipmentItem extends OriginalCarrier { code: string; name: string; status: string; note?: string }
interface LineItem extends OriginalCarrier { type: string; site?: string; status?: string }
interface MedicationItem extends OriginalCarrier { name: string; rate?: string; route?: string }
interface TaskItem extends OriginalCarrier { code: string; description: string }
interface RespItem extends OriginalCarrier { code: string; description: string }

const workflow = useAnesthesiaHandoverStore();
const route = useRoute();
// 路由 operationId（从记录单进入时携带）：优先于“默认第一例”，避免打开错误患者。
const routeOperationId = computed(() => String(route.params.operationId ?? '').trim());
const cases = ref<OperationCase[]>([]);
const selectedOperationId = ref('');
const caseLoading = ref(false);
const caseError = ref('');
const historyVisible = ref(false);
const cancelReason = ref('');
const permissions = ref<string[]>([]);
const doctors = ref<StaffDictItem[]>([]);
const doctorLoading = ref(false);
const currentUserLabel = '当前登录用户';

const can = (code: string) => permissions.value.some((value) => value === '*' || value === 'handover.*' || value === code);
const selectedCase = computed(() => cases.value.find((item) => item.operationId === selectedOperationId.value) ?? null);
const current = computed(() => workflow.detail?.activeHandover ?? null);
const status = computed(() => current.value?.status ?? '');
const readOnly = computed(() => ['accepted', 'cancelled'].includes(status.value));
const isCancelled = computed(() => status.value === 'cancelled');
const responsibleDoctor = computed(() => workflow.detail?.currentResponsibleDoctor ?? null);

const statusStepIndex = computed(() => {
  switch (status.value) {
    case 'draft': return 1;
    case 'submitted': return 2;
    case 'accepted': return 3;
    default: return 0;
  }
});

const handoverTypes = [{ label: '常规换班', value: 'shift_change' }, { label: '临时交班', value: 'temporary' }, { label: '紧急交班', value: 'emergency' }];
const statusLabel = (value?: string) => ({ draft: '草稿', submitted: '待接班', accepted: '已接班', cancelled: '已取消' }[value ?? ''] ?? '未创建');

const doctorOptions = computed(() => doctors.value
  .filter((item) => item.enabled && (!item.role || item.role === '麻醉医生'))
  .map((item) => ({ label: `${item.name}${item.gh ? `（${item.gh}）` : ''}`, value: item.gh || item.id })));
const incomingDoctorFallback = (value: string | number | boolean | Record<string, unknown>): { label: string; value: string } => {
  const id = String(value);
  const matched = doctors.value.find((item) => (item.gh || item.id) === id);
  return { label: matched ? `${matched.name}${matched.gh ? `（${matched.gh}）` : ''}` : id, value: id };
};
const incomingDoctorLabel = computed(() => {
  const id = form.incomingDoctorId || current.value?.incomingDoctorId;
  if (!id) return '';
  const matched = doctors.value.find((item) => (item.gh || item.id) === id);
  return matched?.name || current.value?.incomingDoctorName || '';
});

const form = reactive({
  handoverType: 'shift_change',
  incomingDoctorId: '',
  responsibilities: [] as RespItem[],
  activeProblems: [] as ProblemItem[],
  riskItems: [] as RiskItem[],
  equipment: [] as EquipmentItem[],
  lines: [] as LineItem[],
  activeMedications: [] as MedicationItem[],
  pendingTasks: [] as TaskItem[],
  priorityNotes: '',
  specialNotes: '',
  emergencyReason: '',
  checks: [
    { itemCode: 'equipment', label: '设备与备用设备', result: 'pending' as CheckResult, remark: '' },
    { itemCode: 'medication', label: '持续用药与特殊药品', result: 'pending' as CheckResult, remark: '' },
    { itemCode: 'airway', label: '气道与通气', result: 'pending' as CheckResult, remark: '' },
    { itemCode: 'hemodynamics', label: '循环与出入量', result: 'pending' as CheckResult, remark: '' },
  ],
});

const addResp = () => form.responsibilities.push({ code: '', description: '' });
const addProblem = () => form.activeProblems.push({ code: '', description: '' });
const addRisk = () => form.riskItems.push({ code: '', label: '', level: '' });
const addEquipment = () => form.equipment.push({ code: '', name: '', status: 'normal', note: '' });
const addLine = () => form.lines.push({ type: '', site: '', status: 'active' });
const addMedication = () => form.activeMedications.push({ name: '', rate: '', route: '' });
const addTask = () => form.pendingTasks.push({ code: '', description: '' });

function hydrate() {
  const item = current.value;
  if (!item) {
    Object.assign(form, {
      handoverType: 'shift_change', incomingDoctorId: '', responsibilities: [], activeProblems: [], riskItems: [],
      equipment: [], lines: [], activeMedications: [], pendingTasks: [], priorityNotes: '', specialNotes: '', emergencyReason: '',
    });
    form.checks.forEach((c) => { c.result = 'pending'; c.remark = ''; });
    return;
  }
  // 结构化回读：保留原始对象（_original），编辑时做字段级合并，避免丢失 status/action/note/dueAt 及扩展字段。
  Object.assign(form, {
    handoverType: item.handoverType,
    incomingDoctorId: item.incomingDoctorId ?? '',
    responsibilities: (item.responsibilities || []).map((v) => ({ _original: { ...v }, code: v.code ?? '', description: v.description ?? v.label ?? '' })),
    activeProblems: (item.activeProblems || []).map((v) => ({ _original: { ...v }, code: v.code ?? '', description: v.description ?? '' })),
    riskItems: (item.riskItems || []).map((v) => ({ _original: { ...v }, code: v.code ?? '', label: v.label ?? '', level: v.level ?? '' })),
    equipment: (item.equipment || []).map((v) => ({ _original: { ...v }, code: v.code ?? '', name: v.name ?? '', status: v.status ?? 'normal', note: v.note ?? '' })),
    lines: (item.lines || []).map((v) => ({ _original: { ...v }, type: v.type ?? '', site: v.site ?? '', status: v.status ?? 'active' })),
    activeMedications: (item.activeMedications || []).map((v) => ({ _original: { ...v }, name: v.name ?? '', rate: v.rate ?? '', route: v.route ?? '' })),
    pendingTasks: (item.pendingTasks || []).map((v) => ({ _original: { ...v }, code: v.code ?? '', description: v.description ?? '' })),
    priorityNotes: item.priorityNotes ?? '',
    specialNotes: item.specialNotes ?? '',
    emergencyReason: item.emergencyReason ?? '',
  });
  form.checks.forEach((c) => {
    const saved = (item.checks || []).find((v) => v.itemCode === c.itemCode);
    if (saved) { c.result = saved.result; c.remark = saved.remark ?? ''; }
    else { c.result = 'pending'; c.remark = ''; }
  });
}

// 结构化 payload：以原始对象为基础做字段级合并，保留 status/action/note/dueAt 及未知扩展字段；
// 既有 code/id 不重生成，仅新建条目（无 _original）按序生成 code；删除仅删除显式选中的项。
function payload() {
  const seq = (prefix: string, i: number) => `${prefix}-${i + 1}`;
  return {
    handoverType: form.handoverType,
    incomingDoctorId: form.incomingDoctorId,
    responsibilities: form.responsibilities.filter((v) => v.description.trim()).map((v, i) => mergeStructuredItem(v, { code: v.code || seq('RESP', i), description: v.description, label: v.description })),
    activeProblems: form.activeProblems.filter((v) => v.description.trim()).map((v, i) => mergeStructuredItem(v, { code: v.code || seq('PROBLEM', i), description: v.description })),
    riskItems: form.riskItems.filter((v) => v.label.trim()).map((v, i) => mergeStructuredItem(v, { code: v.code || seq('RISK', i), label: v.label, level: v.level || undefined })),
    equipment: form.equipment.filter((v) => v.name.trim()).map((v, i) => mergeStructuredItem(v, { code: v.code || seq('EQUIP', i), name: v.name, status: v.status, note: v.note || undefined })),
    lines: form.lines.filter((v) => v.type.trim()).map((v) => mergeStructuredItem(v, { type: v.type, site: v.site || undefined, status: v.status || 'active' })),
    activeMedications: form.activeMedications.filter((v) => v.name.trim()).map((v) => mergeStructuredItem(v, { name: v.name, rate: v.rate || undefined, route: v.route || undefined })),
    pendingTasks: form.pendingTasks.filter((v) => v.description.trim()).map((v, i) => mergeStructuredItem(v, { code: v.code || seq('TASK', i), description: v.description })),
    priorityNotes: form.priorityNotes,
    specialNotes: form.specialNotes,
    emergencyReason: form.emergencyReason,
    checks: form.checks.map(({ itemCode, result, remark }) => ({ itemCode, result, remark })),
  };
}

interface SnapshotRow { text: string; abnormal: boolean }
const snapshotGroups = computed(() => {
  // 统一由 mapper 完成 snake_case→camelCase 与阈值判定；组件不再硬编码阈值、不再散落字段兼容。
  const mapped = mapClinicalSnapshot(current.value?.clinicalSnapshot);
  if (!mapped) return [] as Array<{ key: string; title: string; items: SnapshotRow[]; abnormal: boolean; configNote?: string }>;
  return mapped.groups.map((g) => ({
    key: g.key, title: g.title, abnormal: g.abnormal, configNote: mapped.configNote,
    items: g.items.map((it) => ({ text: it.label, abnormal: it.abnormal })),
  }));
});
const snapshotConfigNote = computed(() => {
  const mapped = mapClinicalSnapshot(current.value?.clinicalSnapshot);
  return mapped?.configNote === 'default' ? '（异常阈值：使用默认安全阈值）' : '';
});

// 操作可用性原因：权限与状态共同决定，按钮 disabled 时提示具体原因。
const canCancel = computed(() => !!current.value && ['draft', 'submitted'].includes(status.value) && can('handover.cancel'));
function reasonFor(action: 'write' | 'submit' | 'accept'): string {
  // 未选中有效病例（operationId 不存在/不匹配）时禁止任何提交，避免误操作错误患者。
  if (!selectedCase.value) return caseError.value || '当前未选中有效病例';
  if (isCancelled.value) return '交班已取消，不可操作';
  if (action === 'write') {
    if (readOnly.value) return '已接班，不可编辑';
    if (status.value === 'submitted') return '已提交，等待接班确认';
    return '';
  }
  if (action === 'submit') {
    if (readOnly.value) return status.value === 'accepted' ? '已接班' : '已取消';
    if (current.value && status.value !== 'draft') return '仅草稿状态可提交';
    if (form.checks.some((c) => c.result === 'pending')) return '存在待确认核查项';
    if (form.checks.some((c) => c.result === 'exception' && !c.remark.trim())) return '异常核查项必须填写说明';
    if (!form.incomingDoctorId.trim()) return '请先选择接班医生';
    return '';
  }
  if (action === 'accept') {
    if (status.value !== 'submitted') return '仅待接班状态可确认接班';
    return '';
  }
  return '';
}
const primaryDisabledReason = computed(() => reasonFor('submit') || reasonFor('write') || '');

async function loadCases() {
  caseLoading.value = true; caseError.value = '';
  try {
    cases.value = await loadOperationCases();
    // 优先读取路由 operationId（从记录单进入），校验存在；不存在则明确报错，不得静默选择第一例。
    const want = routeOperationId.value || selectedOperationId.value;
    if (want) {
      const matched = cases.value.find((c) => String(c.operationId) === want);
      if (matched) {
        selectedOperationId.value = String(matched.operationId);
      } else if (routeOperationId.value) {
        selectedOperationId.value = '';
        caseError.value = `未找到手术病例：${routeOperationId.value}，请确认病例编号或从麻醉记录单重新进入。`;
        return;
      } else {
        selectedOperationId.value = String(cases.value[0]?.operationId ?? '');
      }
    } else {
      // 无路由参数的普通列表入口：可默认第一例。
      selectedOperationId.value = String(cases.value[0]?.operationId ?? '');
    }
  } catch (e) { cases.value = []; caseError.value = e instanceof Error ? e.message : '加载病例失败'; }
  finally { caseLoading.value = false; }
}
async function loadDoctors() {
  doctorLoading.value = true;
  try { doctors.value = (await loadStaffCatalog()).items; } catch { doctors.value = []; }
  finally { doctorLoading.value = false; }
}
async function loadHandover() {
  if (!selectedOperationId.value) return;
  try { await workflow.load(selectedOperationId.value); hydrate(); } catch { /* store 显示错误 */ }
}
async function reload() { await loadCases(); await loadHandover(); }
async function saveDraft() {
  if (!form.incomingDoctorId.trim()) { Message.warning('请选择接班医生'); return; }
  try { await workflow.saveDraft(payload()); hydrate(); Message.success('交班草稿已保存并回读'); } catch { /* store 显示错误 */ }
}
async function submit() {
  if (form.checks.some((c) => c.result === 'pending')) { Message.warning('请先逐项确认核查项'); return; }
  if (form.checks.some((c) => c.result === 'exception' && !c.remark.trim())) { Message.warning('异常核查项必须填写说明'); return; }
  if (!form.incomingDoctorId.trim()) { Message.warning('请先选择接班医生'); return; }
  try { await workflow.saveDraft(payload()); await workflow.submit(); hydrate(); Message.success('交班已提交'); } catch { /* store 显示错误 */ }
}
async function accept() { try { await workflow.accept(); hydrate(); Message.success('接班确认完成'); } catch { /* store 显示错误 */ } }
async function cancel() { try { await workflow.cancel(cancelReason.value); cancelReason.value = ''; hydrate(); Message.success('交班已取消'); } catch (e) { Message.error(e instanceof Error ? e.message : '取消失败'); } }
async function loadPermissions() { try { const result = await authApi.myPermissions(); permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : []; } catch { permissions.value = []; } }

watch(selectedOperationId, loadHandover);
// 路由参数变化（切换到另一个 operationId）时重新加载对应病例。
watch(routeOperationId, async () => { await loadCases(); await loadHandover(); });
onMounted(() => Promise.all([loadPermissions(), loadCases(), loadDoctors()]));
</script>

<style scoped>
.section-card { margin-bottom: 12px; }
.status-pill { margin-left: 8px; }
.handover-steps { margin-bottom: 8px; }
.cancel-banner { margin-bottom: 12px; }
.person-flow { display: flex; align-items: stretch; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
.person-card { flex: 1 1 240px; min-width: 220px; padding: 12px 14px; border: 1px solid var(--border); border-left: 4px solid var(--primary-6, rgb(22, 93, 255)); border-radius: 6px; background: var(--surface, #fff); }
.person-card--responsible { border-left-color: rgb(var(--success-6, 0, 180, 42)); background: #f6fff6; }
.person-role { color: #64748b; font-size: 12px; }
.person-name { margin-top: 2px; color: #0f172a; font-size: 15px; font-weight: 600; }
.person-meta { color: #475569; font-size: 12px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.person-current { margin-top: 6px; color: rgb(var(--success-6, 0, 180, 42)); font-size: 12px; }
.person-arrow { display: flex; align-items: center; color: #94a3b8; font-size: 18px; }
.struct-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.struct-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface, #fff); }
.struct-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.struct-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.struct-empty { color: #94a3b8; font-size: 12px; }
.handover-form { margin-top: 8px; }
.check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.check-item { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm, 6px); font-size: 13px; }
.check-item--pending { border-color: #f7ba1e; background: #fffbe6; }
.check-hint { color: #92600a; font-size: 12px; }
.snapshot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.snapshot-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface, #fff); font-size: 13px; }
.snapshot-card--alert { border-color: #f53f3f; background: #fff2f0; }
.snapshot-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.snapshot-count--alert { color: #f53f3f; font-weight: 600; font-variant-numeric: tabular-nums; }
.snapshot-list { margin: 0; padding-left: 16px; color: #475569; font-size: 12px; line-height: 1.6; }
.snapshot-abnormal { color: #f53f3f; font-weight: 600; }
.snapshot-more { color: #94a3b8; }
.snapshot-empty { margin-top: 16px; color: #94a3b8; font-size: 13px; }
.snapshot-config-note { display: block; width: 100%; margin-bottom: 6px; color: #92600a; font-size: 12px; }
.handover-action-bar { position: sticky; bottom: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 12px; padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface, #fff); box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.06); }
.action-bar-reason { color: #64748b; font-size: 12px; }
@media (max-width: 900px) { .check-grid, .struct-grid, .snapshot-grid { grid-template-columns: 1fr; } .person-flow { flex-direction: column; } .person-arrow { transform: rotate(90deg); justify-content: center; } }
</style>
