import { describe, expect, it, vi } from 'vitest';
import { qualityApi } from '@/api/quality';
import { loadOperationalReport, operationalReportCsv } from './qualityOperationalReportService';

vi.mock('@/api/quality', () => ({ qualityApi: { operationalReport: vi.fn() } }));

describe('qualityOperationalReportService', () => {
  it('loads one backend snapshot for all report views', async () => {
    vi.mocked(qualityApi.operationalReport).mockResolvedValue({ scope: { total: 0 }, workload: [], methods: [], operations: { departments: [], rooms: [] }, drilldown: [] } as never);
    await loadOperationalReport({ startDate: '2026-07-01', endDate: '2026-07-31' });
    expect(qualityApi.operationalReport).toHaveBeenCalledWith({ startDate: '2026-07-01', endDate: '2026-07-31' });
  });

  it('exports only OperationCase projections and report outcomes', () => {
    const csv = operationalReportCsv({ scope: { total: 1, completed: 1, completionRate: 100, startDate: null, endDate: null }, workload: [], methods: [], operations: { departments: [], rooms: [] }, drilldown: [{ operationId: 'OP-1', operationCase: { operationId: 'OP-1', patientName: '测试"患者', operationName: '手术' }, completed: true, riskLevel: 'normal', defectCount: 0 }] });
    expect(csv).toContain('OP-1');
    expect(csv).toContain('测试""患者');
    expect(csv).not.toContain('case_payload');
  });
});
