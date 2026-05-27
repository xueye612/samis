<template>
  <a-drawer :visible="visible" title="输液输血" @cancel="$emit('update:visible', false)">
    <a-alert type="info" show-icon>支持晶体液、胶体液、血制品和自体血登记；当前由麻醉记录单页面模拟维护。</a-alert>
  </a-drawer>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>();
defineEmits<{ 'update:visible': [value: boolean] }>();
</script>
