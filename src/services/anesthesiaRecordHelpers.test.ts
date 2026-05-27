import { describe, expect, it } from 'vitest';
import {
  buildRecordTimeScale,
  calculateFluidBalance,
  detectAbnormalVitalSigns,
  normalizeMedicationPayload,
  normalizeTransfusionPayload,
  runRecordQualityChecks,
} from '@/services/anesthesiaRecordHelpers';
import { anesthesiaCases } from '@/mock/anesthesiaCases';

describe('anesthesiaRecordHelpers', () => {
  it('detects abnormal vital signs with clinical suggestions', () => {
    const abnormal = detectAbnormalVitalSigns([
      { time: '2026-05-25T10:00:00.000Z', SBP: 82, SpO2: 93, TEMP: 35.4 },
    ]);

    expect(abnormal.map((item) => item.metric)).toEqual(expect.arrayContaining(['SBP', 'SpO2', 'TEMP']));
    expect(abnormal[0].suggestion).toBeTruthy();
  });

  it('marks high-alert continuous medication and fills default stop time', () => {
    const payload = normalizeMedicationPayload({
      mode: '持续泵入',
      drug: '去甲肾上腺素',
      startTime: '2026-05-25T10:00:00.000Z',
      executor: '陈洁',
    });

    expect(payload.highAlert).toBe(true);
    expect(payload.stopTime).toBeTruthy();
    expect(payload.checker).toBe('');
  });

  it('requires two-person transfusion confirmation', () => {
    const payload = normalizeTransfusionPayload({
      name: '悬浮红细胞',
      bloodType: 'A',
      anesthesiaConfirm: '王睿',
      circulatingConfirm: '',
      volume: 300,
    });

    expect(payload.doubleCheck).toBe(false);
    expect(payload.bloodType).toBe('A');
  });

  it('calculates input, output and fluid balance from current case shape', () => {
    const balance = calculateFluidBalance(anesthesiaCases[4]);

    expect(balance.inputTotal).toBeGreaterThan(0);
    expect(balance.outputTotal).toBeGreaterThan(0);
    expect(balance.bloodLossTotal).toBe(anesthesiaCases[4].outputs.bloodLoss);
  });

  it('builds a realtime record scale that covers medications and events', () => {
    const scale = buildRecordTimeScale(anesthesiaCases[4]);

    expect(scale.totalMinutes).toBeGreaterThanOrEqual(210);
    expect(scale.majorTicks.length).toBeGreaterThan(3);
    expect(scale.end).toMatch(/^\d{2}:\d{2}$/);
  });

  it('runs record quality checks for signatures, airway and transfusion closure', () => {
    const checks = runRecordQualityChecks(anesthesiaCases[1]);

    expect(checks.length).toBeGreaterThanOrEqual(8);
    expect(checks.some((item) => item.item === '持续泵入停止时间')).toBe(true);
  });
});
