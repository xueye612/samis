<template>
  <a-tag :color="colorMap[value] ?? 'gray'">{{ value }}</a-tag>
</template>

<script setup lang="ts">
import type { CaseStatus } from '@/types/anesthesia';

defineProps<{ value: CaseStatus | string }>();

const colorMap: Record<string, string> = {
  待入室: 'arcoblue',
  已入室: 'cyan',
  麻醉诱导: 'purple',
  麻醉中: 'blue',
  手术中: 'green',
  苏醒中: 'orange',
  PACU: 'magenta',
  已离室: 'gray',
  已取消: 'red',
  观察中: 'orange',
  待转出: 'blue',
  已转出: 'green',
};
</script>

