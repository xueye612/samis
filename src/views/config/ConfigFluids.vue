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

const store = useAnesthesiaStore();
const list = computed(() => store.configFluids);
const save = (value: typeof store.configFluids) => store.upsertFluidBloodDict(value);
</script>
