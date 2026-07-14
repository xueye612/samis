import { describe, expect, it } from 'vitest';
import {
  buildNursePbListQuery,
  buildOperationListQuery,
  buildCanonicalOperationCase,
  mapOperationListResponse,
  mapWorkbenchResponse,
  mapOperationDetail,
  mapOperationListItem,
  mergeOperationIntoCase,
  mergeRemoteMasterWithLocalClinical,
  shouldSkipRemoteOperationRefresh,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import type { SurgeryCase } from '@/types/anesthesia';

describe('operationInfoAdapter', () => {
  it('maps list item with OPERATIONID alias', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'op-100',
      PATIENTNAME: '张三',
      ROOMNAME: 'OR-02',
      numberOfStations: 3,
      OPERATIONNAME: '阑尾切除',
    });
    expect(item.id).toBe('op-100');
    expect(item.patientName).toBe('张三');
    expect(item.room).toBe('OR-02');
    expect(item.sequence).toBe(3);
    expect(item.surgeryName).toBe('阑尾切除');
  });

  it('prefers operationCase and operationTimeline fields over legacy flat fields', () => {
    const [item] = mapOperationListResponse({
      list: [{
        OPERATIONID: 'legacy-op',
        PATIENTNAME: '旧患者',
        ROOMNAME: '旧手术间',
        OPERATIONNAME: '旧手术',
        PLANNING_BEGINTIME: '2026-01-01T07:30:00.000Z',
        FIRST_SCANNING: '2026-01-01T07:40:00.000Z',
        ANESTHESIA_START_TIME: '2026-01-01T07:45:00.000Z',
        OPERATION_START_TIME: '2026-01-01T08:20:00.000Z',
        LAST_SCANNING: '2026-01-01T10:00:00.000Z',
        operationCase: {
          operationId: 'case-op',
          patientName: '新患者',
          roomName: '新手术间',
          operationName: '新手术',
          departmentName: '新科室',
          sequence: 5,
          plannedStartTime: '2026-01-01T08:00:00.000Z',
        },
        operationTimeline: {
          inRoomTime: '2026-01-01T08:05:00.000Z',
          anesthesiaStartTime: '2026-01-01T08:10:00.000Z',
          operationStartTime: '2026-01-01T08:30:00.000Z',
          operationEndTime: '2026-01-01T09:30:00.000Z',
          outRoomTime: '2026-01-01T09:45:00.000Z',
        },
      }],
    });

    expect(item.id).toBe('case-op');
    expect(item.patientName).toBe('新患者');
    expect(item.room).toBe('新手术间');
    expect(item.sequence).toBe(5);
    expect(item.department).toBe('新科室');
    expect(item.surgeryName).toBe('新手术');
    expect(item.plannedStart).toBe('2026-01-01T08:00:00.000Z');
    expect(item.actualStart).toBe('2026-01-01T08:05:00.000Z');
    expect(item.anesthesiaStart).toBe('2026-01-01T08:10:00.000Z');
    expect(item.surgeryStart).toBe('2026-01-01T08:30:00.000Z');
    expect(item.surgeryEnd).toBe('2026-01-01T09:30:00.000Z');
    expect(item.leaveRoomTime).toBe('2026-01-01T09:45:00.000Z');
  });

  it('falls back to legacy fields when operationCase or operationTimeline are absent', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'legacy-op',
      PATIENTNAME: '旧患者',
      ROOMNAME: '旧手术间',
      OPERATIONNAME: '旧手术',
      NUMBER_OF_STATIONS: '2',
      PLANNING_BEGINTIME: '2026-01-01T07:30:00.000Z',
      FIRST_SCANNING: '2026-01-01T07:40:00.000Z',
      ANESTHESIA_START_TIME: '2026-01-01T07:45:00.000Z',
      OPERATION_START_TIME: '2026-01-01T08:20:00.000Z',
    });

    expect(item.id).toBe('legacy-op');
    expect(item.patientName).toBe('旧患者');
    expect(item.room).toBe('旧手术间');
    expect(item.sequence).toBe(2);
    expect(item.surgeryName).toBe('旧手术');
    expect(item.plannedStart).toBe('2026-01-01T07:30:00.000Z');
    expect(item.actualStart).toBe('2026-01-01T07:40:00.000Z');
    expect(item.anesthesiaStart).toBe('2026-01-01T07:45:00.000Z');
    expect(item.surgeryStart).toBe('2026-01-01T08:20:00.000Z');
  });

  it('maps today workbench rows when operationTimeline omits optional timeline fields', () => {
    const result = mapWorkbenchResponse({
      todayCases: [{
        OPERATIONID: 'op-workbench',
        operationCase: {
          patientName: '工作台患者',
          roomName: 'OR-05',
          operationName: '胆囊切除',
        },
        operationTimeline: {
          inRoomTime: '2026-01-01T08:05:00.000Z',
        },
      }],
      roomStatus: [{ roomId: 'OR-05', busy: true, count: 1 }],
      summary: { surgeries: 1, busyRooms: 1, roomCount: 1 },
    });

    expect(result.cases).toHaveLength(1);
    expect(result.cases[0].id).toBe('op-workbench');
    expect(result.cases[0].patientName).toBe('工作台患者');
    expect(result.cases[0].room).toBe('OR-05');
    expect(result.cases[0].actualStart).toBe('2026-01-01T08:05:00.000Z');
    expect(result.cases[0].anesthesiaStart).toBeUndefined();
    expect(result.summary.surgeries).toBe(1);
  });

  it('merges detail responses from operationCase and operationTimeline into an existing case', () => {
    const existing = mapOperationListItem({
      OPERATIONID: 'op-detail',
      PATIENTNAME: '旧详情患者',
      ROOMNAME: 'OR-01',
      OPERATIONNAME: '旧详情手术',
    });
    const detail = mapOperationDetail({
      OPERATIONID: 'op-detail',
      operationCase: {
        patientName: '详情患者',
        departmentName: '普外科',
        operationName: '腹腔镜胆囊切除',
        anesthesiologistName: '麻醉医生甲',
      },
      operationTimeline: {
        anesthesiaStartTime: '2026-01-01T08:10:00.000Z',
        operationStartTime: '2026-01-01T08:30:00.000Z',
      },
    });

    const merged = mergeOperationIntoCase(existing, detail);

    expect(merged.id).toBe('op-detail');
    expect(merged.patientName).toBe('详情患者');
    expect(merged.department).toBe('普外科');
    expect(merged.surgeryName).toBe('腹腔镜胆囊切除');
    expect(merged.anesthesiologist).toBe('麻醉医生甲');
    expect(merged.anesthesiaStart).toBe('2026-01-01T08:10:00.000Z');
    expect(merged.surgeryStart).toBe('2026-01-01T08:30:00.000Z');
  });

  it('merges detail without touching clinical arrays', () => {
    const existing: SurgeryCase = {
      id: 'op-1',
      room: 'OR-01',
      sequence: 1,
      patientName: '旧名',
      gender: '男',
      age: 40,
      department: '外科',
      diagnosis: '旧诊断',
      surgeryName: '旧手术',
      surgeon: '李',
      anesthesiaMethod: '全麻',
      asa: 'II',
      urgency: '择期',
      anesthesiologist: '王',
      anesthesiaNurse: '陈',
      status: '麻醉中',
      locationType: '手术室内',
      plannedStart: new Date().toISOString(),
      expectedDurationMinutes: 60,
      locked: false,
      activeWarming: false,
      autologousBlood: false,
      postoperativeAnalgesia: false,
      preVisit: {
        completed: true,
        height: 170,
        weight: 65,
        asa: 'II',
        allergy: '无',
        anesthesiaHistory: '',
        difficultAirway: '',
        fasting: '',
        preMedication: '',
        specialCondition: '',
        plan: '',
        doctorSignature: '',
      },
      vitals: [{ time: new Date().toISOString(), HR: 80 }],
      events: [],
      medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }],
      fluids: [],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
    };
    const detail = mapOperationDetail({
      operationId: 'op-1',
      patientName: '新名',
      diagnosis: '新诊断',
    });
    const merged = mergeOperationIntoCase(existing, detail);
    expect(merged.patientName).toBe('新名');
    expect(merged.diagnosis).toBe('新诊断');
    expect(merged.vitals).toHaveLength(1);
    expect(merged.medications).toHaveLength(1);
  });

  it('buildOperationListQuery sets operationRoom from room filter', () => {
    const query = buildOperationListQuery({ operationDate: '2026-06-02', room: 'OR-03' });
    expect(query).toContain('operationDate=2026-06-02');
    expect(query).toContain('operationRoom=OR-03');
    expect(query).toContain('room=OR-03');
  });

  it('buildNursePbListQuery requires start and end date', () => {
    const query = buildNursePbListQuery({ startTime: '2026-06-02', endTime: '2026-06-02' });
    expect(query).toBe('startTime=2026-06-02&endTime=2026-06-02');
  });

  it('skips remote refresh when locked or printed', () => {
    expect(shouldSkipRemoteOperationRefresh({ locked: true } as SurgeryCase)).toBe(true);
    expect(shouldSkipRemoteOperationRefresh({ printedAt: '2026-01-01' } as SurgeryCase)).toBe(true);
    expect(shouldSkipRemoteOperationRefresh({ locked: false } as SurgeryCase)).toBe(false);
  });

  it('builds a canonical operationCase without fabricating gender/ASA/allergy', () => {
    const detail = mapOperationDetail({
      operationId: 'op-rich',
      operationCase: {
        operationId: 'op-rich',
        patientName: '李四',
        version: 9,
        sourceSystem: 'HULI',
        sourceTable: 'operatenotice',
        lastUpdatedAt: '2026-07-13 10:00:00',
      },
    });
    const canonical = buildCanonicalOperationCase(detail);
    expect(canonical.operationId).toBe('op-rich');
    expect(canonical.patientName).toBe('李四');
    expect(canonical.version).toBe(9);
    expect(canonical.sourceSystem).toBe('HULI');
    expect(canonical.sourceTable).toBe('operatenotice');
    expect(canonical.lastUpdatedAt).toBe('2026-07-13 10:00:00');
    // 缺失字段必须为 undefined，禁止补造默认值
    expect(canonical.gender).toBeUndefined();
    expect(canonical.asaClass).toBeUndefined();
    expect(canonical.allergyHistory).toBeUndefined();
  });

  it('attaches the canonical operationCase to mapped list items', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'op-case',
      operationCase: { patientName: '王五', version: 3 },
    });
    expect(item.operationCase?.patientName).toBe('王五');
    expect(item.operationCase?.version).toBe(3);
    // 服务端未提供来源表时不补造 operatenotice
    expect(item.operationCase?.sourceTable).toBeUndefined();
  });

  it('merges so remote master data wins and local clinical records win', () => {
    const remote: SurgeryCase = {
      ...(mapOperationListItem({ OPERATIONID: 'op-merge', operationCase: { patientName: '远端姓名', gender: '女', version: 4 } })),
      id: 'op-merge',
      patientName: '远端姓名',
    };
    const local: SurgeryCase = {
      ...remote,
      patientName: '本地旧姓名',
      gender: '男',
      vitals: [{ time: '2026-07-13T08:00:00.000Z', HR: 90 }],
      medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }],
    };
    const merged = mergeRemoteMasterWithLocalClinical(remote, local);
    // 远端主数据胜出
    expect(merged.patientName).toBe('远端姓名');
    expect(merged.gender).toBe('女');
    // 本地临床记录保留
    expect(merged.vitals).toEqual([{ time: '2026-07-13T08:00:00.000Z', HR: 90 }]);
    expect(merged.medications).toEqual([{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }]);
  });

  it('preserves rich operationCase fields including explicit nulls without fabrication', () => {
    const detail = mapOperationDetail({
      operationId: 'op-rich-all',
      operationCase: {
        operationId: 'op-rich-all',
        patientName: null,
        gender: null,
        preceptorCode: 'PRE-1',
        preceptorName: '指导医生',
        assistantCode: 'AS-1',
        assistantName: '助手',
        instrumentNurseName: '器械护士',
        scrubNurseName: '洗手护士',
        circulatingNurseName: '巡回护士',
        operationLevelCode: 'L3',
        operationLevelName: '三级',
        surgeryCategoryCode: 'CAT-1',
        canceledReason: null,
        isLocked: false,
        isArchived: false,
        isPrinted: false,
        hisIsDelete: false,
        createTime: '2026-07-13 08:00:00',
        updateTime: '2026-07-13 09:00:00',
        version: 7,
        sourceSystem: 'HULI',
        sourceTable: 'operatenotice',
      },
    });
    const canonical = buildCanonicalOperationCase(detail);
    expect(canonical.operationId).toBe('op-rich-all');
    // 显式 null 必须保持 null，不得回退旧值或补造“未命名/男/空字符串”
    expect(canonical.patientName).toBeNull();
    expect(canonical.gender).toBeNull();
    expect(canonical.canceledReason).toBeNull();
    expect(canonical.preceptorCode).toBe('PRE-1');
    expect(canonical.preceptorName).toBe('指导医生');
    expect(canonical.assistantCode).toBe('AS-1');
    expect(canonical.assistantName).toBe('助手');
    expect(canonical.instrumentNurseName).toBe('器械护士');
    expect(canonical.scrubNurseName).toBe('洗手护士');
    expect(canonical.circulatingNurseName).toBe('巡回护士');
    expect(canonical.operationLevelCode).toBe('L3');
    expect(canonical.operationLevelName).toBe('三级');
    expect(canonical.surgeryCategoryCode).toBe('CAT-1');
    expect(canonical.isLocked).toBe(false);
    expect(canonical.isArchived).toBe(false);
    expect(canonical.isPrinted).toBe(false);
    expect(canonical.hisIsDelete).toBe(false);
    expect(canonical.createTime).toBe('2026-07-13 08:00:00');
    expect(canonical.updateTime).toBe('2026-07-13 09:00:00');
    expect(canonical.version).toBe(7);
    expect(canonical.sourceSystem).toBe('HULI');
    expect(canonical.sourceTable).toBe('operatenotice');
  });

  it('authoritative remote operationCase null overrides stale local master data', () => {
    const remote: SurgeryCase = {
      ...mapOperationListItem({ OPERATIONID: 'op-null-master' }),
      id: 'op-null-master',
      operationCase: {
        operationId: 'op-null-master',
        patientName: null,
        version: 3,
        sourceSystem: 'HULI',
        sourceTable: 'operatenotice',
      },
    };
    const local: SurgeryCase = {
      ...remote,
      patientName: '旧姓名',
      operationCase: { operationId: 'op-null-master', patientName: '旧姓名', version: 2 },
      vitals: [{ time: '2026-07-13T08:00:00.000Z', HR: 90 }],
      medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }],
    };
    const merged = mergeRemoteMasterWithLocalClinical(remote, local);
    // 远端权威清空（null）覆盖本地旧值
    expect(merged.operationCase?.patientName).toBeNull();
    expect(merged.operationCase?.version).toBe(3);
    // 平铺投影不得保留本地旧姓名
    expect(merged.patientName).toBe('');
    // 本地临床记录保留
    expect(merged.vitals).toEqual([{ time: '2026-07-13T08:00:00.000Z', HR: 90 }]);
    expect(merged.medications).toEqual([{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }]);
  });

  it('clears fabricated flat defaults when authoritative operationCase fields are null', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'op-null-flat',
      operationCase: { operationId: 'op-null-flat', patientName: null, gender: null, version: 2 },
    });
    // 权威 null 必须清空首次列表平铺值，不得保留“未命名/男”
    expect(item.patientName).toBe('');
    expect(item.gender).toBe('');
    expect(item.operationCase?.patientName).toBeNull();
    expect(item.operationCase?.gender).toBeNull();
  });

  it('parses legacy boolean fields explicitly without Boolean("0") trap', () => {
    const falseCase = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-bool-false',
      ISLOCKING: '0', ISEMERGENCY: '0', ISTWO_PLAN_OPERATION: '0',
    }));
    expect(falseCase.isLocked).toBe(false);
    expect(falseCase.isEmergency).toBe(false);
    expect(falseCase.isTwoStageOperation).toBe(false);

    const falseWord = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-bool-false-word',
      ISLOCKING: 'false', ISEMERGENCY: 'false', ISTWO_PLAN_OPERATION: 'false',
    }));
    expect(falseWord.isLocked).toBe(false);
    expect(falseWord.isEmergency).toBe(false);

    const trueNum = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-bool-true',
      ISLOCKING: '1', ISEMERGENCY: 1, ISTWO_PLAN_OPERATION: true,
    }));
    expect(trueNum.isLocked).toBe(true);
    expect(trueNum.isEmergency).toBe(true);
    expect(trueNum.isTwoStageOperation).toBe(true);

    const trueWord = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-bool-true-word',
      ISLOCKING: 'true', ISEMERGENCY: 'true', ISTWO_PLAN_OPERATION: 'true',
    }));
    expect(trueWord.isLocked).toBe(true);
    expect(trueWord.isEmergency).toBe(true);
  });

  it('does not fabricate sourceSystem/sourceTable when server omits or nulls them', () => {
    const absent = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-src-absent',
      operationCase: { operationId: 'op-src-absent', patientName: '甲' },
    }));
    expect(absent.sourceSystem).toBeUndefined();
    expect(absent.sourceTable).toBeUndefined();

    const nulled = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-src-null',
      operationCase: { operationId: 'op-src-null', sourceSystem: null, sourceTable: null },
    }));
    expect(nulled.sourceSystem).toBeNull();
    expect(nulled.sourceTable).toBeNull();

    const provided = buildCanonicalOperationCase(mapOperationDetail({
      OPERATIONID: 'op-src-prov',
      operationCase: { operationId: 'op-src-prov', sourceSystem: 'HULI', sourceTable: 'operatenotice' },
    }));
    expect(provided.sourceSystem).toBe('HULI');
    expect(provided.sourceTable).toBe('operatenotice');
  });

  it('clears fabricated ASA/allergy shell defaults when authoritative fields are null or absent', () => {
    const nulled = mapOperationListItem({
      OPERATIONID: 'op-asa-null',
      operationCase: { operationId: 'op-asa-null', patientName: '甲', asaClass: null, allergyHistory: null },
    });
    expect(nulled.asa).toBe('');
    expect(nulled.preVisit.asa).toBe('');
    expect(nulled.preVisit.allergy).toBe('');
    expect(nulled.operationCase?.asaClass).toBeNull();
    expect(nulled.operationCase?.allergyHistory).toBeNull();

    const absent = mapOperationListItem({
      OPERATIONID: 'op-asa-absent',
      operationCase: { operationId: 'op-asa-absent', patientName: '乙' },
    });
    expect(absent.asa).toBe('');
    expect(absent.preVisit.asa).toBe('');
    expect(absent.preVisit.allergy).toBe('');
    expect(absent.operationCase?.asaClass).toBeUndefined();
    expect(absent.operationCase?.allergyHistory).toBeUndefined();
  });
});
