<template>
  <DictCrudPanel title="评分模板" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';
import { persistStringListDiff } from '@/composables/useDictArrayPersist';

const store = useAnesthesiaStore();
const key = 'configScores' as DictListKey;
const categoryCode = 'anesthesia_score';
const list = computed(() => store[key] as string[]);

const save = async (value: string[]) => {
  const prev = store[key] as string[];
  store.upsertDictList(key, value);
  await persistStringListDiff(value, prev, {
    save: (name) => store.saveDictListItem('configScores', categoryCode, name),
    disable: (name) => store.disableDictListItem('configScores', name),
  });
};
</script>
