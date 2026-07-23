import { describe, expect, it } from 'vitest';
import { isVitalAbnormal, mapClinicalSnapshot, mergeStructuredItem, VITAL_ABNORMAL_DEFAULTS } from './handoverSnapshotMapper';

describe('handoverSnapshotMapper snake_case → camelCase', () => {
  it('将后端蛇形原始行映射为统一展示分组，设备/管路/药物/生命体征均能显示', () => {
    const mapped = mapClinicalSnapshot({
      snapshotAt: '2026-07-22 09:00:00',
      airway: [{ action: 'intubation', device_name: '7.0导管', occurred_at: '2026-07-22 08:30:00' }],
      ventilation: [{ mode: 'VC', fio2_percent: 50, tidal_volume_ml: 500 }],
      io: [{ io_type: '晶体', volume: 500, unit: 'ml' }],
      activeMedications: [{ drug_name: '丙泊酚', rate: 50, rate_unit: 'ml/h', display_text: '丙泊酚 50ml/h' }],
      latestVitals: [{ metric: 'HR', value: 130, unit: 'bpm' }, { metric: 'SpO2', value: 92, unit: '%' }],
      rescueEvents: [{ level: 'high', trigger_description: '低血压' }],
    });
    expect(mapped).not.toBeNull();
    const keys = mapped!.groups.map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(['airway', 'ventilation', 'io', 'meds', 'hemodynamics', 'abnVitals', 'rescue']));
    const airway = mapped!.groups.find((g) => g.key === 'airway')!;
    expect(airway.items[0].label).toContain('intubation');
    expect(airway.items[0].label).toContain('7.0导管');
    const vent = mapped!.groups.find((g) => g.key === 'ventilation')!;
    expect(vent.items[0].label).toContain('FiO₂');
    const meds = mapped!.groups.find((g) => g.key === 'meds')!;
    expect(meds.items[0].label).toContain('丙泊酚');
  });

  it('空数组与字段缺失状态正确展示（不报错、不产生分组）', () => {
    const mapped = mapClinicalSnapshot({ snapshotAt: '2026-07-22 09:00:00' });
    expect(mapped!.groups).toEqual([]);
    expect(mapClinicalSnapshot(null)).toBeNull();
    expect(mapClinicalSnapshot(undefined)).toBeNull();
  });

  it('异常生命体征分组仅包含异常项并醒目标识', () => {
    const mapped = mapClinicalSnapshot({
      latestVitals: [{ metric: 'HR', value: 60, unit: 'bpm' }, { metric: 'SpO2', value: 92, unit: '%' }],
    });
    const hemodynamics = mapped!.groups.find((g) => g.key === 'hemodynamics')!;
    const abnormal = mapped!.groups.find((g) => g.key === 'abnVitals')!;
    expect(hemodynamics.abnormal).toBe(true);
    expect(abnormal.items.length).toBe(1);
    expect(abnormal.items[0].label).toContain('SpO2');
    expect(abnormal.items[0].abnormal).toBe(true);
  });
});

describe('生命体征阈值来源', () => {
  it('默认阈值集中定义，不在组件硬编码', () => {
    expect(VITAL_ABNORMAL_DEFAULTS.HR).toEqual({ min: 50, max: 120 });
    expect(VITAL_ABNORMAL_DEFAULTS.SPO2).toEqual({ min: 95 });
  });

  it('优先使用字典范围（dict），缺失回退默认（default）', () => {
    expect(isVitalAbnormal('HR', 140)).toBe(true);
    expect(isVitalAbnormal('HR', 70)).toBe(false);
    // 提供字典范围后按字典判定
    expect(isVitalAbnormal('HR', 140, { HR: { lowerLimit: 60, upperLimit: 100 } })).toBe(true);
    expect(isVitalAbnormal('HR', 110, { HR: { lowerLimit: 60, upperLimit: 120 } })).toBe(false);
    // 字典缺失该指标时回退默认
    expect(isVitalAbnormal('ETCO2', 20, { HR: { lowerLimit: 60 } })).toBe(true);
  });

  it('配置缺失时使用明确安全降级并标注状态', () => {
    const mappedDefault = mapClinicalSnapshot({ latestVitals: [{ metric: 'HR', value: 140 }] });
    expect(mappedDefault!.configNote).toBe('default');
    const mappedDict = mapClinicalSnapshot({ latestVitals: [{ metric: 'HR', value: 140 }] }, { HR: { lowerLimit: 60, upperLimit: 100 } });
    expect(mappedDict!.configNote).toBe('dict');
  });
});

describe('交班结构化编辑合并 mergeStructuredItem：保留 status/action/note/dueAt 及扩展字段', () => {
  it('编辑 label 后原有字段保留', () => {
    const item = {
      _original: { code: 'RISK-1', label: '原风险', level: 'high', action: '升级监护', status: 'active' },
      label: '编辑后风险',
      level: 'medium',
    };
    const result = mergeStructuredItem(item, { label: item.label, level: item.level, code: 'RISK-1' });
    expect(result.code).toBe('RISK-1');
    expect(result.label).toBe('编辑后风险');
    expect(result.level).toBe('medium');
    expect((result as Record<string,unknown>).action).toBe('升级监护');
    expect((result as Record<string,unknown>).status).toBe('active');
  });

  it('未知扩展字段保留', () => {
    const item = {
      _original: { code: 'X', label: '原', customField: '保留值', nested: { key: 'val' } },
      label: '新',
    };
    const result = mergeStructuredItem(item, { label: item.label, code: 'X' });
    expect((result as Record<string,unknown>).customField).toBe('保留值');
    expect((result as Record<string,unknown>).nested).toEqual({ key: 'val' });
  });

  it('既有 code/ID 不重生成', () => {
    const item = { _original: { code: 'ORIG-123', label: '原' }, label: '新' };
    const result = mergeStructuredItem(item, { code: 'ORIG-123', label: '新' });
    expect(result.code).toBe('ORIG-123');
  });

  it('新建项无 _original，仅含编辑字段', () => {
    const item = { label: '全新', level: 'low' };
    const result = mergeStructuredItem(item, { code: 'NEW-1', label: '全新', level: 'low' });
    expect(result.code).toBe('NEW-1');
    expect(result.label).toBe('全新');
    expect(result.level).toBe('low');
    expect(result).not.toHaveProperty('action');
  });

  it('保存后再次编辑仍完整保留结构（round-trip）', () => {
    const original = { code: 'EQ-1', name: '监护仪', status: 'normal', note: '备用机已测试' };
    const save1 = mergeStructuredItem({ _original: original, name: '监护仪', status: 'abnormal', note: '更新说明' }, { code: 'EQ-1', name: '监护仪', status: 'abnormal', note: '更新说明' });
    expect(save1.status).toBe('abnormal');
    expect(save1.note).toBe('更新说明');
    expect((save1 as Record<string,unknown>).code).toBe('EQ-1');
    const item2 = { _original: save1, name: '监护仪', status: 'abnormal', note: '二次编辑' };
    const save2 = mergeStructuredItem(item2, { code: 'EQ-1', name: '监护仪', status: 'abnormal', note: '二次编辑' });
    expect((save2 as Record<string,unknown>).note).toBe('二次编辑');
    expect((save2 as Record<string,unknown>).status).toBe('abnormal');
    expect((save2 as Record<string,unknown>).code).toBe('EQ-1');
  });
});
