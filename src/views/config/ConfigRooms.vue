<template>
  <DictCrudPanel title="手术间管理" :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DictCrudPanel from '@/components/shared/DictCrudPanel.vue';
import { useAnesthesiaStore, type DictListKey } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const key = 'configRooms' as DictListKey;
const list = computed(() => store[key] as string[]);
const save = (value: string[]) => store.upsertDictList(key, value);
</script>
