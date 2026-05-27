import type { AppIconName } from '@/icons/registry';

export interface PrimaryMenuItem {
  key: string;
  label: string;
  icon: AppIconName;
  defaultPath: string;
  description?: string;
}

export interface SecondaryMenuItem {
  key: string;
  label: string;
  path: string;
  icon?: AppIconName;
}

export const primaryMenus: PrimaryMenuItem[] = [
  { key: 'workbench', label: '工作台', icon: 'IconDashboard', defaultPath: '/workbench/overview', description: '今日手术与待办' },
  { key: 'preoperative', label: '术前管理', icon: 'IconCompass', defaultPath: '/preoperative/requests', description: '访视与核查' },
  { key: 'surgery', label: '手术麻醉', icon: 'IconExperiment', defaultPath: '/surgery/schedule', description: '排班与记录' },
  { key: 'pacu', label: 'PACU恢复室', icon: 'IconHeart', defaultPath: '/pacu/list', description: '恢复与转出' },
  { key: 'postoperative', label: '术后管理', icon: 'IconBookmark', defaultPath: '/postoperative/analgesia', description: '镇痛与随访' },
  { key: 'quality', label: '麻醉质控', icon: 'IconBarChart', defaultPath: '/quality/overview', description: '指标与缺陷' },
  { key: 'reports', label: '统计报表', icon: 'IconArrowRise', defaultPath: '/reports/workload', description: '工作量分析' },
  { key: 'config', label: '基础配置', icon: 'IconSettings', defaultPath: '/config/rooms', description: '字典与模板' },
  { key: 'system', label: '系统管理', icon: 'IconStorage', defaultPath: '/system/users', description: '用户与集成' },
];

export const secondaryMenus: Record<string, SecondaryMenuItem[]> = {
  workbench: [
    { key: 'overview', label: '今日工作台', path: '/workbench/overview', icon: 'IconDashboard' },
    { key: 'rooms', label: '手术间总览', path: '/workbench/rooms', icon: 'IconHome' },
    { key: 'todos', label: '我的待办', path: '/workbench/todos', icon: 'IconList' },
  ],
  preoperative: [
    { key: 'requests', label: '手术申请接收', path: '/preoperative/requests', icon: 'IconFile' },
    { key: 'consultation', label: '麻醉会诊', path: '/preoperative/consultation', icon: 'IconCalendar' },
    { key: 'exam', label: '术前检查审核', path: '/preoperative/exam-review', icon: 'IconExclamationCircle' },
    { key: 'consent', label: '知情同意', path: '/preoperative/consent', icon: 'IconFile' },
    { key: 'safety', label: '手术安全核查', path: '/preoperative/safety-check', icon: 'IconExclamationCircle' },
  ],
  surgery: [
    { key: 'schedule', label: '手术排班', path: '/surgery/schedule', icon: 'IconCalendar' },
    { key: 'detail', label: '患者麻醉详情', path: '/surgery/detail', icon: 'IconList' },
    { key: 'preVisit', label: '术前访视', path: '/surgery/pre-visit', icon: 'IconFile' },
    { key: 'plan', label: '麻醉计划', path: '/surgery/plan', icon: 'IconFile' },
    { key: 'record', label: '麻醉记录单', path: '/surgery/record', icon: 'IconExperiment' },
    { key: 'medications', label: '术中用药', path: '/surgery/medications', icon: 'IconExperiment' },
    { key: 'fluids', label: '输液输血', path: '/surgery/fluids', icon: 'IconSwap' },
    { key: 'events', label: '特殊事件/抢救', path: '/surgery/events', icon: 'IconExclamationCircle' },
    { key: 'intraopMonitor', label: '术中实时监测', path: '/monitor/dashboard', icon: 'IconDesktop' },
    { key: 'nonOr', label: '非手术室麻醉', path: '/special/non-or', icon: 'IconExperiment' },
    { key: 'obstetric', label: '产科/分娩镇痛', path: '/special/obstetric', icon: 'IconHeart' },
  ],
  pacu: [
    { key: 'list', label: '患者列表', path: '/pacu/list', icon: 'IconList' },
    { key: 'record', label: '恢复记录', path: '/pacu/record', icon: 'IconFile' },
    { key: 'transfer', label: '转出管理', path: '/pacu/transfer', icon: 'IconSwap' },
    { key: 'alerts', label: 'PACU质控预警', path: '/pacu/alerts', icon: 'IconExclamationCircle' },
  ],
  postoperative: [
    { key: 'analgesia', label: '术后镇痛', path: '/postoperative/analgesia', icon: 'IconHeart' },
    { key: 'followup', label: '术后随访', path: '/postoperative/followup', icon: 'IconCalendar' },
    { key: 'complications', label: '并发症追踪', path: '/postoperative/complications', icon: 'IconExclamationCircle' },
    { key: 'unplanned', label: '非计划事件追踪', path: '/postoperative/unplanned-events', icon: 'IconSwap' },
  ],
  quality: [
    { key: 'overview', label: '质控总览', path: '/quality/overview', icon: 'IconDashboard' },
    { key: 'dashboard', label: '26项指标看板', path: '/quality/dashboard', icon: 'IconBarChart' },
    { key: 'hypothermia', label: '低体温专项', path: '/quality/hypothermia', icon: 'IconExclamationCircle' },
    { key: 'pacu', label: 'PACU专项', path: '/quality/pacu', icon: 'IconHeart' },
    { key: 'adverse', label: '不良事件统计', path: '/quality/adverse-events', icon: 'IconExclamationCircle' },
    { key: 'defects', label: '质控缺陷', path: '/quality/defects', icon: 'IconExclamationCircle' },
    { key: 'reports', label: '月度质控报表', path: '/quality/reports', icon: 'IconFile' },
    { key: 'pdca', label: 'PDCA持续改进', path: '/quality/pdca', icon: 'IconCalendar' },
  ],
  reports: [
    { key: 'workload', label: '工作量统计', path: '/reports/workload', icon: 'IconBarChart' },
    { key: 'methods', label: '麻醉方式分析', path: '/reports/methods', icon: 'IconExperiment' },
    { key: 'operations', label: '运营分析', path: '/reports/operations', icon: 'IconDashboard' },
  ],
  config: [
    { key: 'rooms', label: '手术间管理', path: '/config/rooms', icon: 'IconHome' },
    { key: 'staff', label: '麻醉人员', path: '/config/staff', icon: 'IconList' },
    { key: 'methods', label: '麻醉方式字典', path: '/config/methods', icon: 'IconExperiment' },
    { key: 'drugs', label: '药品字典', path: '/config/drugs', icon: 'IconExperiment' },
    { key: 'fluids', label: '液体/血制品字典', path: '/config/fluids', icon: 'IconSwap' },
    { key: 'events', label: '事件字典', path: '/config/events', icon: 'IconExclamationCircle' },
    { key: 'scores', label: '评分模板', path: '/config/scores', icon: 'IconFile' },
    { key: 'print', label: '打印模板', path: '/config/print', icon: 'IconFile' },
  ],
  system: [
    { key: 'users', label: '用户管理', path: '/system/users', icon: 'IconList' },
    { key: 'roles', label: '角色权限', path: '/system/roles', icon: 'IconSettings' },
    { key: 'audit', label: '审计日志/操作日志', path: '/system/audit', icon: 'IconFile' },
    { key: 'integration', label: '接口配置', path: '/system/integration', icon: 'IconSwap' },
    { key: 'mock', label: '数据模拟配置', path: '/system/mock', icon: 'IconExperiment' },
  ],
};

export const primaryMenuMap = Object.fromEntries(primaryMenus.map((item) => [item.key, item])) as Record<string, PrimaryMenuItem>;

export function getPrimaryMenuLabel(menuKey: string) {
  return primaryMenuMap[menuKey]?.label ?? '系统';
}

export function matchSecondaryKey(path: string, menuKey: string) {
  const items = secondaryMenus[menuKey] ?? [];
  const hit = items.find((item) => path === item.path || path.startsWith(`${item.path}/`));
  if (hit) return hit.key;
  if (menuKey === 'surgery' && path.includes('/surgery/record')) return 'record';
  if (menuKey === 'surgery' && path.includes('/surgery/detail')) return 'detail';
  if (menuKey === 'surgery' && path.includes('/monitor/')) return 'intraopMonitor';
  if (menuKey === 'surgery' && path.includes('/special/non-or')) return 'nonOr';
  if (menuKey === 'surgery' && path.includes('/special/obstetric')) return 'obstetric';
  if (menuKey === 'pacu' && path.includes('/pacu/record')) return 'record';
  if (menuKey === 'workbench' && path === '/workbench') return 'overview';
  return items[0]?.key;
}
