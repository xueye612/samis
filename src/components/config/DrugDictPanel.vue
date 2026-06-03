<template>
  <div class="drug-dict-panel">
    <a-card class="section-card drug-dict-card" :bordered="false">
      <template #title>
        <span class="card-title">
          <span class="card-title__icon" aria-hidden="true"><icon-experiment /></span>
          药品字典
        </span>
      </template>
      <template #extra>
        <a-button type="primary" :disabled="busy" @click="openCreate">
          <template #icon><icon-plus /></template>
          新增药品
        </a-button>
      </template>



      <a-alert
        v-if="dictEmptyHint"
        type="warning"
        show-icon
        class="dict-remote-empty-alert"
      >
        {{ dictEmptyHint }}
      </a-alert>

      <div class="dict-toolbar">
        <a-input-search
          v-model="keyword"
          allow-clear
          placeholder="搜索名称、编码或规格"
          class="dict-search"
        />
        <div class="dict-stats">
          <a-tag color="arcoblue" bordered>共 {{ rows.length }} 项</a-tag>
          <a-tag color="green" bordered>启用 {{ enabledCount }}</a-tag>
          <a-tag v-if="highAlertCount" color="red" bordered>高警示 {{ highAlertCount }}</a-tag>
        </div>
      </div>



      <div class="dict-table-wrap">
        <a-table
          :data="filteredRows"
          :pagination="false"
          :stripe="true"
          :bordered="false"
          size="medium"
          row-key="id"
          :scroll="{ x: 1100 }"
        >
          <template #empty>
            <a-empty class="dict-empty" :description="dictEmptyDescription">
              <a-button v-if="keyword" type="text" @click="keyword = ''">清除搜索</a-button>
              <a-button v-else type="primary" size="small" :disabled="busy" @click="openCreate">新增药品</a-button>
            </a-empty>
          </template>
          <template #columns>
            <a-table-column title="名称" data-index="name" :width="180">
              <template #cell="{ record }">
                <div class="name-cell">
                  <span class="name-cell__text">{{ record.name }}</span>
                  <a-tag v-if="record.highAlert" color="red" size="small">高警示</a-tag>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="编码" data-index="code" :width="120" />
            <a-table-column title="规格" data-index="specification" :width="140">
              <template #cell="{ record }">{{ record.specification || '—' }}</template>
            </a-table-column>
            <a-table-column title="默认剂量" :width="110">
              <template #cell="{ record }">
                <span v-if="record.defaultDose != null && record.defaultDose !== ''">
                  {{ record.defaultDose }}
                  <span v-if="record.doseUnit" class="muted">{{ record.doseUnit }}</span>
                </span>
                <span v-else class="muted">—</span>
              </template>
            </a-table-column>
            <a-table-column title="默认途径" :width="100">
              <template #cell="{ record }">{{ record.defaultRoute || '—' }}</template>
            </a-table-column>
            <a-table-column title="常用" :width="88" align="center">
              <template #cell="{ record }">
                <a-tag :color="record.common ? 'arcoblue' : 'gray'" size="small">
                  {{ record.common ? '常用' : '普通' }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="排序" data-index="sortOrder" :width="72" align="center" />
            <a-table-column title="状态" :width="88" align="center">
              <template #cell="{ record }">
                <a-badge :status="record.enabled ? 'success' : 'default'" :text="record.enabled ? '启用' : '停用'" />
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="148" fixed="right">
              <template #cell="{ record }">
                <a-space :size="4">
                  <a-button size="mini" type="text" :disabled="busy" @click="openEdit(record)">编辑</a-button>
                  <a-button size="mini" type="text" status="danger" :disabled="busy" @click="confirmDisable(record)">
                    停用
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </div>
    </a-card>



    <a-modal
      v-model:visible="visible"
      :title="editingItem ? '编辑药品' : '新增药品'"
      :ok-loading="busy"
      width="680px"
      unmount-on-close
      modal-class="drug-dict-modal"
      @before-ok="handleBeforeOk"
    >
      <p class="modal-hint">维护麻醉记录单快捷用药与默认剂量，停用后历史记录不受影响。</p>
      <a-form :model="form" layout="vertical" class="drug-form">
        <fieldset class="form-section">
          <legend>基本信息</legend>
          <div class="form-grid">
            <a-form-item label="名称" required>
              <a-input v-model="form.name" placeholder="如 丙泊酚" allow-clear />
            </a-form-item>
            <a-form-item label="编码">
              <a-input v-model="form.code" placeholder="留空则使用名称" allow-clear />
            </a-form-item>
            <a-form-item label="规格" class="form-grid__full">
              <a-input v-model="form.specification" placeholder="如 200mg/20ml" allow-clear />
            </a-form-item>
          </div>
        </fieldset>



        <fieldset class="form-section">
          <legend>剂量与途径</legend>
          <div class="form-grid">
            <a-form-item label="默认剂量">
              <a-input-number v-model="form.defaultDose" :min="0" placeholder="数值" style="width: 100%" />
            </a-form-item>
            <a-form-item label="剂量单位">
              <a-input v-model="form.doseUnit" placeholder="如 mg、μg、ml" allow-clear />
            </a-form-item>
            <a-form-item label="默认途径" class="form-grid__full">
              <a-input v-model="form.defaultRoute" placeholder="如 静脉、吸入" allow-clear />
            </a-form-item>
          </div>
        </fieldset>



        <fieldset class="form-section form-section--compact">
          <legend>属性与排序</legend>
          <div class="switch-grid">
            <label class="switch-card">
              <span class="switch-card__label">
                <strong>高警示药品</strong>
                <small>落单时需额外核对</small>
              </span>
              <a-switch v-model="form.highAlert" />
            </label>
            <label class="switch-card">
              <span class="switch-card__label">
                <strong>常用快捷</strong>
                <small>显示在快捷用药区</small>
              </span>
              <a-switch v-model="form.common" />
            </label>
            <label class="switch-card">
              <span class="switch-card__label">
                <strong>启用</strong>
                <small>停用后不可新建选用</small>
              </span>
              <a-switch v-model="form.enabled" />
            </label>
            <div class="switch-card switch-card--sort">
              <span class="switch-card__label">
                <strong>排序</strong>
                <small>数字越小越靠前</small>
              </span>
              <a-input-number v-model="form.sortOrder" :min="1" :max="9999" style="width: 88px" />
            </div>
          </div>
        </fieldset>
      </a-form>
    </a-modal>
  </div>
</template>



<script setup lang="ts">
import { Modal } from '@arco-design/web-vue';
import { computed, reactive, ref } from 'vue';
import { useRealAnesthesiaDict } from '@/config/apiFlags';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { DrugDictItem } from '@/types/system';

const store = useAnesthesiaStore();



const props = defineProps<{
  modelValue: DrugDictItem[];
  persistItem?: (item: DrugDictItem, mode: 'create' | 'update') => Promise<boolean>;
  disableItem?: (item: DrugDictItem) => Promise<boolean>;
}>();



const emit = defineEmits<{ 'update:modelValue': [value: DrugDictItem[]] }>();



const rows = computed(() => props.modelValue);
const keyword = ref('');
const visible = ref(false);
const busy = ref(false);
const editingItem = ref<DrugDictItem | null>(null);
const form = reactive({
  name: '',
  code: '',
  specification: '',
  defaultDose: undefined as number | undefined,
  doseUnit: '',
  defaultRoute: '',
  highAlert: false,
  common: true,
  sortOrder: 1,
  enabled: true,
});



const enabledCount = computed(() => rows.value.filter((r) => r.enabled).length);
const highAlertCount = computed(() => rows.value.filter((r) => r.highAlert).length);



const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((row) => {
    const hay = [row.name, row.code, row.specification].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
});

const dictEmptyDescription = computed(() => {
  if (keyword.value.trim()) return '未找到匹配的药品';
  if (useRealAnesthesiaDict() && store.drugDictSource === 'remote' && !rows.value.length) {
    return '远程药品字典暂无数据';
  }
  return '暂无药品，可点击下方或右上角新增';
});

const dictEmptyHint = computed(() => {
  if (!useRealAnesthesiaDict() || store.drugDictSource !== 'remote' || rows.value.length) return '';
  return '接口已返回成功但列表为空，请在后台维护字典或通过「新增药品」录入。';
});



const cloneRows = () => JSON.parse(JSON.stringify(props.modelValue)) as DrugDictItem[];



const buildPayload = (): DrugDictItem | null => {
  const name = form.name.trim();
  if (!name) return null;
  const base = editingItem.value ?? {};
  return {
    ...base,
    id: editingItem.value?.id ?? `drug-${Date.now()}`,
    code: form.code.trim() || name,
    name,
    specification: form.specification.trim(),
    defaultDose: form.defaultDose,
    doseUnit: form.doseUnit.trim(),
    defaultRoute: form.defaultRoute.trim() || undefined,
    highAlert: form.highAlert,
    common: form.common,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  };
};



const openCreate = () => {
  editingItem.value = null;
  form.name = '';
  form.code = '';
  form.specification = '';
  form.defaultDose = undefined;
  form.doseUnit = '';
  form.defaultRoute = '';
  form.highAlert = false;
  form.common = true;
  form.sortOrder = props.modelValue.length + 1;
  form.enabled = true;
  visible.value = true;
};



const openEdit = (record: DrugDictItem) => {
  editingItem.value = record;
  form.name = record.name;
  form.code = record.code;
  form.specification = record.specification;
  form.defaultDose = typeof record.defaultDose === 'number' ? record.defaultDose : Number(record.defaultDose) || undefined;
  form.doseUnit = record.doseUnit;
  form.defaultRoute = record.defaultRoute ?? '';
  form.highAlert = Boolean(record.highAlert);
  form.common = record.common ?? true;
  form.sortOrder = record.sortOrder ?? 1;
  form.enabled = record.enabled;
  visible.value = true;
};



const persistLocally = (payload: DrugDictItem) => {
  const next = cloneRows();
  const index = editingItem.value
    ? next.findIndex((row) => row.id === editingItem.value?.id)
    : -1;
  if (index >= 0) next[index] = payload;
  else next.push(payload);
  emit('update:modelValue', next);
};



const handleBeforeOk = async () => {
  const payload = buildPayload();
  if (!payload) return false;
  const mode = editingItem.value ? 'update' : 'create';
  if (props.persistItem) {
    busy.value = true;
    try {
      return await props.persistItem(payload, mode);
    } finally {
      busy.value = false;
    }
  }
  persistLocally(payload);
  return true;
};



const confirmDisable = (record: DrugDictItem) => {
  Modal.confirm({
    title: '停用药品',
    content: `确定停用「${record.name}」？历史麻醉记录中的用药名称不受影响。`,
    okText: '停用',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      if (props.disableItem) {
        busy.value = true;
        try {
          return await props.disableItem(record);
        } finally {
          busy.value = false;
        }
      }
      emit(
        'update:modelValue',
        props.modelValue.filter((row) => row.id !== record.id),
      );
      return true;
    },
  });
};
</script>



<style scoped>
.drug-dict-panel {
  margin-top: var(--space-2);
}

.dict-remote-empty-alert {
  margin-bottom: var(--space-3);
  border-radius: 10px;
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
  color: var(--primary);
  background: rgb(37 99 235 / 8%);
  font-size: 16px;
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
  background: rgb(37 99 235 / 3%);
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
  border-left: 3px solid var(--primary);
  background: rgb(37 99 235 / 6%);
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
  border-color: rgb(37 99 235 / 25%);
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



.switch-card--sort {
  grid-column: 1 / -1;
}



@media (max-width: 560px) {
  .form-grid,
  .switch-grid {
    grid-template-columns: 1fr;
  }



  .switch-card--sort {
    grid-column: auto;
  }
}
</style>



<style>
.drug-dict-modal .arco-modal-body {
  max-height: min(72vh, 640px);
  overflow-y: auto;
}



.drug-dict-modal .arco-modal-header {
  border-bottom: 1px solid var(--border, #e5e7eb);
}



.drug-dict-modal .arco-modal-footer {
  border-top: 1px solid var(--border, #e5e7eb);
}
</style>

