import { describe, expect, it } from 'vitest';
import { resolveQuickEventTimelineNode } from './recordQuickActions';

describe('recordQuickActions', () => {
  it('关键里程碑快捷事件解析到同一个时间轴节点', () => {
    expect(resolveQuickEventTimelineNode('手术开始', ['general'])?.key).toBe('surgery-start');
    expect(resolveQuickEventTimelineNode('麻醉结束', ['general'])?.key).toBe('anes-end');
    expect(resolveQuickEventTimelineNode('离室', ['general'])?.key).toBe('leave-room');
  });

  it('普通异常事件不伪装成关键时间节点', () => {
    expect(resolveQuickEventTimelineNode('低血压', ['general'])).toBeUndefined();
    expect(resolveQuickEventTimelineNode('升压药', ['general'])).toBeUndefined();
  });
});
