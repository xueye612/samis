<template>
  <section class="realtime-device-panel no-print" data-testid="record-realtime-device-panel">
    <header class="realtime-device-head">
      <div>
        <strong>实时设备数值</strong>
        <span data-testid="device-latest-collect">{{ latestCollectLabel }}</span>
      </div>
      <div class="device-head-tags">
        <a-tag :color="!sourceReady ? 'gray' : sourceMode === 'simulation' ? 'orange' : 'blue'" size="small" data-testid="device-source-mode">
          {{ !sourceReady ? '配置读取中' : sourceMode === 'simulation' ? '模拟数据' : '真实设备' }}
        </a-tag>
        <a-tag :color="freshnessColor" size="small" data-testid="device-freshness">{{ freshnessLabel }}</a-tag>
      </div>
    </header>

    <div class="realtime-device-content">
      <div v-if="isRealDevice && sourceReady" class="realtime-device-notice" data-testid="real-device-notice">
        <p>真实设备由设备网关持续上传，本系统当前仅接收数据，不支持远程暂停；需要暂停请在设备端操作。</p>
        <ul class="realtime-device-concepts">
          <li><strong>设备采集</strong>：由设备端持续采集，本系统不远程控制。</li>
          <li><strong>原始数据接收</strong>：已成功接收并通过幂等校验的原始报文将留存。</li>
          <li><strong>写入记录单</strong>：仅按整 5 分钟（抢救 1 分钟）刻度取代表点入单。</li>
        </ul>
      </div>
      <a-alert v-if="state.error" type="warning" show-icon class="realtime-device-error">
        实时刷新失败，保留最近数据：{{ state.error }}
      </a-alert>

      <template v-if="state.data.monitor || state.data.ventilator">
        <div v-if="state.data.monitor" class="device-section" data-testid="monitor-live-values">
          <div class="device-section-title">
            <strong>监护仪</strong>
            <span>{{ sourceLabel(state.data.monitor.deviceId, state.data.monitor.sourceDevice) }}</span>
          </div>
          <div class="metric-grid">
            <div v-for="metric in monitorMetrics" :key="metric.label" class="metric-cell">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.unit }}</small>
            </div>
          </div>
        </div>

        <div v-if="state.data.ventilator" class="device-section" data-testid="ventilator-live-values">
          <div class="device-section-title">
            <strong>呼吸机</strong>
            <span>{{ sourceLabel(state.data.ventilator.deviceId, state.data.ventilator.sourceDevice) }}</span>
          </div>
          <div class="vent-mode-row">
            <span>模式</span><strong>{{ state.data.ventilator.ventMode || '—' }}</strong>
          </div>
          <div class="metric-grid metric-grid--ventilator">
            <div v-for="metric in ventilatorMetrics" :key="metric.label" class="metric-cell">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <small>{{ metric.unit }}</small>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="realtime-device-empty" data-testid="device-live-empty">
        <a-spin v-if="state.loading" dot />
        <span>{{ emptyHint }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { RealtimeDeviceState } from '@/services/anesthesia/realtimeDeviceData';
import type { DeviceRealtimeSource } from '@/services/anesthesia/deviceRealtimeSource';

const props = defineProps<{ state: RealtimeDeviceState; sourceMode: DeviceRealtimeSource; sourceReady: boolean }>();

const isRealDevice = computed(() => props.sourceMode === 'real');

const display = (value: number | null, digits?: number) => {
  if (value === null) return '—';
  return digits === undefined ? String(value) : value.toFixed(digits);
};
const sourceLabel = (deviceId: string | null, sourceDevice: string | null) => deviceId || sourceDevice || '设备未标识';
const latestCollectTime = computed(() => {
  const times = [props.state.data.monitor?.collectTime, props.state.data.ventilator?.collectTime].filter(Boolean) as string[];
  if (!times.length) return null;
  return times.reduce((latest, current) => (
    dayjs(current).valueOf() > dayjs(latest).valueOf() ? current : latest
  ));
});
const latestCollectLabel = computed(() => (
  latestCollectTime.value ? `采集 ${dayjs(latestCollectTime.value).format('HH:mm:ss')}` : '尚未采集'
));
const freshnessLabel = computed(() => ({
  live: '实时', delayed: '延迟', offline: '离线', empty: '无数据',
}[props.state.freshness]));
const freshnessColor = computed(() => ({
  live: 'green', delayed: 'orange', offline: 'red', empty: 'gray',
}[props.state.freshness]));
const emptyHint = computed(() => {
  if (!props.sourceReady) return '正在读取后台设备数据源配置…';
  if (props.state.loading) return props.sourceMode === 'simulation' ? '正在读取模拟采集数据…' : '正在读取真实设备数据…';
  if (props.sourceMode === 'simulation') return '模拟采集尚未启动，请点击下方“启动监护仪”或“启动呼吸机”。';
  return '未连接实时设备，请先在设备管理完成绑定，并确认采集网关在线。';
});
const monitorMetrics = computed(() => {
  const reading = props.state.data.monitor;
  if (!reading) return [];
  return [
    { label: 'HR', value: display(reading.hr), unit: 'bpm' },
    { label: 'NIBP', value: reading.sbp === null && reading.dbp === null ? '—' : `${display(reading.sbp)}/${display(reading.dbp)}`, unit: `MAP ${display(reading.mapValue)}` },
    { label: 'SpO₂', value: display(reading.spo2), unit: '%' },
    { label: 'EtCO₂', value: display(reading.etco2), unit: 'mmHg' },
    { label: 'RR', value: display(reading.respiration), unit: '/min' },
    { label: 'TEMP', value: display(reading.temperature, 1), unit: '℃' },
    { label: 'BIS', value: display(reading.bis), unit: '' },
  ];
});
const ventilatorMetrics = computed(() => {
  const reading = props.state.data.ventilator;
  if (!reading) return [];
  return [
    { label: 'Vt', value: display(reading.tidalVolume), unit: 'mL' },
    { label: 'RR', value: display(reading.respiratoryRate), unit: '/min' },
    { label: 'FiO₂', value: display(reading.fio2), unit: '%' },
    { label: 'PEEP', value: display(reading.peep), unit: 'cmH₂O' },
    { label: 'Ppeak', value: display(reading.peakPressure), unit: 'cmH₂O' },
    { label: 'Pplat', value: display(reading.plateauPressure), unit: 'cmH₂O' },
    { label: 'MV', value: display(reading.minuteVolume, 1), unit: 'L/min' },
    { label: 'Paw', value: display(reading.airwayPressure), unit: 'cmH₂O' },
    { label: 'EtCO₂', value: display(reading.etco2), unit: 'mmHg' },
  ];
});
</script>

<style scoped>
.realtime-device-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; height: 210px; min-height: 210px; max-height: 210px; padding: 9px; overflow: hidden; border: 1px solid #cbdbe9; border-radius: 8px; background: #f8fbfd; }
.realtime-device-head, .device-section-title, .vent-mode-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.realtime-device-head > div { display: grid; gap: 1px; min-width: 0; }
.device-head-tags { flex: none; align-items: center !important; gap: 4px !important; }
.realtime-device-head strong { font-size: 13px; color: #0f172a; white-space: nowrap; }
.realtime-device-head span, .device-section-title span { color: #64748b; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.realtime-device-content { min-height: 0; overflow: auto; scrollbar-gutter: stable; }
.realtime-device-error { font-size: 11px; }
.device-section { display: grid; gap: 6px; padding-top: 7px; border-top: 1px solid #dce7f0; }
.device-section-title strong { font-size: 12px; color: #334155; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.metric-grid--ventilator { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.metric-cell { min-width: 0; padding: 5px 4px; border: 1px solid #e2e8f0; border-radius: 5px; background: #fff; text-align: center; }
.metric-cell span { display: block; color: #64748b; font-size: 11px; }
.metric-cell strong { display: block; margin-top: 1px; color: #0f172a; font-size: 14px; line-height: 1.2; font-variant-numeric: tabular-nums; white-space: nowrap; }
.metric-cell small { display: block; min-height: 12px; margin-top: 1px; color: #94a3b8; font-size: 10px; white-space: nowrap; }
.realtime-device-notice { margin-bottom: 6px; padding: 6px 8px; border: 1px solid #f3d8a3; border-radius: 5px; background: #fff8ec; }
.realtime-device-notice p { margin: 0; color: #92600a; font-size: 11px; line-height: 1.5; }
.realtime-device-concepts { margin: 4px 0 0; padding-left: 14px; color: #7c5a13; font-size: 10px; line-height: 1.5; }
.realtime-device-concepts strong { color: #92600a; }
.vent-mode-row { padding: 4px 7px; border-radius: 5px; background: #eef6ff; font-size: 11px; }
.vent-mode-row span { color: #64748b; }
.realtime-device-empty { height: 100%; min-height: 92px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; color: #64748b; font-size: 11px; line-height: 1.55; text-align: center; }
</style>
