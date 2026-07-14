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

      <a-row :gutter="16">
        <a-col :span="7">
          <div style="font-weight: 600; margin-bottom: 8px">大类</div>
          <a-list :bordered="false" :split="false" size="small">
            <a-list-item v-for="cat in categories" :key="cat.id" :class="{ active: selectedCatId === cat.id }" style="cursor: pointer" @click="selectedCatId = cat.id">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%">
                <span>{{ cat.categoryName }} <a-tag size="small" :color="statusColor(cat.status)">{{ statusLabel(cat.status) }}</a-tag></span>
              </div>
              <template #actions>
                <a-button v-if="canManage" size="mini" @click.stop="openCategoryEdit(cat)">编辑</a-button>
                <a-button size="mini" @click.stop="openCategoryHistory(cat)">历史</a-button>
                <a-button v-if="canManage && cat.status === 'enabled'" size="mini" @click.stop="onChangeCategoryStatus(cat, 'paused')">暂停</a-button>
                <a-button v-if="canManage && cat.status === 'paused'" size="mini" @click.stop="onChangeCategoryStatus(cat, 'enabled')">启用</a-button>
                <a-button v-if="canManage && cat.status !== 'disabled'" size="mini" status="warning" @click.stop="onChangeCategoryStatus(cat, 'disabled')">停用</a-button>
              </template>
            </a-list-item>
          </a-list>
        </a-col>
        <a-col :span="17">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
            <span style="font-weight: 600">{{ selectedCat ? `${selectedCat.categoryName} · 子项` : '子项列表' }}</span>
            <a-button v-if="canManage && selectedCat" type="primary" size="small" @click="openChildCreate">新增子项</a-button>
          </div>
          <a-empty v-if="!selectedCat" description="请先选择或新增麻醉方式大类" />
          <a-table v-else :data="childrenOfSelected" row-key="id" :loading="loading" :pagination="false" size="medium">
            <template #columns>
              <a-table-column title="编码" data-index="itemCode" />
              <a-table-column title="名称" data-index="itemName" />
              <a-table-column title="气道策略"><template #cell="{ record }">{{ record.profile?.airwayStrategy || '—' }}</template></a-table-column>
              <a-table-column title="默认模板"><template #cell="{ record }">{{ record.profile?.defaultTemplateCode || '—' }}</template></a-table-column>
              <a-table-column title="排序" :width="70"><template #cell="{ record }">{{ record.sortNo }}</template></a-table-column>
              <a-table-column title="版本" :width="70"><template #cell="{ record }">{{ record.version }}</template></a-table-column>
              <a-table-column title="状态" :width="90"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
              <a-table-column title="操作" :width="250">
                <template #cell="{ record }">
                  <a-space wrap>
                    <a-button size="mini" @click="openChildHistory(record)">历史</a-button>
                    <a-button v-if="canManage" size="mini" @click="openChildEdit(record)">编辑</a-button>
                    <a-button v-if="canManage && record.status === 'enabled'" size="mini" @click="onChangeChildStatus(record, 'paused')">暂停</a-button>
                    <a-button v-if="canManage && record.status !== 'disabled'" size="mini" status="warning" @click="onChangeChildStatus(record, 'disabled')">停用</a-button>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-col>
      </a-row>
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
:deep(.arco-list-item.active) { background: rgba(15, 131, 255, 0.08); }
</style>
