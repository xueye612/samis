<template>
  <ModulePageShell title="液体与血制品字典" description="维护液体和血制品的规格、容量、速度、血型要求、统计分类、适用场景和生命周期" shell-class="config-fluids-page">
    <a-card :bordered="false">
      <template #title><a-tabs v-model:active-key="activeEntity" @change="reload">
        <a-tab-pane key="fluid" title="液体" />
        <a-tab-pane key="blood" title="血制品" />
      </a-tabs></template>
      <template #extra><a-space><a-button @click="reload" :loading="loading">刷新</a-button><a-button v-if="canManage" type="primary" @click="openCreate">新增</a-button></a-space></template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom:12px">加载失败：{{ loadError }}。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom:12px">远程暂无数据。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom:12px">无配置权限；仅可查看。</a-alert>
      <a-table :data="(items as any)" row-key="id" :loading="loading" :pagination="false" size="medium">
        <template #empty><a-empty description="暂无数据" /></template>
        <template #columns>
          <a-table-column title="编码"><template #cell="{ record }">{{ activeEntity === 'fluid' ? record.fluidCode : record.productCode }}</template></a-table-column>
          <a-table-column title="名称"><template #cell="{ record }">{{ activeEntity === 'fluid' ? record.fluidName : record.productName }}</template></a-table-column>
          <a-table-column title="规格"><template #cell="{ record }">{{ record.specification || '—' }}</template></a-table-column>
          <a-table-column v-if="activeEntity === 'blood'" title="血型要求"><template #cell="{ record }">{{ record.bloodTypeRequirement || '—' }}</template></a-table-column>
          <a-table-column title="默认速度"><template #cell="{ record }">{{ record.defaultRate || '—' }}</template></a-table-column>
          <a-table-column title="统计分类"><template #cell="{ record }">{{ record.statisticalCategory || '—' }}</template></a-table-column>
          <a-table-column title="版本" :width="70"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="280">
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
    <a-drawer :visible="editorVisible" :width="580" :title="isCreate ? '新增' : '编辑'" :mask-closable="false" unmount-on-close @cancel="editorVisible = false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="编码" required><a-input v-model="form.code" :disabled="!isCreate" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="名称" required><a-input v-model="form.name" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="规格"><a-input v-model="form.specification" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6"><a-form-item label="默认容量"><a-input v-model="form.defaultVolume" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="默认单位"><a-input v-model="form.defaultUnit" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="默认速度"><a-input v-model="form.defaultRate" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="统计分类"><a-input v-model="form.statisticalCategory" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="适用场景"><a-input v-model="form.applicableScenario" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="计入入量"><a-switch v-model="form.isCountInput" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
        </a-row>
        <template v-if="activeEntity === 'blood'">
          <a-row :gutter="12">
            <a-col :span="8"><a-form-item label="血型要求"><a-input v-model="form.bloodTypeRequirement" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="双人核对"><a-switch v-model="form.doubleCheck" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="分类"><a-input v-model="form.productCategory" /></a-form-item></a-col>
          </a-row>
        </template>
        <template v-else>
          <a-row :gutter="12">
            <a-col :span="8"><a-form-item label="分类"><a-input v-model="form.fluidType" /></a-form-item></a-col>
          </a-row>
        </template>
        <a-form-item label="适用范围">
          <div v-for="(sc, idx) in form.scopes" :key="idx" class="scope-row">
            <a-select v-model="sc.scopeType" :style="{ width: '150px' }" :options="scopeTypeOptions" />
            <a-input v-model="sc.scopeCode" placeholder="编码" :style="{ flex: 1 }" />
            <a-input v-model="sc.scopeName" placeholder="名称" :style="{ flex: 1 }" />
            <a-button status="danger" size="small" @click="form.scopes.splice(idx, 1)">移除</a-button>
          </div>
          <a-button type="dashed" size="small" @click="form.scopes.push({ scopeType: 'applicable_scope', scopeCode: '', scopeName: '' })">添加范围</a-button>
        </a-form-item>
        <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
      </a-form>
      <template #footer><a-space><a-button @click="editorVisible = false">取消</a-button><a-button type="primary" :loading="saving" @click="onSave">保存</a-button></a-space></template>
    </a-drawer>
    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required><a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}？</a-form-item>
      </a-form>
    </a-modal>
    <a-drawer :visible="historyVisible" :width="500" title="状态变更历史" unmount-on-close @cancel="historyVisible = false">
      <a-empty v-if="!history.length" description="暂无状态变更记录" />
      <a-timeline v-else><a-timeline-item v-for="h in history" :key="h.id">
        <span v-if="h.fromStatus">{{ statusLabel(h.fromStatus) }} → </span><a-tag :color="statusColor(h.toStatus)">{{ statusLabel(h.toStatus) }}</a-tag>
        <div style="color:var(--color-text-3);font-size:12px">版本 {{ h.version }} · {{ h.actor ?? '系统' }} · {{ h.occurredAt ?? '—' }}</div>
        <div v-if="h.reason" style="font-size:13px">原因：{{ h.reason }}</div>
      </a-timeline-item></a-timeline>
    </a-drawer>
  </ModulePageShell>
</template>
<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { computed, onMounted, reactive, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { authApi } from '@/api/auth';
import { loadClinicalDictionary, saveClinicalDictionary, changeClinicalDictionaryStatus, loadClinicalDictionaryHistory, canManageClinical, ClinicalConflictError, type ClinicalEntity } from '@/services/configuration/clinicalDictionaryService';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const activeEntity = ref<ClinicalEntity>('fluid');
const items = ref<any[]>([]);
const loading = ref(false); const loadError = ref(''); const source = ref<'remote'|'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false); const isCreate = ref(true); const saving = ref(false);
const form = reactive<Record<string, any>>({ scopes: [] });
const statusVisible = ref(false); const statusSaving = ref(false); const statusReason = ref('');
const statusTarget = ref<{ id: number; version: number; toStatus: 'enabled'|'paused'|'disabled' } | null>(null);
const historyVisible = ref(false); const history = ref<any[]>([]);
const canManage = computed(() => !useRealAnesthesiaDict() || canManageClinical(permissions.value, activeEntity.value));
const scopeTypeOptions = [
  { label: '适用范围', value: 'applicable_scope' },
  { label: '科室', value: 'department' },
  { label: '手术类型', value: 'operation_type' },
  { label: '麻醉方式', value: 'anesthesia_method' },
];
async function loadPerms() { try { const r = await authApi.myPermissions(); permissions.value = Array.isArray(r?.permissions) ? r.permissions.map(String) : []; } catch { permissions.value = []; } }
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadClinicalDictionary(activeEntity.value, { allStatus: true }); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}
function codeKey() { return activeEntity.value === 'fluid' ? 'fluidCode' : 'productCode'; }
function nameKey() { return activeEntity.value === 'fluid' ? 'fluidName' : 'productName'; }
function blank() {
  const b: Record<string, any> = { id: 0, code: '', name: '', specification: '', defaultVolume: '', defaultUnit: '', defaultRate: '', statisticalCategory: '', applicableScenario: '', isCountInput: false, sortNo: 0, remark: '', expectedVersion: 1, scopes: [] };
  if (activeEntity.value === 'blood') { b.bloodTypeRequirement = ''; b.doubleCheck = true; b.productCategory = ''; }
  else { b.fluidType = ''; b.defaultVolume = ''; }
  return b;
}
function openCreate() { isCreate.value = true; Object.assign(form, blank()); editorVisible.value = true; }
function openEdit(r: any) {
  isCreate.value = false;
  const b = blank();
  b.id = r.id;
  b.code = r[codeKey()]; b.name = r[nameKey()]; b.specification = r.specification ?? ''; b.defaultUnit = r.defaultUnit ?? ''; b.defaultRate = r.defaultRate ?? '';
  b.defaultVolume = r.defaultVolume ?? '';
  b.statisticalCategory = r.statisticalCategory ?? ''; b.applicableScenario = r.applicableScenario ?? ''; b.isCountInput = !!r.isCountInput; b.sortNo = r.sortNo ?? 0;
  b.remark = r.remark ?? ''; b.expectedVersion = r.version;
  if (activeEntity.value === 'blood') { b.bloodTypeRequirement = r.bloodTypeRequirement ?? ''; b.doubleCheck = !!r.doubleCheck; b.productCategory = r.productCategory ?? ''; }
  else { b.fluidType = r.fluidType ?? ''; b.defaultVolume = r.defaultVolume ?? ''; }
  b.scopes = (r.scopes || []).map((s: any) => ({ scopeType: s.scopeType ?? 'applicable_scope', scopeCode: s.scopeCode ?? '', scopeName: s.scopeName ?? '' }));
  Object.assign(form, b); editorVisible.value = true;
}
async function onSave() {
  if (!String(form.code || '').trim()) { Message.warning('编码不能为空'); return; }
  if (!String(form.name || '').trim()) { Message.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload: Record<string, any> = { entityType: activeEntity.value };
    payload[codeKey()] = form.code.trim(); payload[nameKey()] = form.name.trim();
    if (form.id) { payload.id = form.id; payload.expectedVersion = form.expectedVersion; }
    payload.specification = form.specification || null; payload.defaultUnit = form.defaultUnit || null;
    payload.defaultVolume = form.defaultVolume || null;
    payload.defaultRate = form.defaultRate || null; payload.statisticalCategory = form.statisticalCategory || null;
    payload.applicableScenario = form.applicableScenario || null; payload.isCountInput = form.isCountInput ? 1 : 0;
    payload.sortNo = form.sortNo; payload.remark = form.remark || null;
    if (activeEntity.value === 'blood') { payload.bloodTypeRequirement = form.bloodTypeRequirement || null; payload.doubleCheck = form.doubleCheck ? 1 : 0; payload.productCategory = form.productCategory || null; }
    else { payload.fluidType = form.fluidType || null; payload.defaultVolume = form.defaultVolume || null; }
    payload.scopes = (form.scopes || []).filter((s: any) => s.scopeCode?.trim()).map((s: any) => ({ scopeType: s.scopeType, scopeCode: s.scopeCode.trim(), scopeName: s.scopeName || null }));
    await saveClinicalDictionary(payload); Message.success('保存成功'); await reload(); editorVisible.value = false;
  } catch (e) { if (e instanceof ClinicalConflictError) Message.warning('数据已被其他人修改，请刷新后重试'); else if (e instanceof Error) Message.error(e.message); }
  finally { saving.value = false; }
}
function onChangeStatus(r: any, to: 'enabled'|'paused'|'disabled') { statusTarget.value = { id: Number(r.id), version: Number(r.version), toStatus: to }; statusReason.value = ''; statusVisible.value = true; }
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try { await changeClinicalDictionaryStatus({ entityType: activeEntity.value, id: t.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.version }); Message.success('状态变更成功'); statusVisible.value = false; await reload(); }
  catch (e) { if (e instanceof ClinicalConflictError) { Message.warning('数据已被其他人修改，请刷新后重试'); statusVisible.value = false; await reload(); } else if (e instanceof Error) Message.error(e.message); }
  finally { statusSaving.value = false; }
}
async function openHistory(r: any) { historyVisible.value = true; try { history.value = await loadClinicalDictionaryHistory(activeEntity.value, Number(r.id)); } catch { history.value = []; } }
function statusLabel(s: string): string { return ({ enabled: '启用', paused: '暂停', disabled: '停用' }[s] ?? s) || '—'; }
function statusColor(s: string): string { return ({ enabled: 'green', paused: 'orange', disabled: 'red' }[s] ?? 'gray'); }
onMounted(async () => { await loadPerms(); await reload(); });
</script>
<style scoped>
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
</style>
