<template>
  <a-drawer :visible="visible" title="抢救记录" @cancel="$emit('update:visible', false)">
    <a-alert type="error" show-icon>抢救记录需补齐开始/结束时间、抢救措施、用药、参加人员和补记说明。</a-alert>
  </a-drawer>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>();
defineEmits<{ 'update:visible': [value: boolean] }>();
</script>
