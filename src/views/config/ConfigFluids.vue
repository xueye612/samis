<template>
  <FluidBloodDictPanel :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FluidBloodDictPanel from '@/components/config/FluidBloodDictPanel.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const list = computed(() => store.configFluids);
const save = (value: typeof store.configFluids) => store.upsertFluidBloodDict(value);
</script>
