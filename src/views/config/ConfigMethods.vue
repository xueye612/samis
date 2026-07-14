<template>
  <ModulePageShell title="麻醉方式管理" description="维护大类/子项树与麻醉方式专业 profile，保存真实写库并回读" shell-class="config-methods-page">
    <a-card :bordered="false">
      <template #title>
        <a-space>
          <span>麻醉方式</span>
          <a-tag :color="source === 'remote' ? 'green' : 'gray'">{{ source === 'remote' ? '真实数据' : '本地' }}</a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space>
          <a-button @click="reload" :loading="loading">刷新</a-button>
          <a-button v-if="canManage" type="primary" @click="openCreate">新增方式</a-button>
        </a-space>
      </template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">加载麻醉方式失败：{{ loadError }}。可点击刷新重试。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !items.length" type="warning" show-icon style="margin-bottom: 12px">远程暂无麻醉方式数据，表格为空属正常状态。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">无麻醉方式配置权限（config.method.manage）；仅可查看。</a-alert>

      <a-table :data="items" row-key="id" :loading="loading" :pagination="false" size="medium">
        <template #empty><a-empty description="暂无麻醉方式" /></template>
        <template #columns>
          <a-table-column title="编码" data-index="itemCode" />
          <a-table-column title="名称" data-index="itemName" />
          <a-table-column title="所属大类"><template #cell="{ record }">{{ record.parentCode || '—' }}</template></a-table-column>
          <a-table-column title="气道策略"><template #cell="{ record }">{{ record.profile?.airwayStrategy || '—' }}</template></a-table-column>
          <a-table-column title="版本" :width="80"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
          <a-table-column title="状态" :width="100"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="260">
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

    <MethodCategoryPanel :visible="editorVisible" :item="editing" @cancel="editorVisible = false" @saved="onSaved" />
    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required>
          <a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" placeholder="请填写变更原因" />
        </a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}该方式？</a-form-item>
      </a-form>
    </a-modal>
    <a-drawer :visible="historyVisible" :width="500" title="方式状态变更历史" unmount-on-close @cancel="historyVisible = false">
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
import { computed, onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import MethodCategoryPanel from '@/components/config/MethodCategoryPanel.vue';
import { authApi } from '@/api/auth';
import {
  loadProfessionalItems, changeProfessionalStatusConfig, loadProfessionalHistory,
  canManageProfessional, ProfessionalConflictError, METHOD_CATEGORY,
} from '@/services/configuration/professionalDictionaryService';
import type { ProfessionalDictItem, ProfessionalHistoryItem } from '@/types/system';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const items = ref<ProfessionalDictItem[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);
const editorVisible = ref(false);
const editing = ref<ProfessionalDictItem | null>(null);
const historyVisible = ref(false);
const history = ref<ProfessionalHistoryItem[]>([]);
const statusVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ item: ProfessionalDictItem; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

const canManage = computed(() => !useRealAnesthesiaDict() || canManageProfessional(permissions.value, METHOD_CATEGORY));

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : [];
  } catch { permissions.value = []; }
}
async function reload() {
  loading.value = true; loadError.value = '';
  try { items.value = await loadProfessionalItems(METHOD_CATEGORY, true); source.value = 'remote'; }
  catch (e) { items.value = []; source.value = 'local'; loadError.value = e instanceof Error ? e.message : '未知错误'; }
  finally { loading.value = false; }
}
function openCreate() { editing.value = null; editorVisible.value = true; }
function openEdit(item: ProfessionalDictItem) { editing.value = item; editorVisible.value = true; }
async function openHistory(item: ProfessionalDictItem) {
  historyVisible.value = true;
  try { history.value = await loadProfessionalHistory('method', item.id); } catch { history.value = []; }
}
async function onSaved() { editorVisible.value = false; await reload(); }
function onChangeStatus(item: ProfessionalDictItem, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { item, toStatus }; statusReason.value = ''; statusVisible.value = true;
}
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try {
    await changeProfessionalStatusConfig({ entityType: 'method', id: t.item.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.item.version });
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
