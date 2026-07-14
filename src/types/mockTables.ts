export interface AnesthesiaCaseTable {
  caseId: string;
  patientId: string;
  visitId: string;
  hospitalId: string;
  departmentId: string;
  departmentName: string;
  operatingRoomId: string;
  anesthesiaLocation: string;
  locationType: '手术室内' | '手术室外';
  surgeryType: '择期' | '急诊' | '日间' | '产科' | '介入';
  operationName: string;
  diagnosis: string;
  asaLevel: string;
  anesthesiaMethod: string;
  isGeneralAnesthesia: boolean;
  isRegionalAnesthesia: boolean;
  isNeuraxialAnesthesia: boolean;
  isObstetric: boolean;
  isVaginalDelivery: boolean;
  status: string;
  scheduledStartTime: string;
  roomInTime?: string;
  anesthesiaStartTime?: string;
  operationStartTime?: string;
  operationEndTime?: string;
  anesthesiaEndTime?: string;
  roomOutTime?: string;
  pacuInTime?: string;
  pacuOutTime?: string;
  cancelTime?: string;
  cancelStage?: '入室后' | '麻醉开始后' | '入室后麻醉前' | '麻醉开始后手术前';
  cancelReason?: string;
  isTransferIcu: boolean;
  transferIcuPlanned: boolean;
  transferIcuReason?: string;
  isDeleted: boolean;
  isTest: boolean;
  /** 演示场景标签，便于在质控穿透中识别 Mock 样例 */
  qualityDemoTag?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientTable {
  patientId: string;
  name: string;
  gender: '男' | '女' | '';
  age: number;
  birthDate: string;
  inpatientNo: string;
  medicalRecordNo: string;
  bedNo: string;
  departmentName: string;
  height: number;
  weight: number;
  bmi: number;
  allergyHistory: string;
}

export interface AnesthesiaStaffTable {
  staffId: string;
  staffName: string;
  staffType: '麻醉医生' | '麻醉护士' | '复苏护士';
  professionalTitle: string;
  departmentId: string;
  isActive: boolean;
  isCountedForQuality: boolean;
}

export interface CaseStaffTable {
  caseId: string;
  staffId: string;
  role: '主麻' | '副麻' | '麻醉护士' | '复苏护士';
  isPrimary: boolean;
}

export interface PreAnesthesiaVisitTable {
  visitId: string;
  caseId: string;
  visitTime?: string;
  visitDoctorId?: string;
  asaLevel: string;
  airwayAssessment: string;
  fastingStatus: string;
  anesthesiaPlan: string;
  informedConsent: boolean;
  isCompleted: boolean;
  completedTime?: string;
}

export interface VitalSignRecordTable {
  recordId: string;
  caseId: string;
  recordTime: string;
  source: '手工' | '监护仪' | '麻醉机';
  hr?: number;
  sbp?: number;
  dbp?: number;
  map?: number;
  spo2?: number;
  rr?: number;
  etco2?: number;
  temp?: number;
  bis?: number;
  cvp?: number;
  createdBy: string;
}

export interface MachineRecordTable {
  recordId: string;
  caseId: string;
  recordTime: string;
  fio2?: number;
  etco2?: number;
  vt?: number;
  mv?: number;
  rrSet?: number;
  peep?: number;
  ppeak?: number;
  anestheticAgent?: string;
  agentInspired?: number;
  agentExpired?: number;
  freshGasFlow?: number;
  source: '手工' | '麻醉机采集';
}

export interface MedicationTable {
  medicationId: string;
  caseId: string;
  medicationType: '单次用药' | '持续泵入' | '吸入麻醉药';
  drugName: string;
  dose?: number;
  doseUnit?: string;
  concentration?: string;
  infusionRate?: string;
  route?: string;
  startTime?: string;
  adjustTime?: string;
  stopTime?: string;
  totalAmount?: string;
  executorId: string;
  source: '手工' | '输注泵采集';
}

export interface FluidBloodTable {
  recordId: string;
  caseId: string;
  recordType: '晶体液' | '胶体液' | '血制品' | '自体血';
  name: string;
  volume: number;
  unit: string;
  startTime: string;
  endTime?: string;
  bloodType?: string;
  rh?: string;
  adverseReaction?: string;
  executorId: string;
}

export interface AnesthesiaEventTable {
  eventId: string;
  caseId: string;
  eventType: string;
  eventCode: string;
  eventTime: string;
  eventStage: '诱导' | '维持' | '苏醒' | 'PACU' | '术后';
  severity: '轻度' | '中度' | '重度' | '危急';
  description: string;
  treatment: string;
  relatedToAnesthesia: boolean;
  isQualityEvent: boolean;
  reported: boolean;
  reviewStatus: '待审核' | '已确认' | '排除';
  reviewerId?: string;
}

export interface PacuRecordTable {
  pacuId: string;
  caseId: string;
  pacuInTime: string;
  pacuOutTime?: string;
  firstTemp?: number;
  aldreteScoreIn: number;
  aldreteScoreOut?: number;
  vasScore: number;
  nauseaVomiting: boolean;
  shivering: boolean;
  agitation: boolean;
  reintubation: boolean;
  outDestination: '病房' | 'ICU' | '日间病房' | '留观';
  handoverNurseId: string;
}

export interface PostoperativeFollowupTable {
  followupId: string;
  caseId: string;
  followupType: '术后镇痛随访' | '全麻术后随访' | '区域阻滞术后随访';
  followupTime: string;
  vasScore: number;
  nauseaVomiting: boolean;
  headache: boolean;
  hoarseness: boolean;
  hoarsenessDurationHours?: number;
  neuroComplication: boolean;
  neuroDurationHours?: number;
  awareness: boolean;
  respiratoryDepression: boolean;
  reintubation: boolean;
  transferredIcu: boolean;
  newComa: boolean;
  gcsScore?: number;
  death24h: boolean;
  deathTime?: string;
  advice: string;
}

export interface WarmingRecordTable {
  recordId: string;
  caseId: string;
  warmingType: string;
  startTime: string;
  endTime?: string;
}

export interface AirwayRecordTable {
  recordId: string;
  caseId: string;
  airwayType: '气管插管' | '喉罩' | '面罩' | '无';
  intubationTime?: string;
  extubationTime?: string;
  unplanned: boolean;
}

export interface QualityDataset {
  cases: AnesthesiaCaseTable[];
  patients: PatientTable[];
  staff: AnesthesiaStaffTable[];
  caseStaff: CaseStaffTable[];
  preVisits: PreAnesthesiaVisitTable[];
  vitalSigns: VitalSignRecordTable[];
  machineRecords: MachineRecordTable[];
  medications: MedicationTable[];
  fluidBloodRecords: FluidBloodTable[];
  events: AnesthesiaEventTable[];
  pacuRecords: PacuRecordTable[];
  postoperativeFollowups: PostoperativeFollowupTable[];
  warmingRecords: WarmingRecordTable[];
  airwayRecords: AirwayRecordTable[];
}
