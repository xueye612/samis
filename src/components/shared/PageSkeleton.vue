<template>
  <div class="page-skeleton">
    <a-skeleton :animation="true">
      <a-space direction="vertical" :size="16" fill>
        <a-skeleton-line :rows="1" :line-height="48" />
        <a-skeleton-line :rows="3" />
        <a-skeleton-line :rows="6" />
      </a-space>
    </a-skeleton>
  </div>
</template>

<style scoped>
.page-skeleton {
  padding: var(--space-4);
}
</style>
