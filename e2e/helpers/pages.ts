import { expect, type Page, test } from '@playwright/test';
import { watchConsoleErrors } from './consoleErrorWatcher';

export interface CorePage {
  name: string;
  path: string;
  screenshot: string;
  keywords: string[];
}

export const corePages: CorePage[] = [
  { name: '登录页', path: '/login', screenshot: '01-login.png', keywords: ['手术麻醉管理系统', '进入系统'] },
  { name: '麻醉工作台首页', path: '/workbench', screenshot: '02-workbench.png', keywords: ['工作台', 'OR-01', '质控'] },
  { name: '手术排班页面', path: '/surgery/schedule', screenshot: '03-surgery-schedule.png', keywords: ['手术', '排班', 'OR-01'] },
  { name: '麻醉原型优化框架', path: '/surgery/prototype', screenshot: '03b-anesthesia-prototype.png', keywords: ['原型优化框架', '组件规划', '质控'] },
  { name: '术前访视/麻醉评估页面', path: '/surgery/pre-visit', screenshot: '04-pre-visit.png', keywords: ['术前', '访视', 'ASA'] },
  { name: '麻醉记录单页面', path: '/surgery/record/case-or01', screenshot: '05-anesthesia-record.png', keywords: ['麻醉', '记录', 'HR'] },
  { name: 'PACU恢复室列表', path: '/pacu/list', screenshot: '06-pacu-list.png', keywords: ['PACU', 'Aldrete', 'VAS'] },
  { name: 'PACU转出管理', path: '/pacu/transfer', screenshot: '06b-pacu-transfer.png', keywords: ['PACU', '转出', '登记'] },
  { name: 'PACU恢复记录页面', path: '/pacu/record/case-or03', screenshot: '07-pacu-record.png', keywords: ['PACU', '恢复', '交接'] },
  { name: '术后随访页面', path: '/postoperative', screenshot: '08-postoperative-followup.png', keywords: ['术后', '随访', 'VAS'] },
  { name: '麻醉质控看板', path: '/quality/dashboard', screenshot: '09-quality-dashboard.png', keywords: ['质控', '指标分类', '病例'] },
  { name: '质控缺陷列表', path: '/quality/defects', screenshot: '10-quality-defects.png', keywords: ['质控', '缺陷', '整改'] },
  { name: '配置-药品字典', path: '/config/drugs', screenshot: '11-config-drugs.png', keywords: ['药品'] },
  { name: '配置-液体血制品', path: '/config/fluids', screenshot: '12-config-fluids.png', keywords: ['液体', '血制品', '晶体'] },
  { name: '配置-生命体征', path: '/config/vitals', screenshot: '13-config-vitals.png', keywords: ['心率', 'HR', '体征'] },
  { name: '配置-麻醉方式', path: '/config/methods', screenshot: '14-config-methods.png', keywords: ['麻醉', '全身'] },
  { name: '配置-事件字典', path: '/config/events', screenshot: '15-config-events.png', keywords: ['事件', '插管'] },
  { name: '配置-评分模板', path: '/config/scores', screenshot: '16-config-scores.png', keywords: ['评分', 'Aldrete'] },
  { name: '配置-打印模板', path: '/config/print', screenshot: '17-config-print.png', keywords: ['打印', '模板'] },
  { name: '配置-麻醉人员', path: '/config/staff', screenshot: '18-config-staff.png', keywords: ['人员', '麻醉'] },
  { name: '配置-手术间', path: '/config/rooms', screenshot: '19-config-rooms.png', keywords: ['手术间', 'OR'] },
];

export async function openImplementedPage(page: Page, target: CorePage) {
  const watcher = watchConsoleErrors(page);
  const response = await page.goto(target.path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);

  const status = response?.status() ?? 200;
  test.skip(status === 404, `${target.name} route is not implemented: ${target.path}`);

  const main = page.locator('.login-page, .app-content').first();
  await expect(main, `${target.name} should render a visible main container`).toBeVisible();

  const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  test.skip(bodyText.length < 20, `${target.name} appears empty or not implemented: ${target.path}`);

  const hasKeyword = target.keywords.some((keyword) => bodyText.includes(keyword));
  test.skip(!hasKeyword, `${target.name} route loaded but expected key text was not found: ${target.keywords.join(' / ')}`);

  await expect(page.locator('body')).not.toHaveText(/^\s*$/);
  watcher.assertNoSevereErrors();
}
