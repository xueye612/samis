import { describe, expect, it } from 'vitest';
import anesthesiaRecordViewSource from '@/views/AnesthesiaRecord.vue?raw';
import {
  hasInhaledEventHint,
  hasInhaledMethodHint,
  isAutologousFluidCategory,
  isInhaledMedication,
} from '@/services/anesthesiaRecordEngine';
import { resolveSectionVisible } from '@/config/recordSections';

type MedicationLike = {
  drug: string;
  name?: string;
  route?: string;
  status?: 'active' | 'voided';
};

type EventLike = {
  type: string;
};

type FluidLike = {
  category?: string;
  name?: string;
  status?: 'active' | 'voided';
};

function resolveInhaledBandVisible(input: {
  methodText?: string;
  methodLabels?: string[];
  appliedMethodLabels?: string[];
  medications: MedicationLike[];
  events: EventLike[];
  sectionMode?: 'auto' | 'show' | 'hide';
  isPacuRecord?: boolean;
}) {
  const inhaledMedicationRows = input.medications.filter((item) => item.status !== 'voided' && isInhaledMedication(item, [])).length;
  const hasMethodSignal = hasInhaledMethodHint([
    input.methodText,
    ...(input.methodLabels ?? []),
    ...(input.appliedMethodLabels ?? []),
  ]);
  const hasEventSignal = hasInhaledEventHint(input.events.map((item) => item.type));

  const autoVisible = !(input.isPacuRecord ?? false)
    && (inhaledMedicationRows > 0 || hasMethodSignal || hasEventSignal);

  return resolveSectionVisible(input.sectionMode, autoVisible);
}

function resolveAutologousBandVisible(input: {
  autologousBlood?: boolean;
  fluids: FluidLike[];
  sectionMode?: 'auto' | 'show' | 'hide';
  isPacuRecord?: boolean;
}) {
  const autologousRows = input.fluids.filter((item) => item.status !== 'voided' && isAutologousFluidCategory(item.category, item.name));
  const autoVisible = !(input.isPacuRecord ?? false)
    && (Boolean(input.autologousBlood) || autologousRows.length > 0);

  return resolveSectionVisible(input.sectionMode, autoVisible);
}

describe('LiveAnesthesiaSheet business acceptance (data-chain level)', () => {
  it('scenario 1: 全麻-全凭静脉 does not show inhaled band by default', () => {
    const visible = resolveInhaledBandVisible({
      methodText: '全麻-全凭静脉',
      methodLabels: ['全身麻醉'],
      appliedMethodLabels: ['全身麻醉'],
      medications: [
        { drug: '丙泊酚', name: '丙泊酚', route: '静脉' },
        { drug: '瑞芬太尼', name: '瑞芬太尼', route: '静脉' },
      ],
      events: [],
      sectionMode: 'auto',
    });

    expect(visible).toBe(false);
  });

  it('scenario 2: 静吸复合麻醉 shows inhaled band', () => {
    const visible = resolveInhaledBandVisible({
      methodText: '全麻-静吸复合',
      methodLabels: ['全身麻醉'],
      appliedMethodLabels: ['全身麻醉'],
      medications: [
        { drug: '丙泊酚', name: '丙泊酚', route: '静脉' },
      ],
      events: [],
      sectionMode: 'auto',
    });

    expect(visible).toBe(true);
  });

  it('scenario 3: adding 七氟烷 shows inhaled band', () => {
    const visible = resolveInhaledBandVisible({
      methodText: '全麻-全凭静脉',
      medications: [
        { drug: '七氟烷', name: '七氟烷', route: '' },
      ],
      events: [],
      sectionMode: 'auto',
    });

    expect(visible).toBe(true);
  });

  it('scenario 4: writing 开始吸入 event shows inhaled band', () => {
    const visible = resolveInhaledBandVisible({
      methodText: '全麻-全凭静脉',
      medications: [
        { drug: '丙泊酚', name: '丙泊酚', route: '静脉' },
      ],
      events: [
        { type: '开始吸入' },
      ],
      sectionMode: 'auto',
    });

    expect(visible).toBe(true);
  });

  it('scenario 5: 回收血/术中回收血/自体血 shows autologous band', () => {
    const names = ['回收血', '术中回收血', '自体血'];

    names.forEach((name) => {
      const visible = resolveAutologousBandVisible({
        fluids: [
          { category: '血液制品', name, status: 'active' },
        ],
        sectionMode: 'auto',
      });
      expect(visible).toBe(true);
    });
  });
});

describe('AnesthesiaRecord quick-event linkage (source-level acceptance)', () => {
  it('keeps quick-event flow wired from UI action to appendEvent', () => {
    expect(anesthesiaRecordViewSource).toContain('@click="addEvent(event.name)"');
    expect(anesthesiaRecordViewSource).toContain('const addEvent = (type: string) =>');
    expect(anesthesiaRecordViewSource).toContain('const payload = buildQuickEventPayload(type, current.value);');
    expect(anesthesiaRecordViewSource).toContain('store.appendEvent(selectedId.value, payload);');
  });
});
