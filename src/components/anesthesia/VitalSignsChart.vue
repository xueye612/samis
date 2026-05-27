<template>
  <VitalsChart :vitals="vitals" />
</template>

<script setup lang="ts">
import VitalsChart from '@/components/VitalsChart.vue';
import type { VitalSign } from '@/types/anesthesia';

defineProps<{ vitals: VitalSign[] }>();
</script>
