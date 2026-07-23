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

  it('formal page no longer renders the legacy realtime mock panel (unified to session panel)', () => {
    // 设备区域统一：正式页面不再接线旧 monitor mock 卡片，唯一来源为设备采集会话面板。
    expect(recordSource).not.toContain('<RecordRealtimeDevicePanel');
    expect(recordSource).not.toContain('import RecordRealtimeDevicePanel');
    expect(recordSource).toContain('<DeviceSessionVentilatorPanel');
  });
});
