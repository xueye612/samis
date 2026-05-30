export type RecordRecentKind = 'event' | 'timeline' | 'medication' | 'fluid' | 'vital' | 'landing';

export type RecordRecentTarget = 'anesthesia' | 'medication' | 'vitals' | 'infusions' | 'timeline' | 'sheet-event';

export interface RecordRecentEntry {
  id: string;
  kind: RecordRecentKind;
  label: string;
  time: string;
  target: RecordRecentTarget;
  refId?: string;
}
