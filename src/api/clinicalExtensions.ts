import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

// ---- PDCA ----
export interface PdcaCycleApi {
  cycleId: string;
  title: string;
  cycleType: string;
  startDate: string;
  endDate: string;
  status: string;
}

export const pdcaApi = {
  createCycle(data: Record<string, unknown>) { return samisRequest<PdcaCycleApi>('/quality/pdcaCreateCycle', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' }); },
  listCycles(page = 1, pageSize = 20) { return samisRequest<{ list: PdcaCycleApi[]; total: number }>(`/quality/pdcaListCycles?page=${page}&page_size=${pageSize}`, undefined, { module: 'quality' }); },
  freezeIndicators(data: Record<string, unknown>) { return samisRequest<{ snapshotId: string; frozenAt: string }>('/quality/pdcaFreezeIndicators', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' }); },
  createAnalysis(data: Record<string, unknown>) { return samisRequest<unknown>('/quality/pdcaCreateAnalysis', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' }); },
  reviewAnalysis(data: { analysisId: string; decision: string; reviewOpinion?: string }) { return samisRequest<unknown>('/quality/pdcaReviewAnalysis', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' }); },
  closeCycle(cycleId: string) { return samisRequest<PdcaCycleApi>('/quality/pdcaCloseCycle', buildFormPost({ cycleId }), { module: 'quality' }); },
  listAnalyses(cycleId: string, page = 1, pageSize = 20) { return samisRequest<{ list: unknown[]; total: number }>(`/quality/pdcaListAnalyses?cycleId=${encodeURIComponent(cycleId)}&page=${page}&page_size=${pageSize}`, undefined, { module: 'quality' }); },
};

// ---- Clinical Config ----
export interface ClinicalConfigApi {
  key: string;
  value: string;
  scope: string;
  source: string;
}

export const configApi = {
  get(key: string, scope?: string) {
    const q = `key=${encodeURIComponent(key)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`;
    return samisRequest<ClinicalConfigApi>(`/quality/configGet?${q}`, undefined, { module: 'quality' });
  },
  set(key: string, value: string, scope?: string, description?: string) {
    return samisRequest<ClinicalConfigApi>('/quality/configSet', buildFormPost(flatFormFieldsFromRecord({ key, value, scope, description })), { module: 'quality' });
  },
  list(scope?: string) {
    const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return samisRequest<{ list: ClinicalConfigApi[] }>(`/quality/configList${q}`, undefined, { module: 'quality' });
  },
};

// ---- Device ----
export interface DeviceRegistryApi {
  deviceId: string;
  deviceType: string;
  vendor: string | null;
  model: string | null;
  protocolCode: string;
  status: string;
  lastHeartbeatAt: string | null;
}

export interface DeviceAlertApi {
  alertId: string;
  operationId: string;
  deviceId: string;
  alertCode: string;
  severity: string;
  message: string;
  occurredAt: string;
  status: string;
}

export const deviceApi = {
  registryList(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return samisRequest<{ list: DeviceRegistryApi[]; total: number }>(`/anesthesiaDevice/registryList${q.size ? `?${q}` : ''}`, undefined, { module: 'anesthesiaDevice' });
  },
  registrySave(data: Record<string, unknown>) { return samisRequest<DeviceRegistryApi>('/anesthesiaDevice/registrySave', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'anesthesiaDevice' }); },
  bind(deviceId: string, operationId: string) { return samisRequest<{ bindingId: string }>('/anesthesiaDevice/bind', buildFormPost({ deviceId, operationId }), { module: 'anesthesiaDevice' }); },
  unbind(bindingId: string, reason: string) { return samisRequest<unknown>('/anesthesiaDevice/unbind', buildFormPost({ bindingId, reason }), { module: 'anesthesiaDevice' }); },
  heartbeat(deviceId: string, status: string) { return samisRequest<{ deviceId: string; status: string }>('/anesthesiaDevice/heartbeat', buildFormPost({ deviceId, status }), { module: 'anesthesiaDevice' }); },
  alertList(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return samisRequest<{ list: DeviceAlertApi[]; total: number }>(`/anesthesiaDevice/alertList${q.size ? `?${q}` : ''}`, undefined, { module: 'anesthesiaDevice' });
  },
  alertAcknowledge(alertId: string, dispositionType: string, disposition: string) {
    return samisRequest<DeviceAlertApi>('/anesthesiaDevice/alertAcknowledge', buildFormPost({ alertId, dispositionType, disposition }), { module: 'anesthesiaDevice' });
  },
};

// ---- Record Terminal States ----
export interface RecordStatusApi {
  operationId: string;
  recordLocalId: string;
  status: string;
  documentVersion: number;
  submittedAt: string | null;
  signedAt: string | null;
  archivedAt: string | null;
  contentHash: string | null;
}

export const recordLifecycleApi = {
  submit(data: { operationId: string; recordLocalId: string; expectedSyncVersion: number }) {
    return samisRequest<{ record: RecordStatusApi; revision: unknown }>('/anesthesiaRecord/submitRecord', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'anesthesiaRecord' });
  },
  sign(data: { operationId: string; recordLocalId: string; revisionId: string; providerSignatureId: string }) {
    return samisRequest<RecordStatusApi>('/anesthesiaRecord/signRecord', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'anesthesiaRecord' });
  },
  createRevision(data: { operationId: string; recordLocalId: string; revisionId: string; reason: string }) {
    return samisRequest<RecordStatusApi>('/anesthesiaRecord/createRevision', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'anesthesiaRecord' });
  },
  archive(data: { operationId: string; recordLocalId: string; revisionId: string }) {
    return samisRequest<RecordStatusApi>('/anesthesiaRecord/archiveRecord', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'anesthesiaRecord' });
  },
};
