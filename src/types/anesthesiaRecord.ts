export type AnesthesiaRecordType = 'intraoperative' | 'pacu' | 'emergency' | 'day_surgery' | 'icu_transfer';

export type TimeAxisMinorInterval = 1 | 3 | 5 | 10 | 15;

export interface AnesthesiaRecordSnapshot {
  capturedAt: string;
  hospitalName: string;
  recordNo: string;
  patientName: string;
  gender: string;
  age: number;
  height?: number;
  weight?: number;
  department: string;
  ward?: string;
  bedNo?: string;
  inpatientNo?: string;
  paymentMethod?: string;
  bloodType?: string;
  asa: string;
  diagnosisPreop: string;
  diagnosisPostop?: string;
  surgeryPlanned: string;
  surgeryActual?: string;
  anesthesiaMethod: string;
  surgicalPosition?: string;
  room: string;
  surgeonName: string;
  anesthesiologistName: string;
  nurseName: string;
  circulatingNurseNames?: string;
  scrubNurseNames?: string;
  surgeryDate: string;
  preMedication?: string;
  fasting?: string;
}

export interface TimeAxisPageConfig {
  pageNo: number;
  pageCount: number;
  pageStartTime: string;
  pageEndTime: string;
  majorGridMinutes: number;
  minorGridMinutes: TimeAxisMinorInterval;
  pageDurationMinutes: number;
}

export interface AnesthesiaRecordDocument {
  recordNo: string;
  recordType: AnesthesiaRecordType;
  pageCount: number;
  timeAxisPages: TimeAxisPageConfig[];
  hospitalName: string;
  paymentMethod?: string;
  minorInterval: TimeAxisMinorInterval;
  majorInterval: number;
  printedAt?: string;
  lockedAt?: string;
  printVersion?: number;
}

export interface LabResultItem {
  code: string;
  name: string;
  value: string;
  unit: string;
  normalRange?: string;
  abnormal?: boolean;
}

export interface LabResultRecord {
  id: string;
  resultTime: string;
  labType: string;
  items: LabResultItem[];
  displayMode: 'full' | 'brief' | 'number';
  displayNumber?: number;
  source: 'manual' | 'device' | 'import';
  status: 'active' | 'voided';
  remark?: string;
}

export interface TransfusionEventRecord {
  id: string;
  bloodProduct: string;
  amount: number;
  amountUnit: string;
  volume?: number;
  volumeUnit?: string;
  channelType?: string;
  startTime: string;
  endTime?: string;
  reactionFlag?: boolean;
  reactionDescription?: string;
  rowIndex?: number;
  status: 'active' | 'voided';
}

export interface IoRecordEntry {
  id: string;
  recordTime: string;
  ioDirection: 'input' | 'output';
  ioType: string;
  name: string;
  volume: number;
  unit: string;
  isCountTotal: boolean;
  remark?: string;
  status: 'active' | 'voided';
}

export interface RecordSummaryNotes {
  inductionMeds?: string;
  inductionSummary?: string;
  specialMeds?: string;
  keyOperations?: string;
  postopAnalgesia?: string;
}

export interface RecordSummaryFields {
  crystalTotal?: number;
  colloidTotal?: number;
  bloodTotal?: number;
  urineTotal?: number;
  bloodLossTotal?: number;
  drainageTotal?: number;
  inputTotal?: number;
  outputTotal?: number;
  anesthesiaEffect?: '优' | '良' | '差';
  analgesiaMethod?: string;
  extubationTime?: string;
  recoveryTime?: string;
  destination?: string;
  handoverNote?: string;
  completedAt?: string;
  notes?: RecordSummaryNotes;
  manualOverrides?: Record<string, { value: string; reason: string; at: string; operator: string }>;
}

export interface LayoutObject {
  id: string;
  type: 'vital' | 'lab' | 'medication' | 'fluid' | 'transfusion' | 'event' | 'io' | 'special';
  time: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
  allowOffset: boolean;
  maxOffsetY: number;
  displayMode: 'text' | 'number' | 'symbol';
}

export interface LayoutWarning {
  id: string;
  type: string;
  message: string;
  time?: string;
  severity: 'info' | 'warning' | 'error';
  objectIds?: string[];
}

export interface RecordPrintCheck {
  item: string;
  status: '通过' | '警告' | '未通过';
  message: string;
}
