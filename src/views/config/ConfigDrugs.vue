<template>
  <ModulePageShell title="药品管理" description="药品字典与库存预警">
    <a-tabs v-model:active-key="activeTab" type="rounded">
      <a-tab-pane key="dict" title="药品字典">
        <DrugDictPanel :model-value="dictList" @update:model-value="saveDict" />
      </a-tab-pane>
      <a-tab-pane v-for="cat in categories" :key="cat" :title="cat">
        <a-alert
          v-if="lowStockCount(cat)"
          type="warning"
          show-icon
          style="margin-bottom: 12px"
        >
          {{ cat }} 有 {{ lowStockCount(cat) }} 种药品库存低于安全线
        </a-alert>
        <a-table :data="inventoryByCategory(cat)" row-key="id" :pagination="false">
          <template #columns>
            <a-table-column title="药品" data-index="name" />
            <a-table-column title="规格" data-index="specification" />
            <a-table-column title="库存" :width="120">
              <template #cell="{ record }">
                <a-tag :color="isLowStock(record) ? 'red' : 'green'">
                  {{ record.stock }} {{ record.unit }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="安全库存" :width="100">
              <template #cell="{ record }">{{ record.minStock }} {{ record.unit }}</template>
            </a-table-column>
            <a-table-column title="单价" :width="90">
              <template #cell="{ record }">¥{{ record.price }}</template>
            </a-table-column>
            <a-table-column title="状态" :width="100">
              <template #cell="{ record }">
                <a-tag v-if="isLowStock(record)" color="orangered">库存预警</a-tag>
                <a-tag v-else color="arcoblue">正常</a-tag>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DrugDictPanel from '@/components/config/DrugDictPanel.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { DrugInventoryItem } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const activeTab = ref('dict');
const dictList = computed(() => store.configDrugs);
const saveDict = (value: typeof store.configDrugs) => store.upsertDrugDict(value);

const categories = ['麻醉药品', '镇痛药品', '肌松药品', '镇静药品', '其他药品'] as const;

const inventoryByCategory = (cat: DrugInventoryItem['category']) =>
  store.drugInventory.filter((item) => item.category === cat);

const isLowStock = (item: DrugInventoryItem) => item.stock < item.minStock;
const lowStockCount = (cat: DrugInventoryItem['category']) =>
  inventoryByCategory(cat).filter(isLowStock).length;
</script>
