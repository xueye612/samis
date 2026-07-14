<template>
  <ModulePageShell title="药品字典管理" description="维护含通用名、浓度、剂型、剂量范围、分类、适用范围、状态和版本的药品" shell-class="config-drugs-page">
    <a-card :bordered="false">
      <template #title><a-space><span>药品列表</span><a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag></a-space></template>
      <template #extra><a-space><a-button @click="reload" :loading="loading">刷新</a-button><a-button v-if="canManage" type="primary" @click="openCreate">新增药品</a-button></a-space></template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom:12px">加载药品失败：{{ loadError }}。可点击刷新重试。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom:12px">远程暂无药品数据。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom:12px">无药品配置权限（config.drug.manage）；仅可查看。</a-alert>
      <a-table :data="(items as any)" row-key="id" :loading="loading" :pagination="false" size="medium">
        <template #empty><a-empty description="暂无药品" /></template>
        <template #columns>
          <a-table-column title="编码" data-index="drugCode" />
          <a-table-column title="名称" data-index="drugName" />
          <a-table-column title="通用名"><template #cell="{ record }">{{ record.genericName || '—' }}</template></a-table-column>
          <a-table-column title="浓度"><template #cell="{ record }">{{ record.concentration || '—' }}</template></a-table-column>
          <a-table-column title="剂量范围"><template #cell="{ record }">{{ record.minDose ?? '—' }}~{{ record.maxDose ?? '—' }}</template></a-table-column>
          <a-table-column title="版本" :width="70"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="240">
            <template #cell="{ record }">
              <a-space wrap>
                <a-button size="small" @click="openHistory(record)">历史</a-button>
                <a-button v-if="canManage" size="small" @click="openEdit(record)">编辑</a-button>
                <a-button v-if="canManage && record.status === 'enabled'" size="small" @click="onChangeStatus(record, 'paused')">暂停</a-button>
                <a-button v-if="canManage && record.status !== 'disabled'" size="small" status="warning" @click="onChangeStatus(record, 'disabled')">停用</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer :visible="editorVisible" :width="600" :title="isCreate ? '新增药品' : '编辑药品'" :mask-closable="false" unmount-on-close @cancel="editorVisible = false">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="编码" required><a-input v-model="form.drugCode" :disabled="!isCreate" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="名称" required><a-input v-model="form.drugName" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="通用名"><a-input v-model="form.genericName" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="商品名"><a-input v-model="form.brandName" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="浓度"><a-input v-model="form.concentration" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="最小剂量"><a-input v-model="form.minDose" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="最大剂量"><a-input v-model="form.maxDose" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="统计分类"><a-input v-model="form.statisticalCategory" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
      </a-form>
      <template #footer><a-space><a-button @click="editorVisible = false">取消</a-button><a-button type="primary" :loading="saving" @click="onSave">保存</a-button></a-space></template>
    </a-drawer>

    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) + '药品' : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required><a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" /></a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}？</a-form-item>
      </a-form>
    </a-modal>
    <a-drawer :visible="historyVisible" :width="500" title="药品状态变更历史" unmount-on-close @cancel="historyVisible = false">
      <a-empty v-if="!history.length" description="暂无状态变更记录" />
      <a-timeline v-else><a-timeline-item v-for="h in history" :key="h.id"><a-tag :color="statusColor(h.toStatus)">{{ statusLabel(h.toStatus) }}</a-tag><div style="color:var(--color-text-3);font-size:12px">版本 {{ h.version }} · {{ h.actor ?? '系统' }} · {{ h.occurredAt ?? '—' }}</div><div v-if="h.reason" style="font-size:13px">原因：{{ h.reason }}</div></a-timeline-item></a-timeline>
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

const ENTITY = 'drug' as const;
const items = ref<any[]>([]);
const loading = ref(false); const loadError = ref(''); const source = ref<'remote'|'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false); const isCreate = ref(true); const saving = ref(false);
const form = reactive<Record<string, any>>({});
const statusVisible = ref(false); const statusSaving = ref(false); const statusReason = ref('');
const statusTarget = ref<{ id: number; version: number; toStatus: 'enabled'|'paused'|'disabled' } | null>(null);
const historyVisible = ref(false); const history = ref<any[]>([]);
const canManage = computed(() => !useRealAnesthesiaDict() || canManageClinical(permissions.value, ENTITY));

async function loadPerms() { try { const r = await authApi.myPermissions(); permissions.value = Array.isArray(r?.permissions) ? r.permissions.map(String) : []; } catch { permissions.value = []; } }
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadClinicalDictionary(ENTITY, { allStatus: true }); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}
function blank() { return { drugCode: '', drugName: '', genericName: '', brandName: '', concentration: '', minDose: null, maxDose: null, statisticalCategory: '', remark: '', expectedVersion: 1 }; }
function openCreate() { isCreate.value = true; Object.assign(form, blank()); editorVisible.value = true; }
function openEdit(r: any) { isCreate.value = false; Object.assign(form, blank(), r, { expectedVersion: r.version }); editorVisible.value = true; }
async function onSave() {
  if (!String(form.drugCode || '').trim()) { Message.warning('编码不能为空'); return; }
  if (!String(form.drugName || '').trim()) { Message.warning('名称不能为空'); return; }
  saving.value = true;
  try { await saveClinicalDictionary({ entityType: ENTITY, ...form }); Message.success('保存成功'); editorVisible.value = false; await reload(); }
  catch (e) { if (e instanceof ClinicalConflictError) Message.warning('数据已被其他人修改，请刷新后重试'); else if (e instanceof Error) Message.error(e.message); }
  finally { saving.value = false; }
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
