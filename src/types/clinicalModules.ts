export interface ModuleRowItem {
  id: string;
  label: string;
  desc: string;
  link?: string;
}

export type WorkflowMilestoneKey =
  | 'surgeryStart'
  | 'roomIn'
  | 'anesthesiaStart'
  | 'surgeryEnd'
  | 'anesthesiaEnd'
  | 'roomOut'
  | 'orOut'
  | 'pacuIn';

export interface WorkflowChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

export interface ConsentRecord {
  id: string;
  caseId: string;
  patientName: string;
  surgeryName: string;
  anesthesiaMethod: string;
  surgeryDate: string;
  commonRisks: boolean;
  severeRisks: boolean;
  specialRisks: boolean;
  planAccepted: boolean;
  questionAnswered: boolean;
  patientSigned: boolean;
  familySigned: boolean;
  doctorSigned: boolean;
  signedAt?: string;
  status: '草稿' | '已提交';
  updatedAt: string;
  templateCode?: string;
  templateVersion?: string;
  riskDisclosure?: string;
  printStatus?: '未打印' | '已打印';
  archiveStatus?: '未归档' | '已归档';
}

export interface HandoverRecord {
  id: string;
  caseId: string;
  patientName: string;
  handoverType: '常规交班' | '紧急交班' | '临时交班';
  handoverDoctor: string;
  receiveDoctor: string;
  focusPoints: string;
  medications: string;
  vitals: string;
  specialNotes: string;
  pendingItems: string;
  equipmentChecked: boolean;
  drugChecked: boolean;
  signedAt?: string;
  status: '草稿' | '已提交';
}

export interface SummaryRecord {
  id: string;
  caseId: string;
  patientName: string;
  anesthesiaMethod: string;
  intraopNotes: string;
  recoveryNotes: string;
  complications: string;
  effectRating: '优' | '良' | '中' | '差';
  doctorSigned: boolean;
  signedAt?: string;
  status: '草稿' | '已提交';
}

export type PacuBedStatus = '空闲' | '占用' | '预留' | '维护';

export interface PacuBed {
  id: string;
  roomId: string;
  bedNo: string;
  status: PacuBedStatus;
  patientId?: string;
  patientName?: string;
  caseId?: string;
  inTime?: string;
}

export interface PacuRoom {
  id: string;
  name: string;
  code: string;
  bedCount: number;
  beds: PacuBed[];
}

export interface PacuReceiveRecord {
  id: string;
  caseId: string;
  patientName: string;
  bedId: string;
  vitalsChecked: boolean;
  consciousnessChecked: boolean;
  airwayChecked: boolean;
  circulationChecked: boolean;
  tubeChecked: boolean;
  skinChecked: boolean;
  identityChecked: boolean;
  siteChecked: boolean;
  receiveNurse: string;
  receiveTime?: string;
  notes: string;
  status: '待接收' | '已接收';
}

export interface WorkloadStats {
  totalSurgeries: number;
  totalAnesthesia: number;
  emergencyCount: number;
  electiveCount: number;
  completionRate: number;
  trendLabels: string[];
  trendValues: number[];
  typeLabels: string[];
  typeValues: number[];
  methodLabels: string[];
  methodValues: number[];
}

export interface SurgeryRequest {
  id: string;
  operationId?: string;
  patientName: string;
  department: string;
  surgeryName: string;
  urgency: '急诊' | '择期' | null;
  requestDate: string;
  status: '待接收' | '已排班' | '已取消' | null;
  surgeon: string;
  operationStatus?: string | null;
  readOnly?: boolean;
  sourceSystem?: string | null;
}

export interface ConsultationRecord {
  id: string;
  caseId: string;
  patientName: string;
  requestDept: string;
  consultDate: string;
  consultant: string;
  opinion: string;
  status: '待会诊' | '已完成' | '已取消';
  requestContent?: string;
  consultantId?: string;
  submittedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface ExamReviewRecord {
  id: string;
  caseId: string;
  patientName: string;
  labItems: string;
  imagingItems: string;
  reviewResult: '通过' | '待补检' | '异常';
  reviewer: string;
  reviewDate: string;
}

export interface SafetyCheckRecord {
  id: string;
  caseId: string;
  patientName: string;
  signInComplete: boolean;
  timeOutComplete: boolean;
  signOutComplete: boolean;
  checker: string;
  checkDate: string;
  status: '未完成' | '已完成';
}

export interface MonitorDevice {
  id: string;
  name: string;
  room: string;
  type: string;
  status: '在线' | '离线' | '告警';
  lastSync: string;
}

export interface MonitorAlert {
  id: string;
  room: string;
  patientName: string;
  alertType: string;
  severity: '一般' | '严重' | '危急';
  time: string;
  handled: boolean;
}

export interface ComplicationRecord {
  id: string;
  caseId: string;
  patientName: string;
  type: string;
  severity: '轻度' | '中度' | '重度' | '危及生命';
  stage: string;
  symptoms: string;
  treatment: string;
  outcome: string;
  reportTime: string;
  status: '草稿' | '已提交';
}

export interface FavoriteItem {
  id: string;
  name: string;
  category: '常用功能' | '常用患者' | '常用药品' | '常用方案';
  targetPath: string;
  createdAt: string;
}

export interface ScheduleDutySlot {
  id: string;
  date: string;
  shift: '白班' | '夜班' | '备班';
  doctor: string;
  nurse: string;
  anesthesiologist: string;
  phone: string;
}

export interface EmergencyCall {
  id: string;
  type: '麻醉紧急呼叫' | '手术室紧急呼叫' | '复苏室紧急呼叫' | '其他';
  caller: string;
  location: string;
  severity: '一般' | '紧急' | '危急';
  description: string;
  time: string;
  status: '已接收' | '处理中' | '已解决';
}

export interface PacuBooking {
  id: string;
  caseId: string;
  patientName: string;
  pacuRoomId: string;
  bedId?: string;
  bookingTime: string;
  bookingDoctor: string;
  bookingType: '常规预约' | '紧急预约';
  status: '待接收' | '已接收' | '已取消';
}

export interface QualityCheckRecord {
  id: string;
  checkItem: string;
  standard: string;
  result: '合格' | '不合格' | '待查';
  checker: string;
  checkDate: string;
  issueDesc?: string;
  rectifyStatus?: '待整改' | '整改中' | '已闭环';
}

/** 药品管理页「分类库存」Tab 名称；新增分类需同步改 buildDrugInventory 种子数据 */
export const DRUG_INVENTORY_CATEGORIES = [
  '麻醉药品',
  '镇痛药品',
  '肌松药品',
  '镇静药品',
  '其他药品',
] as const;

export type DrugInventoryCategory = (typeof DRUG_INVENTORY_CATEGORIES)[number];

export interface DrugInventoryItem {
  id: string;
  name: string;
  category: DrugInventoryCategory;
  specification: string;
  stock: number;
  unit: string;
  minStock: number;
  price: number;
}
