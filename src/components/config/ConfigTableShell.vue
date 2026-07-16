<template>
  <a-card class="section-card config-table-shell" :bordered="false">
    <template v-if="$slots.title || title" #title>
      <slot name="title">
        <a-space>
          <span>{{ title }}</span>
          <slot name="title-tag" />
        </a-space>
      </slot>
    </template>
    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
    <slot name="alerts" />
    <div class="config-table-scroll">
      <slot />
    </div>
  </a-card>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<style scoped>
.config-table-shell :deep(.arco-card-body) {
  min-width: 0;
}
.config-table-scroll {
  width: 100%;
  min-width: 0;
}
/* 统一门禁：表头单行不换行，杜绝逐字竖排 */
.config-table-shell :deep(.arco-table-th) {
  white-space: nowrap;
}
/* 长编码/长文本单行省略，hover 由 title 提示完整内容 */
.config-table-shell :deep(.cell-ellipsis) {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 操作列固定在右侧时保持净空，避免与数据列重叠 */
.config-table-shell :deep(.arco-table-col-fixed-right) {
  background: var(--surface);
}
</style>
