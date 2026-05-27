<template>
  <DrugDictPanel :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DrugDictPanel from '@/components/config/DrugDictPanel.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const list = computed(() => store.configDrugs);
const save = (value: typeof store.configDrugs) => store.upsertDrugDict(value);
</script>
