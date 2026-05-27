<template>
  <MethodCategoryPanel :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MethodCategoryPanel from '@/components/config/MethodCategoryPanel.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const list = computed(() => store.configMethods);
const save = (value: typeof store.configMethods) => store.upsertMethodCategories(value);
</script>
