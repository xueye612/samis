<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { normalizeNumberedNotes, parseNumberedNoteLines } from '@/utils/numberedNotes';

const props = withDefaults(defineProps<{
  label: string;
  modelValue?: string;
  readonly?: boolean;
  printMode?: boolean;
  placeholder?: string;
  highlightIndexes?: number[];
  timelineEnabled?: boolean;
}>(), {
  modelValue: '',
  readonly: false,
  printMode: false,
  placeholder: '每行一条，保存后自动编号',
  highlightIndexes: () => [],
  timelineEnabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'select-line': [index: number];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const activeLineIndex = ref<number | null>(null);

const lines = computed(() => parseNumberedNoteLines(props.modelValue));
const timedLines = computed(() => lines.value.filter((item) => item.clock));

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
};

const onBlur = () => {
  if (props.readonly || props.printMode) return;
  const normalized = normalizeNumberedNotes(props.modelValue);
  if (normalized !== props.modelValue) emit('update:modelValue', normalized);
};

const focusTextareaLine = async (index: number) => {
  await nextTick();
  const textarea = textareaRef.value;
  if (!textarea) return;
  const lineIdx = lines.value.findIndex((item) => item.index === index);
  if (lineIdx < 0) return;
  const rows = textarea.value.split('\n');
  let start = 0;
  for (let i = 0; i < lineIdx; i += 1) start += rows[i].length + 1;
  const end = start + rows[lineIdx].length;
  textarea.focus();
  textarea.setSelectionRange(start, end);
  activeLineIndex.value = index;
  const lineHeight = 18;
  textarea.scrollTop = Math.max(0, lineIdx * lineHeight - textarea.clientHeight / 3);
};

const onSelectLine = (index: number, hasClock: boolean) => {
  if (!props.timelineEnabled || !hasClock) return;
  activeLineIndex.value = index;
  emit('select-line', index);
  void focusTextareaLine(index);
};

const onTextareaClick = () => {
  if (!props.timelineEnabled) return;
  const textarea = textareaRef.value;
  if (!textarea) return;
  const before = textarea.value.slice(0, textarea.selectionStart);
  const lineIdx = before.split('\n').length - 1;
  const line = lines.value[lineIdx];
  if (line?.clock) onSelectLine(line.index, true);
};

watch(() => props.highlightIndexes, (indexes) => {
  const index = indexes[0];
  if (!index || !props.timelineEnabled) return;
  void focusTextareaLine(index);
}, { deep: true });
</script>

<template>
  <div class="numbered-note-column" :class="{ 'is-print': printMode, 'has-timeline': timelineEnabled && timedLines.length }">
    <label class="numbered-note-label">{{ label }}</label>
    <textarea
      v-if="!readonly && !printMode"
      ref="textareaRef"
      class="numbered-note-input"
      :class="{ 'has-active-line': activeLineIndex !== null }"
      :value="modelValue"
      :placeholder="placeholder"
      rows="7"
      @input="onInput"
      @blur="onBlur"
      @click="onTextareaClick"
      @keyup="onTextareaClick"
    />
    <p v-if="timelineEnabled && timedLines.length && !readonly && !printMode" class="timeline-link-hint">
      与时间轴序号关联 · 点击行或标签定位出入量标记
    </p>
    <ul v-if="!readonly && !printMode && timelineEnabled && timedLines.length" class="timeline-preview">
      <li
        v-for="item in timedLines"
        :key="`preview-${item.index}`"
        :class="{ 'is-highlighted': highlightIndexes.includes(item.index) || activeLineIndex === item.index }"
        @click="onSelectLine(item.index, true)"
      >
        <b>#{{ item.index }}</b>
        <span>{{ item.clock }}</span>
        <em>{{ item.displayContent || item.content }}</em>
      </li>
    </ul>
    <ol v-else-if="lines.length && (readonly || printMode)" class="numbered-note-list">
      <li
        v-for="item in lines"
        :key="`${item.index}-${item.content}`"
        :class="{
          'has-timeline-marker': Boolean(item.clock),
          'is-highlighted': highlightIndexes.includes(item.index),
          clickable: timelineEnabled && Boolean(item.clock),
        }"
        @click="onSelectLine(item.index, Boolean(item.clock))"
      >
        <span>{{ item.displayContent || item.content }}</span>
      </li>
    </ol>
    <p v-else-if="readonly || printMode" class="numbered-note-empty">未记录</p>
  </div>
</template>

<style scoped>
.numbered-note-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px 10px;
  border-right: 1px solid #111827;
  background: #fff;
}

.numbered-note-column.has-timeline {
  background: linear-gradient(180deg, #fff 0%, #fffaf5 100%);
}

.numbered-note-column:last-child {
  border-right: 0;
}

.numbered-note-label {
  margin-bottom: 6px;
  color: #0f172a;
  font-size: 11px;
  font-weight: 700;
}

.numbered-note-input {
  flex: 1;
  width: 100%;
  min-height: 120px;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #111827;
  font-size: 11px;
  line-height: 1.55;
  font-family: inherit;
  resize: vertical;
}

.numbered-note-input.has-active-line {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 10%);
}

.numbered-note-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 12%);
}

.timeline-link-hint {
  margin: 4px 0 0;
  color: #9a3412;
  font-size: 10px;
  line-height: 1.4;
}

.timeline-preview {
  display: grid;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.timeline-preview li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 6px;
  align-items: baseline;
  padding: 4px 6px;
  border: 1px dashed #fdba74;
  border-radius: 4px;
  background: #fff7ed;
  font-size: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.timeline-preview li.is-highlighted {
  border-style: solid;
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 1px rgb(37 99 235 / 18%);
}

.timeline-preview b {
  color: #9a3412;
}

.timeline-preview span {
  color: #1d4ed8;
  font-weight: 700;
}

.timeline-preview em {
  overflow: hidden;
  color: #334155;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.numbered-note-list {
  margin: 0;
  padding-left: 1.35em;
  color: #111827;
  font-size: 11px;
  line-height: 1.55;
}

.numbered-note-list li + li {
  margin-top: 4px;
}

.numbered-note-list li.has-timeline-marker {
  list-style: decimal;
}

.numbered-note-list li.clickable {
  cursor: pointer;
}

.numbered-note-list li.is-highlighted {
  margin-left: -4px;
  padding: 2px 4px;
  border-radius: 4px;
  background: #fef3c7;
}

.numbered-note-empty {
  margin: 0;
  color: #64748b;
  font-size: 11px;
}
</style>
