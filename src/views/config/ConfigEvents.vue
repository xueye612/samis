<template>
  <DictCrudPanel title="事件字典" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';
import { persistStringListDiff } from '@/composables/useDictArrayPersist';

const store = useAnesthesiaStore();
const key = 'configEvents' as DictListKey;
const categoryCode = 'anesthesia_event';
const list = computed(() => store[key] as string[]);

const save = async (value: string[]) => {
  const prev = store[key] as string[];
  // 即时更新本地展示
  store.upsertDictList(key, value);
  await persistStringListDiff(value, prev, {
    save: (name) => store.saveDictListItem('configEvents', categoryCode, name),
    disable: (name) => store.disableDictListItem('configEvents', name),
  });
};
</script>
