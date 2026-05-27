<template>
  <VitalSignDictPanel :model-value="list" @update:model-value="save" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VitalSignDictPanel from '@/components/config/VitalSignDictPanel.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const list = computed(() => store.configVitals);
const save = (value: typeof store.configVitals) => store.upsertVitalSignDict(value);
</script>
