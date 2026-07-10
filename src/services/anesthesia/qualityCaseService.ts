import { qualityApi, type DefectRecordApi, type QualityCaseListApi, type QualityDrilldownCaseApi } from '@/api/quality';
import { useRealQuality } from '@/config/apiFlags';

const forbidden = new Set(['patientId','patientName','departmentName','operationName','operationDate','caseId','operationCase']);
export function defectWritePayload(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !forbidden.has(key)));
}
export async function loadQualityCases(params: Record<string,string|number|undefined> = {}): Promise<QualityCaseListApi> {
  if (!useRealQuality()) return { list: [], total: 0 };
  return qualityApi.caseList(params);
}
export async function loadQualityCase(operationId: string): Promise<QualityDrilldownCaseApi | null> {
  if (!useRealQuality()) return null;
  return qualityApi.caseDetail(operationId);
}
export async function createQualityDefect(input: Record<string,unknown>): Promise<DefectRecordApi> { return qualityApi.defectCreate(defectWritePayload(input)); }
export async function updateQualityDefect(input: Record<string,unknown>): Promise<DefectRecordApi> { return qualityApi.defectUpdate(defectWritePayload(input)); }
export async function closeQualityDefect(input: Record<string,unknown>): Promise<DefectRecordApi> { return qualityApi.defectClose(defectWritePayload(input)); }
