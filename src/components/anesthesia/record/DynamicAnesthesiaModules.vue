<template>
  <a-card class="dynamic-modules-card" :class="{ compact }" :bordered="false">
    <template v-if="!compact" #title>
      <div class="section-title">
        <strong>动态专业模块</strong>
        <span>{{ modules.length }} 个模块已加载</span>
      </div>
    </template>

    <div class="module-grid">
      <section
        v-for="module in modules"
        :key="module.key"
        class="module-panel"
        :class="{ focused: focusModuleKeys.includes(module.key), compact }"
        :style="{ '--module-accent': module.accent }"
      >
        <header>
          <strong>{{ module.title }}</strong>
          <a-tag v-if="!compact" color="arcoblue">已加载</a-tag>
          <p v-if="!compact">{{ module.summary }}</p>
        </header>

        <template v-if="compact">
          <div
            v-for="section in module.sections"
            :key="`${module.key}-${section.title}`"
            class="module-section-compact"
          >
            <div class="section-compact-title">{{ section.title }}</div>
            <dl class="module-fields">
              <div
                v-for="item in section.items"
                :key="`${section.title}-${item.label}`"
                :class="{ emphasis: item.emphasis }"
              >
                <dt>{{ item.label }}</dt>
                <dd v-if="readOnly">{{ fieldValue(section.title, item.label, item.value) || '待记录' }}</dd>
                <input
                  v-else
                  class="module-field-input"
                  type="text"
                  :value="fieldValue(section.title, item.label, item.value)"
                  placeholder="待记录"
                  @change="onSave(section.title, item.label, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </dl>
          </div>
        </template>

        <a-collapse v-else :default-active-key="module.sections.map((section) => section.title)" :bordered="false">
          <a-collapse-item v-for="section in module.sections" :key="section.title" :header="section.title">
            <dl class="module-fields">
              <div
                v-for="item in section.items"
                :key="`${section.title}-${item.label}`"
                :class="{ emphasis: item.emphasis }"
              >
                <dt>{{ item.label }}</dt>
                <dd v-if="readOnly">{{ fieldValue(section.title, item.label, item.value) || '待记录' }}</dd>
                <input
                  v-else
                  class="module-field-input"
                  type="text"
                  :value="fieldValue(section.title, item.label, item.value)"
                  placeholder="待记录"
                  @change="onSave(section.title, item.label, ($event.target as HTMLInputElement).value)"
                />
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
  focusModuleKeys?: AnesthesiaMethodKey[];
  compact?: boolean;
  fieldValues?: Record<string, string>;
  readOnly?: boolean;
}>(), {
  focusModuleKeys: () => [],
  compact: false,
  fieldValues: () => ({}),
  readOnly: false,
});

const emit = defineEmits<{
  'save-field': [group: string, label: string, value: string];
}>();

const modules = computed(() => getDynamicModuleEntries(props.methods));

const fieldKey = (group: string, label: string) => `${group}::${label}`;

const fieldValue = (group: string, label: string, fallback: string) => (
  props.fieldValues[fieldKey(group, label)]
  ?? Object.entries(props.fieldValues).find(([key]) => key.endsWith(`::${label}`))?.[1]
  ?? fallback
);

const onSave = (group: string, label: string, value: string) => {
  emit('save-field', group, label, value);
};
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

.module-panel.compact {
  box-shadow: inset 3px 0 0 var(--module-accent);
}

.module-panel.focused {
  border-color: color-mix(in srgb, var(--module-accent) 45%, #dbe6f3);
  background: color-mix(in srgb, var(--module-accent) 5%, #fff);
}

.module-panel header {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 4px 16px;
}

.module-panel header p {
  flex-basis: 100%;
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}

.module-panel.compact header {
  padding: 8px 10px 4px 12px;
}

.module-panel.compact header strong {
  font-size: 12px;
}

.module-section-compact + .module-section-compact {
  border-top: 1px dashed #e2e8f0;
}

.section-compact-title {
  padding: 6px 10px 4px 12px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.module-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0 10px 10px 12px;
}

.module-panel.compact .module-fields {
  grid-template-columns: 1fr;
  gap: 0;
  padding: 0 8px 8px 10px;
}

.module-fields div {
  min-width: 0;
  padding: 8px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #fbfdff;
}

.module-panel.compact .module-fields div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  border-radius: 0;
  background: #fff;
}

.module-panel.compact .module-fields div:last-child {
  border-bottom: 0;
}

.module-fields div.emphasis {
  border-color: color-mix(in srgb, var(--module-accent) 35%, #e5edf5);
  background: color-mix(in srgb, var(--module-accent) 7%, #fff);
}

.module-panel.compact .module-fields div.emphasis {
  background: color-mix(in srgb, var(--module-accent) 6%, #fff);
}

.module-fields dt {
  color: #64748b;
  font-size: 12px;
}

.module-panel.compact .module-fields dt {
  font-size: 11px;
  line-height: 1.3;
}

.module-fields dd {
  margin: 3px 0 0;
  font-weight: 650;
  color: #1d2939;
}

.module-panel.compact .module-fields dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.3;
  text-align: right;
  word-break: break-word;
}

.module-field-input {
  width: 100%;
  margin-top: 4px;
  padding: 4px 6px;
  border: 1px solid #dbe6f3;
  border-radius: 4px;
  font-size: 12px;
}

.module-panel.compact .module-field-input {
  margin-top: 0;
  min-height: 28px;
  padding: 2px 6px;
}

@media (max-width: 1180px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
}
</style>
