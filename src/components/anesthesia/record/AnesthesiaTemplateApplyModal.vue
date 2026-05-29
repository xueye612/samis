<template>
  <a-modal
    :visible="visible"
    width="920px"
    title="应用麻醉模板到记录单"
    unmount-on-close
    @cancel="$emit('cancel')"
  >
    <template v-if="draft">
      <section class="apply-overview">
        <div>
          <span>当前模板</span>
          <strong>{{ draft.templateName }}</strong>
        </div>
        <div>
          <span>麻醉方式组合</span>
          <a-space wrap>
            <a-tag v-for="label in draft.methodLabels" :key="label" color="arcoblue">{{ label }}</a-tag>
          </a-space>
        </div>
        <div>
          <span>落单方式</span>
          <strong>生成待确认项</strong>
        </div>
      </section>

      <div class="apply-module-list">
        <section v-for="module in draft.modules" :key="module.key" class="apply-module" :style="{ '--module-accent': module.accent }">
          <header>
            <strong>{{ module.title }}</strong>
            <span>{{ module.summary }}</span>
          </header>

          <dl>
            <template v-for="section in module.sections" :key="section.title">
              <dt>{{ section.title }}</dt>
              <dd>
                <span v-for="item in section.items" :key="`${section.title}-${item.label}`">
                  <b>{{ item.label }}</b>{{ item.value }}
                </span>
              </dd>
            </template>
          </dl>
        </section>
      </div>
    </template>

    <a-empty v-else description="请选择麻醉模板" />

    <template #footer>
      <a-button @click="$emit('cancel')">取消</a-button>
      <a-button type="primary" :disabled="!draft" @click="handleApply">生成待确认落单</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import type { AnesthesiaTemplateApplyDraft } from '@/services/anesthesiaRecordMethodEngine';

const props = defineProps<{
  visible: boolean;
  draft?: AnesthesiaTemplateApplyDraft | null;
}>();

const emit = defineEmits<{
  apply: [draft: AnesthesiaTemplateApplyDraft];
  cancel: [];
}>();

const handleApply = () => {
  if (props.draft) emit('apply', props.draft);
};
</script>

<style scoped>
.apply-overview {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 170px;
  gap: 10px;
  margin-bottom: 14px;
}

.apply-overview > div {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fbfdff;
}

.apply-overview span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 12px;
}

.apply-module-list {
  display: grid;
  gap: 10px;
  max-height: 56vh;
  overflow: auto;
  padding-right: 4px;
}

.apply-module {
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 4px 0 0 var(--module-accent);
}

.apply-module header {
  display: grid;
  gap: 4px;
  padding: 12px 14px 8px 16px;
}

.apply-module header span {
  color: #64748b;
  font-size: 12px;
}

.apply-module dl {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0 14px 14px 16px;
}

.apply-module dt {
  color: #334155;
  font-weight: 650;
}

.apply-module dd {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}

.apply-module dd span {
  padding: 5px 8px;
  border-radius: 6px;
  background: #f6f8fb;
  color: #1d2939;
  font-size: 12px;
}

.apply-module dd b {
  margin-right: 4px;
  color: #64748b;
}

@media (max-width: 760px) {
  .apply-overview {
    grid-template-columns: 1fr;
  }
}
</style>
