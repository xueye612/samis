import { describe, expect, it } from 'vitest';
import panelSource from '@/components/anesthesia/record/RecordRealtimeDevicePanel.vue?raw';
import recordSource from '@/views/AnesthesiaRecord.vue?raw';

describe('record realtime device panel acceptance', () => {
  it('renders monitor and ventilator clinical metrics without waveform claims', () => {
    ['HR', 'NIBP', 'SpO₂', 'EtCO₂', 'TEMP', 'BIS', 'Vt', 'FiO₂', 'PEEP', 'Ppeak', 'Pplat', 'MV', 'Paw']
      .forEach((label) => expect(panelSource).toContain(label));
    expect(panelSource).toContain('device-freshness');
    expect(panelSource).toContain('模拟采集尚未启动');
    expect(panelSource).toContain('未连接实时设备');
    expect(panelSource).toContain('height: 210px');
    expect(panelSource).not.toContain('ECG波形');
  });

  it('wires the panel to a case-scoped poller and stops it on teardown', () => {
    expect(recordSource).toContain(':source-ready="deviceRealtimeSourceReady"');
    expect(recordSource).toContain('createRealtimeDevicePoller');
    expect(recordSource).toContain('loadLatestSimulatedDeviceData');
    expect(recordSource).toContain('!operationId || !deviceRealtimeSourceReady.value');
    expect(recordSource).toContain('realtimeDevicePoller?.stop()');
    expect(recordSource).toContain('onBeforeUnmount(stopRealtimeDevicePolling)');
  });
});
