import type { SurgeryCase } from '@/types/anesthesia';
import type { RecordSummaryFields } from '@/types/anesthesiaRecord';
import { formatAnesthesiaMethodLabel, mergeSelectedMethods, deriveMethodSelectionFromCase } from '@/services/anesthesiaRecordMethodEngine';

export interface RecordPendingField {
  key: string;
  label: string;
  hint?: string;
}

function isBlank(value?: string | null) {
  const text = String(value ?? '').trim();
  return !text || text === '-' || text === '未记录';
}

export function buildRecordPendingFields(
  record: SurgeryCase,
  summary?: Partial<RecordSummaryFields>,
): RecordPendingField[] {
  const pending: RecordPendingField[] = [];
  const methodSelection = deriveMethodSelectionFromCase(record);
  const methodLabel = formatAnesthesiaMethodLabel(
    mergeSelectedMethods(methodSelection.primary, methodSelection.auxiliary),
  );

  if (isBlank(record.position)) pending.push({ key: 'position', label: '手术体位' });
  if (isBlank(methodLabel) || methodLabel === '未选择') pending.push({ key: 'method', label: '麻醉方法' });
  if (isBlank(record.anesthesiologist)) pending.push({ key: 'anesthesiologist', label: '麻醉医师' });
  if (isBlank(record.surgeon)) pending.push({ key: 'surgeon', label: '手术医师' });
  if (isBlank(record.scrubNurses)) pending.push({ key: 'scrubNurses', label: '洗手护士' });
  if (isBlank(record.circulatingNurses)) pending.push({ key: 'circulatingNurses', label: '巡回护士' });
  if (isBlank(record.actualSurgeryName ?? record.surgeryName)) pending.push({ key: 'actualSurgery', label: '实施手术' });
  if (isBlank(summary?.destination ?? record.transferTo)) pending.push({ key: 'destination', label: '术后去向' });
  if (isBlank(summary?.anesthesiaSummary)) pending.push({ key: 'anesthesiaSummary', label: '麻醉小结', hint: '签名前建议填写' });

  return pending;
}
