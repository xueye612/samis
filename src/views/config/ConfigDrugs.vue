<template>
  <ModulePageShell
    title="药品管理"
    description="维护药品字典、分类库存与安全库存预警"
    shell-class="config-drugs-page"
  >
    <a-card class="section-card config-drugs-card" :bordered="false">
      <a-alert
        v-if="showRemoteDrugEmpty"
        type="warning"
        show-icon
        class="config-drugs-alert"
      >
        远程药品字典暂无数据（接口来源：{{ store.drugDictSource }}）。表格区域为空属正常状态，可在本页新增或于后台维护。
      </a-alert>
      <a-tabs v-model:active-key="activeTab" type="rounded" class="config-drugs-tabs">
        <a-tab-pane key="dict" title="药品字典">
          <DrugDictPanel
            :model-value="dictList"
            :persist-item="persistItem"
            :disable-item="disableItem"
          />
        </a-tab-pane>
        <a-tab-pane v-for="cat in categories" :key="cat" :title="cat">
          <div class="inventory-pane">
            <a-alert
              v-if="lowStockCount(cat)"
              type="warning"
              show-icon
              class="inventory-alert"
            >
              {{ cat }} 有 <strong>{{ lowStockCount(cat) }}</strong> 种药品库存低于安全线，请及时补货。
            </a-alert>
            <div class="inventory-table-wrap">
              <a-table
                :data="inventoryByCategory(cat)"
                row-key="id"
                :pagination="false"
                :stripe="true"
                :bordered="false"
                size="medium"
              >
                <template #empty>
                  <a-empty description="该分类暂无库存数据" />
                </template>
                <template #columns>
                  <a-table-column title="药品" data-index="name" />
                  <a-table-column title="规格" data-index="specification">
                    <template #cell="{ record }">{{ record.specification || '—' }}</template>
                  </a-table-column>
                  <a-table-column title="库存" :width="130">
                    <template #cell="{ record }">
                      <a-tag :color="isLowStock(record) ? 'red' : 'green'" bordered>
                        {{ record.stock }} {{ record.unit }}
                      </a-tag>
                    </template>
                  </a-table-column>
                  <a-table-column title="安全库存" :width="110">
                    <template #cell="{ record }">{{ record.minStock }} {{ record.unit }}</template>
                  </a-table-column>
                  <a-table-column title="单价" :width="96">
                    <template #cell="{ record }">
                      <span class="price-cell">¥{{ record.price }}</span>
                    </template>
                  </a-table-column>
                  <a-table-column title="状态" :width="108" align="center">
                    <template #cell="{ record }">
                      <a-badge
                        v-if="isLowStock(record)"
                        status="danger"
                        text="库存预警"
                      />
                      <a-badge v-else status="success" text="正常" />
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </ModulePageShell>
</template>



<script setup lang="ts">
import { Message } from '@arco-design/web-vue';
import { computed, ref } from 'vue';
import DrugDictPanel from '@/components/config/DrugDictPanel.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useRealAnesthesiaDict } from '@/config/apiFlags';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { DRUG_INVENTORY_CATEGORIES, type DrugInventoryItem } from '@/types/clinicalModules';
import type { DrugDictItem } from '@/types/system';



const store = useAnesthesiaStore();
const activeTab = ref('dict');
const dictList = computed(() => store.configDrugs);
const showRemoteDrugEmpty = computed(
  () => useRealAnesthesiaDict() && store.drugDictSource === 'remote' && dictList.value.length === 0,
);



const persistItem = async (item: DrugDictItem, _mode: 'create' | 'update') => {
  const ok = await store.saveDrugDictEntry(item);
  if (ok) Message.success('药品已保存');
  return ok;
};



const disableItem = async (item: DrugDictItem) => {
  const ok = await store.disableDrugDictEntry(item.id);
  if (ok) Message.success('药品已停用');
  return ok;
};



const categories = DRUG_INVENTORY_CATEGORIES;



const inventoryByCategory = (cat: DrugInventoryItem['category']) =>
  store.drugInventory.filter((item) => item.category === cat);



const isLowStock = (item: DrugInventoryItem) => item.stock < item.minStock;
const lowStockCount = (cat: DrugInventoryItem['category']) =>
  inventoryByCategory(cat).filter(isLowStock).length;
</script>



<style scoped>
.config-drugs-card :deep(.arco-card-body) {
  padding-top: 8px;
}

.config-drugs-alert {
  margin-bottom: 12px;
  border-radius: 10px;
}



.config-drugs-tabs :deep(.arco-tabs-nav) {
  margin-bottom: 4px;
}



.config-drugs-tabs :deep(.arco-tabs-content) {
  padding-top: 4px;
}



.inventory-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}



.inventory-alert {
  border-radius: 10px;
}



.inventory-alert strong {
  color: inherit;
}



.inventory-table-wrap :deep(.arco-table-th) {
  background: var(--surface-muted, #f8fafc);
  font-weight: 600;
}



.price-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-primary);
}
</style>

