<template>
  <div class="metric-card" :class="{ 'metric-card--warn': variant === 'warn', 'metric-card--danger': variant === 'danger' }">
    <div v-if="icon" class="metric-card__icon" aria-hidden="true">
      <AppIcon :name="icon" :size="18" />
    </div>
    <div class="metric-card__body">
      <div class="metric-card__label">{{ label }}</div>
      <div class="metric-card__row">
        <span class="metric-card__value">{{ value }}</span>
        <a-tag v-if="tag" size="small" :color="tagColor">{{ tag }}</a-tag>
      </div>
      <div v-if="hint" class="metric-card__hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/icons/registry';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint?: string;
    tag?: string;
    variant?: 'default' | 'warn' | 'danger';
    icon?: AppIconName;
    /** @deprecated 使用 variant */
    tone?: string;
    alert?: boolean;
    color?: string;
  }>(),
  { variant: 'default' },
);

const resolvedVariant = computed(() => {
  if (props.variant !== 'default') return props.variant;
  if (props.alert || props.color === 'red') return 'danger';
  if (props.color === 'orange') return 'warn';
  return 'default';
});

const tagColor = computed(() => {
  if (resolvedVariant.value === 'danger') return 'red';
  if (resolvedVariant.value === 'warn') return 'orangered';
  return 'gray';
});
</script>

<style scoped>
.metric-card {
  display: flex;
  gap: 12px;
  min-height: 112px;
  padding: 16px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  box-shadow: var(--shadow-xs);
}

.metric-card--warn {
  border-color: var(--color-warning-100);
  border-left-color: var(--warning);
  background: linear-gradient(180deg, rgb(255 247 237), var(--surface));
}

.metric-card--danger {
  border-color: var(--color-danger-100);
  border-left-color: var(--danger);
  background: linear-gradient(180deg, rgb(254 242 242), var(--surface));
}

.metric-card__icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
  opacity: 0.9;
  padding-top: 0;
}

.metric-card--warn .metric-card__icon {
  background: var(--color-warning-100);
  color: var(--warning);
}

.metric-card--danger .metric-card__icon {
  background: var(--color-danger-100);
  color: var(--danger);
}

.metric-card__body {
  min-width: 0;
  flex: 1;
}

.metric-card__label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-card__row {
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.metric-card__value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.metric-card__hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
