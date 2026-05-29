<template>
  <a-card class="event-detail-panel" :bordered="false">
    <template #title>
      <div class="panel-title">
        <strong>事件专业补录</strong>
        <a-tag v-if="eventName" color="arcoblue">{{ eventName }}</a-tag>
      </div>
    </template>

    <template v-if="eventName">
      <dl class="field-grid">
        <div v-for="field in visibleFields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </div>
      </dl>

      <div v-if="relatedGaps.length" class="related-gaps">
        <strong>待补提醒</strong>
        <p v-for="gap in relatedGaps" :key="gap.id">{{ gap.text }}</p>
      </div>
    </template>
    <a-empty v-else description="点击纸面事件或快捷事件后显示补录字段" />
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CompletionGap, TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';

const props = defineProps<{
  eventName?: string;
  fields: TemplateLandingItem[];
  completionGaps: CompletionGap[];
}>();

const fallbackFieldsByEvent: Record<string, Array<{ label: string; value: string }>> = {
  插管: [
    { label: '气道方式', value: '气管插管' },
    { label: '导管型号', value: '待补' },
    { label: '插管深度', value: '待补' },
    { label: 'EtCO2确认', value: '待补' },
  ],
  喉罩置入: [
    { label: '气道方式', value: '喉罩' },
    { label: '喉罩型号', value: '待补' },
    { label: '通气情况', value: '待补' },
  ],
  穿刺: [
    { label: '穿刺体位', value: '待补' },
    { label: '穿刺间隙', value: '待补' },
    { label: '脑脊液情况', value: '待补' },
  ],
  平面测定: [
    { label: '麻醉平面', value: '待补' },
    { label: 'Bromage评分', value: '待补' },
  ],
  阻滞评估: [
    { label: '感觉阻滞范围', value: '待补' },
    { label: '阻滞效果', value: '待补' },
  ],
  镇静评估: [
    { label: '镇静评分', value: '待补' },
    { label: '氧疗方式', value: '待补' },
    { label: '呼吸情况', value: '待补' },
  ],
  局麻: [
    { label: '局麻部位', value: '待补' },
    { label: '局麻药', value: '待补' },
    { label: '麻醉效果', value: '待补' },
  ],
};

const visibleFields = computed(() => {
  const fields = props.fields
    .filter((item) => item.kind === 'field' && item.relatedEventName === props.eventName)
    .map((item) => ({ label: item.label, value: item.value || '待补' }));
  if (fields.length) return fields;
  const key = Object.keys(fallbackFieldsByEvent).find((name) => props.eventName?.includes(name));
  return key ? fallbackFieldsByEvent[key] : [{ label: '记录要点', value: '按当前事件补充时间、处理和执行人' }];
});

const relatedGaps = computed(() => props.completionGaps.filter((gap) => !gap.relatedEventName || gap.relatedEventName === props.eventName));
</script>

<style scoped>
.event-detail-panel {
  border: 1px solid #dbe6f3;
  background: #fff;
}

.panel-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin: 0;
}

.field-grid div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-height: 32px;
  border: 1px solid #e5edf5;
  border-radius: 6px;
  overflow: hidden;
}

.field-grid dt,
.field-grid dd {
  margin: 0;
  padding: 7px 8px;
}

.field-grid dt {
  background: #f8fafc;
  color: #64748b;
}

.field-grid dd {
  font-weight: 650;
}

.related-gaps {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  background: #fff7ed;
}

.related-gaps p {
  margin: 0;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.45;
}
</style>
