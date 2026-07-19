import { describe, expect, it } from 'vitest';
import anesthesiaRecordViewSource from '@/views/AnesthesiaRecord.vue?raw';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  ANESTHESIA_METHOD_KEYS,
  applyAnesthesiaTemplate,
  buildCompletionGaps,
  buildConfirmedTemplateImpact,
  buildTemplateApplyDraft,
  buildTemplateLandingDraft,
  buildQuickEventPayload,
  buildScenarioWorkflowContext,
  deriveCurrentStage,
  deriveMethodSelectionFromCase,
  filterTemplateImpactForMethods,
  inferSurgeryScenarioFromCase,
  getDynamicModuleEntries,
  getMethodLabels,
  getStageQuickEvents,
  hasAnesthesiaPlaneModule,
  isQuickEventDone,
  mergeSelectedMethods,
  resolveTopToolbarQuickEvents,
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

  it('includes inhalation quick events for general anesthesia workflow', () => {
    const intraopNames = getStageQuickEvents('术中', ['general']).map((item) => item.name);
    const inductionNames = getStageQuickEvents('诱导期', ['general']).map((item) => item.name);
    const recoveryNames = getStageQuickEvents('苏醒期', ['general']).map((item) => item.name);

    expect(intraopNames).toEqual(expect.arrayContaining(['调整浓度']));
    expect(inductionNames).toEqual(expect.arrayContaining(['开始吸入']));
    expect(recoveryNames).toEqual(expect.arrayContaining(['停止吸入']));
  });

  it('builds completion gaps from selected methods, events, and confirmed landing items', () => {
    const generalCase = baseCase('全身麻醉');
    generalCase.events = [{ ...buildQuickEventPayload('插管', generalCase, '2026-05-27T08:15:00.000Z'), id: 'evt-intubation' }];
    expect(buildCompletionGaps(generalCase, ['general'], undefined).map((item) => item.text)).toEqual(expect.arrayContaining([
      '已记录插管，请补充导管型号、插管深度、EtCO2确认和呼吸机参数。',
      '全麻病例建议持续关注体温、BIS、TOF记录。',
    ]));

    const neuraxialCase = baseCase('腰麻');
    neuraxialCase.events = [{ ...buildQuickEventPayload('给药', neuraxialCase, '2026-05-27T08:15:00.000Z'), id: 'evt-dose' }];
    expect(buildCompletionGaps(neuraxialCase, ['neuraxial'], undefined).map((item) => item.text)).toContain('椎管内给药后，请记录麻醉平面和Bromage评分。');

    const confirmed = buildConfirmedTemplateImpact(buildTemplateLandingDraft('臂丛神经阻滞').items);
    expect(buildCompletionGaps(baseCase('臂丛神经阻滞'), ['nerveBlock'], confirmed).map((item) => item.text)).not.toContain('神经阻滞请补充感觉阻滞范围和阻滞效果。');
  });

  it('infers surgery scenarios from surgery name, location, and department', () => {
    expect(inferSurgeryScenarioFromCase({ ...baseCase('全身麻醉'), surgeryName: '腹腔镜胆囊切除术' })).toBe('laparoscopic');
    expect(inferSurgeryScenarioFromCase({ ...baseCase('腰麻'), surgeryName: '剖宫产', department: '产科' })).toBe('cesarean');
    expect(inferSurgeryScenarioFromCase({ ...baseCase('静脉镇静'), surgeryName: '无痛胃肠镜', locationType: '手术室外' })).toBe('endoscopy');
  });

  it('builds a scenario workflow context from method, scenario, stage, and occurred events', () => {
    const item = baseCase('全身麻醉');
    item.surgeryName = '腹腔镜胆囊切除术';
    item.events = [{ ...buildQuickEventPayload('插管', item, '2026-05-27T08:15:00.000Z'), id: 'evt-intubation' }];

    const context = buildScenarioWorkflowContext({
      item,
      methods: ['general'],
      scenario: 'laparoscopic',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(context.quickEvents.map((event) => event.name)).toEqual(expect.arrayContaining(['气腹建立', '低血压']));
    expect(context.recommendedItems.map((entry) => entry.text)).toEqual(expect.arrayContaining([
      '确认EtCO2波形、气道固定深度和呼吸机参数。',
      '腹腔镜气腹后复核气道压、EtCO2和循环变化。',
    ]));
    expect(context.pendingItems.map((entry) => entry.text)).toContain('已记录插管，请补充导管型号、插管深度、EtCO2确认和呼吸机参数。');
    expect(context.nextSteps.map((entry) => entry.text)).toContain('维持期继续记录生命体征、用药调整、出入量和关键事件。');
    expect(context.focusModuleKeys).toEqual(['general']);
  });

  it('updates workstation pending guidance after quick events are appended to the record', () => {
    const item = baseCase('全身麻醉');
    const before = buildScenarioWorkflowContext({
      item,
      methods: ['general'],
      scenario: 'generalSurgery',
      stage: '诱导期',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    item.events.push({ ...buildQuickEventPayload('插管', item, '2026-05-27T08:15:00.000Z'), id: 'evt-intubation' });
    const after = buildScenarioWorkflowContext({
      item,
      methods: ['general'],
      scenario: 'generalSurgery',
      stage: '诱导期',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(before.pendingItems.map((entry) => entry.id)).not.toContain('general-intubation-detail');
    expect(after.pendingItems.map((entry) => entry.text)).toContain('已记录插管，请补充导管型号、插管深度、EtCO2确认和呼吸机参数。');
    expect(item.events.map((event) => event.type)).toContain('插管');
  });

  it('surfaces plane measurement follow-up after a neuraxial plane event', () => {
    const item = baseCase('腰麻');
    item.events.push({ ...buildQuickEventPayload('平面测定', item, '2026-05-27T08:25:00.000Z'), id: 'evt-plane' });

    const context = buildScenarioWorkflowContext({
      item,
      methods: ['neuraxial'],
      scenario: 'cesarean',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(context.pendingItems.map((entry) => entry.text)).toContain('已记录平面测定，请补充左右侧平面、最高阻滞平面和Bromage评分。');
  });

  it('uses method and generic fallback guidance when exact scenario rules do not match', () => {
    const localOnly = buildScenarioWorkflowContext({
      item: baseCase('局部麻醉'),
      methods: ['local'],
      scenario: 'thoracic',
      stage: '离室',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(localOnly.nextSteps.map((entry) => entry.text)).toContain('确认离室生命体征、去向、交接人和医生签名。');
    expect(localOnly.quickEvents.map((event) => event.name)).toEqual(expect.arrayContaining(['离室']));
  });

  it('keeps the workstation summary concise for the current stage', () => {
    const item = baseCase('全身麻醉');
    item.surgeryName = '腹腔镜胆囊切除术';
    item.events.push({ ...buildQuickEventPayload('插管', item, '2026-05-27T08:15:00.000Z'), id: 'evt-intubation' });
    item.events.push({ ...buildQuickEventPayload('低血压', item, '2026-05-27T08:35:00.000Z'), id: 'evt-hypotension' });

    const context = buildScenarioWorkflowContext({
      item,
      methods: ['general'],
      scenario: 'laparoscopic',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(context.quickEvents.length).toBeLessThanOrEqual(8);
    expect(context.recommendedItems.length).toBeLessThanOrEqual(2);
    expect(context.pendingItems.length).toBeLessThanOrEqual(3);
    expect(context.risks.length).toBeLessThanOrEqual(2);
    expect(context.nextSteps.length).toBeLessThanOrEqual(1);
  });

  it('keeps neuraxial plane guidance separate from nerve block guidance in compound contexts', () => {
    const cesarean = baseCase('腰麻');
    cesarean.surgeryName = '剖宫产';
    cesarean.department = '产科';
    cesarean.events = [{ ...buildQuickEventPayload('给药', cesarean, '2026-05-27T08:15:00.000Z'), id: 'evt-dose' }];

    const neuraxialContext = buildScenarioWorkflowContext({
      item: cesarean,
      methods: ['neuraxial'],
      scenario: 'cesarean',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(neuraxialContext.pendingItems.map((entry) => entry.text)).toContain('椎管内给药后，请记录麻醉平面和Bromage评分。');
    expect(neuraxialContext.recommendedItems.map((entry) => entry.text)).toContain('记录麻醉平面、Bromage评分、血压变化和升压处理。');

    const blockContext = buildScenarioWorkflowContext({
      item: baseCase('全麻 + 神经阻滞'),
      methods: ['general', 'nerveBlock'],
      scenario: 'orthopedic',
      stage: '诱导期',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(blockContext.pendingItems.map((entry) => entry.text)).toContain('神经阻滞请补充感觉阻滞范围和阻滞效果。');
    expect(blockContext.pendingItems.map((entry) => entry.text)).not.toContain('椎管内给药后，请记录麻醉平面和Bromage评分。');
    expect(blockContext.focusModuleKeys).toEqual(['general', 'nerveBlock']);
  });

  it('filters general anesthesia medications out of pure neuraxial template impact', () => {
    const neuraxialOnly = filterTemplateImpactForMethods(buildTemplateApplyDraft('全麻 + 硬膜外').impact, ['neuraxial'])!;
    const compound = filterTemplateImpactForMethods(buildTemplateApplyDraft('全麻 + 硬膜外').impact, ['general', 'neuraxial'])!;

    expect(neuraxialOnly.medications.map((item) => item.drug)).not.toContain('罗库溴铵');
    expect(neuraxialOnly.medications.map((item) => item.drug)).not.toContain('丙泊酚');
    expect(neuraxialOnly.professionalFields.map((item) => item.label)).toContain('麻醉平面');
    expect(compound.medications.map((item) => item.drug)).toEqual(expect.arrayContaining(['罗库溴铵', '罗哌卡因']));
  });

  it('adds a non-blocking mismatch review tip for neurosurgery or thoracic cases without general anesthesia', () => {
    const neurosurgeryNeuraxial = buildScenarioWorkflowContext({
      item: baseCase('椎管内麻醉'),
      methods: ['neuraxial'],
      scenario: 'neurosurgery',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });
    const thoracicLocal = buildScenarioWorkflowContext({
      item: baseCase('局部麻醉'),
      methods: ['local'],
      scenario: 'thoracic',
      stage: '术中',
      selectedTemplateName: '',
      confirmedImpact: undefined,
    });

    expect(neurosurgeryNeuraxial.risks.map((item) => item.text)).toContain('当前手术场景与麻醉方式需复核：请确认是否需要全麻、气道或呼吸管理记录。');
    expect(thoracicLocal.risks.map((item) => item.text)).toContain('当前手术场景与麻醉方式需复核：请确认是否需要全麻、气道或呼吸管理记录。');
  });

  it('disables milestone quick events after they are recorded', () => {
    const item = {
      ...baseCase('全身麻醉'),
      surgeryStart: '2026-05-27T10:00:00.000Z',
      events: [{ id: 'e1', type: '手术开始', time: '2026-05-27T10:00:00.000Z', stage: '术中' as const, severity: '轻度' as const, treatment: '', staff: [], reported: false, qualityIncluded: false }],
    };
    expect(isQuickEventDone(item, { name: '手术开始', syncField: 'surgeryStart' })).toBe(true);
    expect(isQuickEventDone(item, { name: '给药' })).toBe(false);
    expect(isQuickEventDone(item, { name: '低血压' })).toBe(false);

    const buttons = resolveTopToolbarQuickEvents(item, '术中', ['general'], '', 'laparoscopic');
    const surgeryBtn = buttons.find((btn) => btn.name === '手术开始');
    expect(surgeryBtn?.disabled).toBe(true);
    expect(surgeryBtn?.title).toContain('已记录');
    expect(buttons.map((btn) => btn.name)).toEqual(expect.arrayContaining(['给药', '低血压', '升压药', '手术开始']));
    expect(new Set(buttons.map((btn) => btn.name)).size).toBe(buttons.length);
  });

  it('keeps print styles scoped to the formal record body', () => {
    const printBlock = anesthesiaRecordViewSource.match(/@media print \{[\s\S]*?<\/style>/)?.[0] ?? '';

    expect(printBlock).toContain('.record-workstation-topbar');
    expect(printBlock).toContain('.work-mode-bar');
    expect(printBlock).toContain('.patient-queue');
    expect(printBlock).toContain('.record-toolbox');
    expect(printBlock).toContain('.record-detail-tabs');
    expect(anesthesiaRecordViewSource).toContain('@page');
    expect(anesthesiaRecordViewSource).toContain('A4 portrait');
    expect(printBlock).toContain('display: none !important');
    expect(anesthesiaRecordViewSource).toContain('<LiveAnesthesiaSheet');
    expect(anesthesiaRecordViewSource).toContain('class="sheet-workbench"');
  });
});
