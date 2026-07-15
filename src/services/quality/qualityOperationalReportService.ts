import { qualityApi, type OperationalReportApi } from '@/api/quality';

export async function loadOperationalReport(params: Record<string, string | number | undefined> = {}): Promise<OperationalReportApi> {
  return qualityApi.operationalReport(params);
}

export function operationalReportCsv(report: OperationalReportApi): string {
  const lines = [['operationId', 'patientName', 'department', 'operationName', 'anesthesiaMethod', 'room', 'completed', 'riskLevel', 'defectCount']];
  report.drilldown.forEach((row) => lines.push([
    row.operationId,
    String(row.operationCase.patientName ?? ''),
    String(row.operationCase.departmentName ?? row.operationCase.department ?? ''),
    String(row.operationCase.operationName ?? ''),
    String(row.operationCase.anesthesiaMethod ?? ''),
    String(row.operationCase.roomName ?? row.operationCase.room ?? ''),
    row.completed ? '1' : '0',
    row.riskLevel,
    String(row.defectCount),
  ]));
  return lines.map((row) => row.map((value) => `"${String(value).split('"').join('""')}"`).join(',')).join('\n');
}
