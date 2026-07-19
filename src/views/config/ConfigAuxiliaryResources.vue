<template>
  <ModulePageShell title="辅助麻醉区域与 PACU 床位" description="麻醉系统权威维护产房、非手术室麻醉位和 PACU 床位；已被预约或占用的资源修改前必须完成影响预检">
    <template #chips>
      <a-tag color="arcoblue">权威写入：SAMIS</a-tag>
      <a-tag color="orange">乐观版本 + 一次性确认</a-tag>
    </template>
    <template #toolbar>
      <a-button :loading="loading" @click="reload">刷新</a-button>
    </template>

    <a-alert v-if="error" type="error" show-icon style="margin-bottom: 12px">
      {{ error }} <a-button size="mini" type="text" @click="reload">重试</a-button>
    </a-alert>
    <a-alert v-if="!canManage" type="warning" show-icon style="margin-bottom: 12px">
      当前账号无 pacu.resource.manage 权限，页面仅可查看，不会发出资源写请求。
    </a-alert>

    <a-tabs v-model:active-key="activeTab" type="rounded">
      <a-tab-pane key="auxiliary" title="辅助麻醉区域">
        <a-card :bordered="false" class="section-card">
          <template #title>产房 / 非手术室麻醉位</template>
          <template #extra><a-button v-if="canManage" type="primary" @click="openAuxiliaryCreate">新增辅助区域</a-button></template>
          <a-table :data="locations" row-key="locationId" :loading="loading" :pagination="false">
            <template #empty><a-empty description="暂无辅助麻醉区域" /></template>
            <template #columns>
              <a-table-column title="编码" data-index="locationCode" :width="130" />
              <a-table-column title="名称" data-index="locationName" :width="180" />
              <a-table-column title="类型" :width="140"><template #cell="{ record }">{{ locationTypeLabel(record.locationType) }}</template></a-table-column>
              <a-table-column title="院区" :width="120"><template #cell="{ record }">{{ record.campus || '—' }}</template></a-table-column>
              <a-table-column title="楼层" :width="100"><template #cell="{ record }">{{ record.floor || '—' }}</template></a-table-column>
              <a-table-column title="位置"><template #cell="{ record }">{{ record.location || '—' }}</template></a-table-column>
              <a-table-column title="状态" :width="110"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template></a-table-column>
              <a-table-column title="版本" :width="80"><template #cell="{ record }">v{{ record.version }}</template></a-table-column>
              <a-table-column title="操作" :width="100"><template #cell="{ record }"><a-button v-if="canManage && record.status !== 'disabled'" size="mini" @click="openAuxiliaryEdit(record)">编辑</a-button><span v-else>—</span></template></a-table-column>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="pacu" title="PACU 床位">
        <a-card :bordered="false" class="section-card">
          <template #title>PACU 床位资源</template>
          <template #extra><a-button v-if="canManage" type="primary" @click="openBedCreate">新增 PACU 床位</a-button></template>
          <a-table :data="beds" row-key="bedId" :loading="loading" :pagination="false">
            <template #empty><a-empty description="暂无 PACU 床位" /></template>
            <template #columns>
              <a-table-column title="复苏室" data-index="roomId" :width="150" />
              <a-table-column title="床号" data-index="bedNo" :width="120" />
              <a-table-column title="状态" :width="100"><template #cell="{ record }"><a-tag :color="bedStatusColor(record.status)">{{ record.status }}</a-tag></template></a-table-column>
              <a-table-column title="当前手术" :width="180"><template #cell="{ record }">{{ record.currentOperationId || '无' }}</template></a-table-column>
              <a-table-column title="备注"><template #cell="{ record }">{{ record.remark || '—' }}</template></a-table-column>
              <a-table-column title="版本" :width="80"><template #cell="{ record }">v{{ record.version }}</template></a-table-column>
              <a-table-column title="操作" :width="100"><template #cell="{ record }"><a-button v-if="canManage && record.status !== '占用'" size="mini" @click="openBedEdit(record)">编辑</a-button><span v-else>—</span></template></a-table-column>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <a-modal :visible="editorVisible" :title="editorTitle" :ok-loading="previewLoading" :mask-closable="false" @cancel="editorVisible = false" @ok="prepareSave">
      <a-form :model="form" layout="vertical">
        <template v-if="editingKind === 'auxiliary'">
          <a-form-item label="位置编码" required><a-input v-model="form.locationCode" :disabled="Boolean(editingLocation)" /></a-form-item>
          <a-form-item label="位置名称" required><a-input v-model="form.locationName" /></a-form-item>
          <a-form-item label="位置类型" required><a-select v-model="form.locationType" :options="locationTypeOptions" /></a-form-item>
          <a-form-item label="院区 / 楼层"><a-space fill><a-input v-model="form.campus" placeholder="院区" /><a-input v-model="form.floor" placeholder="楼层" /></a-space></a-form-item>
          <a-form-item label="具体位置"><a-input v-model="form.location" /></a-form-item>
          <a-form-item label="状态" required><a-select v-model="form.status" :options="locationStatusOptions" /></a-form-item>
        </template>
        <template v-else>
          <a-form-item label="PACU 复苏室" required><a-input v-model="form.roomId" /></a-form-item>
          <a-form-item label="床号" required><a-input v-model="form.bedNo" /></a-form-item>
          <a-form-item label="状态" required><a-select v-model="form.status" :options="bedStatusOptions" /></a-form-item>
          <a-form-item label="备注"><a-textarea v-model="form.remark" /></a-form-item>
        </template>
        <a-form-item v-if="isEditing" label="变更原因" required><a-textarea v-model="reason" placeholder="将写入审计并绑定本次影响预检" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal :visible="impactVisible" title="资源影响确认" :ok-loading="saving" :mask-closable="false" ok-text="确认变更" @cancel="cancelImpact" @ok="confirmSave">
      <a-alert :type="impactPreview?.hasImpact ? 'warning' : 'info'" show-icon style="margin-bottom: 12px">
        {{ impactPreview?.hasImpact ? '该资源已被麻醉预约或占用，继续修改可能影响排班/接收。' : '当前未发现有效预约或占用，确认后将按当前版本提交。' }}
      </a-alert>
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="资源版本">v{{ impactPreview?.resourceVersion }}</a-descriptions-item>
        <a-descriptions-item label="确认有效期">{{ impactPreview?.expiresAt || '—' }}</a-descriptions-item>
        <a-descriptions-item label="变更原因">{{ reason }}</a-descriptions-item>
      </a-descriptions>
      <a-table v-if="impactPreview?.impacts.length" :data="impactPreview.impacts" :pagination="false" size="small" style="margin-top: 12px">
        <template #columns>
          <a-table-column title="手术ID" data-index="operationId" />
          <a-table-column title="使用状态" data-index="status" />
          <a-table-column title="版本"><template #cell="{ record }">v{{ record.version }}</template></a-table-column>
        </template>
      </a-table>
      <p class="impact-privacy">影响清单仅展示手术 ID、状态和版本，不暴露患者信息。</p>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { authApi } from '@/api/auth';
import {
  ResourceImpactConflictError,
  confirmAuxiliaryLocationUpdate,
  confirmPacuBedUpdate,
  createAuxiliaryLocation,
  createPacuBedResource,
  loadAuxiliaryLocations,
  loadPacuBedResources,
  previewAuxiliaryLocationUpdate,
  previewPacuBedUpdate,
  type AuxiliaryLocationRow,
  type PacuBedResourceRow,
  type ResourceImpactPreview,
} from '@/services/configuration/resourceImpactService';

type EditingKind = 'auxiliary' | 'pacu';
const activeTab = ref<EditingKind>('auxiliary');
const locations = ref<AuxiliaryLocationRow[]>([]);
const beds = ref<PacuBedResourceRow[]>([]);
const permissions = ref<string[]>([]);
const loading = ref(false);
const error = ref('');
const editorVisible = ref(false);
const previewLoading = ref(false);
const saving = ref(false);
const editingKind = ref<EditingKind>('auxiliary');
const editingLocation = ref<AuxiliaryLocationRow | null>(null);
const editingBed = ref<PacuBedResourceRow | null>(null);
const reason = ref('');
const impactVisible = ref(false);
const impactPreview = ref<ResourceImpactPreview | null>(null);
const pendingChanges = ref<Record<string, unknown> | null>(null);
const form = reactive<Record<string, any>>({});

const canManage = computed(() => permissions.value.some((item) => item === '*' || item === 'pacu.*' || item === 'pacu.resource.manage'));
const isEditing = computed(() => editingKind.value === 'auxiliary' ? Boolean(editingLocation.value) : Boolean(editingBed.value));
const editorTitle = computed(() => `${isEditing.value ? '编辑' : '新增'}${editingKind.value === 'auxiliary' ? '辅助麻醉区域' : 'PACU 床位'}`);
const locationTypeOptions = [{ label: '产房', value: 'delivery_room' }, { label: '非手术室麻醉位', value: 'non_operating_room' }];
const locationStatusOptions = [{ label: '草稿', value: 'draft' }, { label: '启用', value: 'enabled' }, { label: '维护', value: 'maintenance' }, { label: '停用', value: 'disabled' }];
const bedStatusOptions = [{ label: '空闲', value: '空闲' }, { label: '预留', value: '预留' }, { label: '维护', value: '维护' }];

async function reload() {
  loading.value = true;
  error.value = '';
  try {
    [locations.value, beds.value] = await Promise.all([loadAuxiliaryLocations(), loadPacuBedResources()]);
  } catch (cause) {
    locations.value = [];
    beds.value = [];
    error.value = cause instanceof Error ? cause.message : '辅助资源加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadPermissions() {
  try {
    const result = await authApi.myPermissions();
    permissions.value = Array.isArray(result?.permissions) ? result.permissions.map(String) : [];
  } catch {
    permissions.value = [];
  }
}

function resetForm(values: Record<string, unknown>) {
  Object.keys(form).forEach((key) => delete form[key]);
  Object.assign(form, values);
  reason.value = '';
  impactPreview.value = null;
  pendingChanges.value = null;
}
function openAuxiliaryCreate() { editingKind.value = 'auxiliary'; editingLocation.value = null; editingBed.value = null; resetForm({ locationCode: '', locationName: '', locationType: 'delivery_room', campus: '', floor: '', location: '', status: 'draft' }); editorVisible.value = true; }
function openAuxiliaryEdit(row: AuxiliaryLocationRow) { editingKind.value = 'auxiliary'; editingLocation.value = row; editingBed.value = null; resetForm({ locationCode: row.locationCode, locationName: row.locationName, locationType: row.locationType, campus: row.campus ?? '', floor: row.floor ?? '', location: row.location ?? '', status: row.status }); editorVisible.value = true; }
function openBedCreate() { editingKind.value = 'pacu'; editingBed.value = null; editingLocation.value = null; resetForm({ roomId: '', bedNo: '', status: '空闲', remark: '' }); editorVisible.value = true; }
function openBedEdit(row: PacuBedResourceRow) { editingKind.value = 'pacu'; editingBed.value = row; editingLocation.value = null; resetForm({ roomId: row.roomId, bedNo: row.bedNo, status: row.status, remark: row.remark ?? '' }); editorVisible.value = true; }

function currentChanges(): Record<string, unknown> {
  if (editingKind.value === 'auxiliary') return { locationCode: form.locationCode, locationName: form.locationName, locationType: form.locationType, campus: form.campus || null, floor: form.floor || null, location: form.location || null, status: form.status };
  return { roomId: form.roomId, bedNo: form.bedNo, status: form.status, remark: form.remark || null };
}
function validate(): boolean {
  const required = editingKind.value === 'auxiliary' ? [form.locationCode, form.locationName, form.locationType, form.status] : [form.roomId, form.bedNo, form.status];
  if (required.some((value) => !String(value ?? '').trim())) { Message.warning('请完整填写必填字段'); return false; }
  if (isEditing.value && !reason.value.trim()) { Message.warning('请填写变更原因'); return false; }
  return true;
}
async function prepareSave() {
  if (!validate()) return;
  const changes = currentChanges();
  previewLoading.value = true;
  try {
    if (!isEditing.value) {
      if (editingKind.value === 'auxiliary') await createAuxiliaryLocation(changes);
      else await createPacuBedResource(changes);
      Message.success('新增成功');
      editorVisible.value = false;
      await reload();
      return;
    }
    pendingChanges.value = changes;
    impactPreview.value = editingKind.value === 'auxiliary'
      ? await previewAuxiliaryLocationUpdate(editingLocation.value!, changes)
      : await previewPacuBedUpdate(editingBed.value!, changes);
    editorVisible.value = false;
    impactVisible.value = true;
  } catch (cause) {
    Message.error(cause instanceof Error ? cause.message : '影响预检失败');
  } finally {
    previewLoading.value = false;
  }
}
async function confirmSave() {
  if (!impactPreview.value || !pendingChanges.value) return;
  saving.value = true;
  try {
    if (editingKind.value === 'auxiliary') await confirmAuxiliaryLocationUpdate(editingLocation.value!, pendingChanges.value, impactPreview.value, reason.value.trim());
    else await confirmPacuBedUpdate(editingBed.value!, pendingChanges.value, impactPreview.value, reason.value.trim());
    Message.success('资源变更已保存');
    impactVisible.value = false;
    await reload();
  } catch (cause) {
    if (cause instanceof ResourceImpactConflictError) Message.warning(cause.message);
    else Message.error(cause instanceof Error ? cause.message : '资源变更失败，请重新预检');
    impactVisible.value = false;
    await reload();
  } finally {
    saving.value = false;
  }
}
function cancelImpact() { impactVisible.value = false; impactPreview.value = null; pendingChanges.value = null; }
const locationTypeLabel = (value: string) => value === 'delivery_room' ? '产房' : value === 'non_operating_room' ? '非手术室麻醉位' : value;
const statusLabel = (value: string) => ({ draft: '草稿', enabled: '启用', maintenance: '维护', disabled: '停用' }[value] ?? value);
const statusColor = (value: string) => ({ enabled: 'green', maintenance: 'orange', disabled: 'red', draft: 'gray' }[value] ?? 'gray');
const bedStatusColor = (value: string) => ({ '空闲': 'green', '预留': 'arcoblue', '维护': 'orange', '占用': 'red' }[value] ?? 'gray');
onMounted(async () => { await loadPermissions(); await reload(); });
</script>

<style scoped>
.impact-privacy { margin: 12px 0 0; color: var(--color-text-3); font-size: 12px; }
</style>
