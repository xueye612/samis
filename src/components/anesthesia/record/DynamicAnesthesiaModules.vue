<template>
  <a-card class="dynamic-modules-card" :class="{ compact }" :bordered="false">
    <template #title>
      <div class="section-title">
        <strong>动态专业模块</strong>
        <span>{{ modules.length }} 个模块已加载</span>
      </div>
    </template>

    <div class="module-grid">
      <section v-for="module in modules" :key="module.key" class="module-panel" :style="{ '--module-accent': module.accent }">
        <header>
          <div>
            <strong>{{ module.title }}</strong>
            <p>{{ module.summary }}</p>
          </div>
          <a-tag color="arcoblue">已加载</a-tag>
        </header>

        <a-collapse :default-active-key="module.sections.map((section) => section.title)" :bordered="false">
          <a-collapse-item v-for="section in module.sections" :key="section.title" :header="section.title">
            <dl class="module-fields">
              <div v-for="item in section.items" :key="`${section.title}-${item.label}`" :class="{ emphasis: item.emphasis }">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </a-collapse-item>
        </a-collapse>
      </section>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import { getDynamicModuleEntries } from '@/services/anesthesiaRecordMethodEngine';

const props = withDefaults(defineProps<{
  methods: AnesthesiaMethodKey[];
  compact?: boolean;
}>(), {
  compact: false,
});

const modules = computed(() => getDynamicModuleEntries(props.methods));
</script>

<style scoped>
.dynamic-modules-card {
  border: 1px solid #e5edf5;
}

.dynamic-modules-card.compact {
  border: 0;
  background: transparent;
}

.dynamic-modules-card.compact :deep(.arco-card-header) {
  display: none;
}

.dynamic-modules-card.compact :deep(.arco-card-body) {
  padding: 0;
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title span {
  color: #64748b;
  font-size: 12px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dynamic-modules-card.compact .module-grid {
  grid-template-columns: 1fr;
  gap: 8px;
}

.module-panel {
  overflow: hidden;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 4px 0 0 var(--module-accent);
}

.module-panel header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 14px 4px 16px;
}

.module-panel header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.dynamic-modules-card.compact .module-panel header {
  padding: 9px 10px 2px 12px;
}

.dynamic-modules-card.compact .module-panel header p {
  display: none;
}

.dynamic-modules-card.compact .module-fields {
  grid-template-columns: 1fr;
}

.module-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.module-fields div {
  min-width: 0;
  padding: 8px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #fbfdff;
}

.module-fields div.emphasis {
  border-color: color-mix(in srgb, var(--module-accent) 35%, #e5edf5);
  background: color-mix(in srgb, var(--module-accent) 7%, #fff);
}

.module-fields dt {
  color: #64748b;
  font-size: 12px;
}

.module-fields dd {
  margin: 3px 0 0;
  font-weight: 650;
  color: #1d2939;
}

@media (max-width: 1180px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
}
</style>
