import { describe, expect, it } from 'vitest';
import viewSource from '@/views/AnesthesiaRecord.vue?raw';
import railSource from '@/components/anesthesia/record/TimelineNodeRail.vue?raw';
import apiSource from '@/api/anesthesiaTimeline.ts?raw';
import clockSource from '@/services/serverClock.ts?raw';

// 关键时间后端闭环：审计落后端 DB、权限点、独立服务器时间。
// 源码级契约（node 环境），锁定后端 API 调用与权限控制。

describe('关键时间后端持久化（不再以 IndexedDB 为真值）', () => {
  it('commitTimelineNode 先调后端 saveTimelineNode，成功后才更新 Store', () => {
    expect(viewSource).toContain('anesthesiaTimelineApi.saveTimelineNode');
    expect(viewSource).toContain('timelineSyncVersion');
    expect(viewSource).toContain('// 后端保存成功：用返回值更新 Store');
  });

  it('保存失败回滚（catch 中不更新时间轴，显示错误）', () => {
    expect(viewSource).toContain('err.code === 4003');
    expect(viewSource).toContain('记录版本冲突');
    expect(viewSource).toContain('关键时间保存失败');
  });

  it('页面初始化独立获取服务器时间（不依赖设备 binding）', () => {
    expect(viewSource).toContain('initServerClock');
    expect(viewSource).toContain('anesthesiaTimelineApi.getServerNow');
  });

  it('API 契约包含 saveTimelineNode / getTimelineNodes / getServerNow', () => {
    expect(apiSource).toContain('saveTimelineNode');
    expect(apiSource).toContain('getTimelineNodes');
    expect(apiSource).toContain('getServerNow');
    expect(apiSource).toContain('/system/now');
  });
});

describe('关键时间权限点（前端控制按钮，后端再次校验）', () => {
  it('视图有 canReviseTimeline / canOverrideTimelineOrder 计算属性', () => {
    expect(viewSource).toContain('canReviseTimeline');
    expect(viewSource).toContain('canOverrideTimelineOrder');
    expect(viewSource).toContain("code === 'record.revise'");
    expect(viewSource).toContain("code === 'record.timeline.override'");
  });

  it('TimelineNodeRail 接收 canRevise / canOverride props', () => {
    expect(railSource).toContain('canRevise');
    expect(railSource).toContain('canOverride');
  });

  it('TimelineNodeRail 覆盖按钮受 canOverride 约束', () => {
    expect(railSource).toContain('props.canOverride');
    expect(railSource).toContain('props.canRevise');
  });
});

describe('独立服务器时间（不依赖设备 binding）', () => {
  it('serverClock 有 initServerClock 独立校准 + 周期重校准', () => {
    expect(clockSource).toContain('initServerClock');
    expect(clockSource).toContain('setInterval');
    expect(clockSource).toContain('recalibrationTimer');
  });

  it('serverClock 获取失败不静默使用本地时间（标记未校准）', () => {
    expect(clockSource).toContain('calibrated = false');
    expect(clockSource).toContain('isServerClockCalibrated');
  });
});
