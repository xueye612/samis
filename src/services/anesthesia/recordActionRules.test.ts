import { describe, expect, it } from 'vitest';
import {
  buildRecordActionVisibility,
  isRecordReadyToEnd,
  resolveRecordWorkflowPhase,
  validateRecordEnd,
} from './recordActionRules';
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

  it('刚启动记录时保持“记录中”，不会立即暴露结束或签名动作', () => {
    const item = { ...baseCase(), anesthesiaStart: '2026-06-02T08:00:00.000Z', recordStatus: '采集中' as const };
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.showStartRecord).toBe(false);
    expect(actions.showEndRecord).toBe(false);
    expect(actions.primaryAction).toBe('none');
    expect(actions.primaryLabel).toBe('记录中');
    expect(actions.showSaveDraft).toBe(true);
    expect(actions.showSubmitSignature).toBe(false);
    expect(actions.showRescue).toBe(true);
  });

  it('六个临床关键时间完整且顺序正确后才允许结束记录', () => {
    const item = {
      ...baseCase(),
      recordStatus: '采集中' as const,
      roomInTime: '2026-06-02T08:00:00+08:00',
      anesthesiaStart: '2026-06-02T08:10:00+08:00',
      surgeryStart: '2026-06-02T08:40:00+08:00',
      surgeryEnd: '2026-06-02T10:00:00+08:00',
      anesthesiaEnd: '2026-06-02T10:10:00+08:00',
      leaveRoomTime: '2026-06-02T10:20:00+08:00',
    };
    expect(isRecordReadyToEnd(item)).toEqual({ ok: true });
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.showEndRecord).toBe(true);
    expect(actions.primaryAction).toBe('end');
    expect(actions.primaryLabel).toBe('结束记录');
  });

  it('显式日期支持跨午夜，但同日倒序必须拒绝', () => {
    const overnight = {
      ...baseCase(),
      recordStatus: '采集中' as const,
      roomInTime: '2026-06-02T23:40:00+08:00',
      anesthesiaStart: '2026-06-02T23:50:00+08:00',
      surgeryStart: '2026-06-03T00:10:00+08:00',
      surgeryEnd: '2026-06-03T01:20:00+08:00',
      anesthesiaEnd: '2026-06-03T01:30:00+08:00',
      leaveRoomTime: '2026-06-03T01:40:00+08:00',
    };
    expect(isRecordReadyToEnd(overnight)).toEqual({ ok: true });
    expect(validateRecordEnd(overnight, '2026-06-03T01:45:00+08:00', {
      deviceSessionActive: false,
      rescueActive: false,
    })).toEqual({ ok: true });

    expect(isRecordReadyToEnd({
      ...overnight,
      surgeryStart: '2026-06-02T08:10:00+08:00',
    })).toEqual({
      ok: false,
      message: '手术开始时间不能早于麻醉开始时间。',
    });
  });

  it('已完成不再显示启动或结束记录', () => {
    const item = {
      ...baseCase(),
      anesthesiaStart: '2026-06-02T08:00:00.000Z',
      anesthesiaEnd: '2026-06-02T10:00:00.000Z',
      recordStatus: '已完成' as const,
    };
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.showStartRecord).toBe(false);
    expect(actions.showEndRecord).toBe(false);
    expect(actions.primaryAction).toBe('none');
    expect(actions.primaryLabel).toBe('已完成');
  });

  it('设备采集或暂停未停止时拒绝结束记录', () => {
    const item = {
      ...baseCase(),
      recordStatus: '采集中' as const,
      roomInTime: '2026-06-02T08:00:00.000Z',
      anesthesiaStart: '2026-06-02T08:10:00.000Z',
      surgeryStart: '2026-06-02T08:30:00.000Z',
      surgeryEnd: '2026-06-02T09:30:00.000Z',
      anesthesiaEnd: '2026-06-02T09:40:00.000Z',
      leaveRoomTime: '2026-06-02T09:50:00.000Z',
    };
    const result = validateRecordEnd(item, '2026-06-02T10:00:00.000Z', {
      deviceSessionActive: true,
      rescueActive: false,
    });
    expect(result).toEqual({
      ok: false,
      message: '设备采集尚未停止，请先停止设备采集后再结束记录。',
    });
  });

  it('抢救状态和结束时间逆序时拒绝结束记录', () => {
    const item = {
      ...baseCase(),
      anesthesiaStart: '2026-06-02T08:00:00.000Z',
      surgeryStart: '2026-06-02T08:30:00.000Z',
      surgeryEnd: '2026-06-02T10:00:00.000Z',
      roomInTime: '2026-06-02T07:50:00.000Z',
      anesthesiaEnd: '2026-06-02T10:10:00.000Z',
      leaveRoomTime: '2026-06-02T10:20:00.000Z',
      recordStatus: '采集中' as const,
    };
    expect(validateRecordEnd(item, '2026-06-02T10:30:00.000Z', {
      deviceSessionActive: false,
      rescueActive: true,
    }).ok).toBe(false);
    expect(validateRecordEnd(item, '2026-06-02T10:15:00.000Z', {
      deviceSessionActive: false,
      rescueActive: false,
    })).toEqual({
      ok: false,
      message: '记录结束时间不能早于离室时间。',
    });
  });

  it('临床时间不完整时明确列出缺失项', () => {
    const item = {
      ...baseCase(),
      recordStatus: '采集中' as const,
      roomInTime: '2026-06-02T08:00:00+08:00',
      anesthesiaStart: '2026-06-02T08:10:00+08:00',
    };
    expect(isRecordReadyToEnd(item)).toEqual({
      ok: false,
      message: '请先补齐关键时间：手术开始、手术结束、麻醉结束、离室。',
    });
  });

  it('记录结束后进入待签名而不是直接已完成', () => {
    const item = {
      ...baseCase(),
      recordStatus: '待签名' as const,
      roomInTime: '2026-06-02T08:00:00+08:00',
      anesthesiaStart: '2026-06-02T08:10:00+08:00',
      surgeryStart: '2026-06-02T08:40:00+08:00',
      surgeryEnd: '2026-06-02T10:00:00+08:00',
      anesthesiaEnd: '2026-06-02T10:10:00+08:00',
      leaveRoomTime: '2026-06-02T10:20:00+08:00',
      signatures: { status: '待签名' as const },
    };
    expect(resolveRecordWorkflowPhase(item, false)).toBe('awaiting_signature');
    const actions = buildRecordActionVisibility(item, false);
    expect(actions.primaryLabel).toBe('待签名');
    expect(actions.showSubmitSignature).toBe(true);
    expect(actions.showEndRecord).toBe(false);
  });

  it('已完成记录不可重复结束', () => {
    const item = {
      ...baseCase(),
      anesthesiaStart: '2026-06-02T08:00:00.000Z',
      anesthesiaEnd: '2026-06-02T10:00:00.000Z',
      recordStatus: '已完成' as const,
    };
    expect(validateRecordEnd(item, '2026-06-02T10:05:00.000Z', {
      deviceSessionActive: false,
      rescueActive: false,
    })).toEqual({ ok: false, message: '麻醉记录已经结束，请勿重复操作。' });
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
    } as unknown as SurgeryCase;
    const actions = buildRecordActionVisibility(item, true);
    expect(actions.phase).toBe('rescue');
    expect(actions.showExitRescue).toBe(true);
    expect(actions.showRescue).toBe(false);
    expect(actions.showSubmitSignature).toBe(false);
  });
});
