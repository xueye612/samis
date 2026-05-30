import { describe, expect, it } from 'vitest';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';
import type { SurgeryCase } from '@/types/anesthesia';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import {
  buildDrugCatalog,
  buildFluidCatalog,
  buildLiveTimeScale,
  buildMonitorCells,
  buildRecordBandGrid,
  buildBalanceSummary,
  buildRecordSnapshot,
  roundAxisStartTime,
  resolveDefaultMonitorOrder,
  isInhaledMedication,
  isAutologousFluidCategory,
  isBloodProductCategory,
  isInfusionFluidCategory,
  runPrintPreflightChecks,
  chartYWithPadding,
  clampVitalValueByDict,
  createAnesthesiaPlaneDraft,
  createFluidLineDraft,
  createMedicationLineDraft,
  buildVitalCatalog,
  dragVitalPointValue,
  findVitalUpsertIndex,
  monitorCellTopPercent,
  moveMonitorItemOrder,
  vitalMarkerShape,
  calculateLiveSheetEnd,
  detectDictionaryDrivenAbnormalVitals,
  dragTimeSegment,
  loadRecordLocalState,
  normalizeMedicationFromDrug,
  runLiveRecordQualityChecks,
  saveRecordLocalState,
  timeToPercent,
} from '@/services/anesthesiaRecordEngine';

const drugs: DrugDictItem[] = [
  {
    id: 'drug-prop',
    code: 'PROP',
    name: '丙泊酚',
    specification: '200mg/20ml',
    doseUnit: 'mg',
    defaultRoute: '静脉',
    defaultDose: 120,
    highAlert: true,
    common: true,
    sortOrder: 2,
    enabled: true,
  },
  {
    id: 'drug-atropine',
    code: 'ATR',
    name: '阿托品',
    specification: '0.5mg/1ml',
    doseUnit: 'mg',
    defaultRoute: '静脉',
    defaultDose: 0.5,
    highAlert: false,
    common: false,
    sortOrder: 1,
    enabled: true,
  },
];

const vitals: VitalSignDictItem[] = [
  {
    id: 'vital-sbp',
    code: 'V-SBP',
    name: '收缩压 SBP',
    shortCode: 'SBP',
    unit: 'mmHg',
    normalRange: '90-160',
    lowerLimit: 90,
    upperLimit: 160,
    chartEnabled: true,
    chartColor: '#ef4444',
    chartSymbol: 'triangle-down',
    decimalPlaces: 0,
    sortOrder: 1,
    enabled: true,
  },
  {
    id: 'vital-temp',
    code: 'V-TEMP',
    name: '体温 TEMP',
    shortCode: 'TEMP',
    unit: '℃',
    normalRange: '35.5-38.5',
    chartEnabled: true,
    decimalPlaces: 1,
    sortOrder: 2,
    enabled: true,
  },
];

const fluids: FluidBloodDictItem[] = [
  {
    id: 'fluid-rbc',
    code: 'RBC',
    name: '悬浮红细胞',
    subCategory: '血液制品',
    defaultUnit: 'U',
    defaultVolume: 2,
    requiresDoubleCheck: true,
    enabled: true,
  },
  {
    id: 'fluid-lr',
    code: 'LR',
    name: '乳酸钠林格液',
    subCategory: '晶体液',
    defaultUnit: 'ml',
    defaultVolume: 500,
    requiresDoubleCheck: false,
    enabled: true,
  },
];

const baseCase = (): SurgeryCase => ({
  id: 'case-test',
  patientId: 'p-test',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试患者',
  gender: '男',
  age: 50,
  department: '普外科',
  diagnosis: '测试诊断',
  surgeryName: '测试手术',
  surgeon: '周医生',
  anesthesiaMethod: '全身麻醉',
  asa: 'II级',
  urgency: '择期',
  anesthesiologist: '刘医生',
  anesthesiaNurse: '赵护士',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: '2026-05-26T08:00:00.000Z',
  scheduledStart: '2026-05-26T08:00:00.000Z',
  expectedDurationMinutes: 210,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 70,
    asa: 'II级',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '禁食8小时',
    preMedication: '无',
    specialCondition: '无',
    plan: '全身麻醉',
    doctorSignature: '刘医生',
  },
  vitals: [{ time: '2026-05-26T08:10:00.000Z', SBP: 82, TEMP: 35.2 }],
  events: [],
  medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', dose: 120, unit: 'mg', route: '静脉', executor: '刘医生' }],
  fluids: [{ id: 'f1', category: '血液制品', name: '悬浮红细胞', startTime: '2026-05-26T10:00:00.000Z', volume: 2, executor: '赵护士', doubleCheck: false }],
  outputs: { urine: 100, bloodLoss: 50, drainage: 0 },
});

describe('anesthesiaRecordEngine dictionary linkage', () => {
  it('builds catalogs from enabled dictionaries and carries defaults into record editors', () => {
    expect(buildDrugCatalog(drugs).map((item) => item.name)).toEqual(['阿托品', '丙泊酚']);
    expect(buildVitalCatalog(vitals).map((item) => [item.shortCode, item.lowerLimit, item.upperLimit])).toEqual([
      ['SBP', 90, 160],
      ['TEMP', 35.5, 38.5],
    ]);
    expect(buildFluidCatalog(fluids, '血液制品')[0]).toMatchObject({ name: '悬浮红细胞', defaultUnit: 'U', requiresDoubleCheck: true });
    expect(normalizeMedicationFromDrug(drugs[0], '刘医生')).toMatchObject({
      drug: '丙泊酚',
      dose: 120,
      unit: 'mg',
      route: '静脉',
      highAlert: true,
      executor: '刘医生',
    });
  });

  it('resolveDefaultMonitorOrder prefers standard intraop monitor bundle', () => {
    const catalog: VitalSignDictItem[] = ['HR', 'SBP', 'DBP', 'SpO2', 'EtCO2', 'TEMP', 'BIS'].map((shortCode, index) => ({
      id: `v-${shortCode}`,
      code: `V-${shortCode}`,
      name: shortCode,
      shortCode,
      unit: '-',
      normalRange: '',
      chartEnabled: true,
      decimalPlaces: 0,
      sortOrder: index,
      enabled: true,
    }));
    expect(resolveDefaultMonitorOrder(catalog)).toEqual(['HR', 'SBP', 'DBP', 'SpO2', 'EtCO2', 'TEMP']);
    expect(resolveDefaultMonitorOrder(vitals)).toEqual(['SBP', 'TEMP']);
  });

  it('creates editable line drafts from dictionaries instead of committing quick records immediately', () => {
    expect(createMedicationLineDraft(drugs[0], { at: '09:15', executor: '刘医生' })).toMatchObject({
      kind: 'medication',
      name: '丙泊酚',
      mode: '单次用药',
      time: '09:15',
      amount: 120,
      unit: 'mg',
      route: '静脉',
      highAlert: true,
      executor: '刘医生',
    });

    expect(createFluidLineDraft(fluids[0], { at: '10:05', executor: '赵护士', bloodType: 'A', rh: 'Rh+' })).toMatchObject({
      kind: 'transfusion',
      name: '悬浮红细胞',
      category: '血液制品',
      time: '10:05',
      endTime: '10:15',
      amount: 2,
      unit: 'U',
      bloodType: 'A',
      rh: 'Rh+',
      requiresDoubleCheck: true,
      doubleCheck: false,
      executor: '赵护士',
    });
  });

  it('uses vital dictionaries for abnormal detection instead of hard-coded columns', () => {
    const abnormal = detectDictionaryDrivenAbnormalVitals(baseCase().vitals, vitals);
    expect(abnormal.map((item) => item.metric)).toEqual(['SBP', 'TEMP']);
    expect(abnormal[0]).toMatchObject({ label: '收缩压 SBP', value: 82, low: 90, high: 160 });
  });
});

describe('anesthesiaRecordEngine time axis', () => {
  it('extends and maps the live sheet timeline with draggable one-minute precision', () => {
    expect(calculateLiveSheetEnd('08:00', ['10:20', '11:31'])).toBe('12:00');
    const scale = buildLiveTimeScale('08:00', '11:30');
    expect(scale.majorTicks.map((tick) => tick.label)).toContain('09:30');
    expect(timeToPercent('09:45', '08:00', '11:30')).toBe(50);
    expect(dragTimeSegment({ start: '09:00', end: '09:30' }, { mode: 'move', deltaPercent: 14.2857, sheetStart: '08:00', sheetEnd: '11:30', snapMinutes: 1 })).toEqual({
      start: '09:30',
      end: '10:00',
    });
    expect(dragTimeSegment({ start: '09:00', end: '09:30' }, { mode: 'end', targetPercent: 57.1428, sheetStart: '08:00', sheetEnd: '11:30', snapMinutes: 1 })).toEqual({
      start: '09:00',
      end: '10:00',
    });
    expect(dragTimeSegment({ start: '09:00', end: '09:30' }, { mode: 'start', targetPercent: 21.4285, sheetStart: '08:00', sheetEnd: '11:30', snapMinutes: 1 })).toEqual({
      start: '08:45',
      end: '09:30',
    });
  });

  it('builds reusable vertical and row grid layers for every live-sheet band', () => {
    const grid = buildRecordBandGrid(buildLiveTimeScale('08:00', '09:00'), 4);

    expect(grid.verticalLines).toHaveLength(11);
    expect(grid.verticalLines.filter((line) => line.isMajor).map((line) => line.percent)).toEqual([50]);
    expect(grid.rowLines.map((line) => line.percent)).toEqual([25, 50, 75]);
  });
});

describe('anesthesiaRecordEngine printable chart layout', () => {
  it('keeps chart scale labels and points away from the top and bottom borders', () => {
    expect(chartYWithPadding(200, { min: 40, max: 200, height: 300, padding: 18 })).toBe(18);
    expect(chartYWithPadding(40, { min: 40, max: 200, height: 300, padding: 18 })).toBe(282);
    expect(chartYWithPadding(120, { min: 40, max: 200, height: 300, padding: 18 })).toBe(150);
  });

  it('maps vital dictionaries to the reference anesthesia sheet marker system', () => {
    const [sbp, temp] = vitals;
    expect(vitalMarkerShape({ ...sbp, shortCode: 'SBP', chartSymbol: 'triangle-down' })).toMatchObject({ shape: 'triangle-down', text: '▽', stroke: true });
    expect(vitalMarkerShape({ ...sbp, shortCode: 'DBP', chartSymbol: 'triangle-up' })).toMatchObject({ shape: 'triangle-up', text: '△', stroke: true });
    expect(vitalMarkerShape({ ...sbp, shortCode: 'HR', chartSymbol: 'circle' })).toMatchObject({ shape: 'circle', text: '●', stroke: false });
    expect(vitalMarkerShape({ ...temp, shortCode: 'TEMP', chartSymbol: 'square' })).toMatchObject({ shape: 'square', text: '■' });
    expect(vitalMarkerShape({ ...temp, shortCode: 'RR', chartSymbol: 'hollow-circle' })).toMatchObject({ shape: 'hollow-circle', text: '○', stroke: true });
  });

  it('positions monitor values inside their row cells rather than on row borders', () => {
    expect(monitorCellTopPercent(0, 8)).toBeGreaterThan(0);
    expect(monitorCellTopPercent(0, 8)).toBeLessThan(12.5);
    expect(monitorCellTopPercent(7, 8)).toBeGreaterThan(87.5);
    expect(monitorCellTopPercent(7, 8)).toBeLessThan(100);
  });

  it('builds monitor cells from selected dictionary order without crossing row borders', () => {
    const rows = [
      { ...vitals[0], shortCode: 'SBP', sortOrder: 1 },
      { ...vitals[0], id: 'vital-hr', shortCode: 'HR', name: '心率 HR', unit: '次/分', sortOrder: 2 },
      { ...vitals[1], shortCode: 'TEMP', sortOrder: 3 },
    ];
    const cells = buildMonitorCells(
      [{ id: 'row-1', time: '09:00', SBP: 122, HR: 78, TEMP: 36.6 }],
      rows,
      ['TEMP', 'SBP'],
      { start: '08:00', end: '10:00' },
    );

    expect(cells.map((item) => [item.metric, item.value, item.rowIndex])).toEqual([
      ['TEMP', 36.6, 0],
      ['SBP', 122, 1],
    ]);
    expect(cells[0].leftPercent).toBe(50);
    expect(buildMonitorCells(
      [{ id: 'row-1', time: '09:00', SBP: 122 }],
      rows,
      ['SBP'],
      { start: '08:00', end: '10:00', cellOffsetPercent: 0.8 },
    )[0].leftPercent).toBe(50.8);
    expect(cells[0].topPercent).toBeGreaterThan(0);
    expect(cells[1].topPercent).toBeLessThan(100);
  });

  it('moves monitor item order with stable boundaries', () => {
    expect(moveMonitorItemOrder(['HR', 'SBP', 'DBP'], 'SBP', 'up')).toEqual(['SBP', 'HR', 'DBP']);
    expect(moveMonitorItemOrder(['HR', 'SBP', 'DBP'], 'DBP', 'down')).toEqual(['HR', 'SBP', 'DBP']);
    expect(moveMonitorItemOrder(['HR', 'SBP', 'DBP'], 'HR', 'to-index', 2)).toEqual(['SBP', 'DBP', 'HR']);
  });

  it('converts dragged vital chart points back into clamped dictionary values', () => {
    const sbp = vitals[0];
    const temp = { ...vitals[1], decimalPlaces: 1, lowerLimit: 35.5, upperLimit: 38.5 };

    expect(clampVitalValueByDict(260, sbp)).toBe(160);
    expect(clampVitalValueByDict(34.92, temp)).toBe(35.5);
    expect(dragVitalPointValue(18, sbp, { min: 20, max: 220, height: 300, padding: 18 })).toBe(160);
    expect(dragVitalPointValue(150, temp, { min: 33, max: 39, height: 300, padding: 18 })).toBe(36);
  });

  it('matches dragged vital rows by time when legacy mock rows have no id', () => {
    expect(findVitalUpsertIndex([{ time: '09:00', SBP: 120 }], { time: '09:00' })).toBe(0);
    expect(findVitalUpsertIndex([{ id: 'v1', time: '09:00', SBP: 120 }], { id: 'v1', time: '09:05' })).toBe(0);
    expect(findVitalUpsertIndex([{ time: '09:00', SBP: 120 }], { time: '09:05' })).toBe(-1);
  });

  it('creates editable anesthesia plane drafts for the first medication row', () => {
    expect(createAnesthesiaPlaneDraft(undefined, { at: '09:20' })).toMatchObject({
      time: '09:20',
      level: 'T6',
      direction: 'down',
    });
    expect(createAnesthesiaPlaneDraft({ id: 'p1', time: '09:30', level: 'T8', direction: 'fixed', remark: '稳定' })).toMatchObject({
      id: 'p1',
      level: 'T8',
      direction: 'fixed',
      remark: '稳定',
    });
  });

  it('rounds axis start to 00 or 30 minute grid', () => {
    expect(roundAxisStartTime('08:17')).toBe('08:00');
    expect(roundAxisStartTime('08:47')).toBe('08:30');
  });

  it('builds record snapshot and print preflight checks', () => {
    const snapshot = buildRecordSnapshot(anesthesiaCases[0]);
    expect(snapshot.patientName).toBeTruthy();
    const checks = runPrintPreflightChecks(anesthesiaCases[0], []);
    expect(checks.some((item) => item.item === '页码连续')).toBe(true);
  });

  it('summarizes fluid input and output rows for the printable balance area', () => {
    const item = baseCase();
    item.fluids.push({ id: 'f2', category: '晶体液', name: '乳酸钠林格液', startTime: '09:00', volume: 500, unit: 'ml', executor: '赵护士' });
    item.outputRecords = [
      { id: 'out-1', time: '10:00', type: '尿量', volume: 200 },
      { id: 'out-2', time: '10:10', type: '出血量', volume: 300 },
      { id: 'out-3', time: '10:20', type: '其他', volume: 25 },
    ];

    expect(buildBalanceSummary(item)).toMatchObject({
      totalInput: 502,
      totalOutput: 525,
      urine: 200,
      bloodLoss: 300,
      otherOutput: 25,
    });
  });
});

describe('anesthesiaRecordEngine band helpers', () => {
  const sevoflurane: DrugDictItem = {
    id: 'drug-sev',
    code: 'SEV',
    name: '七氟烷',
    specification: '250ml/瓶',
    doseUnit: '%',
    defaultRoute: '吸入',
    defaultDose: 2,
    highAlert: false,
    common: true,
    sortOrder: 7,
    enabled: true,
  };

  it('detects inhaled medication by route or drug dictionary', () => {
    expect(isInhaledMedication({ drug: '七氟烷', name: '七氟烷', route: '吸入' }, [sevoflurane])).toBe(true);
    expect(isInhaledMedication({ drug: '七氟烷', name: '七氟烷', route: '' }, [sevoflurane])).toBe(true);
    expect(isInhaledMedication({ drug: '丙泊酚', name: '丙泊酚', route: '静脉' }, drugs)).toBe(false);
  });

  it('splits fluid categories for sheet bands', () => {
    expect(isInfusionFluidCategory('晶体液')).toBe(true);
    expect(isInfusionFluidCategory('胶体液')).toBe(true);
    expect(isAutologousFluidCategory('自体血回输')).toBe(true);
    expect(isBloodProductCategory('血液制品')).toBe(true);
    expect(isInfusionFluidCategory('自体血回输')).toBe(false);
  });

  it('maps autologous fluid draft category from dictionary', () => {
    const autologousFluid: FluidBloodDictItem = {
      id: 'fluid-auto',
      code: 'AUTO',
      name: '自体血回输',
      subCategory: '自体血回输',
      defaultUnit: 'ml',
      defaultVolume: 300,
      enabled: true,
    };
    const draft = createFluidLineDraft(autologousFluid, { at: '09:00', executor: '测试' });
    expect(draft.category).toBe('自体血回输');
    expect(draft.kind).toBe('infusion');
  });
});

describe('anesthesiaRecordEngine quality and persistence', () => {
  it('blocks signature when high-alert medication, transfusion, timeline, and abnormal closure are incomplete', () => {
    const item = baseCase();
    item.anesthesiaStart = '2026-05-26T09:00:00.000Z';
    item.surgeryStart = '2026-05-26T08:30:00.000Z';

    const checks = runLiveRecordQualityChecks(item, { drugs, vitals, fluids });

    expect(checks.filter((check) => check.status === '未通过').map((check) => check.item)).toEqual(expect.arrayContaining([
      '关键时间顺序',
      '高警示药品核对',
      '输血双人核对',
      '异常生命体征闭环',
    ]));
  });

  it('persists record dictionaries and drafts through an injectable local storage boundary', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    };

    saveRecordLocalState(storage, { configDrugs: drugs, drafts: { 'case-test': { selectedTab: 'live', lastSavedAt: '09:00' } } });

    expect(loadRecordLocalState(storage)).toMatchObject({
      configDrugs: [{ name: '丙泊酚' }, { name: '阿托品' }],
      drafts: { 'case-test': { selectedTab: 'live', lastSavedAt: '09:00' } },
    });
  });
});
