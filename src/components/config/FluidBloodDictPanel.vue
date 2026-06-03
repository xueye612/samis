<template>
  <div class="fluid-blood-panel">
    <a-card class="section-card fluid-blood-card" :bordered="false">
      <template #title>
        <span class="card-title">
          <span class="card-title__icon" aria-hidden="true"><icon-swap /></span>
          液体/血制品字典
        </span>
      </template>
      <template #extra>
        <a-button type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          新增条目
        </a-button>
      </template>

      <a-tabs v-model:active-key="activeSubCategory" type="rounded" class="subcategory-tabs">
        <a-tab-pane v-for="cat in subCategories" :key="cat" :title="cat" />
      </a-tabs>

      <div class="dict-toolbar">
        <a-input-search
          v-model="keyword"
          allow-clear
          placeholder="搜索名称、编码或备注"
          class="dict-search"
        />
        <div class="dict-stats">
          <a-tag color="arcoblue" bordered>{{ activeSubCategory }} · {{ categoryRows.length }} 项</a-tag>
          <a-tag color="green" bordered>启用 {{ enabledInCategory }}</a-tag>
          <a-tag v-if="doubleCheckInCategory" color="orangered" bordered>
            需双人核对 {{ doubleCheckInCategory }}
          </a-tag>
        </div>
      </div>

      <div class="dict-table-wrap">
        <a-table
          :data="displayRows"
          :pagination="false"
          :stripe="true"
          :bordered="false"
          size="medium"
          row-key="id"
          :scroll="{ x: 960 }"
        >
          <template #empty>
            <a-empty
              class="dict-empty"
              :description="emptyDescription"
            >
              <a-button v-if="keyword" type="text" @click="keyword = ''">清除搜索</a-button>
              <a-button v-else type="primary" size="small" @click="openCreate">新增条目</a-button>
            </a-empty>
          </template>
          <template #columns>
            <a-table-column title="名称" data-index="name" :width="200">
              <template #cell="{ record }">
                <div class="name-cell">
                  <span class="name-cell__text">{{ record.name }}</span>
                  <a-tag v-if="record.requiresDoubleCheck" color="orangered" size="small">双人核对</a-tag>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="编码" data-index="code" :width="120" />
            <a-table-column title="默认单位" data-index="defaultUnit" :width="100">
              <template #cell="{ record }">{{ record.defaultUnit || '—' }}</template>
            </a-table-column>
            <a-table-column title="默认量" :width="110">
              <template #cell="{ record }">
                <span v-if="record.defaultVolume != null">
                  {{ record.defaultVolume }}
                  <span v-if="record.defaultUnit" class="muted">{{ record.defaultUnit }}</span>
                </span>
                <span v-else class="muted">—</span>
              </template>
            </a-table-column>
            <a-table-column title="备注" data-index="remark" :ellipsis="true" tooltip>
              <template #cell="{ record }">{{ record.remark || '—' }}</template>
            </a-table-column>
            <a-table-column title="状态" :width="88" align="center">
              <template #cell="{ record }">
                <a-badge :status="record.enabled ? 'success' : 'default'" :text="record.enabled ? '启用' : '停用'" />
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="148" fixed="right">
              <template #cell="{ record }">
                <a-space :size="4">
                  <a-button size="mini" type="text" @click="openEdit(record)">编辑</a-button>
                  <a-button size="mini" type="text" status="danger" @click="confirmRemove(record)">删除</a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal
      v-model:visible="visible"
      :title="editingId ? '编辑液体/血制品' : '新增液体/血制品'"
      width="640px"
      unmount-on-close
      modal-class="fluid-blood-modal"
      @before-ok="handleBeforeOk"
    >
      <p class="modal-hint">{{ modalHint }}</p>
      <a-form :model="form" layout="vertical" class="fluid-form">
        <fieldset class="form-section">
          <legend>分类与标识</legend>
          <div class="form-grid">
            <a-form-item label="子分类" class="form-grid__full">
              <a-select
                v-model="form.subCategory"
                :options="subCategoryOptions"
                @change="onSubCategoryChange"
              />
            </a-form-item>
            <a-form-item label="名称" required>
              <a-input v-model="form.name" placeholder="如 乳酸林格液、悬浮红细胞" allow-clear />
            </a-form-item>
            <a-form-item label="编码">
              <a-input v-model="form.code" placeholder="留空则使用名称" allow-clear />
            </a-form-item>
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>默认用量</legend>
          <div class="form-grid">
            <a-form-item label="默认单位">
              <a-input v-model="form.defaultUnit" placeholder="如 ml、U" allow-clear />
            </a-form-item>
            <a-form-item label="默认量">
              <a-input-number v-model="form.defaultVolume" :min="0" style="width: 100%" />
            </a-form-item>
            <a-form-item label="备注" class="form-grid__full">
              <a-input v-model="form.remark" placeholder="如 需交叉配血" allow-clear />
            </a-form-item>
          </div>
        </fieldset>

        <fieldset class="form-section form-section--compact">
          <legend>安全与状态</legend>
          <div class="switch-grid">
            <label class="switch-card">
              <span class="switch-card__label">
                <strong>需要双人核对</strong>
                <small>血制品等高风险输注建议开启</small>
              </span>
              <a-switch v-model="form.requiresDoubleCheck" />
            </label>
            <label class="switch-card">
              <span class="switch-card__label">
                <strong>启用</strong>
                <small>停用后不可在新记录中选择</small>
              </span>
              <a-switch v-model="form.enabled" />
            </label>
          </div>
        </fieldset>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { Modal } from '@arco-design/web-vue';
import { computed, reactive, ref, watch } from 'vue';
import { FLUID_BLOOD_SUB_CATEGORIES } from '@/mock/configSeed';
import type { FluidBloodDictItem, FluidBloodSubCategory } from '@/types/system';

const props = defineProps<{ modelValue: FluidBloodDictItem[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: FluidBloodDictItem[]] }>();

const subCategories = FLUID_BLOOD_SUB_CATEGORIES;
const subCategoryOptions = subCategories.map((item) => ({ label: item, value: item }));
const activeSubCategory = ref<FluidBloodSubCategory>('晶体液');
const keyword = ref('');
const visible = ref(false);
const editingId = ref('');
const form = reactive({
  subCategory: '晶体液' as FluidBloodSubCategory,
  name: '',
  code: '',
  defaultUnit: 'ml',
  defaultVolume: 500,
  requiresDoubleCheck: false,
  remark: '',
  enabled: true,
});

const categoryRows = computed(() =>
  props.modelValue.filter((item) => item.subCategory === activeSubCategory.value),
);

const enabledInCategory = computed(() => categoryRows.value.filter((r) => r.enabled).length);
const doubleCheckInCategory = computed(() =>
  categoryRows.value.filter((r) => r.requiresDoubleCheck).length,
);

const displayRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return categoryRows.value;
  return categoryRows.value.filter((row) => {
    const hay = [row.name, row.code, row.remark].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
});

const emptyDescription = computed(() => {
  if (keyword.value.trim()) return '当前分类下未找到匹配条目';
  return `${activeSubCategory.value} 暂无数据，可点击下方或右上角新增`;
});

const modalHint = computed(() => {
  if (form.subCategory === '血液制品') {
    return '血液制品默认需双人核对；维护后用于麻醉记录单输液/输血快捷录入。';
  }
  if (form.subCategory === '自体血回输') {
    return '自体血回输条目将出现在术中液体管理模块的快捷选项中。';
  }
  return '维护晶体液、胶体液等默认单位与容量，供术中液体录入使用。';
});

watch(activeSubCategory, () => {
  keyword.value = '';
});

const cloneRows = () => JSON.parse(JSON.stringify(props.modelValue)) as FluidBloodDictItem[];

const applySubCategoryDefaults = (cat: FluidBloodSubCategory) => {
  if (editingId.value) return;
  form.defaultUnit = cat === '血液制品' ? 'U' : 'ml';
  form.defaultVolume = cat === '血液制品' ? 1 : 500;
  form.requiresDoubleCheck = cat === '血液制品';
};

const onSubCategoryChange = (cat: FluidBloodSubCategory) => {
  applySubCategoryDefaults(cat);
};

const openCreate = () => {
  editingId.value = '';
  form.subCategory = activeSubCategory.value;
  form.name = '';
  form.code = '';
  form.remark = '';
  form.enabled = true;
  applySubCategoryDefaults(activeSubCategory.value);
  visible.value = true;
};

const openEdit = (record: FluidBloodDictItem) => {
  editingId.value = record.id;
  form.subCategory = record.subCategory;
  form.name = record.name;
  form.code = record.code;
  form.defaultUnit = record.defaultUnit ?? 'ml';
  form.defaultVolume = record.defaultVolume ?? 0;
  form.requiresDoubleCheck = Boolean(record.requiresDoubleCheck);
  form.remark = record.remark ?? '';
  form.enabled = record.enabled;
  visible.value = true;
};

const buildPayload = (): FluidBloodDictItem | null => {
  const name = form.name.trim();
  if (!name) return null;
  return {
    id: editingId.value || `fluid-${Date.now()}`,
    code: form.code.trim() || name,
    name,
    subCategory: form.subCategory,
    defaultUnit: form.defaultUnit.trim() || undefined,
    defaultVolume: form.defaultVolume,
    requiresDoubleCheck: form.requiresDoubleCheck,
    remark: form.remark.trim() || undefined,
    enabled: form.enabled,
  };
};

const handleBeforeOk = () => {
  const payload = buildPayload();
  if (!payload) return false;
  const next = cloneRows();
  const index = next.findIndex((item) => item.id === editingId.value);
  if (index >= 0) next[index] = payload;
  else next.push(payload);
  emit('update:modelValue', next);
  return true;
};

const confirmRemove = (record: FluidBloodDictItem) => {
  Modal.confirm({
    title: '删除条目',
    content: `确定删除「${record.name}」？已写入历史麻醉记录的液体/输血数据不受影响。`,
    okText: '删除',
    okButtonProps: { status: 'danger' },
    onOk: () => {
      emit('update:modelValue', props.modelValue.filter((item) => item.id !== record.id));
    },
  });
};
</script>

<style scoped>
.fluid-blood-panel {
  margin-top: var(--space-2);
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.card-title__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: rgb(20 184 166);
  background: rgb(20 184 166 / 10%);
  font-size: 16px;
}

.subcategory-tabs {
  margin-bottom: var(--space-3);
}

.subcategory-tabs :deep(.arco-tabs-nav) {
  margin-bottom: 0;
}

.dict-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: var(--space-4);
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: linear-gradient(180deg, rgb(248 250 252 / 90%), var(--surface));
}

.dict-search {
  flex: 1 1 240px;
  max-width: 320px;
}

.dict-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dict-table-wrap :deep(.arco-table-th) {
  background: var(--surface-muted, #f8fafc);
  font-weight: 600;
}

.dict-table-wrap :deep(.arco-table-tr:hover .arco-table-td) {
  background: rgb(20 184 166 / 4%);
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.name-cell__text {
  font-weight: 500;
  color: var(--text-primary);
}

.muted {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.dict-empty {
  padding: 32px 0;
}

.modal-hint {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  border-left: 3px solid rgb(20 184 166);
  background: rgb(20 184 166 / 8%);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.form-section {
  margin: 0 0 16px;
  padding: 0;
  border: 0;
}

.form-section legend {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.form-section--compact legend {
  margin-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.form-grid__full {
  grid-column: 1 / -1;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: default;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.switch-card:hover {
  border-color: rgb(20 184 166 / 30%);
  box-shadow: 0 2px 8px rgb(15 23 42 / 4%);
}

.switch-card__label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.switch-card__label strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.switch-card__label small {
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.4;
}

@media (max-width: 560px) {
  .form-grid,
  .switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.fluid-blood-modal .arco-modal-body {
  max-height: min(72vh, 600px);
  overflow-y: auto;
}

.fluid-blood-modal .arco-modal-header {
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.fluid-blood-modal .arco-modal-footer {
  border-top: 1px solid var(--border, #e5e7eb);
}
</style>
