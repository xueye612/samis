<template>
  <VitalSignDictPanel :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VitalSignDictPanel from '@/components/config/VitalSignDictPanel.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { persistArrayDiff } from '@/composables/useDictArrayPersist';
import type { VitalSignDictItem } from '@/types/system';

const store = useAnesthesiaStore();
const list = computed(() => store.configVitals);

const save = async (value: VitalSignDictItem[]) => {
  const prev = store.configVitals;
  store.upsertVitalSignDict(value);
  await persistArrayDiff<VitalSignDictItem>(value, prev, {
    save: (item) => store.saveVitalSignDictEntry(item),
    disable: (item) => store.disableVitalSignDictEntry(item.id),
  });
};
</script>
