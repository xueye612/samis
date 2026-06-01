import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import type { AnesthesiaEvent } from '@/types/anesthesia';
import {
  buildMilestoneStatusEvents,
  buildTimedKeyOperationNoteLines,
  buildTimelineNodeStates,
  getMethodTimelineNodes,
  resolveKeyOperationsDisplayText,
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

  it('deduplicates timed key operation lines from stored notes and timeline nodes', () => {
    const duplicateSurgeryStart: AnesthesiaEvent = {
      id: 'duplicate-surgery-start',
      type: '手术开始',
      time: '2026-05-26T08:48:00.000Z',
      stage: '术中',
      severity: '轻度',
      treatment: '',
      staff: [],
      reported: false,
      qualityIncluded: false,
    };
    const item = {
      ...anesthesiaCases[0],
      surgeryStart: '2026-05-26T08:48:00.000Z',
      events: [...anesthesiaCases[0].events, duplicateSurgeryStart],
    };

    expect(buildTimedKeyOperationNoteLines(item, ['general']).filter((line) => line.displayContent === '手术开始')).toHaveLength(1);
    expect(resolveKeyOperationsDisplayText(item, ['general'], '1. 08:48 手术开始\n2. 08:48 手术开始\n3. 09:46 手术结束')).toBe('1. 08:48 手术开始\n2. 09:46 手术结束');
  });
});
