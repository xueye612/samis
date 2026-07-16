<template>
  <div class="config-row-actions">
    <a-button
      v-for="act in primaryActions"
      :key="act.key"
      type="text"
      size="mini"
      :status="act.danger ? 'danger' : 'normal'"
      class="config-row-action-btn"
      @click="emit('action', act.key)"
    >{{ act.label }}</a-button>
    <a-dropdown v-if="moreActions.length" trigger="click" position="br">
      <a-button type="text" size="mini" class="config-row-action-btn config-row-more">
        <template #icon><icon-unordered-list /></template>
        更多
      </a-button>
      <template #content>
        <a-doption
          v-for="act in moreActions"
          :key="act.key"
          @click="emit('action', act.key)"
        >
          <span :class="{ 'config-row-danger': act.danger }">{{ act.label }}</span>
        </a-doption>
      </template>
    </a-dropdown>
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

const visibleActions = computed(() => props.actions.filter((a) => !a.hidden));
const primaryActions = computed(() => visibleActions.value.filter((a) => a.primary));
const moreActions = computed(() => visibleActions.value.filter((a) => !a.primary));
</script>

<style scoped>
.config-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.config-row-action-btn {
  padding: 0 6px;
  height: 26px;
}
.config-row-danger {
  color: var(--danger);
}
</style>
