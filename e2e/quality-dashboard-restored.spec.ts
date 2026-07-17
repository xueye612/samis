import { expect, test, type Page } from '@playwright/test';

const indicator = (code: string, name: string, category: 'process' | 'outcome', status: 'normal' | 'abnormal', numerator: number, denominator: number) => ({
  code, name, category, unit: '%', numerator, denominator, rate: denominator ? numerator / denominator * 100 : 0,
  value: denominator ? numerator / denominator * 100 : 0, expression: 'numerator / denominator * 100',
  displayValue: `${denominator ? Math.round(numerator / denominator * 100) : 0}%`, target: '≥90%', warningRule: null,
  met: status === 'normal', status, denominatorDefinition: '纳入病例', numeratorDefinition: '符合标准病例', exclusions: ['取消手术'],
  timeWindow: { anchor: '手术日期', granularity: 'month', timezone: 'Asia/Shanghai' }, evidenceFields: ['operationId', 'status'],
  severity: status === 'normal' ? 'low' : 'high', drilldown: { denominator: true, numerator: true, defect: true }, remediationAction: '复核病例并整改',
});

async function install(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'quality-e2e');
    sessionStorage.setItem('samis_authorization', 'Bearer quality-e2e');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'quality', displayName: '质控员' }));
  });
  const rows = [indicator('QI-01', '术前访视完成率', 'process', 'normal', 18, 20), indicator('QI-02', '非计划事件发生率', 'outcome', 'abnormal', 2, 20)];
  await page.route('**/api-samis/pc/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/quality/indicators')) data = rows;
    if (path.endsWith('/quality/indicatorDetail')) data = { ...rows[1], numeratorCases: [], denominatorCases: [], defectCases: [{ caseId: 'OP-QA-1', patientName: '测试患者', room: 'OR-01', department: '外科', operationName: '测试手术', anesthesiaMethod: '全麻', doctorName: '医生', status: 'completed', defectDesc: '真实异常证据' }], totals: { numeratorCount: 2, denominatorCount: 20 } };
    if (path.endsWith('/auth/myPermissions')) data = { permissions: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
  });
}

test('恢复质控图表、指标卡片与真实病例穿透，不回填模拟趋势', async ({ page }) => {
  await install(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/quality/dashboard');
  await expect(page.getByRole('heading', { name: '麻醉专业质控指标' })).toBeVisible();
  await expect(page.locator('.quality-kpi')).toHaveCount(4);
  await expect(page.locator('.portfolio-chart canvas')).toHaveCount(2);
  await expect(page.locator('.real-indicator-card')).toHaveCount(2);
  await page.locator('.real-indicator-card').filter({ hasText: 'QI-02' }).click();
  await expect(page.getByText('真实异常证据')).toBeVisible();
  await expect(page.getByText('模拟趋势')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
