import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { routeSamisMock } from '@/services/mock/samisMockRouter';
import { unwrapSamisResponse, type SamisApiResponse } from '@/api/samisResponse';

async function mockData<T>(path: string, init?: RequestInit) {
  const response = await routeSamisMock<SamisApiResponse<T>>(path, init);
  return unwrapSamisResponse(response);
}

describe('samisMockRouter', () => {
  it('往返保存麻醉记录单实时设备数据源配置', async () => {
    const path = '/quality/configSet';
    const post = (value: 'simulation' | 'real') => mockData<{ key: string; value: string; scope: string }>(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          key: 'device_realtime_data_source',
          value,
          scope: 'global',
        }).toString(),
      },
    );

    try {
      expect(await post('real')).toMatchObject({
        key: 'device_realtime_data_source',
        value: 'real',
        scope: 'global',
      });
      expect(await mockData<{ value: string }>(
        '/quality/configGet?key=device_realtime_data_source&scope=global',
      )).toMatchObject({ value: 'real' });
    } finally {
      await post('simulation');
    }
  });

  it('为本地模拟页面提供结构化权限上下文', async () => {
    const data = await mockData<{ permissions: string[]; role: string; groupid: number | null }>(
      '/auth/myPermissions',
    );

    expect(data).toEqual({ permissions: ['*'], role: 'developer', groupid: 1 });
  });

  it('为重构后的26项质控页提供完整模拟列表', async () => {
    const data = await mockData<Array<{ code: string; category: string; status: string }>>(
      '/quality/indicators?category=全部',
    );

    expect(data).toHaveLength(26);
    expect(data[0]).toEqual(expect.objectContaining({ code: expect.any(String), status: 'no-data' }));
  });

  it('filters operation list by operationDate', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

    const todayData = await mockData<{ list: unknown[]; total: number }>(
      `/operationInfo/getOperationList?operationDate=${today}`,
    );
    const tomorrowData = await mockData<{ list: unknown[]; total: number }>(
      `/operationInfo/getOperationList?operationDate=${tomorrow}`,
    );

    expect(todayData.total).toBeGreaterThan(0);
    expect(todayData.list.length).toBe(todayData.total);
    expect(tomorrowData.total).toBe(0);
    expect(tomorrowData.list).toEqual([]);
  });

  it('filters operation list by room, patient name and inpatient number', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const data = await mockData<{ list: Array<{ patientName: string; room: string }>; total: number }>(
      `/operationInfo/getOperationList?operationDate=${today}&operationRoom=OR-01&patientName=周&inpatientNo=zhouming`,
    );

    expect(data.total).toBe(1);
    expect(data.list[0]).toMatchObject({ patientName: '周明', room: 'OR-01' });
  });

  it('keeps nurse schedule date range semantics aligned with operation date', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

    const todayData = await mockData<{ list: unknown[]; total: number }>(
      `/operationInfo/getNursePbList?startTime=${today}&endTime=${today}`,
    );
    const tomorrowData = await mockData<{ list: unknown[]; total: number }>(
      `/operationInfo/getNursePbList?startTime=${tomorrow}&endTime=${tomorrow}`,
    );

    expect(todayData.total).toBeGreaterThan(0);
    expect(tomorrowData.total).toBe(0);
  });

  it('returns stable batch results for anesthesia record child-table saves', async () => {
    const data = await mockData<{ results: Array<{ entityType: string; localId: string; status: string }> }>(
      '/anesthesiaRecord/batchSaveMedications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ localId: 'med-local-1' }] }),
      },
    );

    expect(data.results).toEqual([
      expect.objectContaining({
        entityType: 'medication',
        localId: 'med-local-1',
        status: 'success',
      }),
    ]);
  });

  it('postoperative followup mock CRUD round-trip', async () => {
    const listBefore = await mockData<{ list: unknown[]; total: number }>(
      '/postoperative/followupList?page=1&page_size=200',
    );
    const before = listBefore.total;

    const created = await mockData<{ id: number; caseId: string; followupType: string }>(
      '/postoperative/followupCreate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          caseId: 'case-or99',
          followupType: '术后镇痛随访',
          followTime: '2026-07-05 10:00:00',
          vasScore: '4',
          nausea: '1',
        }).toString(),
      },
    );
    expect(created.id).toBeGreaterThan(0);
    expect(created.followupType).toBe('术后镇痛随访');

    const listAfter = await mockData<{ list: Array<{ id: number }>; total: number }>(
      '/postoperative/followupList?page=1&page_size=200',
    );
    expect(listAfter.total).toBe(before + 1);
    expect(listAfter.list.some((f) => f.id === created.id)).toBe(true);

    const del = await mockData<{ id: number }>('/postoperative/followupDelete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id: String(created.id) }).toString(),
    });
    expect(del.id).toBe(created.id);
  });

  it('postoperative complication mock CRUD round-trip', async () => {
    const created = await mockData<{ id: number; type: string; severity: string }>(
      '/postoperative/complicationCreate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          caseId: 'case-or99',
          complicationType: '低氧血症',
          severity: '重度',
          stage: '恢复期',
          reportTime: '2026-07-05 11:00:00',
          status: '草稿',
        }).toString(),
      },
    );
    expect(created.type).toBe('低氧血症');
    expect(created.severity).toBe('重度');

    const updated = await mockData<{ id: number; status: string }>(
      '/postoperative/complicationUpdate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          id: String(created.id),
          status: '已提交',
        }).toString(),
      },
    );
    expect(updated.status).toBe('已提交');
  });

  it('analgesiaCases / unplannedCases mock aggregation returns postoperativeAnalgesia cases', async () => {
    const analgesia = await mockData<{ list: Array<{ postoperativeAnalgesia: boolean }>; total: number }>(
      '/postoperative/analgesiaCases?page=1&page_size=200',
    );
    expect(analgesia.total).toBeGreaterThan(0);
    expect(analgesia.list.every((c) => c.postoperativeAnalgesia)).toBe(true);

    const unplanned = await mockData<{ list: unknown[]; total: number }>(
      '/postoperative/unplannedCases?page=1&page_size=200',
    );
    expect(unplanned.total).toBeGreaterThanOrEqual(0);
  });
});
