import { describe, expect, it } from 'vitest';
import {
  buildStructuredRecordPayload,
  resolveStructuredRecordOccurredAt,
  validateStructuredRecordDraft,
} from '@/services/anesthesia/structuredRecordForm';

describe('structured record form', () => {
  it('normalizes numeric values and clinical time without adding master data', () => {
    expect(buildStructuredRecordPayload('ventilation_segment', {
      mode: 'VCV',
      tidalVolumeMl: '450',
      fio2Percent: '50',
      effectiveAt: '2026-07-15T09:30',
      patientName: '不得传输',
    })).toEqual({
      mode: 'VCV',
      tidalVolumeMl: 450,
      fio2Percent: 50,
      effectiveAt: '2026-07-15T09:30:00+08:00',
      startTime: '2026-07-15T09:30:00+08:00',
    });
  });

  it('requires two different transfusion verifiers and validates rescue JSON', () => {
    expect(validateStructuredRecordDraft('transfusion_verification', {
      verificationStatus: 'verified', bloodBagNo: 'BAG-1', productName: '红细胞', verifierOneId: 'U1', verifierTwoId: 'U1', occurredAt: '2026-07-15T09:30',
    })).toBe('两位核对人不能相同');
    expect(validateStructuredRecordDraft('rescue_action', {
      rescueEventLocalId: 'RES-1', actionType: 'medication', payloadJson: '{bad}', occurredAt: '2026-07-15T09:30',
    })).toBe('动作内容必须是有效 JSON');
  });

  it('uses the entity clinical time for ordering and never invents one', () => {
    expect(resolveStructuredRecordOccurredAt('airway_record', {})).toBeUndefined();
    expect(resolveStructuredRecordOccurredAt('rescue_event', { triggeredAt: '2026-07-15T10:00' }))
      .toBe('2026-07-15T10:00:00+08:00');
  });
});
