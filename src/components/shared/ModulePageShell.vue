<template>
  <div class="page-stack" :class="shellClass">
    <section v-if="title" class="module-hero">
      <div>
        <h2 class="module-hero__title">{{ title }}</h2>
        <p v-if="description" class="module-hero__desc">{{ description }}</p>
      </div>
      <div v-if="$slots.chips" class="module-hero__chips">
        <slot name="chips" />
      </div>
    </section>
    <div v-if="$slots.toolbar" class="page-toolbar">
      <slot name="toolbar" />
    </div>
    <div v-if="$slots.stats" class="stat-grid">
      <slot name="stats" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
  shellClass?: string;
}>();
</script>
