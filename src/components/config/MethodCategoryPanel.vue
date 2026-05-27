<template>
  <div class="page-stack">
    <a-card class="section-card" :bordered="false">
      <template #title>麻醉方式字典</template>
      <template #extra>
        <a-button type="primary" @click="openCategoryCreate">新增大类</a-button>
      </template>
      <a-row :gutter="16">
        <a-col :span="7">
          <div class="panel-title">麻醉方式大类</div>
          <a-list :bordered="false" :split="false" class="category-list">
            <a-list-item
              v-for="(cat, index) in categories"
              :key="cat.id"
              class="category-item"
              :class="{ active: selectedIndex === index }"
              @click="selectedIndex = index"
            >
              <div class="category-row">
                <span>{{ cat.name }}</span>
                <a-tag :color="cat.enabled ? 'green' : 'gray'" size="small">{{ cat.enabled ? '启用' : '停用' }}</a-tag>
              </div>
              <template #actions>
                <a-button size="mini" @click.stop="openCategoryEdit(index)">编辑</a-button>
              </template>
            </a-list-item>
          </a-list>
        </a-col>
        <a-col :span="17">
          <div class="panel-header">
            <div class="panel-title">{{ selectedCategory ? `${selectedCategory.name} · 子项` : '子项列表' }}</div>
            <a-button type="primary" size="small" :disabled="!selectedCategory" @click="openChildCreate">新增子项</a-button>
          </div>
          <a-empty v-if="!selectedCategory" description="请先选择或新增麻醉方式大类" />
          <a-table v-else :data="selectedCategory.children" :pagination="false" row-key="id">
            <template #columns>
              <a-table-column title="名称" data-index="name" />
              <a-table-column title="编码" data-index="code" />
              <a-table-column title="状态">
                <template #cell="{ record }">
                  <a-tag :color="record.enabled ? 'green' : 'gray'">{{ record.enabled ? '启用' : '停用' }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="操作" :width="160">
                <template #cell="{ record, rowIndex }">
                  <a-space>
                    <a-button size="mini" @click="openChildEdit(record, rowIndex)">编辑</a-button>
                    <a-button size="mini" status="danger" @click="removeChild(rowIndex)">删除</a-button>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-col>
      </a-row>
    </a-card>

    <a-modal v-model:visible="categoryVisible" :title="categoryEditingIndex >= 0 ? '编辑大类' : '新增大类'" @ok="saveCategory">
      <a-form :model="categoryForm" layout="vertical">
        <a-form-item label="大类名称"><a-input v-model="categoryForm.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="categoryForm.code" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="categoryForm.enabled" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:visible="childVisible" :title="childEditingIndex >= 0 ? '编辑子项' : '新增子项'" @ok="saveChild">
      <a-form :model="childForm" layout="vertical">
        <a-form-item label="子项名称"><a-input v-model="childForm.name" /></a-form-item>
        <a-form-item label="编码"><a-input v-model="childForm.code" /></a-form-item>
        <a-form-item label="启用"><a-switch v-model="childForm.enabled" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { AnesthesiaMethodCategory, AnesthesiaMethodItem } from '@/types/system';

const props = defineProps<{ modelValue: AnesthesiaMethodCategory[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: AnesthesiaMethodCategory[]] }>();

const categories = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const selectedIndex = ref(0);
watch(
  () => props.modelValue.length,
  (len) => {
    if (len === 0) selectedIndex.value = -1;
    else if (selectedIndex.value >= len) selectedIndex.value = len - 1;
  },
  { immediate: true },
);

const selectedCategory = computed(() => (selectedIndex.value >= 0 ? categories.value[selectedIndex.value] : undefined));

const categoryVisible = ref(false);
const categoryEditingIndex = ref(-1);
const categoryForm = reactive({ name: '', code: '', enabled: true });

const childVisible = ref(false);
const childEditingIndex = ref(-1);
const childForm = reactive({ name: '', code: '', enabled: true });

const cloneCategories = () => JSON.parse(JSON.stringify(categories.value)) as AnesthesiaMethodCategory[];

const openCategoryCreate = () => {
  categoryEditingIndex.value = -1;
  categoryForm.name = '';
  categoryForm.code = '';
  categoryForm.enabled = true;
  categoryVisible.value = true;
};

const openCategoryEdit = (index: number) => {
  const cat = categories.value[index];
  categoryEditingIndex.value = index;
  categoryForm.name = cat.name;
  categoryForm.code = cat.code;
  categoryForm.enabled = cat.enabled;
  categoryVisible.value = true;
};

const saveCategory = () => {
  const name = categoryForm.name.trim();
  if (!name) return;
  const next = cloneCategories();
  const payload: AnesthesiaMethodCategory = {
    id: categoryEditingIndex.value >= 0 ? next[categoryEditingIndex.value].id : `method-cat-${Date.now()}`,
    code: categoryForm.code.trim() || name,
    name,
    enabled: categoryForm.enabled,
    children: categoryEditingIndex.value >= 0 ? next[categoryEditingIndex.value].children : [],
  };
  if (categoryEditingIndex.value >= 0) next[categoryEditingIndex.value] = payload;
  else {
    next.push(payload);
    selectedIndex.value = next.length - 1;
  }
  emit('update:modelValue', next);
  categoryVisible.value = false;
};

const openChildCreate = () => {
  childEditingIndex.value = -1;
  childForm.name = '';
  childForm.code = '';
  childForm.enabled = true;
  childVisible.value = true;
};

const openChildEdit = (record: AnesthesiaMethodItem, index: number) => {
  childEditingIndex.value = index;
  childForm.name = record.name;
  childForm.code = record.code;
  childForm.enabled = record.enabled;
  childVisible.value = true;
};

const saveChild = () => {
  if (selectedIndex.value < 0) return;
  const name = childForm.name.trim();
  if (!name) return;
  const next = cloneCategories();
  const cat = next[selectedIndex.value];
  const payload: AnesthesiaMethodItem = {
    id: childEditingIndex.value >= 0 ? cat.children[childEditingIndex.value].id : `method-child-${Date.now()}`,
    code: childForm.code.trim() || name,
    name,
    enabled: childForm.enabled,
  };
  if (childEditingIndex.value >= 0) cat.children[childEditingIndex.value] = payload;
  else cat.children.push(payload);
  emit('update:modelValue', next);
  childVisible.value = false;
};

const removeChild = (index: number) => {
  if (selectedIndex.value < 0) return;
  const next = cloneCategories();
  next[selectedIndex.value].children.splice(index, 1);
  emit('update:modelValue', next);
};
</script>

<style scoped>
.panel-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.category-list {
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
}
.category-item {
  cursor: pointer;
  padding: 8px 12px;
}
.category-item.active {
  background: rgba(15, 131, 255, 0.08);
}
.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
</style>
