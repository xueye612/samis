import { describe, expect, it } from 'vitest';
import { buildRecordActionVisibility, resolveRecordWorkflowPhase } from './recordActionRules';
import type { SurgeryCase } from '@/types/anesthesia';

const baseCase = (): SurgeryCase => ({
  id: 'c1',
  patientName: '测试',
  room: '1间',
  surgeryName: '测试手术',
  locked: false,
} as SurgeryCase);

describe('recordActionRules', () => {
  it('未开始仅显示启动记录', () => {
    const actions = buildRecordActionVisibility(baseCase(), false);
    expect(actions.showStartRecord).toBe(true);
    expect(actions.showSaveDraft).toBe(false);
    expect(actions.showRescue).toBe(false);
  });

  it('采集中显示保存与签名，不显示启动', () => {
    const item = { ...baseCase(), anesthesiaStart: '2026-06-02T08:00:00.000Z', recordStatus: '采集中' as const };
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.showStartRecord).toBe(false);
    expect(actions.showSaveDraft).toBe(true);
    expect(actions.showSubmitSignature).toBe(true);
    expect(actions.showRescue).toBe(true);
  });

  it('已锁定隐藏编辑类按钮', () => {
    const item = { ...baseCase(), locked: true };
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.showSaveDraft).toBe(false);
    expect(actions.showRescue).toBe(false);
    expect(actions.showSubmitSignature).toBe(false);
    expect(actions.showUnlock).toBe(true);
    expect(actions.showPrint).toBe(true);
  });

  it('已签名归类为 signed 阶段', () => {
    const item = {
      ...baseCase(),
      locked: true,
      signatures: { status: '已签名' as const },
    };
    expect(resolveRecordWorkflowPhase(item, false)).toBe('signed');
    expect(buildRecordActionVisibility(item, false).primaryLabel).toBe('已签名');
  });

  it('抢救中显示退出抢救', () => {
    const item = {
      ...baseCase(),
      anesthesiaStart: '2026-06-02T08:00:00.000Z',
      rescue: { active: true, startTime: '2026-06-02T09:00:00.000Z' },
    } as SurgeryCase;
    const actions = buildRecordActionVisibility(item, true);
    expect(actions.phase).toBe('rescue');
    expect(actions.showExitRescue).toBe(true);
    expect(actions.showRescue).toBe(false);
  });
});
