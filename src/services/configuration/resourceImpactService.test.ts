import { beforeEach, describe, expect, it, vi } from 'vitest';

const auxiliaryLocationApi = {
  locationList: vi.fn(),
  locationCreate: vi.fn(),
  impactPreview: vi.fn(),
  locationUpdate: vi.fn(),
};
const pacuApi = {
  bedList: vi.fn(),
  bedCreate: vi.fn(),
  bedImpactPreview: vi.fn(),
  bedUpdate: vi.fn(),
};

vi.mock('@/api/auxiliaryLocation', () => ({ auxiliaryLocationApi }));
vi.mock('@/api/pacu', () => ({ pacuApi }));

const service = await import('@/services/configuration/resourceImpactService');

describe('C1 辅助区域与 PACU 影响确认', () => {
  beforeEach(() => vi.clearAllMocks());

  it('辅助区域更新先预检，确认时复用同一 changes 和版本', async () => {
    const location = { locationId: 12, locationCode: 'DEL-1', locationName: '产房麻醉位', locationType: 'delivery_room', status: 'enabled', version: 3 } as const;
    const changes = { locationName: '产房麻醉位 A', status: 'maintenance' };
    const preview = { resourceId: 12, resourceVersion: 3, impactToken: 'token-a', expiresAt: '2026-07-17 12:00:00', changeDigest: 'digest', hasImpact: true, warnings: ['有影响'], impacts: [{ operationId: 'OP-1', status: 'reserved', version: 1 }] };
    auxiliaryLocationApi.impactPreview.mockResolvedValue(preview);
    auxiliaryLocationApi.locationUpdate.mockResolvedValue({ ...location, ...changes, version: 4 });

    expect(await service.previewAuxiliaryLocationUpdate(location, changes)).toEqual(preview);
    await service.confirmAuxiliaryLocationUpdate(location, changes, preview, '布局调整');

    expect(auxiliaryLocationApi.impactPreview).toHaveBeenCalledWith({ locationId: 12, changes });
    expect(auxiliaryLocationApi.locationUpdate).toHaveBeenCalledWith({
      locationId: 12,
      expectedVersion: 3,
      ...changes,
      confirmImpact: true,
      impactToken: 'token-a',
      reason: '布局调整',
    });
  });

  it('PACU 床位更新先预检，确认信封不夹带患者信息', async () => {
    const bed = { bedId: 'BED-1', roomId: 'PACU-1', bedNo: '01', status: '空闲', currentOperationId: 'OP-1', remark: null, version: 2 };
    const changes = { status: '维护', remark: '保养' };
    const preview = { resourceId: 'BED-1', resourceVersion: 2, impactToken: 'token-b', expiresAt: '2026-07-17 12:00:00', changeDigest: 'digest', hasImpact: true, warnings: ['有影响'], impacts: [{ operationId: 'OP-1', status: '占用', version: 2 }] };
    pacuApi.bedImpactPreview.mockResolvedValue(preview);
    pacuApi.bedUpdate.mockResolvedValue({});

    await service.previewPacuBedUpdate(bed, changes);
    await service.confirmPacuBedUpdate(bed, changes, preview, '设备保养');

    expect(pacuApi.bedImpactPreview).toHaveBeenCalledWith({ bedId: 'BED-1', changes });
    const payload = pacuApi.bedUpdate.mock.calls[0][0];
    expect(payload).toEqual({ bedId: 'BED-1', expectedVersion: 2, ...changes, confirmImpact: true, impactToken: 'token-b', reason: '设备保养', sourceSystem: 'SAMIS' });
    expect(payload).not.toHaveProperty('currentOperationId');
    expect(payload).not.toHaveProperty('patientName');
  });

  it('实体版本与预检版本不一致时不提交确认', async () => {
    const location = { locationId: 12, locationCode: 'DEL-1', locationName: '产房', locationType: 'delivery_room', status: 'enabled', version: 4 } as const;
    const preview = { resourceId: 12, resourceVersion: 3, impactToken: 'stale', expiresAt: '', changeDigest: '', hasImpact: false, warnings: [], impacts: [] };
    await expect(service.confirmAuxiliaryLocationUpdate(location, { status: 'maintenance' }, preview, '原因')).rejects.toBeInstanceOf(service.ResourceImpactConflictError);
    expect(auxiliaryLocationApi.locationUpdate).not.toHaveBeenCalled();
  });
});
