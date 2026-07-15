<template>
  <ModulePageShell title="模板管理" description="维护模板与字段集合结构化配置，原子保存、版本、生命周期和刷新回读" shell-class="config-print-page">
    <a-card :bordered="false">
      <template #title><a-space><span>模板列表</span><a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag></a-space></template>
      <template #extra><a-space><a-button @click="reload" :loading="loading">刷新</a-button><a-button v-if="canManage" type="primary" @click="openCreate">新增模板</a-button></a-space></template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom:12px">加载模板失败：{{ loadError }}。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom:12px">远程暂无模板数据。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom:12px">无模板配置权限；仅可查看。</a-alert>
      <a-table :data="(items as any)" row-key="id" :loading="loading" :pagination="false" size="medium">
        <template #empty><a-empty description="暂无模板" /></template>
        <template #columns>
          <a-table-column title="编码"><template #cell="{ record }">{{ record.templateCode }}</template></a-table-column>
          <a-table-column title="名称"><template #cell="{ record }">{{ record.templateName }}</template></a-table-column>
          <a-table-column title="类型"><template #cell="{ record }">{{ record.templateType || '—' }}</template></a-table-column>
          <a-table-column title="适用麻醉方式"><template #cell="{ record }">{{ record.applicableAnesthesiaMethod || '—' }}</template></a-table-column>
          <a-table-column title="字段数" :width="80"><template #cell="{ record }">{{ (record.fields || []).length }}</template></a-table-column>
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
    <a-drawer :visible="editorVisible" :width="720" :title="isCreate ? '新增模板' : '编辑模板'" :mask-closable="false" unmount-on-close @cancel="editorVisible = false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="6"><a-form-item label="编码" required><a-input v-model="form.templateCode" :disabled="!isCreate" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="名称" required><a-input v-model="form.templateName" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="类型"><a-input v-model="form.templateType" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="默认模板"><a-switch v-model="form.isDefault" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="适用麻醉方式"><a-input v-model="form.applicableAnesthesiaMethod" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="适用科室"><a-input v-model="form.applicableDepartment" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="适用手术类型"><a-input v-model="form.applicableSurgeryType" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="适用范围">
          <div v-for="(sc, idx) in form.scopes" :key="idx" class="scope-row">
            <a-select v-model="sc.scopeType" :style="{ width: '130px' }" :options="templateScopeOptions" />
            <a-input v-model="sc.scopeCode" placeholder="编码" :style="{ flex: 1 }" />
            <a-input v-model="sc.scopeName" placeholder="名称" :style="{ flex: 1 }" />
            <a-button status="danger" size="small" @click="form.scopes.splice(idx, 1)">移除</a-button>
          </div>
          <a-button type="dashed" size="small" @click="form.scopes.push({ scopeType: 'anesthesia_method', scopeCode: '', scopeName: '' })">添加范围</a-button>
        </a-form-item>
        <a-form-item label="模板字段（原子保存，支持 section/code/name/type/unit/default/placeholder/required/print/sort/optionGroup/displayRule/validationRule）">
          <div v-for="(f, idx) in form.fields" :key="idx" class="field-card">
            <a-row :gutter="8">
              <a-col :span="5"><a-input v-model="f.sectionCode" placeholder="分区编码" /></a-col>
              <a-col :span="5"><a-input v-model="f.fieldCode" placeholder="字段编码*" /></a-col>
              <a-col :span="6"><a-input v-model="f.fieldName" placeholder="字段名称*" /></a-col>
              <a-col :span="5"><a-select v-model="f.fieldType" :options="fieldTypeOptions" /></a-col>
              <a-col :span="3"><a-button status="danger" size="small" @click="form.fields.splice(idx, 1)">移除</a-button></a-col>
            </a-row>
            <a-row :gutter="8" class="field-card-row">
              <a-col :span="4"><a-input v-model="f.unit" placeholder="单位" /></a-col>
              <a-col :span="5"><a-input v-model="f.defaultValue" placeholder="默认值" /></a-col>
              <a-col :span="6"><a-input v-model="f.placeholder" placeholder="输入提示" /></a-col>
              <a-col :span="5"><a-input v-model="f.optionGroupCode" placeholder="选项组编码" /></a-col>
              <a-col :span="4"><a-input-number v-model="f.sortNo" placeholder="排序" :min="0" /></a-col>
            </a-row>
            <a-row :gutter="8" class="field-card-row">
              <a-col :span="10"><a-input v-model="f.displayRule" placeholder="显示规则 JSON" /></a-col>
              <a-col :span="10"><a-input v-model="f.validationRule" placeholder="校验规则 JSON" /></a-col>
              <a-col :span="2"><a-tooltip content="必填"><a-switch v-model="f.isRequired" /></a-tooltip></a-col>
              <a-col :span="2"><a-tooltip content="打印"><a-switch v-model="f.isPrint" /></a-tooltip></a-col>
            </a-row>
          </div>
          <a-button type="dashed" size="small" @click="addField">添加字段</a-button>
        </a-form-item>
        <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
      </a-form>
      <template #footer><a-space><a-button @click="editorVisible = false">取消</a-button><a-button type="primary" :loading="saving" @click="onSave">保存</a-button></a-space></template>
    </a-drawer>
    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) + '模板' : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required><a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}？</a-form-item>
      </a-form>
    </a-modal>
    <a-drawer :visible="historyVisible" :width="500" title="模板状态变更历史" unmount-on-close @cancel="historyVisible = false">
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
import { loadClinicalDictionary, saveClinicalDictionary, changeClinicalDictionaryStatus, loadClinicalDictionaryHistory, canManageClinical, ClinicalConflictError } from '@/services/configuration/clinicalDictionaryService';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const ENTITY = 'template' as const;
const items = ref<any[]>([]);
const loading = ref(false); const loadError = ref(''); const source = ref<'remote'|'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false); const isCreate = ref(true); const saving = ref(false);
const form = reactive<Record<string, any>>({ fields: [], scopes: [] });
const statusVisible = ref(false); const statusSaving = ref(false); const statusReason = ref('');
const statusTarget = ref<{ id: number; version: number; toStatus: 'enabled'|'paused'|'disabled' } | null>(null);
const historyVisible = ref(false); const history = ref<any[]>([]);
const canManage = computed(() => !useRealAnesthesiaDict() || canManageClinical(permissions.value, ENTITY));
const templateScopeOptions = [{ label: '麻醉方式', value: 'anesthesia_method' }, { label: '科室', value: 'department' }, { label: '手术类型', value: 'surgery_type' }];
const fieldTypeOptions = [
  { label: 'text', value: 'text' }, { label: 'number', value: 'number' }, { label: 'date', value: 'date' },
  { label: 'time', value: 'time' }, { label: 'datetime', value: 'datetime' }, { label: 'select', value: 'select' },
  { label: 'textarea', value: 'textarea' }, { label: 'checkbox', value: 'checkbox' }, { label: 'radio', value: 'radio' },
  { label: 'table', value: 'table' }, { label: 'section', value: 'section' }, { label: 'label', value: 'label' },
];
async function loadPerms() { try { const r = await authApi.myPermissions(); permissions.value = Array.isArray(r?.permissions) ? r.permissions.map(String) : []; } catch { permissions.value = []; } }
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadClinicalDictionary(ENTITY, { allStatus: true }); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}
function addField() {
  form.fields.push({ sectionCode: '', fieldCode: '', fieldName: '', fieldType: 'text', unit: '', defaultValue: '', placeholder: '',
    isRequired: false, isPrint: true, sortNo: form.fields.length + 1, optionGroupCode: '', displayRule: '', validationRule: '' });
}
function blank() {
  return { id: 0, templateCode: '', templateName: '', templateType: '', isDefault: false,
    applicableAnesthesiaMethod: '', applicableDepartment: '', applicableSurgeryType: '',
    sortNo: 0, remark: '', expectedVersion: 1, fields: [], scopes: [] };
}
function openCreate() { isCreate.value = true; Object.assign(form, blank()); editorVisible.value = true; }
function openEdit(r: any) {
  isCreate.value = false;
  Object.assign(form, blank(), {
    id: r.id, templateCode: r.templateCode, templateName: r.templateName, templateType: r.templateType ?? '',
    isDefault: !!r.isDefault, applicableAnesthesiaMethod: r.applicableAnesthesiaMethod ?? '',
    applicableDepartment: r.applicableDepartment ?? '', applicableSurgeryType: r.applicableSurgeryType ?? '',
    sortNo: r.sortNo ?? 0, remark: r.remark ?? '', expectedVersion: r.version,
    fields: (r.fields || []).map((f: any) => ({
      sectionCode: f.sectionCode ?? '',
      fieldCode: f.fieldCode ?? '', fieldName: f.fieldName ?? '', fieldType: f.fieldType ?? 'text',
      unit: f.unit ?? '', defaultValue: f.defaultValue ?? '', placeholder: f.placeholder ?? '',
      isRequired: !!f.isRequired, isPrint: f.isPrint == null ? true : !!f.isPrint, sortNo: f.sortNo ?? 0,
      optionGroupCode: f.optionGroupCode ?? '', displayRule: ruleText(f.displayRule), validationRule: ruleText(f.validationRule),
    })),
    scopes: (r.scopes || []).map((s: any) => ({ scopeType: s.scopeType ?? 'anesthesia_method', scopeCode: s.scopeCode ?? '', scopeName: s.scopeName ?? '' })),
  });
  editorVisible.value = true;
}
async function onSave() {
  if (!String(form.templateCode || '').trim()) { Message.warning('编码不能为空'); return; }
  if (!String(form.templateName || '').trim()) { Message.warning('名称不能为空'); return; }
  saving.value = true;
  try {
    const payload: Record<string, any> = {
      entityType: ENTITY, templateCode: form.templateCode.trim(), templateName: form.templateName.trim(),
      templateType: form.templateType || null, isDefault: form.isDefault ? 1 : 0,
      applicableAnesthesiaMethod: form.applicableAnesthesiaMethod || null, applicableDepartment: form.applicableDepartment || null,
      applicableSurgeryType: form.applicableSurgeryType || null, sortNo: form.sortNo, remark: form.remark || null,
      fields: (form.fields || []).filter((f: any) => f.fieldCode?.trim()).map((f: any) => ({
        sectionCode: f.sectionCode || null,
        fieldCode: f.fieldCode.trim(), fieldName: f.fieldName || null, fieldType: f.fieldType || 'text',
        unit: f.unit || null, defaultValue: f.defaultValue || null, placeholder: f.placeholder || null,
        isRequired: !!f.isRequired, isPrint: !!f.isPrint, sortNo: f.sortNo ?? 0,
        optionGroupCode: f.optionGroupCode || null, displayRule: f.displayRule || null, validationRule: f.validationRule || null,
      })),
      scopes: (form.scopes || []).filter((s: any) => s.scopeCode?.trim()).map((s: any) => ({ scopeType: s.scopeType, scopeCode: s.scopeCode.trim(), scopeName: s.scopeName || null })),
    };
    if (!isCreate.value) { payload.id = form.id; payload.expectedVersion = form.expectedVersion; }
    await saveClinicalDictionary(payload); Message.success('保存成功'); await reload(); editorVisible.value = false;
  } catch (e) { if (e instanceof ClinicalConflictError) Message.warning('数据已被其他人修改，请刷新后重试'); else if (e instanceof Error) Message.error(e.message); }
  finally { saving.value = false; }
}
function ruleText(value: unknown): string {
  if (value == null || value === '') return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
function onChangeStatus(r: any, to: 'enabled'|'paused'|'disabled') { statusTarget.value = { id: Number(r.id), version: Number(r.version), toStatus: to }; statusReason.value = ''; statusVisible.value = true; }
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
.field-card { border: 1px solid var(--color-border-2); border-radius: 6px; padding: 10px; margin-bottom: 10px; width: 100%; }
.field-card-row { margin-top: 8px; }
</style>
