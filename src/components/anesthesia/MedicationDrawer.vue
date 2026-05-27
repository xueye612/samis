<template>
  <a-drawer :visible="visible" title="术中用药" @cancel="$emit('update:visible', false)">
    <a-alert type="info" show-icon>支持单次用药、持续泵入和吸入麻醉药录入；当前由麻醉记录单页面模拟维护。</a-alert>
  </a-drawer>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>();
defineEmits<{ 'update:visible': [value: boolean] }>();
</script>
