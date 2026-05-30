<template>
  <section class="event-detail-panel">
    <header class="panel-head">
      <strong>事件专业补录</strong>
      <a-tag v-if="eventName" color="arcoblue">{{ eventName }}</a-tag>
    </header>

    <div v-if="eventName" class="panel-body">
      <p class="panel-desc">补充与「{{ eventName }}」相关的专业字段，保存后写入记录单。</p>
      <a-form :model="draft" layout="vertical" class="event-field-form">
        <a-form-item v-for="field in resolvedFields" :key="field.label" :label="field.label">
          <a-input
            :model-value="draft[field.label] ?? ''"
            :placeholder="field.placeholder"
            :disabled="locked"
            allow-clear
            @update:model-value="updateDraft(field.label, $event)"
          />
        </a-form-item>
      </a-form>

      <div v-if="relatedGaps.length" class="related-gaps">
        <strong>待补提醒</strong>
        <p v-for="gap in relatedGaps" :key="gap.id">{{ gap.text }}</p>
      </div>

      <footer class="panel-actions">
        <a-button type="primary" size="small" :disabled="locked" @click="saveAll">保存补录</a-button>
        <a-button size="small" :disabled="locked" @click="clearDraft">清空</a-button>
      </footer>
    </div>

    <div v-else class="event-empty-guide">
      <p class="guide-title">先选择事件，再填写专业字段</p>
      <p class="guide-desc">例如插管深度、麻醉平面、阻滞范围等，会在选定事件后出现输入框。</p>
      <div v-if="quickEvents.length" class="quick-event-grid">
        <a-button
          v-for="event in quickEvents"
          :key="event.name"
          size="small"
          type="outline"
          :disabled="locked"
          @click="$emit('select-event', event.name)"
        >
          {{ event.name }}
        </a-button>
      </div>
      <ul class="guide-tips">
        <li>点击上方「场景化工作台」推荐动作</li>
        <li>或点击记录单曲线上的状态符号</li>
        <li>或点顶部快捷事件按钮</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CompletionGap, QuickEventOption, TemplateLandingItem } from '@/mock/anesthesiaRecordPrototype';

const props = withDefaults(defineProps<{
  eventName?: string;
  fields: TemplateLandingItem[];
  completionGaps: CompletionGap[];
  fieldValues?: Record<string, string>;
  locked?: boolean;
  quickEvents?: QuickEventOption[];
}>(), {
  eventName: '',
  fieldValues: () => ({}),
  locked: false,
  quickEvents: () => [],
});

const emit = defineEmits<{
  'save-field': [group: string, label: string, value: string];
  'select-event': [eventName: string];
}>();

const draft = ref<Record<string, string>>({});

const fallbackFieldsByEvent: Record<string, Array<{ label: string; placeholder: string }>> = {
  插管: [
    { label: '气道方式', placeholder: '如 气管插管' },
    { label: '导管型号', placeholder: '如 7.0#' },
    { label: '插管深度', placeholder: '如 22 cm' },
    { label: 'EtCO2确认', placeholder: '如 波形正常' },
  ],
  喉罩: [
    { label: '气道方式', placeholder: '喉罩' },
    { label: '喉罩型号', placeholder: '如 4#' },
    { label: '通气情况', placeholder: '如 通畅' },
  ],
  穿刺: [
    { label: '穿刺体位', placeholder: '如 左侧卧' },
    { label: '穿刺间隙', placeholder: '如 L3-4' },
    { label: '脑脊液情况', placeholder: '如 清亮' },
  ],
  平面测定: [
    { label: '麻醉平面', placeholder: '如 T6' },
    { label: 'Bromage评分', placeholder: '如 0级' },
  ],
  阻滞评估: [
    { label: '感觉阻滞范围', placeholder: '如 C5-T1' },
    { label: '阻滞效果', placeholder: '如 完善' },
  ],
  镇静评估: [
    { label: '镇静评分', placeholder: '如 Ramsay 3' },
    { label: '氧疗方式', placeholder: '如 鼻导管' },
    { label: '呼吸情况', placeholder: '如 平稳' },
  ],
  局麻: [
    { label: '局麻部位', placeholder: '待填写' },
    { label: '局麻药', placeholder: '待填写' },
    { label: '麻醉效果', placeholder: '待填写' },
  ],
};

const fieldGroup = computed(() => (props.eventName ? `事件补录·${props.eventName}` : ''));

const fieldKey = (label: string) => `${fieldGroup.value}::${label}`;

const savedValue = (label: string) => props.fieldValues[fieldKey(label)] ?? '';

const resolvedFields = computed(() => {
  const fromLanding = props.fields
    .filter((item) => item.kind === 'field' && item.relatedEventName === props.eventName)
    .map((item) => ({
      label: item.label,
      placeholder: item.value && item.value !== '待补' ? item.value : '待填写',
    }));
  if (fromLanding.length) return fromLanding;
  const key = Object.keys(fallbackFieldsByEvent).find((name) => props.eventName?.includes(name));
  if (key) return fallbackFieldsByEvent[key];
  return [{ label: '记录要点', placeholder: '时间、处理措施、执行人等' }];
});

const relatedGaps = computed(() => props.completionGaps.filter(
  (gap) => !gap.relatedEventName || gap.relatedEventName === props.eventName,
));

const syncDraft = () => {
  draft.value = Object.fromEntries(
    resolvedFields.value.map((field) => [field.label, savedValue(field.label)]),
  );
};

watch(() => props.eventName, syncDraft, { immediate: true });
watch(() => props.fieldValues, syncDraft, { deep: true });

const updateDraft = (label: string, value: string) => {
  draft.value = { ...draft.value, [label]: value };
};

const saveAll = () => {
  if (!fieldGroup.value || props.locked) return;
  resolvedFields.value.forEach((field) => {
    emit('save-field', fieldGroup.value, field.label, draft.value[field.label] ?? '');
  });
};

const clearDraft = () => {
  draft.value = Object.fromEntries(resolvedFields.value.map((field) => [field.label, '']));
};
</script>

<style scoped>
.event-detail-panel {
  border: 1px solid #dbe6f3;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #edf2f7;
  background: #f8fbff;
}

.panel-body {
  padding: 10px 12px 12px;
}

.panel-desc {
  margin: 0 0 10px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}

.event-field-form :deep(.arco-form-item) {
  margin-bottom: 8px;
}

.event-field-form :deep(.arco-form-item-label) {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.related-gaps {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fff7ed;
}

.related-gaps p {
  margin: 0;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.45;
}

.event-empty-guide {
  padding: 14px 12px 16px;
}

.guide-title {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.guide-desc {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.quick-event-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.guide-tips {
  margin: 0;
  padding-left: 1.2em;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.6;
}
</style>
