<template>
  <div class="config-row-actions">
    <a-button
      v-for="act in visibleActions"
      :key="act.key"
      type="text"
      size="mini"
      :status="act.danger ? 'danger' : 'normal'"
      class="config-row-action-btn"
      @click="emit('action', act.key)"
    >{{ act.label }}</a-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface ConfigRowAction {
  key: string;
  label: string;
  danger?: boolean;
  hidden?: boolean;
  primary?: boolean;
  disabled?: boolean;
}

const props = defineProps<{ actions: ConfigRowAction[] }>();
const emit = defineEmits<{ (e: 'action', key: string): void }>();

/**
 * 操作列采用单行不换行的按钮组：主操作与生命周期/历史按钮均直接可点，
 * 配合表格 scroll.x 与受控列宽避免被压缩导致多行堆叠。
 * 不使用收起下拉，以保持既有功能用例对“编辑/暂停/停用”等按钮的可点击契约。
 */
const visibleActions = computed(() => props.actions.filter((a) => !a.hidden));
</script>

<style scoped>
.config-row-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0;
  white-space: nowrap;
}
.config-row-action-btn {
  padding: 0 4px;
  height: 26px;
  font-size: 12px;
}
</style>
