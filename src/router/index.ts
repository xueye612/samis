import { createRouter, createWebHistory } from 'vue-router';
import Login from '@/views/Login.vue';
import WorkbenchOverview from '@/views/workbench/WorkbenchOverview.vue';
import WorkbenchRooms from '@/views/workbench/WorkbenchRooms.vue';
import WorkbenchTodos from '@/views/workbench/WorkbenchTodos.vue';
import WorkbenchNoShift from '@/views/workbench/WorkbenchNoShift.vue';
import WorkbenchEmergency from '@/views/workbench/WorkbenchEmergency.vue';
import PreoperativeRequests from '@/views/preoperative/PreoperativeRequests.vue';
import PreoperativeConsultation from '@/views/preoperative/PreoperativeConsultation.vue';
import PreoperativeExamReview from '@/views/preoperative/PreoperativeExamReview.vue';
import PreoperativeConsent from '@/views/preoperative/PreoperativeConsent.vue';
import PreoperativeSafetyCheck from '@/views/preoperative/PreoperativeSafetyCheck.vue';
import SurgerySchedule from '@/views/SurgerySchedule.vue';
import ScheduleDuty from '@/views/surgery/ScheduleDuty.vue';
import PatientAnesthesiaDetail from '@/views/PatientAnesthesiaDetail.vue';
import PreVisit from '@/views/PreVisit.vue';
import AnesthesiaPrototypeHub from '@/views/surgery/AnesthesiaPrototypeHub.vue';
import AnesthesiaPlan from '@/views/surgery/AnesthesiaPlan.vue';
import AnesthesiaHandover from '@/views/surgery/AnesthesiaHandover.vue';
import AnesthesiaSummary from '@/views/surgery/AnesthesiaSummary.vue';
import AnesthesiaRecord from '@/views/AnesthesiaRecord.vue';
import SurgeryMedications from '@/views/surgery/SurgeryMedications.vue';
import SurgeryFluids from '@/views/surgery/SurgeryFluids.vue';
import SurgeryEvents from '@/views/surgery/SurgeryEvents.vue';
import MonitorDashboard from '@/views/monitor/MonitorDashboard.vue';
import MonitorDevices from '@/views/monitor/MonitorDevices.vue';
import MonitorAlerts from '@/views/monitor/MonitorAlerts.vue';
import PacuList from '@/views/PacuList.vue';
import PacuRecord from '@/views/PacuRecord.vue';
import PacuTransfer from '@/views/PacuTransfer.vue';
import PacuAlerts from '@/views/pacu/PacuAlerts.vue';
import PacuBooking from '@/views/pacu/PacuBooking.vue';
import PacuReceive from '@/views/pacu/PacuReceive.vue';
import PostoperativeAnalgesia from '@/views/postoperative/PostoperativeAnalgesia.vue';
import PostoperativeAnalgesiaDetail from '@/views/postoperative/PostoperativeAnalgesiaDetail.vue';
import PostoperativeFollowupPage from '@/views/postoperative/PostoperativeFollowupPage.vue';
import PostoperativeComplications from '@/views/postoperative/PostoperativeComplications.vue';
import PostoperativeUnplannedEvents from '@/views/postoperative/PostoperativeUnplannedEvents.vue';
import SpecialObstetric from '@/views/special/SpecialObstetric.vue';
import SpecialNonOr from '@/views/special/SpecialNonOr.vue';
import QualityOverview from '@/views/quality/QualityOverview.vue';
import QualityDashboard from '@/views/QualityDashboard.vue';
import QualityHypothermia from '@/views/quality/QualityHypothermia.vue';
import QualityPacu from '@/views/quality/QualityPacu.vue';
import QualityAdverseEvents from '@/views/quality/QualityAdverseEvents.vue';
import QualityDefects from '@/views/QualityDefects.vue';
import QualityReports from '@/views/quality/QualityReports.vue';
import QualityPdca from '@/views/quality/QualityPdca.vue';
import ReportsWorkload from '@/views/reports/ReportsWorkload.vue';
import ReportsMethods from '@/views/reports/ReportsMethods.vue';
import ReportsOperations from '@/views/reports/ReportsOperations.vue';
import ConfigRooms from '@/views/config/ConfigRooms.vue';
import ConfigStaff from '@/views/config/ConfigStaff.vue';
import ConfigMethods from '@/views/config/ConfigMethods.vue';
import ConfigDrugs from '@/views/config/ConfigDrugs.vue';
import ConfigFluids from '@/views/config/ConfigFluids.vue';
import ConfigVitals from '@/views/config/ConfigVitals.vue';
import ConfigEvents from '@/views/config/ConfigEvents.vue';
import ConfigScores from '@/views/config/ConfigScores.vue';
import ConfigPrint from '@/views/config/ConfigPrint.vue';
import SystemUsers from '@/views/system/SystemUsers.vue';
import SystemRoles from '@/views/system/SystemRoles.vue';
import SystemAudit from '@/views/system/SystemAudit.vue';
import SystemIntegration from '@/views/system/SystemIntegration.vue';
import SystemMock from '@/views/system/SystemMock.vue';

import { checkSamisAuthRequired, ensureLoggedIn } from '@/services/auth/authService';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/workbench/overview' },
    { path: '/login', name: 'login', component: Login, meta: { fullscreen: true, title: '登录' } },
    { path: '/workbench', redirect: '/workbench/overview' },
    { path: '/workbench/overview', name: 'workbenchOverview', component: WorkbenchOverview, meta: { menu: 'workbench', title: '今日麻醉工作台' } },
    { path: '/workbench/rooms', name: 'workbenchRooms', component: WorkbenchRooms, meta: { menu: 'workbench', title: '手术间状态总览' } },
    { path: '/workbench/todos', name: 'workbenchTodos', component: WorkbenchTodos, meta: { menu: 'workbench', title: '我的待办' } },
    { path: '/workbench/no-shift', name: 'workbenchNoShift', component: WorkbenchNoShift, meta: { menu: 'workbench', title: '今日无排班' } },
    { path: '/workbench/emergency', name: 'workbenchEmergency', component: WorkbenchEmergency, meta: { menu: 'workbench', title: '紧急呼叫' } },
    { path: '/preoperative/requests', name: 'preoperativeRequests', component: PreoperativeRequests, meta: { menu: 'preoperative', title: '手术申请接收' } },
    { path: '/preoperative/consultation', name: 'preoperativeConsultation', component: PreoperativeConsultation, meta: { menu: 'preoperative', title: '麻醉会诊' } },
    { path: '/preoperative/exam-review', name: 'preoperativeExamReview', component: PreoperativeExamReview, meta: { menu: 'preoperative', title: '术前检查审核' } },
    { path: '/preoperative/consent', name: 'preoperativeConsent', component: PreoperativeConsent, meta: { menu: 'preoperative', title: '知情同意' } },
    { path: '/preoperative/safety-check', name: 'preoperativeSafetyCheck', component: PreoperativeSafetyCheck, meta: { menu: 'preoperative', title: '手术安全核查' } },
    { path: '/surgery', redirect: '/surgery/schedule' },
    { path: '/surgery/schedule', name: 'schedule', component: SurgerySchedule, meta: { menu: 'surgery', title: '手术排班' } },
    { path: '/surgery/duty', name: 'scheduleDuty', component: ScheduleDuty, meta: { menu: 'surgery', title: '值班排班' } },
    { path: '/surgery/detail/:id?', name: 'patientAnesthesiaDetail', component: PatientAnesthesiaDetail, meta: { menu: 'surgery', title: '患者麻醉详情' } },
    { path: '/surgery/prototype', name: 'anesthesiaPrototypeHub', component: AnesthesiaPrototypeHub, meta: { menu: 'surgery', title: '原型优化框架' } },
    { path: '/surgery/pre-visit', name: 'preVisit', component: PreVisit, meta: { menu: 'surgery', title: '术前访视/麻醉评估' } },
    { path: '/surgery/plan', name: 'anesthesiaPlan', component: AnesthesiaPlan, meta: { menu: 'surgery', title: '麻醉计划' } },
    { path: '/surgery/handover', name: 'anesthesiaHandover', component: AnesthesiaHandover, meta: { menu: 'surgery', title: '麻醉交班' } },
    { path: '/surgery/summary', name: 'anesthesiaSummary', component: AnesthesiaSummary, meta: { menu: 'surgery', title: '麻醉小结' } },
    { path: '/surgery/record/:id?', name: 'record', component: AnesthesiaRecord, meta: { menu: 'surgery', title: '麻醉记录单' } },
    { path: '/surgery/medications', name: 'surgeryMedications', component: SurgeryMedications, meta: { menu: 'surgery', title: '术中用药' } },
    { path: '/surgery/fluids', name: 'surgeryFluids', component: SurgeryFluids, meta: { menu: 'surgery', title: '输液输血' } },
    { path: '/surgery/events', name: 'surgeryEvents', component: SurgeryEvents, meta: { menu: 'surgery', title: '特殊事件/抢救记录' } },
    { path: '/monitor/dashboard', name: 'monitorDashboard', component: MonitorDashboard, meta: { menu: 'surgery', title: '术中实时监测' } },
    { path: '/monitor/devices', name: 'monitorDevices', component: MonitorDevices, meta: { menu: 'surgery', title: '设备数据采集' } },
    { path: '/monitor/alerts', name: 'monitorAlerts', component: MonitorAlerts, meta: { menu: 'surgery', title: '实时告警' } },
    { path: '/pacu', redirect: '/pacu/list' },
    { path: '/pacu/list', name: 'pacu', component: PacuList, meta: { menu: 'pacu', title: 'PACU恢复室' } },
    { path: '/pacu/record/:id?', name: 'pacuRecord', component: PacuRecord, meta: { menu: 'pacu', title: 'PACU恢复记录' } },
    { path: '/pacu/transfer', name: 'pacuTransfer', component: PacuTransfer, meta: { menu: 'pacu', title: 'PACU转出管理' } },
    { path: '/pacu/alerts', name: 'pacuAlerts', component: PacuAlerts, meta: { menu: 'pacu', title: 'PACU质控预警' } },
    { path: '/pacu/booking', name: 'pacuBooking', component: PacuBooking, meta: { menu: 'pacu', title: 'PACU预约' } },
    { path: '/pacu/receive', name: 'pacuReceive', component: PacuReceive, meta: { menu: 'pacu', title: 'PACU接收' } },
    { path: '/postoperative', redirect: '/postoperative/analgesia' },
    { path: '/postoperative/analgesia', name: 'postoperativeAnalgesia', component: PostoperativeAnalgesia, meta: { menu: 'postoperative', title: '术后镇痛' } },
    { path: '/postoperative/analgesia-detail', name: 'postoperativeAnalgesiaDetail', component: PostoperativeAnalgesiaDetail, meta: { menu: 'postoperative', title: '镇痛方案管理' } },
    { path: '/postoperative/followup', name: 'postoperativeFollowup', component: PostoperativeFollowupPage, meta: { menu: 'postoperative', title: '术后随访' } },
    { path: '/postoperative/complications', name: 'postoperativeComplications', component: PostoperativeComplications, meta: { menu: 'postoperative', title: '并发症追踪' } },
    { path: '/postoperative/unplanned-events', name: 'postoperativeUnplannedEvents', component: PostoperativeUnplannedEvents, meta: { menu: 'postoperative', title: '非计划事件追踪' } },
    { path: '/special/obstetric', name: 'specialObstetric', component: SpecialObstetric, meta: { menu: 'surgery', title: '产科/分娩镇痛' } },
    { path: '/special/non-or', name: 'specialNonOr', component: SpecialNonOr, meta: { menu: 'surgery', title: '非手术室麻醉' } },
    { path: '/quality', redirect: '/quality/overview' },
    { path: '/quality/overview', name: 'qualityOverview', component: QualityOverview, meta: { menu: 'quality', title: '质控总览' } },
    { path: '/quality/dashboard', name: 'qualityDashboard', component: QualityDashboard, meta: { menu: 'quality', title: '26项质控指标' } },
    { path: '/quality/hypothermia', name: 'qualityHypothermia', component: QualityHypothermia, meta: { menu: 'quality', title: '低体温专项' } },
    { path: '/quality/pacu', name: 'qualityPacu', component: QualityPacu, meta: { menu: 'quality', title: 'PACU专项' } },
    { path: '/quality/adverse-events', name: 'qualityAdverseEvents', component: QualityAdverseEvents, meta: { menu: 'quality', title: '不良事件统计' } },
    { path: '/quality/defects', name: 'qualityDefects', component: QualityDefects, meta: { menu: 'quality', title: '质控缺陷列表' } },
    { path: '/quality/reports', name: 'qualityReports', component: QualityReports, meta: { menu: 'quality', title: '月度质控报表' } },
    { path: '/quality/pdca', name: 'qualityPdca', component: QualityPdca, meta: { menu: 'quality', title: 'PDCA持续改进' } },
    { path: '/reports/workload', name: 'reportsWorkload', component: ReportsWorkload, meta: { menu: 'reports', title: '工作量统计' } },
    { path: '/reports/methods', name: 'reportsMethods', component: ReportsMethods, meta: { menu: 'reports', title: '麻醉方式分析' } },
    { path: '/reports/operations', name: 'reportsOperations', component: ReportsOperations, meta: { menu: 'reports', title: '运营分析' } },
    { path: '/config', redirect: '/config/rooms' },
    { path: '/config/rooms', name: 'configRooms', component: ConfigRooms, meta: { menu: 'config', title: '手术间管理' } },
    { path: '/config/staff', name: 'configStaff', component: ConfigStaff, meta: { menu: 'config', title: '麻醉人员' } },
    { path: '/config/methods', name: 'configMethods', component: ConfigMethods, meta: { menu: 'config', title: '麻醉方式字典' } },
    { path: '/config/drugs', name: 'configDrugs', component: ConfigDrugs, meta: { menu: 'config', title: '药品字典' } },
    { path: '/config/fluids', name: 'configFluids', component: ConfigFluids, meta: { menu: 'config', title: '液体/血制品字典' } },
    { path: '/config/vitals', name: 'configVitals', component: ConfigVitals, meta: { menu: 'config', title: '生命体征字典' } },
    { path: '/config/events', name: 'configEvents', component: ConfigEvents, meta: { menu: 'config', title: '事件字典' } },
    { path: '/config/scores', name: 'configScores', component: ConfigScores, meta: { menu: 'config', title: '评分模板' } },
    { path: '/config/print', name: 'configPrint', component: ConfigPrint, meta: { menu: 'config', title: '打印模板' } },
    { path: '/system', redirect: '/system/users' },
    { path: '/system/users', name: 'systemUsers', component: SystemUsers, meta: { menu: 'system', title: '用户管理' } },
    { path: '/system/roles', name: 'systemRoles', component: SystemRoles, meta: { menu: 'system', title: '角色权限' } },
    { path: '/system/audit', name: 'systemAudit', component: SystemAudit, meta: { menu: 'system', title: '审计日志/操作日志' } },
    { path: '/system/integration', name: 'systemIntegration', component: SystemIntegration, meta: { menu: 'system', title: '接口配置' } },
    { path: '/system/mock', name: 'systemMock', component: SystemMock, meta: { menu: 'system', title: '数据模拟配置' } },
  ],
});

router.beforeEach((to) => {
  if (to.meta.fullscreen || to.path === '/login') return true;
  if (checkSamisAuthRequired() && !ensureLoggedIn()) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
