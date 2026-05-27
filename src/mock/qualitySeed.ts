import dayjs from 'dayjs';
import { buildDemoCaseStaff, buildDemoCases, demoPatients } from '@/mock/qualitySeedDemoCases';
import type {
  AirwayRecordTable,
  AnesthesiaCaseTable,
  AnesthesiaEventTable,
  AnesthesiaStaffTable,
  CaseStaffTable,
  FluidBloodTable,
  MachineRecordTable,
  MedicationTable,
  PacuRecordTable,
  PatientTable,
  PostoperativeFollowupTable,
  PreAnesthesiaVisitTable,
  VitalSignRecordTable,
  WarmingRecordTable,
} from '@/types/mockTables';

const at = (hour: number, minute = 0) => dayjs().hour(hour).minute(minute).second(0).millisecond(0).toISOString();
const ago = (minutes: number) => dayjs().subtract(minutes, 'minute').second(0).millisecond(0).toISOString();

const corePatients: PatientTable[] = [
  { patientId: 'p-001', name: '周明', gender: '男', age: 46, birthDate: '1979-03-18', inpatientNo: 'I202605001', medicalRecordNo: 'MR001', bedNo: '12A', departmentName: '肝胆外科', height: 172, weight: 73, bmi: 24.7, allergyHistory: '无' },
  { patientId: 'p-002', name: '李桂兰', gender: '女', age: 68, birthDate: '1957-09-22', inpatientNo: 'I202605002', medicalRecordNo: 'MR002', bedNo: '08B', departmentName: '骨科', height: 158, weight: 64, bmi: 25.6, allergyHistory: '青霉素皮疹' },
  { patientId: 'p-003', name: '陈悦', gender: '女', age: 39, birthDate: '1986-06-12', inpatientNo: 'I202605003', medicalRecordNo: 'MR003', bedNo: '21C', departmentName: '妇科', height: 164, weight: 58, bmi: 21.6, allergyHistory: '无' },
  { patientId: 'p-004', name: '何思思', gender: '女', age: 31, birthDate: '1994-11-02', inpatientNo: 'I202605004', medicalRecordNo: 'MR004', bedNo: '05A', departmentName: '产科', height: 166, weight: 76, bmi: 27.6, allergyHistory: '无' },
  { patientId: 'p-005', name: '孙启航', gender: '男', age: 57, birthDate: '1968-01-30', inpatientNo: 'I202605005', medicalRecordNo: 'MR005', bedNo: 'NICU-2', departmentName: '神经外科', height: 176, weight: 80, bmi: 25.8, allergyHistory: '无' },
  { patientId: 'p-006', name: '吴凯', gender: '男', age: 52, birthDate: '1973-05-10', inpatientNo: 'O202605006', medicalRecordNo: 'MR006', bedNo: '内镜候诊', departmentName: '消化内镜中心', height: 170, weight: 82, bmi: 28.4, allergyHistory: '无' },
  { patientId: 'p-007', name: '郑雅', gender: '女', age: 29, birthDate: '1996-04-08', inpatientNo: 'OB202605007', medicalRecordNo: 'MR007', bedNo: '产房3', departmentName: '产科', height: 162, weight: 72, bmi: 27.4, allergyHistory: '无' },
  { patientId: 'p-008', name: '罗敏', gender: '女', age: 27, birthDate: '1998-08-16', inpatientNo: 'OB202605008', medicalRecordNo: 'MR008', bedNo: '产房4', departmentName: '产科', height: 160, weight: 70, bmi: 27.3, allergyHistory: '无' },
];

export const patients: PatientTable[] = [...corePatients, ...demoPatients];

export const anesthesiaStaff: AnesthesiaStaffTable[] = [
  { staffId: 'd-001', staffName: '王睿', staffType: '麻醉医生', professionalTitle: '副主任医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'd-002', staffName: '沈卓', staffType: '麻醉医生', professionalTitle: '主治医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'd-003', staffName: '梁琛', staffType: '麻醉医生', professionalTitle: '主治医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'd-004', staffName: '顾南', staffType: '麻醉医生', professionalTitle: '主治医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'd-005', staffName: '许清', staffType: '麻醉医生', professionalTitle: '主任医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'd-006', staffName: '林琪', staffType: '麻醉医生', professionalTitle: '主治医师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'n-001', staffName: '陈洁', staffType: '麻醉护士', professionalTitle: '主管护师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'n-002', staffName: '马宁', staffType: '麻醉护士', professionalTitle: '护师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'n-003', staffName: '苏冉', staffType: '麻醉护士', professionalTitle: '护师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'n-004', staffName: '罗欣', staffType: '麻醉护士', professionalTitle: '护师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
  { staffId: 'n-005', staffName: '钱悦', staffType: '麻醉护士', professionalTitle: '主管护师', departmentId: 'anes', isActive: true, isCountedForQuality: true },
];

const coreAnesthesiaCases: AnesthesiaCaseTable[] = [
  { caseId: 'case-or01', patientId: 'p-001', qualityDemoTag: '场景·OR-01正常完成', visitId: 'v-001', hospitalId: 'h-001', departmentId: 'dept-hb', departmentName: '肝胆外科', operatingRoomId: 'OR-01', anesthesiaLocation: '中心手术室', locationType: '手术室内', surgeryType: '择期', operationName: '腹腔镜胆囊切除术', diagnosis: '胆囊结石伴慢性胆囊炎', asaLevel: 'II', anesthesiaMethod: '全身麻醉', isGeneralAnesthesia: true, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: false, isVaginalDelivery: false, status: '已离室', scheduledStartTime: at(8, 20), roomInTime: at(8, 20), anesthesiaStartTime: at(8, 25), operationStartTime: at(8, 48), operationEndTime: at(9, 46), anesthesiaEndTime: at(9, 58), roomOutTime: at(10, 5), pacuInTime: ago(145), pacuOutTime: ago(5), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(7, 40), updatedAt: at(10, 8) },
  { caseId: 'case-or02', patientId: 'p-002', qualityDemoTag: '场景·OR-02全麻无体温', visitId: 'v-002', hospitalId: 'h-001', departmentId: 'dept-orth', departmentName: '骨科', operatingRoomId: 'OR-02', anesthesiaLocation: '中心手术室', locationType: '手术室内', surgeryType: '择期', operationName: '全髋关节置换术', diagnosis: '左股骨头坏死', asaLevel: 'III', anesthesiaMethod: '全身麻醉', isGeneralAnesthesia: true, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: false, isVaginalDelivery: false, status: '手术中', scheduledStartTime: at(8, 40), roomInTime: at(8, 40), anesthesiaStartTime: at(8, 45), operationStartTime: at(9, 10), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(8, 0), updatedAt: at(11, 5) },
  { caseId: 'case-or03', patientId: 'p-003', qualityDemoTag: '场景·OR-03PACU低体温', visitId: 'v-003', hospitalId: 'h-001', departmentId: 'dept-gyn', departmentName: '妇科', operatingRoomId: 'OR-03', anesthesiaLocation: '中心手术室', locationType: '手术室内', surgeryType: '择期', operationName: '腹腔镜子宫肌瘤剔除术', diagnosis: '子宫肌瘤', asaLevel: 'II', anesthesiaMethod: '全身麻醉', isGeneralAnesthesia: true, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: false, isVaginalDelivery: false, status: 'PACU', scheduledStartTime: at(9, 0), roomInTime: at(9, 0), anesthesiaStartTime: at(9, 5), operationStartTime: at(9, 28), operationEndTime: at(11, 15), anesthesiaEndTime: at(11, 22), roomOutTime: at(11, 30), pacuInTime: ago(45), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(8, 20), updatedAt: at(11, 35) },
  { caseId: 'case-or04', patientId: 'p-004', qualityDemoTag: '场景·OR-04椎管内产科', visitId: 'v-004', hospitalId: 'h-001', departmentId: 'dept-ob', departmentName: '产科', operatingRoomId: 'OR-04', anesthesiaLocation: '中心手术室', locationType: '手术室内', surgeryType: '产科', operationName: '剖宫产术', diagnosis: '瘢痕子宫妊娠39周', asaLevel: 'II', anesthesiaMethod: '椎管内麻醉', isGeneralAnesthesia: false, isRegionalAnesthesia: true, isNeuraxialAnesthesia: true, isObstetric: true, isVaginalDelivery: false, status: '苏醒中', scheduledStartTime: at(10, 0), roomInTime: at(10, 0), anesthesiaStartTime: at(10, 5), operationStartTime: at(10, 20), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(9, 30), updatedAt: at(10, 55) },
  { caseId: 'case-or05', patientId: 'p-005', qualityDemoTag: '场景·OR-05非计划转ICU', visitId: 'v-005', hospitalId: 'h-001', departmentId: 'dept-ns', departmentName: '神经外科', operatingRoomId: 'OR-05', anesthesiaLocation: '中心手术室', locationType: '手术室内', surgeryType: '急诊', operationName: '颅内占位切除术', diagnosis: '右额叶占位', asaLevel: 'III', anesthesiaMethod: '全身麻醉', isGeneralAnesthesia: true, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: false, isVaginalDelivery: false, status: '麻醉中', scheduledStartTime: at(11, 0), roomInTime: at(11, 0), anesthesiaStartTime: at(11, 5), operationStartTime: at(11, 35), isTransferIcu: true, transferIcuPlanned: false, transferIcuReason: '术中脑水肿及循环不稳定', isDeleted: false, isTest: false, createdAt: at(10, 20), updatedAt: at(12, 40) },
  { caseId: 'case-or06', patientId: 'p-006', qualityDemoTag: '场景·OR-06麻醉后取消', visitId: 'v-006', hospitalId: 'h-001', departmentId: 'dept-end', departmentName: '消化内镜中心', operatingRoomId: 'OR-06', anesthesiaLocation: '内镜中心', locationType: '手术室外', surgeryType: '择期', operationName: '无痛胃肠镜', diagnosis: '结肠息肉筛查', asaLevel: 'II', anesthesiaMethod: '静脉全身麻醉', isGeneralAnesthesia: true, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: false, isVaginalDelivery: false, status: '已取消', scheduledStartTime: at(13, 30), roomInTime: at(13, 30), anesthesiaStartTime: at(13, 35), cancelTime: at(13, 42), cancelStage: '麻醉开始后手术前', cancelReason: '禁食不足', isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(12, 50), updatedAt: at(13, 45) },
  { caseId: 'case-ob01', patientId: 'p-007', qualityDemoTag: '场景·阴道分娩镇痛', visitId: 'v-007', hospitalId: 'h-001', departmentId: 'dept-ob', departmentName: '产科', operatingRoomId: '产房', anesthesiaLocation: '产房', locationType: '手术室外', surgeryType: '产科', operationName: '阴道分娩镇痛', diagnosis: '足月妊娠', asaLevel: 'II', anesthesiaMethod: '椎管内麻醉', isGeneralAnesthesia: false, isRegionalAnesthesia: true, isNeuraxialAnesthesia: true, isObstetric: true, isVaginalDelivery: true, status: '已离室', scheduledStartTime: at(6, 0), roomInTime: at(6, 10), anesthesiaStartTime: at(6, 20), anesthesiaEndTime: at(11, 0), roomOutTime: at(11, 20), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(5, 40), updatedAt: at(11, 20) },
  { caseId: 'case-ob02', patientId: 'p-008', qualityDemoTag: '场景·未实施麻醉', visitId: 'v-008', hospitalId: 'h-001', departmentId: 'dept-ob', departmentName: '产科', operatingRoomId: '产房', anesthesiaLocation: '产房', locationType: '手术室外', surgeryType: '产科', operationName: '阴道分娩', diagnosis: '足月妊娠', asaLevel: 'I', anesthesiaMethod: '未实施麻醉', isGeneralAnesthesia: false, isRegionalAnesthesia: false, isNeuraxialAnesthesia: false, isObstetric: true, isVaginalDelivery: true, status: '已离室', scheduledStartTime: at(7, 0), roomInTime: at(7, 10), roomOutTime: at(13, 10), isTransferIcu: false, transferIcuPlanned: false, isDeleted: false, isTest: false, createdAt: at(6, 30), updatedAt: at(13, 10) },
];

export const anesthesiaCases: AnesthesiaCaseTable[] = [...coreAnesthesiaCases, ...buildDemoCases()];

const coreCaseStaff = [
  ['case-or01', 'd-001', '主麻'], ['case-or01', 'n-001', '麻醉护士'],
  ['case-or02', 'd-002', '主麻'], ['case-or02', 'n-002', '麻醉护士'],
  ['case-or03', 'd-003', '主麻'], ['case-or03', 'n-003', '麻醉护士'],
  ['case-or04', 'd-004', '主麻'], ['case-or04', 'n-004', '麻醉护士'],
  ['case-or05', 'd-005', '主麻'], ['case-or05', 'n-005', '麻醉护士'],
  ['case-or06', 'd-006', '主麻'], ['case-or06', 'n-001', '麻醉护士'],
].map(([caseId, staffId, role]) => ({ caseId, staffId, role: role as CaseStaffTable['role'], isPrimary: role === '主麻' }));

export const caseStaff: CaseStaffTable[] = [...coreCaseStaff, ...buildDemoCaseStaff()];

export const preAnesthesiaVisits: PreAnesthesiaVisitTable[] = anesthesiaCases.map((item) => ({
  visitId: `pre-${item.caseId}`,
  caseId: item.caseId,
  visitTime: item.caseId === 'case-or06' ? undefined : at(7, 30),
  visitDoctorId: caseStaff.find((staff) => staff.caseId === item.caseId && staff.role === '主麻')?.staffId,
  asaLevel: item.asaLevel,
  airwayAssessment: item.caseId === 'case-or02' ? 'Mallampati III级' : 'Mallampati II级',
  fastingStatus: item.caseId === 'case-or06' ? '禁食不足' : '禁食禁饮符合要求',
  anesthesiaPlan: item.anesthesiaMethod,
  informedConsent: item.caseId !== 'case-or06',
  isCompleted: item.caseId !== 'case-or06',
  completedTime: item.caseId === 'case-or06' ? undefined : at(7, 45),
}));

export const vitalSignRecords: VitalSignRecordTable[] = [
  ['case-or01', 8, 25, 78, 132, 78, 99, 36, 36.4], ['case-or01', 8, 35, 72, 118, 68, 100, 35, 36.3],
  ['case-or03', 9, 5, 82, 128, 74, 100, 35, 36.2], ['case-or03', 10, 35, 84, 112, 62, 99, 34, 35.6],
  ['case-or04', 10, 5, 92, 126, 76, 99, undefined, 36.5],
  ['case-or05', 11, 5, 88, 152, 88, 99, 34, 36.5], ['case-or05', 11, 55, 92, 128, 72, 98, 36, 36.3],
  ['case-or06', 13, 35, 82, 138, 80, 98, 37, 36.6],
  ['case-or02', 8, 45, 86, 146, 82, 99, 35, undefined], ['case-or02', 10, 20, 88, 112, 64, 99, 34, undefined],
].map(([caseId, hour, minute, hr, sbp, dbp, spo2, etco2, temp], index) => ({
  recordId: `vs-${index + 1}`,
  caseId: String(caseId),
  recordTime: at(Number(hour), Number(minute)),
  source: '监护仪',
  hr: hr as number,
  sbp: sbp as number,
  dbp: dbp as number,
  spo2: spo2 as number,
  etco2: etco2 as number | undefined,
  temp: temp as number | undefined,
  createdBy: 'system',
}));

export const anesthesiaMachineRecords: MachineRecordTable[] = vitalSignRecords
  .filter((item) => item.etco2)
  .map((item, index) => ({ recordId: `am-${index + 1}`, caseId: item.caseId, recordTime: item.recordTime, fio2: 50, etco2: item.etco2, vt: 450, mv: 6.2, rrSet: 12, peep: 5, ppeak: 18, anestheticAgent: '七氟烷', agentInspired: 1.8, agentExpired: 1.5, freshGasFlow: 2, source: '麻醉机采集' }));

export const anesthesiaMedications: MedicationTable[] = [
  { medicationId: 'med-001', caseId: 'case-or01', medicationType: '单次用药', drugName: '丙泊酚', dose: 120, doseUnit: 'mg', route: '静脉', startTime: at(8, 28), executorId: 'n-001', source: '手工' },
  { medicationId: 'med-002', caseId: 'case-or02', medicationType: '持续泵入', drugName: '瑞芬太尼', concentration: '2mg/50ml', infusionRate: '8ml/h', startTime: at(8, 55), adjustTime: at(10, 10), totalAmount: '18ml', executorId: 'n-002', source: '输注泵采集' },
  { medicationId: 'med-003', caseId: 'case-or03', medicationType: '持续泵入', drugName: '丙泊酚', concentration: '500mg/50ml', infusionRate: '18ml/h', startTime: at(9, 8), stopTime: at(11, 8), totalAmount: '36ml', executorId: 'n-003', source: '输注泵采集' },
  { medicationId: 'med-004', caseId: 'case-or06', medicationType: '单次用药', drugName: '丙泊酚', dose: 40, doseUnit: 'mg', route: '静脉', startTime: at(13, 36), executorId: 'n-001', source: '手工' },
];

export const fluidBloodRecords: FluidBloodTable[] = [
  { recordId: 'fb-001', caseId: 'case-or01', recordType: '晶体液', name: '乳酸钠林格液', volume: 800, unit: 'ml', startTime: at(8, 25), endTime: at(9, 55), executorId: 'n-001' },
  { recordId: 'fb-002', caseId: 'case-or02', recordType: '血制品', name: '悬浮红细胞', volume: 300, unit: 'ml', startTime: at(10, 25), bloodType: 'A', rh: '+', adverseReaction: '无', executorId: 'n-002' },
  { recordId: 'fb-003', caseId: 'case-or05', recordType: '自体血', name: '自体血回输', volume: 350, unit: 'ml', startTime: at(12, 20), bloodType: 'O', rh: '+', adverseReaction: '无', executorId: 'n-005' },
];

export const anesthesiaEvents: AnesthesiaEventTable[] = [
  { eventId: 'ev-001', caseId: 'case-or01', eventType: '插管', eventCode: 'INT', eventTime: at(8, 34), eventStage: '诱导', severity: '轻度', description: '可视喉镜一次成功', treatment: '气管插管成功', relatedToAnesthesia: true, isQualityEvent: false, reported: false, reviewStatus: '已确认' },
  { eventId: 'ev-002', caseId: 'case-or01', eventType: '拔管', eventCode: 'EXT', eventTime: at(9, 56), eventStage: '苏醒', severity: '轻度', description: '自主呼吸恢复', treatment: '拔管顺利', relatedToAnesthesia: true, isQualityEvent: false, reported: false, reviewStatus: '已确认' },
  { eventId: 'ev-003', caseId: 'case-or02', eventType: '插管', eventCode: 'INT', eventTime: at(8, 57), eventStage: '诱导', severity: '轻度', description: '气管插管顺利', treatment: '气管插管成功', relatedToAnesthesia: true, isQualityEvent: false, reported: false, reviewStatus: '已确认' },
  { eventId: 'ev-004', caseId: 'case-or03', eventType: '低体温', eventCode: 'LOW_TEMP', eventTime: at(10, 35), eventStage: '维持', severity: '中度', description: '术中体温35.6℃', treatment: '升高暖风毯温度，预热输液', relatedToAnesthesia: true, isQualityEvent: true, reported: true, reviewStatus: '已确认' },
  { eventId: 'ev-005', caseId: 'case-or05', eventType: '非计划转ICU', eventCode: 'UICU', eventTime: at(12, 40), eventStage: '维持', severity: '重度', description: '术中循环不稳定，拟转ICU', treatment: '', relatedToAnesthesia: true, isQualityEvent: true, reported: true, reviewStatus: '待审核' },
  { eventId: 'ev-006', caseId: 'case-or05', eventType: '抢救', eventCode: 'RESCUE', eventTime: at(12, 35), eventStage: '维持', severity: '危急', description: '启动抢救流程', treatment: '', relatedToAnesthesia: true, isQualityEvent: true, reported: true, reviewStatus: '待审核' },
  { eventId: 'ev-007', caseId: 'case-or06', eventType: '麻醉开始后手术取消', eventCode: 'CANCEL_AFTER_ANES', eventTime: at(13, 42), eventStage: '诱导', severity: '中度', description: '禁食不足，取消检查', treatment: '停止给药并观察', relatedToAnesthesia: true, isQualityEvent: true, reported: false, reviewStatus: '已确认' },
];

export const pacuRecords: PacuRecordTable[] = [
  { pacuId: 'pacu-001', caseId: 'case-or03', pacuInTime: ago(45), firstTemp: 35.7, aldreteScoreIn: 8, vasScore: 4, nauseaVomiting: false, shivering: true, agitation: false, reintubation: false, outDestination: '病房', handoverNurseId: 'n-003' },
  { pacuId: 'pacu-002', caseId: 'case-or01', pacuInTime: ago(145), pacuOutTime: ago(5), firstTemp: 36.1, aldreteScoreIn: 9, aldreteScoreOut: 10, vasScore: 2, nauseaVomiting: false, shivering: false, agitation: false, reintubation: false, outDestination: '病房', handoverNurseId: 'n-001' },
  { pacuId: 'pacu-003', caseId: 'case-or02', pacuInTime: ago(30), aldreteScoreIn: 7, vasScore: 5, nauseaVomiting: true, shivering: false, agitation: true, reintubation: false, outDestination: '病房', handoverNurseId: 'n-002' },
];

export const postoperativeFollowups: PostoperativeFollowupTable[] = [
  { followupId: 'fu-001', caseId: 'case-or03', followupType: '术后镇痛随访', followupTime: at(18, 0), vasScore: 2, nauseaVomiting: false, headache: false, hoarseness: false, neuroComplication: false, awareness: false, respiratoryDepression: false, reintubation: false, transferredIcu: false, newComa: false, death24h: false, advice: '继续当前镇痛方案。' },
  { followupId: 'fu-002', caseId: 'case-or04', followupType: '术后镇痛随访', followupTime: at(18, 20), vasScore: 5, nauseaVomiting: true, headache: false, hoarseness: false, neuroComplication: false, awareness: false, respiratoryDepression: false, reintubation: false, transferredIcu: false, newComa: false, death24h: false, advice: '追加镇痛评估。' },
  { followupId: 'fu-003', caseId: 'case-or05', followupType: '全麻术后随访', followupTime: at(19, 0), vasScore: 0, nauseaVomiting: false, headache: false, hoarseness: true, hoarsenessDurationHours: 12, neuroComplication: false, awareness: false, respiratoryDepression: false, reintubation: false, transferredIcu: true, newComa: false, death24h: false, advice: 'ICU继续观察。' },
];

export const warmingRecords: WarmingRecordTable[] = [
  { recordId: 'wr-001', caseId: 'case-or01', warmingType: '暖风毯', startTime: at(8, 30), endTime: at(9, 50) },
  { recordId: 'wr-002', caseId: 'case-or03', warmingType: '暖风毯', startTime: at(9, 20), endTime: at(11, 20) },
  { recordId: 'wr-003', caseId: 'case-or05', warmingType: '输液加温', startTime: at(11, 20) },
];

export const airwayRecords: AirwayRecordTable[] = [
  { recordId: 'air-001', caseId: 'case-or01', airwayType: '气管插管', intubationTime: at(8, 34), extubationTime: at(9, 56), unplanned: false },
  { recordId: 'air-002', caseId: 'case-or02', airwayType: '气管插管', intubationTime: at(8, 57), unplanned: false },
  { recordId: 'air-003', caseId: 'case-or03', airwayType: '气管插管', intubationTime: at(9, 12), extubationTime: at(11, 20), unplanned: false },
  { recordId: 'air-004', caseId: 'case-or05', airwayType: '气管插管', intubationTime: at(11, 18), unplanned: false },
  { recordId: 'air-005', caseId: 'case-or06', airwayType: '面罩', unplanned: false },
];
