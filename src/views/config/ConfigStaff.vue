<template>
  <DictCrudPanel title="麻醉人员" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';
import { persistStringListDiff } from '@/composables/useDictArrayPersist';

const store = useAnesthesiaStore();
const key = 'configStaff' as DictListKey;
const list = computed(() => store[key] as string[]);

const save = async (names: string[]) => {
  const prev = store[key] as string[];
  store.upsertDictList(key, names);
  await persistStringListDiff(names, prev, {
    save: (name) => store.saveStaffEntry({ id: name, name, role: '麻醉医生', enabled: true }),
    disable: (name) => {
      const target = store.configStaffItems.find((item) => item.name === name);
      return target ? store.disableStaffEntry(target.id) : Promise.resolve(true);
    },
  });
};
</script>
