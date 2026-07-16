<template>
  <ModulePageShell title="生命体征字典" description="维护含采集频率、设备来源、质控属性、正常范围、阈值、图表和状态的生命体征" shell-class="config-vitals-page">
    <ConfigTableShell title="生命体征列表">
      <template #title-tag><a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag></template>
      <template #extra><a-space><a-button @click="reload" :loading="loading">刷新</a-button><a-button v-if="canManage" type="primary" @click="openCreate">新增</a-button></a-space></template>
      <template #alerts>
        <a-alert v-if="loadError" type="error" show-icon style="margin-bottom:12px">加载失败：{{ loadError }}。</a-alert>
        <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom:12px">远程暂无数据。</a-alert>
        <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom:12px">无配置权限；仅可查看。</a-alert>
      </template>
      <a-table :data="(items as any)" row-key="id" :loading="loading" :pagination="false" size="medium" :scroll="{ x: 1110 }">
        <template #empty><a-empty description="暂无生命体征" /></template>
        <template #columns>
          <a-table-column title="编码" :width="150"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.code">{{ record.code }}</span></template></a-table-column>
          <a-table-column title="名称" :width="160"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.itemName">{{ record.itemName }}</span></template></a-table-column>
          <a-table-column title="单位" :width="90"><template #cell="{ record }">{{ record.unit || '—' }}</template></a-table-column>
          <a-table-column title="正常范围" :width="130"><template #cell="{ record }">{{ record.normalRange || '—' }}</template></a-table-column>
          <a-table-column title="采集频率(秒)" :width="130"><template #cell="{ record }">{{ record.samplingIntervalSeconds || '—' }}</template></a-table-column>
          <a-table-column title="质控属性" :width="120"><template #cell="{ record }">{{ record.qualityAttribute || '—' }}</template></a-table-column>
          <a-table-column title="版本" :width="80"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="140" fixed="right">
            <template #cell="{ record }">
              <ConfigRowActions :actions="rowActions(record)" @action="(key: string) => onRowAction(record, key)" />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </ConfigTableShell>
    <a-drawer :visible="editorVisible" :width="600" :title="isCreate ? '新增生命体征' : '编辑生命体征'" :mask-closable="false" unmount-on-close @cancel="editorVisible = false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="编码" required><a-input v-model="form.code" :disabled="!isCreate" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="短码"><a-input v-model="form.shortCode" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="名称" required><a-input v-model="form.itemName" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6"><a-form-item label="单位"><a-input v-model="form.unit" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="正常范围"><a-input v-model="form.normalRange" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="下限"><a-input v-model="form.lowerLimit" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="上限"><a-input v-model="form.upperLimit" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6"><a-form-item label="默认值"><a-input v-model="form.defaultValue" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="小数位"><a-input-number v-model="form.decimalPlaces" :min="0" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="采集频率(秒)"><a-input-number v-model="form.samplingIntervalSeconds" :min="1" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="质控属性"><a-input v-model="form.qualityAttribute" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="6"><a-form-item label="图表开关"><a-switch v-model="form.chartEnabled" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="图表颜色"><a-input v-model="form.chartColor" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="图表符号"><a-input v-model="form.chartSymbol" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="排序"><a-input-number v-model="form.sortNo" :min="0" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="设备来源（scope）">
          <div v-for="(sc, idx) in form.scopes" :key="idx" class="scope-row">
            <a-select v-model="sc.scopeType" :style="{ width: '150px' }" :options="vitalScopeOptions" />
            <a-input v-model="sc.scopeCode" placeholder="设备来源编码" :style="{ flex: 1 }" />
            <a-input v-model="sc.scopeName" placeholder="名称" :style="{ flex: 1 }" />
            <a-button status="danger" size="small" @click="form.scopes.splice(idx, 1)">移除</a-button>
          </div>
          <a-button type="dashed" size="small" @click="form.scopes.push({ scopeType: 'device_source', scopeCode: '', scopeName: '' })">添加设备来源</a-button>
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
import ConfigTableShell from '@/components/config/ConfigTableShell.vue';
import ConfigRowActions, { type ConfigRowAction } from '@/components/config/ConfigRowActions.vue';
import { authApi } from '@/api/auth';
import { loadClinicalDictionary, saveClinicalDictionary, changeClinicalDictionaryStatus, loadClinicalDictionaryHistory, canManageClinical, ClinicalConflictError } from '@/services/configuration/clinicalDictionaryService';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const ENTITY = 'vital' as const;
const items = ref<any[]>([]);
const loading = ref(false); const loadError = ref(''); const source = ref<'remote'|'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false); const isCreate = ref(true); const saving = ref(false);
const form = reactive<Record<string, any>>({ scopes: [] });
const statusVisible = ref(false); const statusSaving = ref(false); const statusReason = ref('');
const statusTarget = ref<{ id: number; version: number; toStatus: 'enabled'|'paused'|'disabled' } | null>(null);
const historyVisible = ref(false); const history = ref<any[]>([]);
const canManage = computed(() => !useRealAnesthesiaDict() || canManageClinical(permissions.value, ENTITY));
const vitalScopeOptions = [{ label: '适用范围', value: 'applicable_scope' }, { label: '设备来源', value: 'device_source' }];
async function loadPerms() { try { const r = await authApi.myPermissions(); permissions.value = Array.isArray(r?.permissions) ? r.permissions.map(String) : []; } catch { permissions.value = []; } }
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadClinicalDictionary(ENTITY, { allStatus: true }); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}
function blank() {
  return { id: 0, code: '', shortCode: '', itemName: '', unit: '', normalRange: '', lowerLimit: null, upperLimit: null, defaultValue: '',
    chartEnabled: true, chartColor: '', chartSymbol: '', decimalPlaces: 0, samplingIntervalSeconds: null, qualityAttribute: '',
    sortNo: 0, remark: '', expectedVersion: 1, scopes: [] };
}
function openCreate() { isCreate.value = true; Object.assign(form, blank()); editorVisible.value = true; }
function openEdit(r: any) {
  isCreate.value = false; Object.assign(form, blank(), {
    id: r.id, code: r.code, shortCode: r.shortCode ?? '', itemName: r.itemName, unit: r.unit ?? '', normalRange: r.normalRange ?? '',
    lowerLimit: r.lowerLimit ?? null, upperLimit: r.upperLimit ?? null, defaultValue: r.defaultValue ?? '',
    chartEnabled: r.chartEnabled ?? true, chartColor: r.chartColor ?? '', chartSymbol: r.chartSymbol ?? '', decimalPlaces: r.decimalPlaces ?? 0,
    samplingIntervalSeconds: r.samplingIntervalSeconds ?? null, qualityAttribute: r.qualityAttribute ?? '',
    sortNo: r.sortNo ?? 0, remark: r.remark ?? '', expectedVersion: r.version,
    scopes: (r.scopes || []).map((s: any) => ({ scopeType: s.scopeType ?? 'device_source', scopeCode: s.scopeCode ?? '', scopeName: s.scopeName ?? '' })),
  });
  editorVisible.value = true;
}
async function onSave() {
  if (!String(form.code || '').trim()) { Message.warning('编码不能为空'); return; }
  if (!String(form.itemName || '').trim()) { Message.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload: Record<string, any> = { entityType: ENTITY };
    Object.assign(payload, form);
    if (!isCreate.value) { payload.id = form.id; payload.expectedVersion = form.expectedVersion; }
    else { delete payload.id; delete payload.expectedVersion; }
    payload.scopes = (form.scopes || []).filter((s: any) => s.scopeCode?.trim()).map((s: any) => ({ scopeType: s.scopeType, scopeCode: s.scopeCode.trim(), scopeName: s.scopeName || null }));
    await saveClinicalDictionary(payload); Message.success('保存成功'); await reload(); editorVisible.value = false;
  } catch (e) { if (e instanceof ClinicalConflictError) Message.warning('数据已被其他人修改，请刷新后重试'); else if (e instanceof Error) Message.error(e.message); }
  finally { saving.value = false; }
}
function onChangeStatus(r: any, to: 'enabled'|'paused'|'disabled') { statusTarget.value = { id: Number(r.id), version: Number(r.version), toStatus: to }; statusReason.value = ''; statusVisible.value = true; }

function rowActions(r: any): ConfigRowAction[] {
  return [
    { key: 'edit', label: '编辑', primary: true, hidden: !canManage.value },
    { key: 'history', label: '历史' },
    { key: 'pause', label: '暂停', hidden: !canManage.value || r.status !== 'enabled' },
    { key: 'enable', label: '启用', hidden: !canManage.value || r.status !== 'paused' },
    { key: 'disable', label: '停用', danger: true, hidden: !canManage.value || r.status === 'disabled' },
  ];
}
function onRowAction(r: any, key: string) {
  if (key === 'edit') openEdit(r);
  else if (key === 'history') openHistory(r);
  else if (key === 'pause') onChangeStatus(r, 'paused');
  else if (key === 'enable') onChangeStatus(r, 'enabled');
  else if (key === 'disable') onChangeStatus(r, 'disabled');
}
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try { await changeClinicalDictionaryStatus({ entityType: ENTITY, id: t.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.version }); Message.success('状态变更成功'); statusVisible.value = false; await reload(); }
  catch (e) { if (e instanceof ClinicalConflictError) { Message.warning('数据已被其他人修改，请刷新后重试'); statusVisible.value = false; await reload(); } else if (e instanceof Error) Message.error(e.message); }
  finally { statusSaving.value = false; }
}
async function openHistory(r: any) { historyVisible.value = true; try { history.value = await loadClinicalDictionaryHistory(ENTITY, Number(r.id)); } catch { history.value = []; } }
function statusLabel(s: string): string { return ({ enabled: '启用', paused: '暂停', disabled: '停用' }[s] ?? s) || '—'; }
function statusColor(s: string): string { return ({ enabled: 'green', paused: 'orange', disabled: 'red' }[s] ?? 'gray'); }
onMounted(async () => { await loadPerms(); await reload(); });
</script>
<style scoped>
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
</style>
