<template>
  <div class="empty-state">
    <AppIcon v-if="icon" :name="icon" :size="32" class="empty-state__icon" />
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="description" class="empty-state__desc">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/icons/registry';

defineProps<{
  title: string;
  description?: string;
  icon?: AppIconName;
}>();
</script>

<style scoped>
.empty-state {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--text-secondary);
}

.empty-state__icon {
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
}

.empty-state__title {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.empty-state__desc {
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-sm);
}
</style>
