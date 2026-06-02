import type { SpecialDrugCategory } from '@/types/drugDict';

export type CaseStatus =
  | '待入室'
  | '已入室'
  | '麻醉诱导'
  | '麻醉中'
  | '手术中'
  | '苏醒中'
  | 'PACU'
  | '已离室'
  | '已取消';

export type Severity = '轻度' | '中度' | '重度' | '危急';
export type EventStage = '术前' | '入室后' | '诱导期' | '术中' | '苏醒期' | 'PACU' | '术后';
export type IndicatorGroup = '结构' | '过程' | '结果' | 'PACU' | '术后' | '产科';

export interface VitalSign {
  id?: string;
  time: string;
  HR?: number;
  SBP?: number;
  DBP?: number;
  MAP?: number;
  SpO2?: number;
  RR?: number;
  EtCO2?: number;
  TEMP?: number;
  BIS?: number;
  CVP?: number;
  source?: '手工录入' | '设备采集' | '设备采集占位' | '接口导入' | '手工修正';
  displayValue?: Record<string, number | string>;
  correctedValue?: Record<string, number | string>;
  originalValue?: Record<string, number | string>;
  remark?: string;
  rescue?: boolean;
  abnormalHandled?: Record<string, string>;
  monitorExtras?: Record<string, string | number>;
  status?: 'active' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface AnesthesiaEvent {
  id: string;
  type: string;
  time: string;
  stage: EventStage;
  severity: Severity;
  treatment: string;
  staff: string[];
  reported: boolean;
  qualityIncluded: boolean;
  status?: 'active' | 'voided';
  voidReason?: string;
}

export interface AnesthesiaPlaneRecord {
  id: string;
  time: string;
  level: string;
  direction: 'up' | 'down' | 'fixed';
  remark?: string;
  status?: 'active' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface RescueRecord {
  startTime: string;
  endTime?: string;
  measures: string;
  medications: string;
  participants: string[];
  supplementReminder: boolean;
  course?: string;
  result?: string;
}

export interface MedicationRecord {
  id: string;
  drugId?: string;
  mode: '单次用药' | '持续泵入' | '间断追加';
  time?: string;
  /** 单次/间断给药事件时间（与 time 等价，便于与后端 event_time 对齐） */
  eventTime?: string;
  endTime?: string;
  drug: string;
  name?: string;
  dose?: number;
  unit?: string;
  route?: string;
  executor: string;
  concentration?: string;
  pumpRate?: string;
  startTime?: string;
  adjustTime?: string;
  stopTime?: string;
  pauseTime?: string;
  resumeTime?: string;
  totalAmount?: string;
  checker?: string;
  highAlert?: boolean;
  /** 是否进入特殊用药说明区（与是否画线无关）；以医生最终勾选为准 */
  isSpecial?: boolean;
  /** 特殊用药区编号，存 1/2/3 或圈号，展示时转圈号 */
  specialNo?: number;
  specialCategory?: SpecialDrugCategory;
  /** 辅助及特殊用药区说明文案 */
  specialReason?: string;
  displayText?: string;
  reason?: string;
  rate?: string;
  rateUnit?: string;
  drugCategory?: string;
  rowIndex?: number;
  status?: 'active' | 'paused' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface FluidRecord {
  id: string;
  category: '晶体液' | '胶体液' | '血液制品' | '自体血回输';
  name: string;
  product?: string;
  startTime: string;
  time?: string;
  endTime?: string;
  volume: number;
  unit?: string;
  bloodType?: string;
  rh?: string;
  reaction?: string;
  executor: string;
  bagNo?: string;
  anesthesiaConfirm?: string;
  circulatingConfirm?: string;
  doubleCheck?: boolean;
  status?: 'active' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface OutputRecord {
  urine: number;
  bloodLoss: number;
  drainage: number;
}

export interface OutputDetailRecord {
  id: string;
  time: string;
  type: '尿量' | '出血量' | '引流量' | '其他';
  volume: number;
  remark?: string;
  status?: 'active' | 'voided';
  voidReason?: string;
  voidedAt?: string;
}

export interface PreVisit {
  completed: boolean;
  height: number;
  weight: number;
  asa: string;
  allergy: string;
  anesthesiaHistory: string;
  difficultAirway: string;
  fasting: string;
  preMedication: string;
  specialCondition: string;
  plan: string;
  doctorSignature: string;
}

export interface SurgeryCase {
  id: string;
  patientId?: string;
  room: string;
  roomId?: string;
  roomName?: string;
  sequence: number;
  patientName: string;
  gender: '男' | '女';
  age: number;
  department: string;
  diagnosis: string;
  surgeryName: string;
  surgeon: string;
  anesthesiaMethod: string;
  asa: string;
  urgency: '急诊' | '择期';
  anesthesiologist: string;
  anesthesiaNurse: string;
  circulatingNurses?: string;
  scrubNurses?: string;
  status: CaseStatus;
  locationType: '手术室内' | '手术室外';
  plannedStart: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  anesthesiaStart?: string;
  surgeryStart?: string;
  surgeryEnd?: string;
  leaveRoomTime?: string;
  transferTo?: 'PACU' | 'ICU' | '病房' | '门诊';
  expectedDurationMinutes: number;
  assignedAnesthesiologistIds?: string[];
  assignedNurseIds?: string[];
  nursingScheduleSource?: string;
  emergencyInserted?: boolean;
  recordStatus?: '未开始' | '采集中' | '补记中' | '已完成' | '已锁定';
  collectStatus?: '未连接' | '采集中' | '手工录入' | '采集暂停';
  vitalFrequency?: '5分钟' | '10分钟' | '抢救1分钟';
  operationLogs?: string[];
  locked: boolean;
  activeWarming: boolean;
  autologousBlood: boolean;
  postoperativeAnalgesia: boolean;
  preVisit: PreVisit;
  vitals: VitalSign[];
  events: AnesthesiaEvent[];
  anesthesiaPlanes?: AnesthesiaPlaneRecord[];
  rescue?: RescueRecord;
  medications: MedicationRecord[];
  fluids: FluidRecord[];
  outputs: OutputRecord;
  outputRecords?: OutputDetailRecord[];
  device?: AnesthesiaRecordDeviceState;
  signatures?: AnesthesiaRecordSignatureState;
  modificationLogs?: AnesthesiaRecordModificationLog[];
  recordDraft?: AnesthesiaRecordDraft;
  airwayRecord?: AirwayRecord;
  recoveryRecord?: RecoveryRecord;
  professionalFieldValues?: Record<string, string>;
  anesthesiaEnd?: string;
  roomInTime?: string;
  position?: string;
  transferIcuPlanned?: boolean;
  cancelStage?: string;
  cancelReason?: string;
  isVaginalDelivery?: boolean;
  actualSurgeryName?: string;
  paymentMethod?: string;
  height?: number;
  recordDocument?: import('@/types/anesthesiaRecord').AnesthesiaRecordDocument;
  recordSnapshot?: import('@/types/anesthesiaRecord').AnesthesiaRecordSnapshot;
  labResults?: import('@/types/anesthesiaRecord').LabResultRecord[];
  transfusionEvents?: import('@/types/anesthesiaRecord').TransfusionEventRecord[];
  ioRecords?: import('@/types/anesthesiaRecord').IoRecordEntry[];
  recordSummary?: import('@/types/anesthesiaRecord').RecordSummaryFields;
  layoutWarnings?: import('@/types/anesthesiaRecord').LayoutWarning[];
  printedAt?: string;
}

export interface AnesthesiaRecordDeviceState {
  monitor: string;
  anesthesiaMachine: string;
  infusionPump: string;
  collectStatus: '未连接' | '待启动' | '采集中' | '采集暂停' | '采集异常' | '已结束';
  dataSource: string;
  lastCollectTime?: string;
  collectFrequency?: string;
  receiveStatus?: string;
  abnormalNote?: string;
  logs: Array<{ time: string; content: string }>;
}

export interface AnesthesiaRecordSignatureState {
  anesthesiologist?: string;
  surgeon?: string;
  nurse?: string;
  reviewer?: string;
  signedAt?: string;
  status: '未签名' | '待签名' | '已签名' | '修改中';
}

export interface AnesthesiaRecordModificationLog {
  id: string;
  time: string;
  operator: string;
  field: string;
  label: string;
  before: string;
  after: string;
  reason: string;
  status: '录入修改' | '已记录';
}

export interface AnesthesiaRecordDraft {
  selectedTab: string;
  lastSavedAt: string;
}

export interface AirwayRecord {
  airwayMethod?: string;
  intubationTime?: string;
  intubationMethod?: string;
  intubationAttempts?: number;
  tubeModel?: string;
  tubeDepth?: string;
  fixationPosition?: string;
  cormack?: string;
  difficultAirway?: boolean;
  difficultMeasure?: string;
  extubationTime?: string;
  extubationStatus?: string;
  postExtubationSpo2?: number;
  airwayNote?: string;
}

export interface RecoveryRecord {
  leaveTime?: string;
  destination?: 'PACU' | 'ICU' | '病房' | '门诊' | '其他';
  consciousness?: string;
  respiration?: string;
  circulation?: string;
  painScore?: number;
  aldrete?: number;
  tubes?: string;
  skin?: string;
  handoverNurse?: string;
  receiver?: string;
  handoverNote?: string;
  pacuInTime?: string;
  pacuOutTime?: string;
  conclusion?: string;
}

export interface PacuPatient {
  id: string;
  caseId: string;
  patientName: string;
  room: string;
  inTime: string;
  outTime?: string;
  firstTemperature?: number;
  HR: number;
  BP: string;
  SpO2: number;
  RR: number;
  aldrete: number;
  vas: number;
  nausea: boolean;
  shivering: boolean;
  agitation: boolean;
  reintubation: boolean;
  status: '观察中' | '待转出' | '已转出';
  transferTo: '病房' | 'ICU' | '日间病房' | '留观';
  handover: string;
}

export interface PostoperativeFollowUp {
  id: string;
  caseId: string;
  type: '术后镇痛随访' | '全麻术后随访' | '区域阻滞术后随访';
  followTime: string;
  vas: number;
  nausea: boolean;
  headache: boolean;
  hoarseness: boolean;
  numbness: boolean;
  motorDisorder: boolean;
  awareness: boolean;
  respiratoryDepression: boolean;
  reintubation: boolean;
  transferredIcu: boolean;
  death: boolean;
  advice: string;
  newComa?: boolean;
  neuroDurationHours?: number;
  hoarsenessDurationHours?: number;
}

export interface QualityIndicatorDefinition {
  code: string;
  group: IndicatorGroup;
  name: string;
  numerator: string;
  denominator: string;
  target: string;
}

export interface QualityIndicatorResult extends QualityIndicatorDefinition {
  currentValue: string;
  trend: number[];
  abnormalCases: string[];
}

export interface QualityDefect {
  id: string;
  caseId: string;
  patientName: string;
  name: string;
  severity: '一般' | '重要' | '严重';
  source: string;
  suggestion: string;
}
