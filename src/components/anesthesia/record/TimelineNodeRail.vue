<template>
  <section class="timeline-rail" :class="{ embedded }">
    <header v-if="!embedded && showHeader" class="timeline-rail-head">
      <strong>关键时间轴</strong>
      <span>{{ methodLabels.join(' + ') || '待确认麻醉方式' }}</span>
    </header>

    <div v-if="embedded" class="sheet-band timeline-band" :style="timelineBandStyle">
      <div class="band-side">关键时间</div>
      <div class="band-labels timeline-labels"></div>
      <div ref="trackRef" class="band-track timeline-track" :style="trackStyle">
        <span
          v-for="line in gridLines"
          :key="line.id"
          class="grid-line"
          :class="{ major: line.isMajor }"
          :style="{ left: `${line.percent}%` }"
        />
        <a-popover
          v-for="node in positionedNodes"
          :key="node.key"
          trigger="click"
          position="top"
          :popup-visible="popoverKey === node.key"
          @popup-visible-change="(visible) => onPopoverVisible(node.key, visible)"
        >
          <button
            type="button"
            class="timeline-node-embedded"
            :class="{ recorded: node.recorded, active: activeKey === node.key, disabled: locked }"
            :style="{
              left: `${node.displayPercent}%`,
              transform: `translate(-50%, calc(-50% + ${node.lane * laneStepPx}px))`,
            }"
            :disabled="locked"
            @click.stop="openPopover(node)"
          >
            <em>{{ node.label }}</em>
            <strong>{{ node.recorded ? formatTimelineClock(node.time) : '+' }}</strong>
          </button>
          <template #content>
            <div class="timeline-popover">
              <p>{{ node.label }}</p>
              <a-time-picker
                v-model="editorTime"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
                :disabled="locked"
              />
              <a-space>
                <a-button size="mini" type="primary" :disabled="locked" @click="saveNow(node)">现在</a-button>
                <a-button size="mini" type="primary" :disabled="locked" @click="saveNode(node)">保存</a-button>
              </a-space>
            </div>
          </template>
        </a-popover>
      </div>
    </div>

    <div v-else class="timeline-list">
      <a-popover
        v-for="(node, index) in nodes"
        :key="node.key"
        trigger="click"
        position="left"
        :popup-visible="popoverKey === node.key"
        @popup-visible-change="(visible) => onPopoverVisible(node.key, visible)"
      >
        <button
          type="button"
          class="timeline-row"
          :class="{
            recorded: node.recorded,
            active: activeKey === node.key,
            pending: !node.recorded,
            last: index === nodes.length - 1,
          }"
          :disabled="locked"
          @click="openPopover(node)"
        >
          <span class="timeline-marker" aria-hidden="true">
            <i class="timeline-dot"></i>
            <i v-if="index < nodes.length - 1" class="timeline-stem"></i>
          </span>
          <span class="timeline-row-main">
            <span class="node-label">{{ node.label }}</span>
            <span class="node-time">{{ node.recorded ? formatTimelineClock(node.time) : '待记录' }}</span>
          </span>
        </button>
        <template #content>
          <div class="timeline-popover">
            <p>{{ node.label }}</p>
            <a-time-picker
              v-model="editorTime"
              format="HH:mm"
              value-format="HH:mm"
              style="width: 100%"
              :disabled="locked"
            />
            <a-space>
              <a-button size="mini" type="primary" :disabled="locked" @click="saveNow(node)">现在</a-button>
              <a-button size="mini" type="primary" :disabled="locked" @click="saveNode(node)">保存</a-button>
            </a-space>
          </div>
        </template>
      </a-popover>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { buildRecordBandGrid, buildLiveTimeScale, timeToPercent } from '@/services/anesthesiaRecordEngine';
import { resolveTimelineNodeLanes } from '@/services/recordLayoutEngine';
import { buildTimelineNodeStates, buildRecordClockIso, buildRecordNowIso, formatTimelineClock, type MethodTimelineNode } from '@/services/methodTimelineEngine';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { SurgeryCase } from '@/types/anesthesia';

const props = withDefaults(defineProps<{
  record: SurgeryCase;
  methodKeys: AnesthesiaMethodKey[];
  methodLabels?: string[];
  locked?: boolean;
  embedded?: boolean;
  sheetStart?: string;
  sheetEnd?: string;
  activeKey?: string;
  showHeader?: boolean;
}>(), {
  methodLabels: () => [],
  locked: false,
  embedded: true,
  activeKey: '',
  showHeader: true,
});

const emit = defineEmits<{
  save: [node: MethodTimelineNode, isoTime: string];
  focus: [node: MethodTimelineNode];
}>();

const trackRef = ref<HTMLElement | null>(null);
const popoverKey = ref('');
const editorTime = ref('');

const nodes = computed(() => buildTimelineNodeStates(props.record, props.methodKeys));

const timeScale = computed(() => {
  if (props.sheetStart && props.sheetEnd) {
    return buildLiveTimeScale(props.sheetStart, props.sheetEnd);
  }
  const start = props.record.plannedStart || props.record.anesthesiaStart || dayjs().toISOString();
  const end = props.record.leaveRoomTime || props.record.surgeryEnd || dayjs(start).add(3, 'hour').toISOString();
  return buildLiveTimeScale(start, end);
});

const trackStyle = computed(() => ({
  '--minor-count': Math.max(1, timeScale.value.minorTicks.length - 1),
  backgroundSize: `calc(100% / ${Math.max(1, timeScale.value.minorTicks.length - 1)}) 100%`,
}));

const gridLines = computed(() => buildRecordBandGrid(timeScale.value, 1).verticalLines);

const positionedNodes = computed(() => {
  const start = props.sheetStart || timeScale.value.start;
  const end = props.sheetEnd || timeScale.value.end;
  const total = nodes.value.length || 1;
  const raw = nodes.value.map((node, index) => ({
    ...node,
    leftPercent: node.time
      ? timeToPercent(node.time, start, end)
      : Number(((index + 0.5) / total) * 100),
  }));
  return resolveTimelineNodeLanes(raw);
});

const maxTimelineLane = computed(() => positionedNodes.value.reduce((max, node) => Math.max(max, node.lane), 0));
const timelineBandStyle = computed(() => ({
  minHeight: `${Math.max(64, 36 + (maxTimelineLane.value + 1) * 28)}px`,
}));
const laneStepPx = 28;

const buildIsoTime = (clock: string) => buildRecordClockIso(props.record, clock);

const openPopover = (node: MethodTimelineNode & { time?: string }) => {
  if (props.locked) return;
  popoverKey.value = node.key;
  editorTime.value = node.time ? dayjs(node.time).format('HH:mm') : dayjs(buildRecordNowIso(props.record)).format('HH:mm');
  emit('focus', node);
};

const onPopoverVisible = (key: string, visible: boolean) => {
  popoverKey.value = visible ? key : '';
};

const saveNode = (node: MethodTimelineNode) => {
  if (!editorTime.value || props.locked) return;
  emit('save', node, buildIsoTime(editorTime.value));
  popoverKey.value = '';
};

const saveNow = (node: MethodTimelineNode) => {
  if (props.locked) return;
  emit('save', node, buildRecordNowIso(props.record));
  popoverKey.value = '';
};

watch(() => props.record.id, () => {
  popoverKey.value = '';
});

defineExpose({ trackRef });
</script>

<style scoped>
.timeline-rail.embedded {
  margin: 0;
}

.timeline-rail-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
}

.timeline-band {
  display: grid;
  grid-template-columns: var(--sheet-side-col, 28px) var(--sheet-label-col, 112px) 1fr;
  min-height: 64px;
  border-bottom: 1px solid #111827;
}

.timeline-labels {
  border-right: 1px solid #111827;
  background: #fff;
}

.band-side {
  display: grid;
  place-items: center;
  border-right: 1px solid #111827;
  background: #f1f5f9;
  font-weight: 700;
  font-size: 12px;
  color: #0f172a;
}

.timeline-track {
  position: relative;
  min-height: 56px;
  overflow: visible;
  background-image: linear-gradient(to right, rgba(71, 85, 105, 0.32) 1px, transparent 1px);
  background-repeat: repeat;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(71, 85, 105, 0.28);
  pointer-events: none;
}

.grid-line.major {
  width: 1px;
  background: rgba(15, 23, 42, 0.55);
}

.timeline-node-embedded {
  position: absolute;
  top: 50%;
  z-index: 3;
  display: grid;
  gap: 2px;
  min-width: 56px;
  max-width: 72px;
  padding: 3px 5px;
  border: 1.5px solid #64748b;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
  transform: translate(-50%, -50%);
  cursor: pointer;
  text-align: center;
}

.timeline-node-embedded em {
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.2;
  white-space: nowrap;
}

.timeline-node-embedded strong {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.timeline-node-embedded.recorded {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 1px 3px rgb(37 99 235 / 18%);
}

.timeline-node-embedded.recorded em {
  color: #1e3a8a;
}

.timeline-node-embedded.recorded strong {
  color: #1d4ed8;
}

.timeline-node-embedded.active {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgb(29 78 216 / 25%);
}

.timeline-node-embedded:not(.recorded):not(.disabled) {
  border-style: dashed;
  border-color: #94a3b8;
}

.timeline-node-embedded.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.timeline-rail:not(.embedded) .timeline-list {
  display: grid;
  gap: 0;
  max-height: min(420px, calc(100vh - 220px));
  overflow: auto;
  padding: 2px 0;
}

.timeline-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  width: 100%;
  min-height: 34px;
  margin: 0;
  padding: 2px 4px 2px 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.timeline-row:hover:not(:disabled) {
  background: #f8fafc;
}

.timeline-row.active {
  background: #eff6ff;
}

.timeline-row:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.timeline-marker {
  position: relative;
  display: flex;
  justify-content: center;
  width: 18px;
  min-height: 34px;
}

.timeline-dot {
  position: relative;
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 12px;
  border: 2px solid #94a3b8;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
}

.timeline-row.recorded .timeline-dot {
  border-color: #2563eb;
  background: #2563eb;
}

.timeline-row.active .timeline-dot {
  box-shadow: 0 0 0 3px rgb(37 99 235 / 18%);
}

.timeline-stem {
  position: absolute;
  top: 20px;
  bottom: -2px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: #dbeafe;
}

.timeline-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
}

.timeline-row.recorded .timeline-row-main {
  border-color: #dbeafe;
  background: #f8fbff;
}

.timeline-row.pending .timeline-row-main {
  border-color: #e2e8f0;
  background: #fff;
  border-style: dashed;
}

.timeline-row.active .timeline-row-main {
  border-color: #93c5fd;
  background: #eff6ff;
}

.node-label {
  overflow: hidden;
  color: #0f172a;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-time {
  flex-shrink: 0;
  min-width: 42px;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.timeline-row.pending .node-time {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
}

.timeline-popover {
  display: grid;
  gap: 8px;
  width: 180px;
}

.timeline-popover p {
  margin: 0;
  font-weight: 700;
}
</style>
