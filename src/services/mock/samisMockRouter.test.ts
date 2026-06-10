import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { routeSamisMock } from '@/services/mock/samisMockRouter';
import { unwrapSamisResponse, type SamisApiResponse } from '@/api/samisResponse';

async function mockData<T>(path: string, init?: RequestInit) {
  const response = await routeSamisMock<SamisApiResponse<T>>(path, init);
  return unwrapSamisResponse(response);
}

describe('samisMockRouter', () => {
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
});
