<template>
  <ModulePageShell
    title="液体/血制品管理"
    description="维护晶体液、胶体液、血液制品与自体血回输的默认用量及核对要求"
  >
    <FluidBloodDictPanel :model-value="list" @update:model-value="save" />
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FluidBloodDictPanel from '@/components/config/FluidBloodDictPanel.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { persistArrayDiff } from '@/composables/useDictArrayPersist';
import type { FluidBloodDictItem } from '@/types/system';

const store = useAnesthesiaStore();
const list = computed(() => store.configFluids);

const save = async (value: FluidBloodDictItem[]) => {
  const prev = store.configFluids;
  store.upsertFluidBloodDict(value);
  await persistArrayDiff<FluidBloodDictItem>(value, prev, {
    save: (item) => store.saveFluidDictEntry(item),
    disable: (item) => store.disableFluidDictEntry(item),
  });
};
</script>
