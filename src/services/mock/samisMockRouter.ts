import { buildSamisSuccess } from '@/api/samisResponse';
import type { SamisApiResponse } from '@/api/samisResponse';
import type { PushBatchRequest, PushBatchResponse, PushBatchResultItem } from '@/api/anesthesiaSync';
import dayjs from 'dayjs';
import { seedDrugDict, seedFluidBloodDict } from '@/mock/configSeed';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import { drugDictItemToApi } from '@/services/drugDictMapper';
import { buildDrugRecommendFromDict } from '@/services/drugDictRecommend';
import { SPECIAL_DRUG_CATEGORY_OPTIONS } from '@/types/drugDict';

const serverIdCounter = { value: 10000 };

interface MockServerEntity {
  entityType: string;
  localId: string;
  serverId: number;
  syncVersion: number;
  payload: unknown;
  deletedAt?: string;
  isCorrected?: boolean;
  collectTime?: string;
}

const serverEntityRegistry = new Map<string, MockServerEntity>();

function entityKey(entityType: string, localId: string) {
  return `${entityType}:${localId}`;
}

function nextServerId() {
  serverIdCounter.value += 1;
  return serverIdCounter.value;
}

function parseBody<T>(init?: RequestInit): T {
  const raw = String(init?.body ?? '');
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const params = new URLSearchParams(raw);
    const obj: Record<string, unknown> = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    if (typeof obj.data === 'string') {
      try {
        obj.data = JSON.parse(obj.data);
      } catch {
        // keep string
      }
    }
    if (typeof obj.items === 'string') {
      try {
        obj.items = JSON.parse(obj.items);
      } catch {
        // keep string
      }
    }
    return obj as T;
  }
}

function getPayloadField(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return undefined;
  return (payload as Record<string, unknown>)[key];
}

function joinDisplayValue(value: unknown, fallback = '') {
  if (Array.isArray(value)) return value.join('、');
  return String(value ?? fallback);
}

function caseToOperationRow(item: (typeof anesthesiaCases)[0]) {
  const scheduledStart = item.scheduledStart ?? item.plannedStart;
  return {
    operationId: item.id,
    OPERATIONID: item.id,
    patientName: item.patientName,
    patientNumber: item.patientId ?? item.id,
    room: item.room,
    roomName: item.roomName ?? item.room,
    roomId: item.roomId ?? item.room,
    numberOfStations: item.sequence,
    surgeryName: item.surgeryName,
    diagnosis: item.diagnosis,
    surgeon: item.surgeon,
    anesthesiologist: item.anesthesiologist,
    anesthesiaMethod: item.anesthesiaMethod,
    asa: item.asa,
    gender: item.gender,
    age: item.age,
    department: item.department,
    operationDate: dayjs(scheduledStart).format('YYYY-MM-DD'),
    scheduledStart,
    scheduledEnd: item.scheduledEnd,
    plannedStart: item.plannedStart,
    urgency: item.urgency,
    status: item.status,
    circulatingNurse: joinDisplayValue(item.circulatingNurses, item.anesthesiaNurse),
    scrubNurse: joinDisplayValue(item.scrubNurses),
  };
}

function findCaseByOperationId(operationId: string) {
  return anesthesiaCases.find((c) => c.id === operationId);
}

function getSearchParams(path: string) {
  return new URL(path, 'http://local').searchParams;
}

function operationCaseDate(item: (typeof anesthesiaCases)[0]) {
  return dayjs(item.scheduledStart ?? item.plannedStart).format('YYYY-MM-DD');
}

function includesText(value: unknown, keyword: string) {
  return String(value ?? '').toLowerCase().includes(keyword.toLowerCase());
}

function matchesOperationListQuery(item: (typeof anesthesiaCases)[0], params: URLSearchParams) {
  const operationDate = params.get('operationDate') || params.get('date');
  if (operationDate && operationCaseDate(item) !== dayjs(operationDate).format('YYYY-MM-DD')) {
    return false;
  }

  const room = params.get('operationRoom') || params.get('room') || params.get('roomId');
  if (room) {
    const values = [item.room, item.roomId, item.roomName];
    if (!values.some((value) => includesText(value, room))) return false;
  }

  const patientName = params.get('patientName');
  if (patientName && !includesText(item.patientName, patientName)) {
    return false;
  }

  const inpatientNo = params.get('inpatientNo') || params.get('patientNumber') || params.get('patientId');
  if (inpatientNo) {
    const values = [item.patientId, item.id];
    if (!values.some((value) => includesText(value, inpatientNo))) return false;
  }

  return true;
}

function isCaseInRange(item: (typeof anesthesiaCases)[0], startTime?: string | null, endTime?: string | null) {
  if (!startTime && !endTime) return true;
  const date = dayjs(operationCaseDate(item));
  const start = startTime ? dayjs(startTime).startOf('day') : null;
  const end = endTime ? dayjs(endTime).endOf('day') : null;
  if (start && date.isBefore(start, 'day')) return false;
  if (end && date.isAfter(end, 'day')) return false;
  return true;
}

function handleSamisSyncPushBatch(body: PushBatchRequest): SamisApiResponse<PushBatchResponse> {
  const results: PushBatchResultItem[] = body.items.map((item) => {
    const localId = item.localId;
    const entityType = item.entityType;
    const key = entityKey(entityType, localId);
    const baseSyncVersion = item.baseSyncVersion ?? Number(getPayloadField(item.payload, 'baseSyncVersion') ?? 0);
    const operationType = item.operationType;
    const payload = item.payload ?? {};
    const recordLocked = Boolean(getPayloadField(payload, 'recordLocked') ?? getPayloadField(body, 'recordLocked'));
    const recordPrinted = Boolean(getPayloadField(payload, 'recordPrinted'));

    if (recordLocked || recordPrinted) {
      if (operationType === 'update' || operationType === 'delete' || operationType === 'void') {
        const existing = serverEntityRegistry.get(key);
        return {
          entityType,
          localId,
          serverId: existing?.serverId ?? item.serverId ?? null,
          status: 'conflict',
          conflictType: recordPrinted ? 'record_printed' : 'record_locked',
          message: recordPrinted ? 'record printed on server' : 'record locked on server',
          serverSyncVersion: existing?.syncVersion,
          serverPayload: existing?.payload ?? {},
        };
      }
    }

    if (entityType === 'monitor_raw' || entityType === 'ventilator_raw') {
      const collectTime = String(getPayloadField(payload, 'collectTime') ?? getPayloadField(payload, 'collect_time') ?? '');
      const dup = [...serverEntityRegistry.values()].find((row) =>
        row.entityType === entityType
        && (row.localId === localId || (collectTime && row.collectTime === collectTime)),
      );
      if (dup) {
        return {
          entityType,
          localId,
          serverId: dup.serverId,
          status: 'success',
          message: 'deduplicated',
          serverSyncVersion: dup.syncVersion,
        };
      }
      const serverId = nextServerId();
      serverEntityRegistry.set(key, {
        entityType,
        localId,
        serverId,
        syncVersion: 1,
        payload,
        collectTime,
      });
      return { entityType, localId, serverId, status: 'success', serverSyncVersion: 1 };
    }

    if (entityType === 'vital_sign') {
      const existing = serverEntityRegistry.get(key);
      const incomingSource = String(getPayloadField(payload, 'source') ?? '');
      if (existing?.isCorrected && incomingSource.includes('设备')) {
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'conflict',
          conflictType: 'vital_corrected',
          message: 'vital corrected on server',
          serverSyncVersion: existing.syncVersion,
          serverPayload: existing.payload,
        };
      }
    }

    const conflictTypes = new Set(['medication', 'fluid', 'transfusion', 'timeline_event']);
    const existing = serverEntityRegistry.get(key);
    if (conflictTypes.has(entityType) && existing && baseSyncVersion < existing.syncVersion) {
      return {
        entityType,
        localId,
        serverId: existing.serverId,
        status: 'conflict',
        conflictType: 'version_mismatch',
        message: 'server sync version newer',
        serverSyncVersion: existing.syncVersion,
        serverPayload: existing.payload,
      };
    }

    if (operationType === 'delete' || operationType === 'void') {
      if (existing) {
        existing.deletedAt = new Date().toISOString();
        existing.syncVersion += 1;
        existing.payload = {
          ...existing.payload as object,
          deletedAt: existing.deletedAt,
          voidReason: getPayloadField(payload, 'voidReason') ?? 'void',
        };
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'success',
          serverSyncVersion: existing.syncVersion,
        };
      }
      return { entityType, localId, serverId: nextServerId(), status: 'success', serverSyncVersion: 1 };
    }

    const nextVersion = existing ? existing.syncVersion + 1 : 1;
    const isCorrected = getPayloadField(payload, 'source') === '手工修正' || Boolean(getPayloadField(payload, 'correctedValue'));
    const serverId = existing?.serverId ?? item.serverId ?? nextServerId();
    serverEntityRegistry.set(key, {
      entityType,
      localId,
      serverId,
      syncVersion: nextVersion,
      payload,
      isCorrected: isCorrected || existing?.isCorrected,
    });
    return {
      entityType,
      localId,
      serverId,
      status: 'success',
      serverSyncVersion: nextVersion,
    };
  });
  return buildSamisSuccess({ batchNo: body.batchNo, results });
}

function handleSamisDeviceBatch(body: { items?: Array<{ localId: string }> }, entityType: string) {
  const items = body.items ?? [];
  return buildSamisSuccess({
    results: items.map((item) => ({
      entityType,
      localId: item.localId,
      serverId: nextServerId(),
      status: 'success' as const,
      message: '',
    })),
  });
}

function handleSamisRecordBatch(
  body: { items?: Array<{ localId?: string; id?: string }> },
  entityType: string,
) {
  const items = body.items ?? [];
  return buildSamisSuccess({
    results: items.map((item) => ({
      entityType,
      localId: item.localId ?? item.id ?? `${entityType}-${Date.now()}`,
      serverId: nextServerId(),
      status: 'success' as const,
      message: '',
      serverSyncVersion: 1,
    })),
  });
}

const MOCK_ROOMS = [
  { roomId: 'OR-01', roomName: 'OR-01', roomGroup: '手术中心' },
  { roomId: 'OR-02', roomName: 'OR-02', roomGroup: '手术中心' },
  { roomId: 'OR-03', roomName: 'OR-03', roomGroup: '手术中心' },
  { roomId: 'OR-04', roomName: 'OR-04', roomGroup: '手术中心' },
  { roomId: 'OR-05', roomName: 'OR-05', roomGroup: '手术中心' },
  { roomId: 'OR-06', roomName: 'OR-06', roomGroup: '手术中心' },
  { roomId: 'PACU', roomName: 'PACU', roomGroup: '恢复区' },
];

/**
 * Routes Samis-style paths (with or without /api-samis/pc/v1 prefix).
 */
export async function routeSamisMock<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (path.endsWith('/anesthesiaSync/pushBatch') && init?.method === 'POST') {
    return handleSamisSyncPushBatch(parseBody<PushBatchRequest>(init)) as T;
  }
  if (path.includes('/anesthesiaSync/getSyncStatus')) {
    return buildSamisSuccess({ pendingCount: 0, online: true, lastSyncedAt: new Date().toISOString() }) as T;
  }
  if (path.includes('/anesthesiaSync/getPendingCount')) {
    return buildSamisSuccess({ pendingCount: 0 }) as T;
  }
  if (path.endsWith('/anesthesiaSync/confirmBatch') && init?.method === 'POST') {
    const body = parseBody<{ batchNo: string }>(init);
    return buildSamisSuccess({ batchNo: body.batchNo, confirmed: true }) as T;
  }
  if (path.endsWith('/anesthesiaSync/resolveConflict') && init?.method === 'POST') {
    const body = parseBody<{ conflictId?: string; localId?: string; action?: string }>(init);
    return buildSamisSuccess({
      conflictId: body.conflictId ?? body.localId ?? `conflict-${Date.now()}`,
      action: body.action ?? 'keepLocal',
      resolved: true,
      resolvedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveRecord') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; caseId?: string }>(init);
    return buildSamisSuccess({ localId: body.localId ?? body.caseId ?? 'local-record', serverId: nextServerId() }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveSnapshot') && init?.method === 'POST') {
    const body = parseBody<{ snapshotId?: string; localId?: string }>(init);
    return buildSamisSuccess({
      snapshotId: body.snapshotId ?? body.localId ?? `snapshot-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveTimelineEvents') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'timeline_event') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveMedications') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'medication') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveFluids') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'fluid') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveTransfusions') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'transfusion') as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveVitalSigns') && init?.method === 'POST') {
    return handleSamisRecordBatch(parseBody(init), 'vital_sign') as T;
  }
  if (path.endsWith('/anesthesiaRecord/lockRecord') && init?.method === 'POST') {
    const body = parseBody<{ operationId?: string; recordLocalId?: string }>(init);
    return buildSamisSuccess({
      operationId: body.operationId,
      recordLocalId: body.recordLocalId,
      locked: true,
      lockedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/voidRecord') && init?.method === 'POST') {
    const body = parseBody<{ operationId?: string; recordLocalId?: string; voidReason?: string }>(init);
    return buildSamisSuccess({
      operationId: body.operationId,
      recordLocalId: body.recordLocalId,
      voidReason: body.voidReason,
      voided: true,
      voidedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveIoRecord') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; id?: string }>(init);
    return buildSamisSuccess({
      localId: body.localId ?? body.id ?? `io-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveLabResult') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; id?: string }>(init);
    return buildSamisSuccess({
      localId: body.localId ?? body.id ?? `lab-${Date.now()}`,
      serverId: nextServerId(),
      savedAt: new Date().toISOString(),
    }) as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushMonitorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'monitor_raw') as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushVentilatorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'ventilator_raw') as T;
  }
  if (path.includes('/anesthesiaDevice/getLatestDeviceData')) {
    return buildSamisSuccess({ monitor: null, ventilator: null }) as T;
  }
  if (path.includes('/anesthesiaRecord/getRecordDetail')) {
    const operationId = getSearchParams(path).get('operationId') ?? '';
    const { mockApi } = await import('@/services/mockApi');
    const payload = mockApi.getAnesthesiaRecord(operationId);
    return buildSamisSuccess(payload ?? { operationId, record: null }) as T;
  }

  if (path.includes('/operationInfo/getOperationList')) {
    const params = getSearchParams(path);
    const list = anesthesiaCases.filter((item) => matchesOperationListQuery(item, params)).map(caseToOperationRow);
    return buildSamisSuccess({
      list,
      total: list.length,
    }) as T;
  }
  if (path.includes('/operationInfo/getOperationInfo')) {
    const params = getSearchParams(path);
    const operationId = params.get('operationId') ?? params.get('OPERATIONID') ?? '';
    const seed = findCaseByOperationId(operationId);
    const row = seed ? caseToOperationRow(seed) : {
      operationId,
      patientName: 'Mock Patient',
      surgeryName: 'Mock Surgery',
      room: 'OR-01',
      diagnosis: 'Mock Diagnosis',
    };
    return buildSamisSuccess({
      ...row,
      preMedication: seed?.preVisit.preMedication,
      fasting: seed?.preVisit.fasting,
      height: seed?.preVisit.height,
      weight: seed?.preVisit.weight,
      circulatingNurses: seed?.circulatingNurses,
      scrubNurses: seed?.scrubNurses,
    }) as T;
  }
  if (path.includes('/operationInfo/getNursePbList')) {
    const params = getSearchParams(path);
    const list = anesthesiaCases.filter((c) => isCaseInRange(c, params.get('startTime'), params.get('endTime')));
    return buildSamisSuccess({
      list: list.map((c) => ({
        operationId: c.id,
        room: c.room,
        roomId: c.roomId ?? c.room,
        roomName: c.roomName ?? c.room,
        operationDate: operationCaseDate(c),
        scheduledStart: c.scheduledStart ?? c.plannedStart,
        scheduledEnd: c.scheduledEnd,
        numberOfStations: c.sequence,
        anesthesiologist: c.anesthesiologist,
        nurse: c.anesthesiaNurse,
        circulatingNurse: joinDisplayValue(c.circulatingNurses, c.anesthesiaNurse),
        scrubNurse: joinDisplayValue(c.scrubNurses),
      })),
      total: list.length,
    }) as T;
  }
  if (path.endsWith('/operationInfo/saveNursePb') && init?.method === 'POST') {
    return buildSamisSuccess({ saved: true }) as T;
  }
  if (path.endsWith('/operationInfo/updateNumberOfStations') && init?.method === 'POST') {
    return buildSamisSuccess({ updated: true }) as T;
  }
  if (path.endsWith('/operationInfo/updateOperationInfo') && init?.method === 'POST') {
    return buildSamisSuccess({ updated: true }) as T;
  }

  if (path.includes('/room/getRoomList')) {
    return buildSamisSuccess({ list: MOCK_ROOMS }) as T;
  }
  if (path.includes('/room/getRoomGroupList')) {
    return buildSamisSuccess({
      list: [
        { roomGroupId: 'g-or', roomGroupName: '手术中心', rooms: MOCK_ROOMS.filter((r) => r.roomGroup === '手术中心') },
        { roomGroupId: 'g-pacu', roomGroupName: '恢复区', rooms: MOCK_ROOMS.filter((r) => r.roomGroup === '恢复区') },
      ],
    }) as T;
  }

  if (path.includes('/admin/login') && init?.method === 'POST') {
    const body = parseBody<{ username?: string; password?: string }>(init);
    const login = body.username ?? 'user';
    return buildSamisSuccess({
      token: `mock-token-${login}`,
      userInfo: {
        id: 'mock-user-1',
        name: '演示用户',
        GH: login,
        token: `mock-token-${login}`,
        department_code: 'ANES',
        department_name: '麻醉科',
      },
    }) as T;
  }
  if (path.includes('/adminUser/getAdminUserInfo')
    || path.includes('/user/getLoginUser')
    || path.includes('/user/getCurrentUser')) {
    return buildSamisSuccess({
      userId: 'mock-user-1',
      userName: '王睿',
      loginName: 'wangrui',
      gh: 'wangrui',
      room: 'OR-01',
      roomGroup: '手术中心',
      roleNames: ['麻醉医生'],
    }) as T;
  }

  if (path.includes('/anesthesiaDict/getSpecialDrugCategories')) {
    return buildSamisSuccess(SPECIAL_DRUG_CATEGORY_OPTIONS) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugRecommend')) {
    const params = new URL(path, 'http://local').searchParams;
    const drug = seedDrugDict.find((d) => d.id === params.get('drug_id') || d.name === params.get('drug_name'));
    return buildSamisSuccess(drug ? buildDrugRecommendFromDict(drug) : null) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugDict')) {
    const list = seedDrugDict.filter((d) => d.enabled).map(drugDictItemToApi);
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/getFluidDict')) {
    const list = seedFluidBloodDict.filter((d) => d.enabled).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      subCategory: item.subCategory,
      enabled: item.enabled,
    }));
    return buildSamisSuccess({ list, page: 1, page_size: list.length, total: list.length }) as T;
  }
  if (path.includes('/anesthesiaDict/saveDrugDict')) {
    return buildSamisSuccess({ drugId: parseBody<{ drugId?: string }>(init).drugId ?? `drug-mock-${Date.now()}` }) as T;
  }
  if (path.includes('/anesthesiaDict/disableDrugDict')) {
    return buildSamisSuccess(null) as T;
  }
  if (
    path.includes('/anesthesiaDict/getTemplate')
    || path.includes('/anesthesiaDict/getTemplateField')
    || path.includes('/anesthesiaDict/getDictCategory')
    || path.includes('/anesthesiaDict/getDictItem')
    || path.includes('/anesthesiaDict/getBloodProductDict')
    || path.includes('/anesthesiaDict/getEventDict')
    || path.includes('/anesthesiaDict/getDeviceDict')
  ) {
    return buildSamisSuccess({ list: [], page: 1, page_size: 10, total: 0 }) as T;
  }
  if (path.includes('/anesthesiaDict/save') || path.includes('/anesthesiaDict/disable') || path.includes('/anesthesiaDict/delete')) {
    return buildSamisSuccess(null) as T;
  }

  throw new Error(`Mock backend route not implemented: ${path}`);
}
