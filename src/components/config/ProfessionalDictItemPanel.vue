<template>
  <ModulePageShell :title="title" :description="description" :shell-class="`config-${entityType}-page`">
    <a-card :bordered="false">
      <template #title>
        <a-space>
          <span>{{ title }}</span>
          <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button v-if="canManage" type="primary" @click="openCreate">新增</a-button>
        </a-space>
      </template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">加载失败：{{ loadError }}。可点击刷新重试。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom: 12px">远程暂无数据，表格为空属正常状态。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">无配置权限；仅可查看。</a-alert>

      <a-table :data="items" row-key="id" :loading="loading" :pagination="false" size="medium">
        <template #empty><a-empty :description="`暂无${title}`" /></template>
        <template #columns>
          <a-table-column title="编码" data-index="itemCode" />
          <a-table-column title="名称" data-index="itemName" />
          <a-table-column v-if="isEvent" title="分类"><template #cell="{ record }">{{ record.profile?.eventCategory || '—' }}</template></a-table-column>
          <a-table-column v-if="isEvent" title="严重程度"><template #cell="{ record }">{{ record.profile?.severity || '—' }}</template></a-table-column>
          <a-table-column v-if="isScore" title="评分类型"><template #cell="{ record }">{{ record.profile?.scoreType || '—' }}</template></a-table-column>
          <a-table-column v-if="isScore" title="规则维度数"><template #cell="{ record }">{{ ruleDimCount(record) }}</template></a-table-column>
          <a-table-column title="版本" :width="80"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="100"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="260">
            <template #cell="{ record }">
              <a-space wrap>
                <a-button size="small" @click="openHistory(record)">历史</a-button>
                <a-button v-if="canManage" size="small" @click="openEdit(record)">编辑</a-button>
                <a-button v-if="canManage && record.status === 'enabled'" size="small" @click="onChangeStatus(record, 'paused')">暂停</a-button>
                <a-button v-if="canManage && record.status === 'paused'" size="small" @click="onChangeStatus(record, 'enabled')">启用</a-button>
                <a-button v-if="canManage && record.status !== 'disabled'" size="small" status="warning" @click="onChangeStatus(record, 'disabled')">停用</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer :visible="editorVisible" :width="560" :title="isCreate ? `新增${title}` : `编辑${title}`" :mask-closable="false" unmount-on-close @cancel="editorVisible = false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="编码" :required="true"><a-input v-model="form.itemCode" :disabled="!isCreate" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="名称" :required="true"><a-input v-model="form.itemName" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
        </a-row>
        <template v-if="isEvent">
          <a-row :gutter="12">
            <a-col :span="8"><a-form-item label="事件分类"><a-input v-model="form.eventCategory" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="严重程度"><a-input v-model="form.severity" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="纳入质控"><a-switch v-model="form.qualityIncluded" /></a-form-item></a-col>
          </a-row>
          <a-form-item label="处置指引"><a-textarea v-model="form.responseGuidance" :auto-size="{ minRows: 2 }" /></a-form-item>
        </template>
        <template v-else>
          <a-form-item label="评分类型"><a-input v-model="form.scoreType" /></a-form-item>
          <a-form-item label="结构化规则（JSON 数组）" :required="true">
            <a-textarea v-model="form.ruleDefinitionText" :auto-size="{ minRows: 4 }" placeholder='[{"dimension":"心率","scores":[0,1,2]}]' />
          </a-form-item>
          <a-form-item label="适用场景"><a-input v-model="form.applicableScenario" /></a-form-item>
          <a-form-item label="阈值解释"><a-textarea v-model="form.thresholdInterpretation" :auto-size="{ minRows: 2 }" /></a-form-item>
        </template>
        <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="editorVisible = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="onSave">保存</a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required>
          <a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" placeholder="请填写变更原因" />
        </a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}？</a-form-item>
      </a-form>
    </a-modal>

    <a-drawer :visible="historyVisible" :width="500" title="状态变更历史" unmount-on-close @cancel="historyVisible = false">
      <a-empty v-if="!history.length" description="暂无状态变更记录" />
      <a-timeline v-else>
        <a-timeline-item v-for="h in history" :key="h.id">
          <a-tag :color="statusColor(h.toStatus)">{{ statusLabel(h.toStatus) }}</a-tag>
          <div style="color: var(--color-text-3); font-size: 12px">版本 {{ h.version }} · {{ h.actor ?? '系统' }} · {{ h.occurredAt ?? '—' }}</div>
          <div v-if="h.reason" style="font-size: 13px">原因：{{ h.reason }}</div>
        </a-timeline-item>
      </a-timeline>
    </a-drawer>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { authApi } from '@/api/auth';
import {
  loadProfessionalItems, saveProfessionalItem, changeProfessionalStatusConfig, loadProfessionalHistory,
  canManageProfessional, ProfessionalConflictError,
  EVENT_CATEGORY, SCORE_CATEGORY,
} from '@/services/configuration/professionalDictionaryService';
import type { ProfessionalDictItem, ProfessionalHistoryItem, EventProfile, ScoreProfile } from '@/types/system';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const props = defineProps<{ categoryCode: string; entityType: string; title: string; description: string }>();
const isEvent = computed(() => props.categoryCode === EVENT_CATEGORY);
const isScore = computed(() => props.categoryCode === SCORE_CATEGORY);

const items = ref<ProfessionalDictItem[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false);
const editing = ref<ProfessionalDictItem | null>(null);
const isCreate = ref(true);
const saving = ref(false);
const historyVisible = ref(false);
const history = ref<ProfessionalHistoryItem[]>([]);
const statusVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ item: ProfessionalDictItem; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

interface ItemForm {
  id: number; itemCode: string; itemName: string; sortNo: number; remark: string; expectedVersion: number;
  eventCategory: string; severity: string; responseGuidance: string; qualityIncluded: boolean;
  scoreType: string; ruleDefinitionText: string; applicableScenario: string; thresholdInterpretation: string;
}
const form = reactive<ItemForm>(blankForm());

function blankForm(): ItemForm {
  return { id: 0, itemCode: '', itemName: '', sortNo: 0, remark: '', expectedVersion: 1, eventCategory: '', severity: '', responseGuidance: '', qualityIncluded: false, scoreType: '', ruleDefinitionText: '[]', applicableScenario: '', thresholdInterpretation: '' };
}

const canManage = computed(() => !useRealAnesthesiaDict() || canManageProfessional(permissions.value, props.categoryCode));

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : [];
  } catch { permissions.value = []; }
}
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadProfessionalItems(props.categoryCode, true); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}

function openCreate() { editing.value = null; isCreate.value = true; Object.assign(form, blankForm()); editorVisible.value = true; }
function openEdit(item: ProfessionalDictItem) {
  editing.value = item; isCreate.value = false;
  const p = (item.profile ?? {}) as Partial<EventProfile> & Partial<ScoreProfile>;
  Object.assign(form, {
    id: item.id, itemCode: item.itemCode, itemName: item.itemName, sortNo: item.sortNo, remark: item.remark ?? '', expectedVersion: item.version,
    eventCategory: p.eventCategory ?? '', severity: p.severity ?? '', responseGuidance: p.responseGuidance ?? '',
    qualityIncluded: !!p.qualityIncluded,
    scoreType: p.scoreType ?? '', ruleDefinitionText: p.ruleDefinition === undefined || p.ruleDefinition === null ? '[]' : JSON.stringify(p.ruleDefinition, null, 2),
    applicableScenario: p.applicableScenario ?? '', thresholdInterpretation: p.thresholdInterpretation ?? '',
  });
  editorVisible.value = true;
}
async function openHistory(item: ProfessionalDictItem) {
  historyVisible.value = true;
  try { history.value = await loadProfessionalHistory(props.entityType, item.id); } catch { history.value = []; }
}

async function onSave() {
  if (!form.itemCode.trim()) { Message.warning('编码不能为空'); return; }
  if (!form.itemName.trim()) { Message.warning('名称不能为空'); return; }
  let payload: Record<string, unknown> = {
    id: form.id, categoryCode: props.categoryCode, itemCode: form.itemCode.trim(), itemName: form.itemName.trim(),
    sortNo: form.sortNo,
    remark: form.remark || null, expectedVersion: form.expectedVersion,
  };
  if (isEvent.value) {
    payload = { ...payload, eventCategory: form.eventCategory || null, severity: form.severity || null, responseGuidance: form.responseGuidance || null, qualityIncluded: form.qualityIncluded ? 1 : 0 };
  } else {
    let rule: unknown;
    try { rule = JSON.parse(form.ruleDefinitionText || '[]'); } catch { Message.warning('评分规则必须为合法 JSON 数组'); return; }
    if (!Array.isArray(rule)) { Message.warning('评分规则必须为 JSON 数组'); return; }
    payload = { ...payload, scoreType: form.scoreType || null, ruleDefinition: rule, applicableScenario: form.applicableScenario || null, thresholdInterpretation: form.thresholdInterpretation || null };
  }
  saving.value = true;
  try {
    await saveProfessionalItem(payload);
    Message.success(isCreate.value ? '创建成功' : '更新成功');
    editorVisible.value = false;
    await reload();
  } catch (e) {
    if (e instanceof ProfessionalConflictError) Message.warning('数据已被其他人修改，请刷新后重试');
    else if (e instanceof Error) Message.error(e.message);
  } finally { saving.value = false; }
}

function onChangeStatus(item: ProfessionalDictItem, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { item, toStatus }; statusReason.value = ''; statusVisible.value = true;
}
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try {
    await changeProfessionalStatusConfig({ entityType: props.entityType, id: t.item.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.item.version });
    Message.success('状态变更成功'); statusVisible.value = false; await reload();
  } catch (e) {
    if (e instanceof ProfessionalConflictError) { Message.warning('数据已被其他人修改，请刷新后重试'); statusVisible.value = false; await reload(); }
    else if (e instanceof Error) Message.error(e.message);
  } finally { statusSaving.value = false; }
}

function ruleDimCount(item: ProfessionalDictItem): number {
  const rule = (item.profile as Partial<ScoreProfile> | null)?.ruleDefinition;
  return Array.isArray(rule) ? rule.length : 0;
}
function statusLabel(s: string): string { return ({ draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[s] ?? s) || '—'; }
function statusColor(s: string): string { return ({ enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[s] ?? 'gray'); }

watch(() => props.categoryCode, () => { reload(); });
onMounted(async () => { await loadPermissions(); await reload(); });
</script>

<style scoped>
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.field-row { display: flex; gap: 4px; margin-bottom: 8px; align-items: center; }
</style>
