import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import {
  buildMilestoneStatusEvents,
  buildTimelineNodeStates,
  getMethodTimelineNodes,
} from '@/services/methodTimelineEngine';

describe('methodTimelineEngine', () => {
  it('returns general anesthesia nodes including intubation and extubation', () => {
    const nodes = getMethodTimelineNodes(['general']);
    expect(nodes.map((item) => item.label)).toEqual(expect.arrayContaining(['插管/喉罩', '拔管', '麻醉开始', '手术开始']));
    expect(nodes.map((item) => item.label)).not.toContain('穿刺');
  });

  it('returns neuraxial nodes without intubation', () => {
    const nodes = getMethodTimelineNodes(['neuraxial']);
    expect(nodes.map((item) => item.label)).toEqual(expect.arrayContaining(['穿刺', '平面测定']));
    expect(nodes.map((item) => item.label)).not.toContain('插管/喉罩');
  });

  it('resolves case-level timestamps for milestone synthesis', () => {
    const item = anesthesiaCases[0];
    const milestones = buildMilestoneStatusEvents(item);
    expect(milestones.some((row) => row.type === '麻醉开始')).toBe(true);
    expect(milestones.some((row) => row.type === '手术开始')).toBe(true);
  });

  it('refreshes recorded state after sync field update', () => {
    const item = { ...anesthesiaCases[0], roomInTime: undefined, anesthesiaStart: undefined as string | undefined };
    const before = buildTimelineNodeStates(item, ['general']).find((row) => row.key === 'anes-start');
    expect(before?.recorded).toBe(false);
    item.anesthesiaStart = '2026-05-26T08:25:00.000Z';
    const after = buildTimelineNodeStates(item, ['general']).find((row) => row.key === 'anes-start');
    expect(after?.recorded).toBe(true);
  });

  it('switches node set when anesthesia method changes to neuraxial', () => {
    const general = buildTimelineNodeStates(anesthesiaCases[0], ['general']).map((row) => row.key);
    const neuraxial = buildTimelineNodeStates(anesthesiaCases[0], ['neuraxial']).map((row) => row.key);
    expect(general).toContain('intubation');
    expect(neuraxial).toContain('puncture');
    expect(neuraxial).not.toContain('intubation');
  });
});
