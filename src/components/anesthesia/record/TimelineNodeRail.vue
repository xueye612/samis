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
            :class="{ recorded: node.recorded, active: activeKey === node.key, disabled: locked, dragging: dragKey === node.key }"
            :style="{
              left: `${nodeDisplayPercent(node)}%`,
              transform: `translate(-50%, calc(-50% + ${node.lane * laneStepPx}px))`,
            }"
            :disabled="locked"
            @pointerdown.stop="startDrag($event, node)"
            @click.stop="openPopover(node)"
          >
            <em>{{ node.label }}</em>
            <strong>{{ nodeDisplayClock(node) }}</strong>
          </button>
          <template #content>
            <div class="timeline-popover timeline-popover--rich">
              <p>{{ (popoverNode && popoverNode.key === node.key && popoverNode.label) || node.label }}</p>
              <div v-if="isModify && popoverNode?.time" class="tp-row"><span>原时间</span><strong>{{ formatTimelineClock(popoverNode.time) }}</strong></div>
              <div class="tp-row"><span>新时间</span>
                <a-time-picker v-model="editorTime" format="HH:mm" value-format="HH:mm" style="width: 100%" :disabled="locked" />
              </div>
              <a-alert v-if="validation && orderConflict" type="warning" show-icon class="tp-alert">{{ validation.message }}</a-alert>
              <a-alert v-else-if="isHardError" type="error" show-icon class="tp-alert">{{ validation?.message }}</a-alert>
              <label class="tp-reason">
                <span>修改原因{{ reasonRequired ? '（必填）' : '' }}</span>
                <a-input v-model="editorReason" :placeholder="reasonRequired ? '修改/清除/异常覆盖需填写原因' : '可留空'" :disabled="locked" />
              </label>
              <a-space wrap class="tp-actions">
                <a-button size="mini" type="primary" :disabled="locked || !canSave" @click="saveNode">保存</a-button>
                <a-button v-if="canConfirmOverride" size="mini" status="warning" @click="confirmOverride">确认仍然保存</a-button>
                <a-button size="mini" :disabled="locked" @click="saveNow">现在</a-button>
                <a-button v-if="isModify" size="mini" status="danger" :disabled="locked || !canClear || !editorReason.trim()" @click="clearNode">清除</a-button>
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
            <span class="node-label">{{ node.label }}<em v-if="node.source && node.source !== '未记录'" class="node-source">{{ node.source }}</em></span>
            <span class="node-time">{{ node.recorded ? formatTimelineClock(node.time) : '待记录' }}</span>
          </span>
        </button>
        <template #content>
          <div class="timeline-popover timeline-popover--rich">
            <p>{{ (popoverNode && popoverNode.key === node.key && popoverNode.label) || node.label }}</p>
            <div v-if="isModify && popoverNode?.time" class="tp-row"><span>原时间</span><strong>{{ formatTimelineClock(popoverNode.time) }}</strong></div>
            <div class="tp-row"><span>新时间</span>
              <a-time-picker v-model="editorTime" format="HH:mm" value-format="HH:mm" style="width: 100%" :disabled="locked" />
            </div>
            <a-alert v-if="validation && orderConflict" type="warning" show-icon class="tp-alert">{{ validation.message }}</a-alert>
            <a-alert v-else-if="isHardError" type="error" show-icon class="tp-alert">{{ validation?.message }}</a-alert>
            <label class="tp-reason">
              <span>修改原因{{ reasonRequired ? '（必填）' : '' }}</span>
              <a-input v-model="editorReason" :placeholder="reasonRequired ? '修改/清除/异常覆盖需填写原因' : '可留空'" :disabled="locked" />
            </label>
            <a-space wrap class="tp-actions">
              <a-button size="mini" type="primary" :disabled="locked || !canSave" @click="saveNode">保存</a-button>
              <a-button v-if="canConfirmOverride" size="mini" status="warning" @click="confirmOverride">确认仍然保存</a-button>
              <a-button size="mini" :disabled="locked" @click="saveNow">现在</a-button>
              <a-button v-if="isModify" size="mini" status="danger" :disabled="locked || !canClear || !editorReason.trim()" @click="clearNode">清除</a-button>
            </a-space>
          </div>
        </template>
      </a-popover>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { buildRecordBandGrid, buildLiveTimeScale, timeToPercent } from '@/services/anesthesiaRecordEngine';
import { resolveTimelineNodeLanes } from '@/services/recordLayoutEngine';
import { buildTimelineNodeStates, buildRecordClockIso, buildRecordNowIso, formatTimelineClock, resolveTimelineDragIso, validateTimelineNodeTime, resolveTimelineNodeSource, type MethodTimelineNode } from '@/services/methodTimelineEngine';
import { getServerNowClock, getServerNowIso } from '@/services/serverClock';
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
  /** 修改/清除权限（前端仅控制按钮，后端再次校验）。 */
  canRevise?: boolean;
  /** 异常顺序覆盖权限。 */
  canOverride?: boolean;
}>(), {
  methodLabels: () => [],
  locked: false,
  embedded: true,
  activeKey: '',
  showHeader: true,
  canRevise: true,
  canOverride: true,
});

const emit = defineEmits<{
  save: [node: MethodTimelineNode, isoTime: string, options?: { reason?: string; overrideOrder?: boolean; clear?: boolean; source?: string }];
  focus: [node: MethodTimelineNode];
  /** 拖动已记录/顺序冲突节点结束：请求父级打开修改弹窗（携带 proposedTime 草稿）。 */
  'request-edit': [node: MethodTimelineNode, isoTime: string];
}>();

const trackRef = ref<HTMLElement | null>(null);
const popoverKey = ref('');
const popoverNode = ref<(MethodTimelineNode & { time?: string; recorded?: boolean; source?: string }) | null>(null);
const editorTime = ref('');
const editorReason = ref('');
const dragKey = ref('');
const dragPercent = ref(0);
const dragIso = ref('');
let dragStartX = 0;
let dragMoved = false;
type RailNode = MethodTimelineNode & { displayPercent: number; time?: string; recorded?: boolean };
let dragNode: RailNode | null = null;
let suppressClick = false;

const nodes = computed(() => buildTimelineNodeStates(props.record, props.methodKeys));

/** 预览顺序校验（区分可覆盖的 warning 与不可覆盖的 error）。 */
const validation = computed(() => {
  if (!popoverNode.value || !editorTime.value) return null;
  const iso = buildIsoTime(editorTime.value);
  return validateTimelineNodeTime(props.record, props.methodKeys, popoverNode.value, iso);
});
const isModify = computed(() => Boolean(popoverNode.value?.recorded && popoverNode.value?.time));
const orderConflict = computed(() => validation.value?.orderConflict === true);
const isHardError = computed(() => validation.value?.severity === 'error');
/** 修改/清除/顺序覆盖时原因必填；首录且顺序正常可不填。无权限时整体禁用。 */
const reasonRequired = computed(() => isModify.value || orderConflict.value);
const canSave = computed(() => {
  if (props.locked) return false;
  if (isModify.value && !props.canRevise) return false;
  if (!editorTime.value) return false;
  if (isHardError.value) return false;
  if (reasonRequired.value && !editorReason.value.trim()) return false;
  // 修改且时间未变化不提交
  if (isModify.value && popoverNode.value?.time && editorTime.value === dayjs(popoverNode.value.time).format('HH:mm')) return false;
  return true;
});
const canConfirmOverride = computed(() => orderConflict.value && !isHardError.value && canSave.value && props.canOverride);
const canClear = computed(() => isModify.value && props.canRevise);

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

const nodeDisplayPercent = (node: { key: string; displayPercent: number }) => (
  dragKey.value === node.key ? dragPercent.value : node.displayPercent
);

const nodeDisplayClock = (node: { key: string; recorded: boolean; time?: string }) => {
  if (dragKey.value === node.key && dragIso.value) return formatTimelineClock(dragIso.value);
  return node.recorded ? formatTimelineClock(node.time) : '+';
};

const buildIsoTime = (clock: string) => buildRecordClockIso(props.record, clock);

const openPopover = (node: MethodTimelineNode & { time?: string }) => {
  if (props.locked || suppressClick) return;
  popoverKey.value = node.key;
  popoverNode.value = node;
  // 默认时间优先服务器时间：首录用服务器当前，修改时回填原时间。
  editorTime.value = node.time ? dayjs(node.time).format('HH:mm') : getServerNowClock();
  editorReason.value = '';
  emit('focus', node);
};

const closePopover = () => {
  popoverKey.value = '';
  popoverNode.value = null;
  editorReason.value = '';
};

const onPopoverVisible = (key: string, visible: boolean) => {
  if (!visible) closePopover();
  else popoverKey.value = key;
};

const submitSave = (overrideOrder: boolean) => {
  if (!popoverNode.value || !editorTime.value || props.locked) return;
  if (reasonRequired.value && !editorReason.value.trim()) return;
  const iso = buildIsoTime(editorTime.value);
  emit('save', popoverNode.value, iso, {
    reason: editorReason.value.trim(),
    overrideOrder,
    source: '人工录入',
  });
  closePopover();
};

const saveNode = () => submitSave(false);
const confirmOverride = () => submitSave(true);

const saveNow = () => {
  if (!popoverNode.value || props.locked) return;
  const iso = getServerNowIso();
  // 现在保存仍需尊重修改/异常原因规则；若需原因且未填，回填时间供用户补原因。
  editorTime.value = dayjs(iso).format('HH:mm');
  if (!reasonRequired.value) {
    emit('save', popoverNode.value, iso, { reason: editorReason.value.trim(), overrideOrder: false, source: '人工录入' });
    closePopover();
  }
};

const clearNode = () => {
  if (!popoverNode.value || props.locked) return;
  // 清除视为修改，原因必填（由 view 二次确认）。
  if (!editorReason.value.trim()) return;
  emit('save', popoverNode.value, '', { reason: editorReason.value.trim(), clear: true, source: '人工录入' });
  closePopover();
};

const removeDragListeners = () => {
  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', finishDrag);
  window.removeEventListener('pointercancel', cancelDrag);
};

const updateDrag = (clientX: number) => {
  const rect = trackRef.value?.getBoundingClientRect();
  if (!rect || !dragNode) return;
  dragPercent.value = Math.max(0, Math.min(100, ((clientX - rect.left) / Math.max(1, rect.width)) * 100));
  dragIso.value = resolveTimelineDragIso(
    props.record,
    clientX,
    { left: rect.left, width: rect.width },
    props.sheetStart || timeScale.value.start,
    props.sheetEnd || timeScale.value.end,
  );
};

function moveDrag(event: PointerEvent) {
  if (!dragNode) return;
  dragMoved = dragMoved || Math.abs(event.clientX - dragStartX) >= 3;
  if (dragMoved) updateDrag(event.clientX);
}

function resetDrag() {
  dragKey.value = '';
  dragIso.value = '';
  dragNode = null;
  dragMoved = false;
  removeDragListeners();
}

function finishDrag(event: PointerEvent) {
  if (!dragNode) return;
  const node = dragNode;
  if (dragMoved) {
    updateDrag(event.clientX);
    const iso = dragIso.value;
    suppressClick = true;
    if (iso) {
      const isModifyNode = Boolean(node.recorded && node.time);
      const v = validateTimelineNodeTime(props.record, props.methodKeys, node, iso);
      const conflict = v?.orderConflict === true;
      const hardError = v?.severity === 'error';
      if (hardError) {
        // 无效/越界时间：交给父级提示，不弹窗、不保存。
        emit('save', node, iso);
      } else if (isModifyNode || conflict) {
        // 修改已记录时间 或 顺序冲突：请求父级打开修改弹窗（预填拖动后 proposedTime 草稿），
        // 保存前不修改正式 Store/时间轴位置。取消则节点保持原位。
        emit('request-edit', node, iso);
      } else {
        // 首录且顺序正常：直接保存（reason 可选）。
        emit('save', node, iso);
      }
    }
    window.setTimeout(() => { suppressClick = false; }, 0);
  }
  resetDrag();
}

function cancelDrag() {
  resetDrag();
}

const startDrag = (event: PointerEvent, node: MethodTimelineNode & { displayPercent: number; time?: string }) => {
  if (props.locked || !props.embedded || !trackRef.value) return;
  dragNode = node;
  dragKey.value = node.key;
  dragPercent.value = node.displayPercent;
  dragIso.value = node.time || buildRecordNowIso(props.record);
  dragStartX = event.clientX;
  dragMoved = false;
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', cancelDrag);
};

watch(() => props.record.id, () => {
  closePopover();
  resetDrag();
});

onBeforeUnmount(resetDrag);

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
  touch-action: none;
  text-align: center;
}

.timeline-node-embedded:not(.disabled) {
  cursor: grab;
}

.timeline-node-embedded.dragging {
  z-index: 8;
  cursor: grabbing;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 25%);
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
  max-height: none;
  overflow: visible;
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

.timeline-popover--rich {
  width: 260px;
}

.timeline-popover p {
  margin: 0;
  font-weight: 700;
}

.tp-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 6px;
  align-items: center;
  font-size: 12px;
}

.tp-row span { color: #64748b; }
.tp-row strong { color: #0f172a; }

.tp-alert { font-size: 11px; }

.tp-reason { display: grid; gap: 4px; font-size: 12px; color: #475569; }

.tp-actions { justify-content: flex-start; }

.node-source {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: #eef2ff;
  color: #475569;
  font-style: normal;
  font-size: 10px;
  font-weight: 500;
}
</style>
