<template>
  <ModulePageShell title="麻醉人员管理" description="维护含工号、职称、专业组、授权、岗位、工作区、有效期与状态的结构化人员" shell-class="config-staff-page">
    <ConfigTableShell title="人员列表">
      <template #title-tag>
        <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button v-if="canManage" type="primary" @click="openCreate">新增人员</a-button>
        </a-space>
      </template>

      <template #alerts>
        <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">加载人员失败：{{ loadError }}。可点击刷新重试。</a-alert>
        <a-alert v-else-if="!loading && source === 'remote' && !staff.length" type="warning" show-icon style="margin-bottom: 12px">远程暂无人员数据，表格为空属正常状态，可在本页新增。</a-alert>
        <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">无人员配置权限（config.staff.manage）；仅可查看，写动作已禁用。</a-alert>
      </template>

      <a-table :data="staff" row-key="id" :loading="loading" :pagination="false" size="medium" :scroll="{ x: 1040 }">
        <template #empty><a-empty description="暂无人员" /></template>
        <template #columns>
          <a-table-column title="工号" :width="140"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.gh">{{ record.gh }}</span></template></a-table-column>
          <a-table-column title="姓名" :width="120"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.name">{{ record.name }}</span></template></a-table-column>
          <a-table-column title="职称" :width="120"><template #cell="{ record }">{{ record.title || '—' }}</template></a-table-column>
          <a-table-column title="专业组" :width="140"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.professionalGroup">{{ record.professionalGroup || '—' }}</span></template></a-table-column>
          <a-table-column title="适用范围" :width="180">
            <template #cell="{ record }">
              <a-tag v-for="sc in record.scopes" :key="sc.scopeType + sc.scopeCode">{{ sc.scopeCode }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="版本" :width="80"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="100"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="140" fixed="right">
            <template #cell="{ record }">
              <ConfigRowActions :actions="rowActions(record)" @action="(key: string) => onRowAction(record, key)" />
            </template>
          </a-table-column>
        </template>
      </a-table>
    </ConfigTableShell>

    <StaffConfigurationPanel :visible="editorVisible" :staff="editing" @cancel="editorVisible = false" @saved="onSaved" />
    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) + '人员' : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required>
          <a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" placeholder="请填写变更原因" />
        </a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}该人员？</a-form-item>
      </a-form>
    </a-modal>

    <a-drawer :visible="historyVisible" :width="520" title="人员状态变更历史" unmount-on-close @cancel="historyVisible = false">
      <a-empty v-if="!history.length" description="暂无状态变更记录" />
      <a-timeline v-else>
        <a-timeline-item v-for="item in history" :key="item.id">
          <a-tag :color="statusColor(item.toStatus)">{{ statusLabel(item.toStatus) }}</a-tag>
          <div style="color: var(--color-text-3); font-size: 12px">版本 {{ item.version }} · {{ item.actor ?? '系统' }} · {{ item.occurredAt ?? '—' }}</div>
          <div v-if="item.reason" style="color: var(--color-text-2); font-size: 13px">原因：{{ item.reason }}</div>
        </a-timeline-item>
      </a-timeline>
    </a-drawer>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { computed, onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import ConfigTableShell from '@/components/config/ConfigTableShell.vue';
import ConfigRowActions, { type ConfigRowAction } from '@/components/config/ConfigRowActions.vue';
import StaffConfigurationPanel from '@/components/config/StaffConfigurationPanel.vue';
import { authApi } from '@/api/auth';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import {
  loadStaffConfig, changeStaffStatusConfig, loadStaffHistory,
  canManageStaff, ProfessionalConflictError,
} from '@/services/configuration/professionalDictionaryService';
import type { StaffProfile, ProfessionalHistoryItem } from '@/types/system';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const store = useAnesthesiaStore();
const staff = ref<StaffProfile[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false);
const editing = ref<StaffProfile | null>(null);
const historyVisible = ref(false);
const historyId = ref(0);
const history = ref<ProfessionalHistoryItem[]>([]);
const statusVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ staff: StaffProfile; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

const canManage = computed(() => !useRealAnesthesiaDict() || canManageStaff(permissions.value));

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : Array.isArray(result) ? (result as unknown[]).map(String) : [];
  } catch { permissions.value = []; }
}

async function reload() {
  loading.value = true; loadError.value = '';
  try {
    staff.value = await loadStaffConfig({ allStatus: true });
    source.value = 'remote';
  } catch (e) {
    staff.value = []; source.value = 'local';
    loadError.value = e instanceof Error ? e.message : '未知错误';
  } finally { loading.value = false; }
}

function openCreate() { editing.value = null; editorVisible.value = true; }
function openEdit(s: StaffProfile) { editing.value = s; editorVisible.value = true; }
async function openHistory(s: StaffProfile) {
  historyId.value = s.id; historyVisible.value = true;
  try { history.value = await loadStaffHistory(s.id); } catch { history.value = []; }
}

async function onSaved() {
  editorVisible.value = false;
  await reload();
  try { await store.loadRemoteStaffDict(); } catch { /* 门店面目录刷新失败不影响配置页真值 */ }
}

function onChangeStatus(s: StaffProfile, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { staff: s, toStatus }; statusReason.value = ''; statusVisible.value = true;
}

function rowActions(s: StaffProfile): ConfigRowAction[] {
  return [
    { key: 'edit', label: '编辑', primary: true, hidden: !canManage.value },
    { key: 'history', label: '历史' },
    { key: 'pause', label: '暂停', hidden: !canManage.value || s.status !== 'enabled' },
    { key: 'enable', label: '启用', hidden: !canManage.value || s.status !== 'paused' },
    { key: 'disable', label: '停用', danger: true, hidden: !canManage.value || s.status === 'disabled' },
  ];
}
function onRowAction(s: StaffProfile, key: string) {
  if (key === 'edit') openEdit(s);
  else if (key === 'history') openHistory(s);
  else if (key === 'pause') onChangeStatus(s, 'paused');
  else if (key === 'enable') onChangeStatus(s, 'enabled');
  else if (key === 'disable') onChangeStatus(s, 'disabled');
}
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try {
    await changeStaffStatusConfig({ id: t.staff.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.staff.version });
    Message.success('状态变更成功'); statusVisible.value = false; await reload();
  } catch (e) {
    if (e instanceof ProfessionalConflictError) { Message.warning('数据已被其他人修改，请刷新后重试'); statusVisible.value = false; await reload(); }
    else if (e instanceof Error) Message.error(e.message);
  } finally { statusSaving.value = false; }
}

function statusLabel(s: string): string { return ({ draft: '草稿', enabled: '启用', paused: '暂停', disabled: '停用' }[s] ?? s) || '—'; }
function statusColor(s: string): string { return ({ enabled: 'green', paused: 'orange', disabled: 'red', draft: 'gray' }[s] ?? 'gray'); }

onMounted(async () => { await loadPermissions(); await reload(); });
</script>

<style scoped>
.scope-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
</style>
