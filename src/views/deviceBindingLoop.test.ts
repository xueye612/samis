import { describe, expect, it } from 'vitest';
import pollerSource from '@/services/anesthesia/deviceSessionPoller.ts?raw';
import panelSource from '@/components/anesthesia/record/DeviceSessionVentilatorPanel.vue?raw';
import configPanelSource from '@/components/anesthesia/record/RoomDeviceConfigPanel.vue?raw';
import viewSource from '@/views/AnesthesiaRecord.vue?raw';

// 设备自动关联与代表点闭环：poller 不闪烁、结构化错误、配置后重试。
// 源码级契约（node 环境）。

describe('设备关联不闪烁', () => {
  it('poller 仅首次尝试设 loading=true（有 binding 或有 error 后不再设）', () => {
    expect(pollerSource).toContain('isFirstAttempt');
    expect(pollerSource).toContain('!state.binding && !state.error');
    // 不再每轮无条件 loading=true
    expect(pollerSource).not.toContain('emit({ ...state, loading: true, error: null })');
  });

  it('applySessionResponse 检测后端结构化错误状态（room_device_not_configured 等）', () => {
    expect(pollerSource).toContain('errorStatuses');
    expect(pollerSource).toContain('room_device_not_configured');
    expect(pollerSource).toContain('device_occupied');
  });

  it('设备面板错误时提供"配置设备"处理入口', () => {
    expect(panelSource).toContain('open-room-config');
    expect(panelSource).toContain('room_device_not_configured');
  });
});

describe('配置后立即重试关联', () => {
  it('RoomDeviceConfigPanel 保存/移除后 emit config-changed', () => {
    expect(configPanelSource).toContain("'config-changed'");
  });

  it('视图监听 config-changed 触发 poller 刷新', () => {
    expect(viewSource).toContain('@config-changed');
    expect(viewSource).toContain('deviceSessionPoller?.refresh()');
  });

  it('面板错误时 open-room-config 打开手术间设备配置', () => {
    expect(viewSource).toContain('@open-room-config');
    expect(viewSource).toContain("moreToolTab = 'roomDevice'");
  });
});
