<template>
  <section class="device-session-panel no-print" data-testid="device-session-panel">
    <header class="dsp-head">
      <div class="dsp-head-main">
        <strong data-testid="device-session-room">{{ roomLabel }}</strong>
        <span data-testid="device-session-name">{{ headerDeviceLabel }}</span>
        <span class="dsp-mode" :class="{ 'dsp-mode--waiting': waiting }" data-testid="device-session-mode">{{ modeLabel }}</span>
      </div>
      <div class="dsp-head-tags">
        <a-tag v-if="waiting" color="gray" size="small" data-testid="device-session-source">等待入室</a-tag>
        <a-tag v-else :color="isPreview ? 'orange' : 'blue'" size="small" data-testid="device-session-source">
          {{ isPreview ? '预览数据' : '设备数据' }}
        </a-tag>
        <a-tag :color="freshnessColor" size="small" data-testid="device-session-freshness">{{ freshnessLabel }}</a-tag>
      </div>
    </header>

    <div class="dsp-body">
      <div v-if="waiting" class="dsp-waiting" data-testid="device-session-waiting">
        <strong>等待患者入室</strong>
        <span>患者入室后将自动关联本手术间呼吸机</span>
      </div>
      <template v-else>
      <a-alert
        v-if="isPreview"
        type="info"
        show-icon
        class="dsp-preview-notice"
        data-testid="device-session-preview-notice"
      >
        预览数据，尚未连接中央采集服务器
      </a-alert>
      <a-alert
        v-if="state.roomChanged"
        type="warning"
        show-icon
        class="dsp-room-changed"
        data-testid="device-session-room-changed"
      >
        手术间已变化，请确认设备转移（{{ state.bindingRoomName || state.bindingRoomCode }} → {{ state.currentRoomName || state.currentRoomCode }}）
      </a-alert>
      <a-alert v-if="state.error && !state.ended" type="warning" show-icon class="dsp-error" data-testid="device-session-error">
        {{ state.error }}
      </a-alert>

      <div v-if="latestMetrics.length" class="dsp-vent" data-testid="device-session-ventilator">
        <div class="dsp-vent-mode">
          <span>模式</span><strong>{{ ventMode || '—' }}</strong>
        </div>
        <div class="dsp-grid dsp-grid--vent">
          <div v-for="metric in latestMetrics" :key="metric.label" class="dsp-cell">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.unit }}</small>
          </div>
        </div>
      </div>
      <div v-else class="dsp-empty" data-testid="device-session-empty">
        <a-spin v-if="state.loading" dot />
        <span>{{ emptyHint }}</span>
      </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { DeviceSessionState } from '@/services/anesthesia/deviceSessionPoller';

const props = defineProps<{ state: DeviceSessionState; displayPaused?: boolean }>();

const waiting = computed(() => props.state.waitingForPatientEntry && !props.state.binding);
// associating 仅在尚未建立 binding 时为真；已有 binding 后普通轮询不再回到关联中。
const associating = computed(() => !waiting.value && !props.state.binding && props.state.loading);
const isPreview = computed(() => !waiting.value && (props.state.source === 'preview' || props.state.status === 'preview'));
const roomLabel = computed(() => {
  const code = props.state.bindingRoomCode || props.state.binding?.roomCode || '';
  const name = props.state.bindingRoomName || props.state.binding?.roomName || '';
  return name || code || '手术间';
});
const headerDeviceLabel = computed(() => {
  if (waiting.value) return '';
  if (props.state.binding) return props.state.binding.deviceName || '已关联设备';
  return associating.value ? '正在关联设备…' : '未关联设备';
});
const modeLabel = computed(() => {
  if (waiting.value) return '等待入室';
  if (props.state.binding) {
    const m = props.state.binding.bindingMode;
    return m === 'auto' ? '自动关联' : m === 'transfer' ? '已转移' : m === 'manual' ? '手动关联' : '已关联';
  }
  return associating.value ? '关联中' : '未关联';
});
const ventMode = computed(() => (props.state.latest?.metadata?.ventMode as string | undefined) ?? '');

const VENT_FIELDS: Array<{ code: string; label: string; digits?: number }> = [
  { code: 'Vt', label: 'Vt' },
  { code: 'RR', label: 'RR' },
  { code: 'FiO2', label: 'FiO₂' },
  { code: 'PEEP', label: 'PEEP', digits: 1 },
  { code: 'Ppeak', label: 'Ppeak', digits: 1 },
  { code: 'Pplat', label: 'Pplat', digits: 1 },
  { code: 'MV', label: 'MV', digits: 1 },
  { code: 'Paw', label: 'Paw', digits: 1 },
];

const metricMap = computed(() => {
  const map = new Map<string, { value: number; unit: string }>();
  for (const m of props.state.latest?.metrics ?? []) map.set(m.code, m);
  return map;
});
const latestMetrics = computed(() => {
  if (!props.state.latest) return [];
  return VENT_FIELDS.map((f) => {
    const raw = metricMap.value.get(f.code);
    const value = raw ? (f.digits ? raw.value.toFixed(f.digits) : String(raw.value)) : '—';
    return { label: f.label, value, unit: raw?.unit ?? '' };
  });
});

const freshnessLabel = computed(() => {
  if (waiting.value) return '等待入室';
  if (props.state.ended) return '已结束';
  if (props.displayPaused) return '显示已暂停';
  if (props.state.binding && props.state.latest) return `采集 ${dayjs(props.state.latest.observedAt).format('HH:mm:ss')}`;
  if (props.state.binding) return '已关联·等待数据';
  return associating.value ? '关联中' : '未关联';
});
const freshnessColor = computed(() => (waiting.value || props.state.ended ? 'gray' : props.state.latest ? 'green' : 'gray'));
const emptyHint = computed(() => {
  if (props.state.ended) return '病例已结束，设备采集已停止';
  if (props.state.binding) return '已关联，等待采集数据…';
  if (associating.value) return '正在关联设备并读取数据…';
  if (props.state.error) return props.state.error;
  return '正在自动关联设备…';
});
</script>

<style scoped>
.device-session-panel { display: grid; grid-template-rows: auto minmax(0,1fr); gap: 8px; padding: 9px; border: 1px solid #cbdbe9; border-radius: 8px; background: #f8fbfd; }
.dsp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsp-head-main { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
.dsp-head-main strong { font-size: 13px; color: #0f172a; }
.dsp-head-main span { color: #64748b; font-size: 11px; }
.dsp-mode { color: #2563eb !important; }
.dsp-head-tags { display: flex; align-items: center; gap: 4px; flex: none; }
.dsp-body { display: grid; gap: 6px; min-height: 0; }
.dsp-preview-notice, .dsp-room-changed, .dsp-error { font-size: 11px; }
.dsp-vent-mode { display: flex; align-items: center; gap: 8px; padding: 4px 7px; border-radius: 5px; background: #eef6ff; font-size: 11px; }
.dsp-vent-mode span { color: #64748b; }
.dsp-grid { display: grid; gap: 4px; }
.dsp-grid--vent { grid-template-columns: repeat(4, minmax(0,1fr)); }
.dsp-cell { min-width: 0; padding: 5px 4px; border: 1px solid #e2e8f0; border-radius: 5px; background: #fff; text-align: center; }
.dsp-cell span { display: block; color: #64748b; font-size: 11px; }
.dsp-cell strong { display: block; color: #0f172a; font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dsp-cell small { display: block; color: #94a3b8; font-size: 10px; }
.dsp-empty { min-height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b; font-size: 11px; text-align: center; }
.dsp-mode--waiting { color: #64748b !important; }
.dsp-waiting { display: grid; gap: 4px; min-height: 60px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; text-align: center; align-content: center; }
.dsp-waiting strong { color: #334155; font-size: 13px; }
.dsp-waiting span { color: #64748b; font-size: 11px; line-height: 1.5; }
</style>
