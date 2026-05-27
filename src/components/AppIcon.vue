<template>
  <component :is="iconComponent" v-if="iconComponent" :style="sizeStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { appIcons, type AppIconName } from '@/icons/registry';

const props = withDefaults(
  defineProps<{
    name: AppIconName;
    size?: number;
  }>(),
  { size: 16 },
);

const iconComponent = computed(() => appIcons[props.name]);
const sizeStyle = computed(() => ({ fontSize: `${props.size}px` }));
</script>
