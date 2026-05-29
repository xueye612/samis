import { describe, expect, it } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  ANESTHESIA_METHOD_KEYS,
  applyAnesthesiaTemplate,
  buildCompletionGaps,
  buildConfirmedTemplateImpact,
  buildTemplateApplyDraft,
  buildTemplateLandingDraft,
  buildQuickEventPayload,
  deriveCurrentStage,
  deriveMethodSelectionFromCase,
  getDynamicModuleEntries,
  getMethodLabels,
  getStageQuickEvents,
  hasAnesthesiaPlaneModule,
  mergeSelectedMethods,
} from '@/services/anesthesiaRecordMethodEngine';

const baseCase = (anesthesiaMethod: string): SurgeryCase => ({
  id: 'case-test',
  patientId: 'p-test',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试患者',
  gender: '男',
  age: 46,
  department: '普外科',
  diagnosis: '测试诊断',
  surgeryName: '测试手术',
  surgeon: '周医生',
  anesthesiaMethod,
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '刘医生',
  anesthesiaNurse: '赵护士',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: '2026-05-27T08:00:00.000Z',
  expectedDurationMinutes: 120,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 70,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '禁食8小时',
    preMedication: '无',
    specialCondition: '无',
    plan: anesthesiaMethod,
    doctorSignature: '刘医生',
  },
  vitals: [],
  events: [],
  medications: [],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('anesthesiaRecordMethodEngine', () => {
  it('derives the default dynamic module from an existing case method', () => {
    expect(deriveMethodSelectionFromCase(baseCase('全身麻醉')).primary).toBe('general');
    expect(deriveMethodSelectionFromCase(baseCase('椎管内麻醉')).primary).toBe('neuraxial');
    expect(deriveMethodSelectionFromCase(baseCase('静脉镇静 + 局部麻醉')).auxiliary).toEqual(['local']);
  });

  it('applies common templates into primary and auxiliary method combinations', () => {
    expect(applyAnesthesiaTemplate('全麻 + 神经阻滞')).toMatchObject({
      templateName: '全麻 + 神经阻滞',
      primary: 'general',
      auxiliary: ['nerveBlock'],
    });

    expect(applyAnesthesiaTemplate('镇静 + 局麻')).toMatchObject({
      templateName: '镇静 + 局麻',
      primary: 'sedation',
      auxiliary: ['local'],
    });
  });

  it('builds a template application draft for confirmation before it changes the sheet', () => {
    const draft = buildTemplateApplyDraft('全麻 + 神经阻滞');

    expect(draft).toMatchObject({
      templateName: '全麻 + 神经阻滞',
      primary: 'general',
      auxiliary: ['nerveBlock'],
      methodKeys: ['general', 'nerveBlock'],
      methodLabels: ['全身麻醉', '神经阻滞'],
      showAnesthesiaPlane: false,
    });
    expect(draft.modules.map((item) => item.key)).toEqual(['general', 'nerveBlock']);
    expect(draft.impact.events.map((item) => item.name)).toEqual(expect.arrayContaining(['诱导开始', '插管', '阻滞评估', '拔管']));
    expect(draft.impact.medications.map((item) => item.drug)).toEqual(expect.arrayContaining(['丙泊酚', '罗哌卡因']));
    expect(draft.impact.monitorCodes).toEqual(expect.arrayContaining(['EtCO2', 'BIS', 'TOF']));
  });

  it('builds a neuraxial template draft that enables the sheet anesthesia plane row', () => {
    const draft = buildTemplateApplyDraft('腰麻');

    expect(draft.methodLabels).toEqual(['椎管内麻醉']);
    expect(draft.showAnesthesiaPlane).toBe(true);
    expect(draft.modules.map((item) => item.key)).toEqual(['neuraxial']);
    expect(draft.impact.events.map((item) => item.name)).toEqual(expect.arrayContaining(['穿刺', '给药', '平面测定']));
    expect(draft.impact.professionalFields.map((item) => item.label)).toContain('麻醉平面');
  });

  it('builds a nerve block template impact with block range terminology instead of anesthesia plane', () => {
    const draft = buildTemplateApplyDraft('臂丛神经阻滞');
    const labels = draft.impact.professionalFields.map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(['阻滞部位', '感觉阻滞范围', '阻滞效果']));
    expect(labels).not.toContain('麻醉平面');
  });

  it('distinguishes tracheal intubation and laryngeal mask template impacts', () => {
    expect(buildTemplateApplyDraft('全麻-气管插管').impact.events.map((item) => item.name)).toEqual(expect.arrayContaining(['插管', '接麻醉机', '拔管']));
    expect(buildTemplateApplyDraft('全麻-喉罩').impact.events.map((item) => item.name)).toEqual(expect.arrayContaining(['喉罩置入', '接麻醉机', '拔除喉罩']));
  });

  it('turns selected method keys into labels for the sheet method summary', () => {
    expect(getMethodLabels(['sedation', 'local'])).toEqual(['镇静/监护麻醉', '局部麻醉']);
  });

  it('merges compound anesthesia modules without replacing each other', () => {
    expect(mergeSelectedMethods('general', ['nerveBlock', 'neuraxial', 'general'])).toEqual([
      'general',
      'nerveBlock',
      'neuraxial',
    ]);

    const modules = getDynamicModuleEntries(['general', 'nerveBlock']);
    expect(modules.map((item) => item.key)).toEqual(['general', 'nerveBlock']);
  });

  it('limits anesthesia plane display to the neuraxial anesthesia module', () => {
    expect(hasAnesthesiaPlaneModule(['general', 'nerveBlock'])).toBe(false);
    expect(hasAnesthesiaPlaneModule(['general', 'neuraxial'])).toBe(true);
  });

  it('keeps nerve block terminology distinct from neuraxial plane terminology', () => {
    const [module] = getDynamicModuleEntries(['nerveBlock']);

    expect(module.sections.flatMap((section) => section.items.map((item) => item.label))).toEqual(
      expect.arrayContaining(['感觉阻滞范围', '阻滞效果']),
    );
    expect(module.sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain('麻醉平面');
  });

  it('builds quick event payloads with mock operator and severity defaults', () => {
    const payload = buildQuickEventPayload('低血压', baseCase('全身麻醉'), '2026-05-27T08:30:00.000Z');

    expect(payload).toMatchObject({
      type: '低血压',
      time: '2026-05-27T08:30:00.000Z',
      stage: '术中',
      severity: '中度',
      staff: ['刘医生', '赵护士'],
      treatment: '快捷事件：低血压，已由刘医生模拟记录。',
    });
  });

  it('exposes the five supported anesthesia method keys', () => {
    expect(ANESTHESIA_METHOD_KEYS).toEqual(['general', 'neuraxial', 'nerveBlock', 'local', 'sedation']);
  });

  it('derives the intraoperative stage from record events and synced times', () => {
    expect(deriveCurrentStage(baseCase('全身麻醉'))).toBe('入室后');

    const inducing = baseCase('全身麻醉');
    inducing.anesthesiaStart = '2026-05-27T08:05:00.000Z';
    inducing.events = [{ ...buildQuickEventPayload('诱导开始', inducing, '2026-05-27T08:10:00.000Z'), id: 'evt-induction' }];
    expect(deriveCurrentStage(inducing)).toBe('诱导期');

    const operating = baseCase('全身麻醉');
    operating.surgeryStart = '2026-05-27T08:35:00.000Z';
    expect(deriveCurrentStage(operating)).toBe('术中');

    const recovery = baseCase('全身麻醉');
    recovery.events = [{ ...buildQuickEventPayload('拔管', recovery, '2026-05-27T10:05:00.000Z'), id: 'evt-extubation' }];
    expect(deriveCurrentStage(recovery)).toBe('苏醒期');

    const left = baseCase('全身麻醉');
    left.leaveRoomTime = '2026-05-27T10:20:00.000Z';
    expect(deriveCurrentStage(left)).toBe('离室');
  });

  it('builds pending template landing items and confirms them into sheet impact only after confirmation', () => {
    const draft = buildTemplateLandingDraft('全麻 + 神经阻滞');

    expect(draft.items.every((item) => item.status === 'pending')).toBe(true);
    expect(draft.items.map((item) => item.kind)).toEqual(expect.arrayContaining(['event', 'medication', 'monitor', 'field']));
    expect(draft.items.filter((item) => item.kind === 'event').map((item) => item.label)).toEqual(expect.arrayContaining(['诱导开始', '插管', '接麻醉机', '拔管', '阻滞评估']));

    const confirmed = buildConfirmedTemplateImpact(draft.items);
    expect(confirmed.events.map((item) => item.name)).toEqual(expect.arrayContaining(['诱导开始', '插管', '阻滞评估']));
    expect(confirmed.medications.map((item) => item.drug)).toEqual(expect.arrayContaining(['丙泊酚', '罗哌卡因']));
    expect(confirmed.monitorCodes).toEqual(expect.arrayContaining(['EtCO2', 'BIS', 'TOF']));
    expect(confirmed.professionalFields.map((item) => item.label)).toEqual(expect.arrayContaining(['感觉阻滞范围', '阻滞效果']));
  });

  it('keeps neuraxial plane pending fields out of nerve block landing drafts', () => {
    const neuraxialLabels = buildTemplateLandingDraft('腰麻').items.filter((item) => item.kind === 'field').map((item) => item.label);
    const nerveBlockLabels = buildTemplateLandingDraft('臂丛神经阻滞').items.filter((item) => item.kind === 'field').map((item) => item.label);

    expect(neuraxialLabels).toContain('麻醉平面');
    expect(nerveBlockLabels).toEqual(expect.arrayContaining(['感觉阻滞范围', '阻滞效果']));
    expect(nerveBlockLabels).not.toContain('麻醉平面');
  });

  it('prioritizes quick events by current stage and anesthesia method', () => {
    expect(getStageQuickEvents('诱导期', ['general']).map((item) => item.name).slice(0, 4)).toEqual(['诱导开始', '给药', '插管', '接麻醉机']);
    expect(getStageQuickEvents('诱导期', ['neuraxial']).map((item) => item.name)).toEqual(expect.arrayContaining(['穿刺', '给药', '平面测定']));
    expect(getStageQuickEvents('术中', ['nerveBlock']).map((item) => item.name)).toEqual(expect.arrayContaining(['阻滞评估']));
  });

  it('builds completion gaps from selected methods, events, and confirmed landing items', () => {
    const generalCase = baseCase('全身麻醉');
    generalCase.events = [{ ...buildQuickEventPayload('插管', generalCase, '2026-05-27T08:15:00.000Z'), id: 'evt-intubation' }];
    expect(buildCompletionGaps(generalCase, ['general'], undefined).map((item) => item.text)).toEqual(expect.arrayContaining([
      '已记录插管，请补充EtCO2确认、气道/导管信息和拔管/苏醒记录。',
      '全麻病例建议持续关注体温、BIS、TOF记录。',
    ]));

    const neuraxialCase = baseCase('腰麻');
    neuraxialCase.events = [{ ...buildQuickEventPayload('给药', neuraxialCase, '2026-05-27T08:15:00.000Z'), id: 'evt-dose' }];
    expect(buildCompletionGaps(neuraxialCase, ['neuraxial'], undefined).map((item) => item.text)).toContain('椎管内给药后，请记录麻醉平面和Bromage评分。');

    const confirmed = buildConfirmedTemplateImpact(buildTemplateLandingDraft('臂丛神经阻滞').items);
    expect(buildCompletionGaps(baseCase('臂丛神经阻滞'), ['nerveBlock'], confirmed).map((item) => item.text)).not.toContain('神经阻滞请补充感觉阻滞范围和阻滞效果。');
  });
});
