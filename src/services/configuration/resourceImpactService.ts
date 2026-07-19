import { auxiliaryLocationApi } from '@/api/auxiliaryLocation';
import { pacuApi } from '@/api/pacu';
import { unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';

export interface AuxiliaryLocationRow {
  locationId: number;
  locationCode: string;
  locationName: string;
  locationType: 'delivery_room' | 'non_operating_room';
  campus: string | null;
  floor: string | null;
  location: string | null;
  status: 'draft' | 'enabled' | 'maintenance' | 'disabled';
  version: number;
  reason: string | null;
}

export interface PacuBedResourceRow {
  bedId: string;
  roomId: string;
  bedNo: string;
  status: '空闲' | '预留' | '维护' | '占用' | string;
  currentOperationId: string | null;
  remark: string | null;
  version: number;
}

export interface ResourceImpactPreview {
  resourceId: string | number;
  resourceVersion: number;
  changeDigest: string;
  impactToken: string;
  expiresAt: string;
  hasImpact: boolean;
  warnings: string[];
  impacts: Array<{ operationId: string; status: string; version: number }>;
}

export class ResourceImpactConflictError extends Error {
  constructor(message = '资源版本已变化，请重新读取并执行影响预检') {
    super(message);
    this.name = 'ResourceImpactConflictError';
  }
}

export function listPayload<T>(raw: unknown): T[] {
  return unwrapListPayload(raw) as T[];
}

export async function loadAuxiliaryLocations(): Promise<AuxiliaryLocationRow[]> {
  return listPayload<AuxiliaryLocationRow>(await auxiliaryLocationApi.locationList({ pageSize: 200 }));
}

export async function createAuxiliaryLocation(payload: Record<string, unknown>): Promise<void> {
  await auxiliaryLocationApi.locationCreate(payload);
}

export async function loadPacuBedResources(): Promise<PacuBedResourceRow[]> {
  return listPayload<PacuBedResourceRow>(await pacuApi.bedList({ pageSize: 200 }));
}

export async function createPacuBedResource(payload: Record<string, unknown>): Promise<void> {
  await pacuApi.bedCreate({ ...payload, expectedVersion: 0 });
}

export async function previewAuxiliaryLocationUpdate(
  location: Pick<AuxiliaryLocationRow, 'locationId'>,
  changes: Record<string, unknown>,
): Promise<ResourceImpactPreview> {
  return auxiliaryLocationApi.impactPreview({ locationId: location.locationId, changes }) as Promise<ResourceImpactPreview>;
}

export async function confirmAuxiliaryLocationUpdate(
  location: Pick<AuxiliaryLocationRow, 'locationId' | 'version'>,
  changes: Record<string, unknown>,
  preview: ResourceImpactPreview,
  reason: string,
): Promise<void> {
  assertPreviewVersion(location.version, preview);
  await auxiliaryLocationApi.locationUpdate({
    locationId: location.locationId,
    expectedVersion: location.version,
    ...changes,
    confirmImpact: true,
    impactToken: preview.impactToken,
    reason,
  });
}

export async function previewPacuBedUpdate(
  bed: Pick<PacuBedResourceRow, 'bedId'>,
  changes: Record<string, unknown>,
): Promise<ResourceImpactPreview> {
  return pacuApi.bedImpactPreview({ bedId: bed.bedId, changes }) as Promise<ResourceImpactPreview>;
}

export async function confirmPacuBedUpdate(
  bed: Pick<PacuBedResourceRow, 'bedId' | 'version'>,
  changes: Record<string, unknown>,
  preview: ResourceImpactPreview,
  reason: string,
): Promise<void> {
  assertPreviewVersion(bed.version, preview);
  await pacuApi.bedUpdate({
    bedId: bed.bedId,
    expectedVersion: bed.version,
    ...changes,
    confirmImpact: true,
    impactToken: preview.impactToken,
    reason,
    sourceSystem: 'SAMIS',
  });
}

function assertPreviewVersion(version: number, preview: ResourceImpactPreview): void {
  if (version !== preview.resourceVersion) throw new ResourceImpactConflictError();
  if (!preview.impactToken) throw new ResourceImpactConflictError('影响预检未返回有效确认凭据');
}
