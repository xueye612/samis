<template>
  <span class="nav-icon-badge" :class="[`nav-icon-badge--${variant}`, { 'nav-icon-badge--lg': large }]">
    <AppIcon :name="name" :size="size" />
  </span>
</template>

<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/icons/registry';

withDefaults(
  defineProps<{
    name: AppIconName;
    variant?: 'default' | 'active' | 'muted' | 'on-primary';
    size?: number;
    large?: boolean;
    /** @deprecated 使用 variant */
    tone?: string;
    solid?: boolean;
  }>(),
  { variant: 'default', size: 16, large: false },
);
</script>

<style scoped>
.nav-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--surface-muted);
}

.nav-icon-badge--lg {
  width: 32px;
  height: 32px;
}

.nav-icon-badge--active {
  color: var(--primary);
  background: var(--primary-soft);
}

.nav-icon-badge--muted {
  color: var(--text-tertiary);
  background: transparent;
}

.nav-icon-badge--on-primary {
  color: #fff;
  background: rgb(255 255 255 / 18%);
}
</style>
