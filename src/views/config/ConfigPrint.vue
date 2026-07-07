<template>
  <DictCrudPanel title="打印模板" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';
import { persistStringListDiff } from '@/composables/useDictArrayPersist';

const store = useAnesthesiaStore();
const key = 'configPrintTemplates' as DictListKey;
const list = computed(() => store[key] as string[]);

const save = async (names: string[]) => {
  const prev = store[key] as string[];
  store.upsertDictList(key, names);
  await persistStringListDiff(names, prev, {
    save: (name) => store.saveTemplateEntry({ id: name, templateName: name, enabled: true }),
    disable: (name) => {
      const target = store.configTemplateItems.find((item) => item.templateName === name);
      return target ? store.disableTemplateEntry(target.id) : Promise.resolve(true);
    },
  });
};
</script>
