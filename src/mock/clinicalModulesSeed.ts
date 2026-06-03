import dayjs from 'dayjs';
import type {
  ComplicationRecord,
  ConsentRecord,
  ConsultationRecord,
  DrugInventoryItem,
  EmergencyCall,
  ExamReviewRecord,
  FavoriteItem,
  HandoverRecord,
  MonitorAlert,
  MonitorDevice,
  PacuBooking,
  PacuReceiveRecord,
  PacuRoom,
  QualityCheckRecord,
  SafetyCheckRecord,
  ScheduleDutySlot,
  SummaryRecord,
  SurgeryRequest,
  WorkloadStats,
} from '@/types/clinicalModules';
import type { SurgeryCase } from '@/types/anesthesia';

const now = dayjs();

export function buildPacuRooms(cases: SurgeryCase[]): PacuRoom[] {
  const rooms: PacuRoom[] = [
    { id: 'pacu-a', name: '复苏室A', code: 'PACU-A', bedCount: 6, beds: [] },
    { id: 'pacu-b', name: '复苏室B', code: 'PACU-B', bedCount: 4, beds: [] },
    { id: 'pacu-c', name: '复苏室C', code: 'PACU-C', bedCount: 4, beds: [] },
  ];
  rooms.forEach((room) => {
    for (let i = 1; i <= room.bedCount; i += 1) {
      room.beds.push({
        id: `${room.id}-bed-${i}`,
        roomId: room.id,
        bedNo: `${room.code}-${String(i).padStart(2, '0')}`,
        status: '空闲',
      });
    }
  });
  const activeCases = cases.filter((item) => ['PACU', '苏醒中'].includes(item.status));
  activeCases.forEach((item, index) => {
    const room = rooms[index % rooms.length];
    const bed = room.beds.find((b) => b.status === '空闲');
    if (bed) {
      bed.status = '占用';
      bed.patientName = item.patientName;
      bed.caseId = item.id;
      bed.patientId = item.patientId ?? item.id;
      bed.inTime = now.subtract(30 + index * 15, 'minute').toISOString();
    }
  });
  rooms[0].beds[rooms[0].beds.length - 1].status = '维护';
  return rooms;
}

export function buildConsentRecords(cases: SurgeryCase[]): ConsentRecord[] {
  return cases.map((item) => ({
    id: `consent-${item.id}`,
    caseId: item.id,
    patientName: item.patientName,
    surgeryName: item.surgeryName,
    anesthesiaMethod: item.anesthesiaMethod,
    surgeryDate: dayjs(item.plannedStart).format('YYYY-MM-DD'),
    commonRisks: item.preVisit.completed,
    severeRisks: item.preVisit.completed,
    specialRisks: false,
    planAccepted: item.preVisit.completed,
    questionAnswered: item.preVisit.completed,
    patientSigned: item.preVisit.completed,
    familySigned: false,
    doctorSigned: item.preVisit.completed,
    signedAt: item.preVisit.completed ? now.subtract(1, 'day').toISOString() : undefined,
    status: item.preVisit.completed ? '已提交' : '草稿',
    updatedAt: now.toISOString(),
  }));
}

export function buildHandoverRecords(cases: SurgeryCase[]): HandoverRecord[] {
  return cases
    .filter((item) => ['麻醉中', '手术中', '苏醒中'].includes(item.status))
    .slice(0, 3)
    .map((item, index) => ({
      id: `handover-${item.id}`,
      caseId: item.id,
      patientName: item.patientName,
      handoverType: index === 0 ? '常规交班' : '临时交班',
      handoverDoctor: item.anesthesiologist,
      receiveDoctor: '李麻醉',
      focusPoints: `${item.anesthesiaMethod}，关注生命体征`,
      medications: '丙泊酚持续泵入',
      vitals: 'HR 72, BP 118/76, SpO2 99%',
      specialNotes: item.activeWarming ? '术中保温中' : '无',
      pendingItems: '术后镇痛评估',
      equipmentChecked: true,
      drugChecked: true,
      status: '草稿' as const,
    }));
}

export function buildSummaryRecords(cases: SurgeryCase[]): SummaryRecord[] {
  return cases
    .filter((item) => item.status === '已离室')
    .map((item) => ({
      id: `summary-${item.id}`,
      caseId: item.id,
      patientName: item.patientName,
      anesthesiaMethod: item.anesthesiaMethod,
      intraopNotes: '麻醉过程平稳',
      recoveryNotes: '苏醒良好',
      complications: '无',
      effectRating: '优' as const,
      doctorSigned: true,
      signedAt: now.subtract(2, 'hour').toISOString(),
      status: '已提交' as const,
    }));
}

export function buildWorkloadStats(cases: SurgeryCase[]): WorkloadStats {
  const emergency = cases.filter((item) => item.urgency === '急诊').length;
  const elective = cases.filter((item) => item.urgency === '择期').length;
  const completed = cases.filter((item) => ['已离室', 'PACU'].includes(item.status)).length;
  return {
    totalSurgeries: cases.length,
    totalAnesthesia: cases.filter((item) => item.status !== '已取消').length,
    emergencyCount: emergency,
    electiveCount: elective,
    completionRate: cases.length ? Math.round((completed / cases.length) * 100) : 0,
    trendLabels: Array.from({ length: 7 }, (_, i) => now.subtract(6 - i, 'day').format('MM-DD')),
    trendValues: [8, 10, 9, 12, 11, 10, cases.length],
    typeLabels: ['择期', '急诊', '日间', '室外'],
    typeValues: [elective, emergency, 2, cases.filter((c) => c.locationType === '手术室外').length],
    methodLabels: ['全麻', '椎管内', '神经阻滞', '其他'],
    methodValues: [
      cases.filter((c) => c.anesthesiaMethod.includes('全麻')).length,
      cases.filter((c) => c.anesthesiaMethod.includes('椎管') || c.anesthesiaMethod.includes('腰硬')).length,
      cases.filter((c) => c.anesthesiaMethod.includes('阻滞')).length,
      1,
    ],
  };
}

export function buildSurgeryRequests(cases: SurgeryCase[]): SurgeryRequest[] {
  return cases.map((item) => ({
    id: `req-${item.id}`,
    patientName: item.patientName,
    department: item.department,
    surgeryName: item.surgeryName,
    urgency: item.urgency,
    requestDate: dayjs(item.plannedStart).subtract(1, 'day').format('YYYY-MM-DD'),
    status: item.status === '已取消' ? '已取消' : '已排班',
    surgeon: item.surgeon,
  }));
}

export function buildConsultations(cases: SurgeryCase[]): ConsultationRecord[] {
  return cases.slice(0, 4).map((item) => ({
    id: `consult-${item.id}`,
    caseId: item.id,
    patientName: item.patientName,
    requestDept: item.department,
    consultDate: now.format('YYYY-MM-DD'),
    consultant: '王睿',
    opinion: item.asa >= 'III' ? '建议加强监测，评估困难气道' : '可按计划麻醉',
    status: item.preVisit.completed ? '已完成' : '待会诊',
  }));
}

export function buildExamReviews(cases: SurgeryCase[]): ExamReviewRecord[] {
  return cases.map((item) => ({
    id: `exam-${item.id}`,
    caseId: item.id,
    patientName: item.patientName,
    labItems: '血常规、凝血、生化',
    imagingItems: '胸片',
    reviewResult: item.preVisit.completed ? '通过' : '待补检',
    reviewer: '王睿',
    reviewDate: now.format('YYYY-MM-DD'),
  }));
}

export function buildSafetyChecks(cases: SurgeryCase[]): SafetyCheckRecord[] {
  return cases.map((item) => ({
    id: `safety-${item.id}`,
    caseId: item.id,
    patientName: item.patientName,
    signInComplete: item.preVisit.completed,
    timeOutComplete: ['麻醉中', '手术中', '苏醒中', 'PACU', '已离室'].includes(item.status),
    signOutComplete: item.status === '已离室',
    checker: item.anesthesiaNurse,
    checkDate: now.format('YYYY-MM-DD'),
    status: item.status === '已离室' ? '已完成' : '未完成',
  }));
}

export function buildMonitorDevices(cases: SurgeryCase[]): MonitorDevice[] {
  return cases.slice(0, 6).map((item, index) => ({
    id: `device-${item.id}`,
    name: `监护仪-${item.room}`,
    room: item.room,
    type: '多参数监护',
    status: index === 2 ? '告警' : '在线',
    lastSync: now.subtract(index * 2, 'minute').format('HH:mm:ss'),
  }));
}

export function buildMonitorAlerts(cases: SurgeryCase[]): MonitorAlert[] {
  return cases
    .filter((item) => item.events.some((e) => ['低体温', '低血压', '低氧'].includes(e.type)))
    .map((item) => ({
      id: `alert-${item.id}`,
      room: item.room,
      patientName: item.patientName,
      alertType: item.events.find((e) => ['低体温', '低血压', '低氧'].includes(e.type))?.type ?? '异常',
      severity: '严重' as const,
      time: now.subtract(10, 'minute').format('HH:mm'),
      handled: false,
    }));
}

export function buildComplications(cases: SurgeryCase[]): ComplicationRecord[] {
  return cases
    .filter((item) => item.events.length > 0)
    .slice(0, 3)
    .map((item) => ({
      id: `comp-${item.id}`,
      caseId: item.id,
      patientName: item.patientName,
      type: item.events[0]?.type ?? '其他',
      severity: '中度',
      stage: item.events[0]?.stage ?? '术中',
      symptoms: item.events[0]?.treatment ?? '',
      treatment: '对症处理',
      outcome: '已缓解',
      reportTime: now.format('YYYY-MM-DD HH:mm'),
      status: '已提交',
    }));
}

export function buildFavorites(): FavoriteItem[] {
  return [
    { id: 'fav-1', name: '手术排班', category: '常用功能', targetPath: '/surgery/schedule', createdAt: now.toISOString() },
    { id: 'fav-2', name: '质控缺陷', category: '常用功能', targetPath: '/quality/defects', createdAt: now.toISOString() },
    { id: 'fav-3', name: 'PACU总览', category: '常用功能', targetPath: '/pacu/list', createdAt: now.toISOString() },
  ];
}

export function buildScheduleDuty(): ScheduleDutySlot[] {
  return [
    { id: 'duty-1', date: now.format('YYYY-MM-DD'), shift: '白班', doctor: '张主任', nurse: '刘护士', anesthesiologist: '王睿', phone: '13800001111' },
    { id: 'duty-2', date: now.format('YYYY-MM-DD'), shift: '夜班', doctor: '李主任', nurse: '陈护士', anesthesiologist: '赵麻醉', phone: '13800002222' },
    { id: 'duty-3', date: now.add(1, 'day').format('YYYY-MM-DD'), shift: '备班', doctor: '周主任', nurse: '吴护士', anesthesiologist: '王睿', phone: '13800003333' },
  ];
}

export function buildEmergencyCalls(): EmergencyCall[] {
  return [
    {
      id: 'call-1',
      type: '复苏室紧急呼叫',
      caller: 'PACU护士',
      location: 'PACU-A-03',
      severity: '紧急',
      description: '患者低氧需协助',
      time: now.subtract(5, 'minute').format('HH:mm'),
      status: '处理中',
    },
  ];
}

export function buildPacuBookings(cases: SurgeryCase[]): PacuBooking[] {
  return cases
    .filter((item) => ['麻醉中', '手术中'].includes(item.status))
    .slice(0, 2)
    .map((item) => ({
      id: `booking-${item.id}`,
      caseId: item.id,
      patientName: item.patientName,
      pacuRoomId: 'pacu-a',
      bookingTime: now.add(1, 'hour').format('YYYY-MM-DD HH:mm'),
      bookingDoctor: item.anesthesiologist,
      bookingType: item.urgency === '急诊' ? '紧急预约' : '常规预约',
      status: '待接收',
    }));
}

export function buildPacuReceives(cases: SurgeryCase[]): PacuReceiveRecord[] {
  return cases
    .filter((item) => item.status === 'PACU')
    .map((item) => ({
      id: `receive-${item.id}`,
      caseId: item.id,
      patientName: item.patientName,
      bedId: 'pacu-a-bed-01',
      vitalsChecked: true,
      consciousnessChecked: true,
      airwayChecked: true,
      circulationChecked: true,
      tubeChecked: true,
      skinChecked: true,
      identityChecked: true,
      siteChecked: true,
      receiveNurse: 'PACU护士',
      receiveTime: now.subtract(20, 'minute').toISOString(),
      notes: '交接顺利',
      status: '已接收',
    }));
}

export function buildQualityChecks(): QualityCheckRecord[] {
  return [
    { id: 'qc-1', checkItem: '体温监测', standard: '全麻>120min需记录', result: '不合格', checker: '质控员', checkDate: now.format('YYYY-MM-DD'), issueDesc: 'OR-02未记录', rectifyStatus: '整改中' },
    { id: 'qc-2', checkItem: 'PACU首次体温', standard: '入室30分钟内', result: '合格', checker: '质控员', checkDate: now.format('YYYY-MM-DD') },
    { id: 'qc-3', checkItem: '术前访视', standard: '择期术前完成', result: '待查', checker: '质控员', checkDate: now.format('YYYY-MM-DD'), rectifyStatus: '待整改' },
  ];
}

export function buildDrugInventory(): DrugInventoryItem[] {
  return [
    // 麻醉药品（演示库存；与「药品字典」seedDrugDict 可同名，供分类 Tab 展示）
    { id: 'drug-inv-1', name: '丙泊酚', category: '麻醉药品', specification: '200mg/20ml', stock: 48, unit: '支', minStock: 20, price: 35 },
    { id: 'drug-inv-2', name: '依托咪酯', category: '麻醉药品', specification: '20mg/10ml', stock: 32, unit: '支', minStock: 15, price: 22 },
    { id: 'drug-inv-3', name: '七氟烷', category: '麻醉药品', specification: '250ml/瓶', stock: 18, unit: '瓶', minStock: 8, price: 180 },
    { id: 'drug-inv-4', name: '氯胺酮', category: '麻醉药品', specification: '100mg/2ml', stock: 24, unit: '支', minStock: 10, price: 15 },
    { id: 'drug-inv-5', name: '地氟烷', category: '麻醉药品', specification: '240ml/瓶', stock: 12, unit: '瓶', minStock: 6, price: 210 },
    { id: 'drug-inv-6', name: '异氟烷', category: '麻醉药品', specification: '100ml/瓶', stock: 10, unit: '瓶', minStock: 5, price: 95 },
    { id: 'drug-inv-7', name: '利多卡因', category: '麻醉药品', specification: '100mg/5ml', stock: 36, unit: '支', minStock: 12, price: 5 },
    { id: 'drug-inv-10', name: '芬太尼', category: '镇痛药品', specification: '0.1mg/2ml', stock: 20, unit: '支', minStock: 15, price: 12 },
    { id: 'drug-inv-11', name: '舒芬太尼', category: '镇痛药品', specification: '50μg/1ml', stock: 12, unit: '支', minStock: 15, price: 28 },
    { id: 'drug-inv-12', name: '瑞芬太尼', category: '镇痛药品', specification: '1mg/1ml', stock: 16, unit: '支', minStock: 10, price: 45 },
    { id: 'drug-inv-20', name: '罗库溴铵', category: '肌松药品', specification: '50mg/5ml', stock: 30, unit: '支', minStock: 10, price: 42 },
    { id: 'drug-inv-21', name: '顺阿曲库铵', category: '肌松药品', specification: '10mg/5ml', stock: 22, unit: '支', minStock: 10, price: 38 },
    { id: 'drug-inv-30', name: '咪达唑仑', category: '镇静药品', specification: '5mg/1ml', stock: 25, unit: '支', minStock: 10, price: 18 },
    { id: 'drug-inv-31', name: '右美托咪定', category: '镇静药品', specification: '200μg/2ml', stock: 14, unit: '支', minStock: 8, price: 52 },
    { id: 'drug-inv-40', name: '阿托品', category: '其他药品', specification: '0.5mg/1ml', stock: 40, unit: '支', minStock: 10, price: 3 },
    { id: 'drug-inv-41', name: '肾上腺素', category: '其他药品', specification: '1mg/1ml', stock: 30, unit: '支', minStock: 12, price: 4 },
  ];
}
