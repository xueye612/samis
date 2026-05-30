import { getMutableDataset } from '@/services/datasetStore';
import type { QualityDataset } from '@/types/mockTables';
import type { SurgeryCase } from '@/types/anesthesia';
import type {
  AnesthesiaRecordDocument,
  AnesthesiaRecordSnapshot,
  LabResultRecord,
  RecordSummaryFields,
  TransfusionEventRecord,
} from '@/types/anesthesiaRecord';

export interface AnesthesiaRecordApiPayload {
  case: SurgeryCase;
  snapshot?: AnesthesiaRecordSnapshot;
  document?: AnesthesiaRecordDocument;
  labResults?: LabResultRecord[];
  transfusionEvents?: TransfusionEventRecord[];
  summary?: RecordSummaryFields;
}

const recordStore = new Map<string, AnesthesiaRecordApiPayload>();

export function getQualityDataset(): QualityDataset {
  return getMutableDataset();
}

export const mockApi = {
  getQualityDataset,
  getAnesthesiaRecord(caseId: string) {
    return recordStore.get(caseId) ?? null;
  },
  saveAnesthesiaRecord(payload: AnesthesiaRecordApiPayload) {
    recordStore.set(payload.case.id, payload);
    return payload;
  },
  listAnesthesiaRecords() {
    return Array.from(recordStore.values());
  },
};

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (path.startsWith('/quality/dataset')) return getQualityDataset() as T;
  if (path.startsWith('/anesthesia/records/') && (!init?.method || init.method === 'GET')) {
    const caseId = path.split('/').pop() ?? '';
    return mockApi.getAnesthesiaRecord(caseId) as T;
  }
  if (path === '/anesthesia/records' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body ?? '{}')) as AnesthesiaRecordApiPayload;
    return mockApi.saveAnesthesiaRecord(body) as T;
  }
  throw new Error(`Mock backend route not implemented: ${path}`);
}
