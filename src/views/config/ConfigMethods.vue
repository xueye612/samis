<template>
  <ModulePageShell title="麻醉方式管理" description="维护大类/子项树与方式专业 profile，保存真实写库并回读" shell-class="config-methods-page">
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
          <a-button v-if="canManage" type="primary" @click="openCategoryCreate">新增大类</a-button>
        </a-space>
      </template>
      <a-alert v-if="loadError" type="error" show-icon style="margin-bottom: 12px">加载麻醉方式失败：{{ loadError }}。可点击刷新重试。</a-alert>
      <a-alert v-else-if="!loading && source === 'remote' && !categories.length" type="warning" show-icon style="margin-bottom: 12px">远程暂无麻醉方式大类，可在本页新增。</a-alert>
      <a-alert v-if="!canManage && source === 'remote'" type="warning" show-icon style="margin-bottom: 12px">无麻醉方式配置权限（config.method.manage）；仅可查看。</a-alert>

      <div class="method-layout">
        <div class="method-category-col">
          <div class="method-col-head">大类</div>
          <a-list :bordered="false" :split="false" size="small" class="method-category-list">
            <a-list-item
              v-for="cat in categories"
              :key="cat.id"
              :class="{ active: selectedCatId === cat.id }"
              style="cursor: pointer"
              @click="selectedCatId = cat.id"
            >
              <div class="method-category-main">
                <span class="method-category-name">{{ cat.categoryName }}</span>
                <a-tag size="small" :color="statusColor(cat.status)">{{ statusLabel(cat.status) }}</a-tag>
              </div>
              <template #actions>
                <ConfigRowActions :actions="categoryActions(cat)" @action="(key: string) => onCategoryAction(cat, key)" />
              </template>
            </a-list-item>
          </a-list>
        </div>
        <div class="method-children-col">
          <div class="method-children-head">
            <span class="method-children-title">{{ selectedCat ? `${selectedCat.categoryName} · 子项` : '子项列表' }}</span>
            <a-button v-if="canManage && selectedCat" type="primary" size="small" @click="openChildCreate">新增子项</a-button>
          </div>
          <a-empty v-if="!selectedCat" description="请先选择或新增麻醉方式大类" />
          <a-table
            v-else
            :data="childrenOfSelected"
            row-key="id"
            :loading="loading"
            :pagination="false"
            size="medium"
            :scroll="{ x: 1320 }"
          >
            <template #columns>
              <a-table-column title="编码" :width="180"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.itemCode">{{ record.itemCode }}</span></template></a-table-column>
              <a-table-column title="名称" :width="160"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.itemName">{{ record.itemName }}</span></template></a-table-column>
              <a-table-column title="气道策略" :width="130"><template #cell="{ record }">{{ record.profile?.airwayStrategy || '—' }}</template></a-table-column>
              <a-table-column title="适用手术" :width="160"><template #cell="{ record }"><span class="cell-ellipsis" :title="record.profile?.applicableOperationTypes">{{ record.profile?.applicableOperationTypes || '未配置' }}</span></template></a-table-column>
              <a-table-column title="镇痛策略" :width="130"><template #cell="{ record }">{{ record.profile?.analgesiaStrategy || '未配置' }}</template></a-table-column>
              <a-table-column title="PACU去向" :width="120"><template #cell="{ record }">{{ record.profile?.pacuDestination || '未配置' }}</template></a-table-column>
              <a-table-column title="默认模板" :width="140"><template #cell="{ record }">{{ record.profile?.defaultTemplateCode || '—' }}</template></a-table-column>
              <a-table-column title="排序" :width="80"><template #cell="{ record }">{{ record.sortNo }}</template></a-table-column>
              <a-table-column title="版本" :width="80"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
              <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
              <a-table-column title="操作" :width="200" fixed="right">
                <template #cell="{ record }">
                  <ConfigRowActions :actions="childActions(record)" @action="(key: string) => onChildAction(record, key)" />
                </template>
              </a-table-column>
            </template>
          </a-table>
        </div>
      </div>
    </a-card>

    <MethodCategoryPanel :visible="editorVisible" :item="editingChild" :categories="categories" @cancel="editorVisible = false" @saved="onChildSaved" />

    <a-modal :visible="catEditorVisible" :title="catForm.id ? '编辑大类' : '新增大类'" :ok-loading="catSaving" :mask-closable="false" @cancel="catEditorVisible = false" @ok="saveCategory">
      <a-form :model="catForm" layout="vertical">
        <a-form-item label="大类编码" required><a-input v-model="catForm.categoryCode" :disabled="!!catForm.id" /></a-form-item>
        <a-form-item label="大类名称" required><a-input v-model="catForm.categoryName" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model="catForm.sortNo" :min="0" /></a-form-item>
        <a-form-item label="描述"><a-input v-model="catForm.description" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :visible="statusVisible" :title="statusTarget ? statusLabel(statusTarget.toStatus) : '状态变更'" :ok-loading="statusSaving" :mask-closable="false" @cancel="statusVisible = false" @ok="confirmStatus">
      <a-form :model="{}" layout="vertical">
        <a-form-item v-if="statusTarget && needsReason(statusTarget.toStatus)" label="原因（必填）" required>
          <a-textarea v-model="statusReason" :auto-size="{ minRows: 2 }" placeholder="请填写变更原因" />
        </a-form-item>
        <a-form-item v-else>确认{{ statusTarget ? statusLabel(statusTarget.toStatus) : '' }}？</a-form-item>
      </a-form>
    </a-modal>

    <a-drawer :visible="historyVisible" :width="500" :title="historyTitle" unmount-on-close @cancel="historyVisible = false">
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
import { computed, onMounted, reactive, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import ConfigRowActions, { type ConfigRowAction } from '@/components/config/ConfigRowActions.vue';
import MethodCategoryPanel from '@/components/config/MethodCategoryPanel.vue';
import { authApi } from '@/api/auth';
import {
  loadProfessionalItems, saveMethodCategoryConfig, changeProfessionalStatusConfig, changeCategoryStatusConfig,
  loadProfessionalHistory, loadCategoryHistory, canManageProfessional, ProfessionalConflictError, METHOD_CATEGORY,
} from '@/services/configuration/professionalDictionaryService';
import type { ProfessionalDictItem, ProfessionalHistoryItem, MethodCategory } from '@/types/system';
import { useRealAnesthesiaDict } from '@/config/apiFlags';

const categories = ref<MethodCategory[]>([]);
const items = ref<ProfessionalDictItem[]>([]);
const loading = ref(false);
const loadError = ref('');
const source = ref<'remote' | 'local'>('local');
const permissions = ref<string[]>([]);
const selectedCatId = ref<number | null>(null);

const editorVisible = ref(false);
const editingChild = ref<ProfessionalDictItem | null>(null);
const catEditorVisible = ref(false);
const catSaving = ref(false);
const catForm = reactive<{ id: number | null; categoryCode: string; categoryName: string; sortNo: number; description: string; expectedVersion: number }>({ id: null, categoryCode: '', categoryName: '', sortNo: 0, description: '', expectedVersion: 1 });

const historyVisible = ref(false);
const historyTitle = ref('状态变更历史');
const history = ref<ProfessionalHistoryItem[]>([]);
const statusVisible = ref(false);
const statusSaving = ref(false);
const statusReason = ref('');
const statusTarget = ref<{ kind: 'child' | 'category'; id: number; version: number; toStatus: 'enabled' | 'paused' | 'disabled' } | null>(null);

const canManage = computed(() => !useRealAnesthesiaDict() || canManageProfessional(permissions.value, METHOD_CATEGORY));
const selectedCat = computed(() => categories.value.find((c) => c.id === selectedCatId.value) ?? null);
const childrenOfSelected = computed(() => items.value.filter((i) => i.parentCode === (selectedCat.value?.categoryCode ?? '')));

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : [];
  } catch { permissions.value = []; }
}

async function reload() {
  loading.value = true; loadError.value = '';
  try {
    const { loadMethodCategories } = await import('@/services/configuration/professionalDictionaryService');
    const [cats, its] = await Promise.all([loadMethodCategories({ allStatus: true }), loadProfessionalItems(METHOD_CATEGORY, true)]);
    categories.value = cats;
    items.value = its;
    source.value = 'remote';
    if (selectedCatId.value === null && cats.length) selectedCatId.value = cats[0].id;
  } catch (e) {
    categories.value = []; items.value = []; source.value = 'local';
    loadError.value = e instanceof Error ? e.message : '未知错误';
  } finally { loading.value = false; }
}

function openCategoryCreate() {
  Object.assign(catForm, { id: null, categoryCode: '', categoryName: '', sortNo: 0, description: '', expectedVersion: 1 });
  catEditorVisible.value = true;
}
function openCategoryEdit(cat: MethodCategory) {
  Object.assign(catForm, { id: cat.id, categoryCode: cat.categoryCode, categoryName: cat.categoryName, sortNo: cat.sortNo, description: cat.description ?? '', expectedVersion: cat.version });
  catEditorVisible.value = true;
}
async function saveCategory() {
  if (!catForm.categoryCode.trim() || !catForm.categoryName.trim()) { Message.warning('编码与名称不能为空'); return; }
  catSaving.value = true;
  try {
    await saveMethodCategoryConfig({ id: catForm.id ?? 0, categoryCode: catForm.categoryCode.trim(), categoryName: catForm.categoryName.trim(), sortNo: catForm.sortNo, description: catForm.description || null, expectedVersion: catForm.expectedVersion });
    Message.success('保存成功'); catEditorVisible.value = false; await reload();
  } catch (e) {
    if (e instanceof ProfessionalConflictError) Message.warning('数据已被其他人修改，请刷新后重试');
    else if (e instanceof Error) Message.error(e.message);
  } finally { catSaving.value = false; }
}

function openChildCreate() { editingChild.value = null; editorVisible.value = true; }
function openChildEdit(item: ProfessionalDictItem) { editingChild.value = item; editorVisible.value = true; }
async function onChildSaved() { editorVisible.value = false; await reload(); }

function openChildHistory(item: ProfessionalDictItem) {
  historyTitle.value = '子项状态变更历史'; historyVisible.value = true;
  loadProfessionalHistory('method', item.id).then((h) => history.value = h).catch(() => history.value = []);
}
function openCategoryHistory(cat: MethodCategory) {
  historyTitle.value = '大类状态变更历史'; historyVisible.value = true;
  loadCategoryHistory(cat.id).then((h) => history.value = h).catch(() => history.value = []);
}

function onChangeChildStatus(item: ProfessionalDictItem, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { kind: 'child', id: item.id, version: item.version, toStatus }; statusReason.value = ''; statusVisible.value = true;
}
function onChangeCategoryStatus(cat: MethodCategory, toStatus: 'enabled' | 'paused' | 'disabled') {
  statusTarget.value = { kind: 'category', id: cat.id, version: cat.version, toStatus }; statusReason.value = ''; statusVisible.value = true;
}

function categoryActions(cat: MethodCategory): ConfigRowAction[] {
  return [
    { key: 'edit', label: '编辑', primary: true, hidden: !canManage.value },
    { key: 'history', label: '历史' },
    { key: 'pause', label: '暂停', hidden: !canManage.value || cat.status !== 'enabled' },
    { key: 'enable', label: '启用', hidden: !canManage.value || cat.status !== 'paused' },
    { key: 'disable', label: '停用', danger: true, hidden: !canManage.value || cat.status === 'disabled' },
  ];
}
function onCategoryAction(cat: MethodCategory, key: string) {
  if (key === 'edit') openCategoryEdit(cat);
  else if (key === 'history') openCategoryHistory(cat);
  else if (key === 'pause') onChangeCategoryStatus(cat, 'paused');
  else if (key === 'enable') onChangeCategoryStatus(cat, 'enabled');
  else if (key === 'disable') onChangeCategoryStatus(cat, 'disabled');
}

function childActions(item: ProfessionalDictItem): ConfigRowAction[] {
  return [
    { key: 'edit', label: '编辑', primary: true, hidden: !canManage.value },
    { key: 'history', label: '历史' },
    { key: 'pause', label: '暂停', hidden: !canManage.value || item.status !== 'enabled' },
    { key: 'enable', label: '启用', hidden: !canManage.value || item.status !== 'paused' },
    { key: 'disable', label: '停用', danger: true, hidden: !canManage.value || item.status === 'disabled' },
  ];
}
function onChildAction(item: ProfessionalDictItem, key: string) {
  if (key === 'edit') openChildEdit(item);
  else if (key === 'history') openChildHistory(item);
  else if (key === 'pause') onChangeChildStatus(item, 'paused');
  else if (key === 'enable') onChangeChildStatus(item, 'enabled');
  else if (key === 'disable') onChangeChildStatus(item, 'disabled');
}
function needsReason(t: string) { return t === 'paused' || t === 'disabled'; }
async function confirmStatus() {
  const t = statusTarget.value; if (!t) return;
  if (needsReason(t.toStatus) && !statusReason.value.trim()) { Message.warning('请填写变更原因'); return; }
  statusSaving.value = true;
  try {
    const entityType = t.kind === 'category' ? 'method_category' : 'method';
    const fn = t.kind === 'category' ? changeCategoryStatusConfig : changeProfessionalStatusConfig;
    await fn({ entityType, id: t.id, toStatus: t.toStatus, reason: statusReason.value.trim(), expectedVersion: t.version });
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
.method-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.method-category-col {
  min-width: 0;
}
.method-col-head {
  font-weight: 600;
  margin-bottom: 8px;
}
.method-category-list {
  max-height: 560px;
  overflow-y: auto;
}
@media (max-width: 1200px) {
  .method-layout { grid-template-columns: 320px minmax(0, 1fr); }
}
.method-category-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.method-category-item:hover {
  border-color: var(--color-brand-100);
  background: var(--surface-muted);
}
.method-category-item.active {
  border-color: var(--color-brand-200);
  background: var(--primary-soft);
}
:deep(.arco-list-item.active) {
  background: var(--primary-soft);
}
.method-category-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.method-category-name {
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.method-children-col {
  min-width: 0;
}
.method-children-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.method-children-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1024px) {
  .method-layout {
    grid-template-columns: 1fr;
  }
}
</style>
