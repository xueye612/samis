import { expect, test } from '@playwright/test';
import { corePages, openImplementedPage } from './helpers/pages';

test.describe('核心页面冒烟测试', () => {
  for (const target of corePages) {
    test(`${target.name} 可以访问且不白屏`, async ({ page }) => {
      await openImplementedPage(page, target);
    });
  }

  test('麻醉质控指标表格在页面内完整呈现且无横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openImplementedPage(page, corePages.find((item) => item.path === '/quality/dashboard')!);

    const table = page.locator('.section-card .arco-table').first();
    await expect(table).toBeVisible();
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);

    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.section-card')?.getBoundingClientRect();
      const content = document.querySelector('.app-content')?.getBoundingClientRect();

      return {
        cardWidth: card?.width ?? 0,
        contentWidth: content?.width ?? 0,
        pageOverflowX: document.body.scrollWidth > document.documentElement.clientWidth,
      };
    });

    expect(metrics.cardWidth).toBeGreaterThan(0);
    expect(metrics.cardWidth).toBeLessThanOrEqual(metrics.contentWidth);
    expect(metrics.pageOverflowX).toBe(false);
  });

  test('主菜单采用完整合理的九项结构并可进入审计日志', async ({ page }) => {
    await openImplementedPage(page, corePages.find((item) => item.path === '/workbench')!);

    const primaryLabels = await page.locator('.app-sider .arco-menu-item').allInnerTexts();
    expect(primaryLabels.map((item) => item.trim())).toEqual([
      '工作台',
      '术前管理',
      '手术麻醉',
      'PACU恢复室',
      '术后管理',
      '麻醉质控',
      '统计报表',
      '基础配置',
      '系统管理',
    ]);

    await page.locator('.app-sider .arco-menu-item', { hasText: '手术麻醉' }).click();
    await page.locator('.surgery-subnav-group', { hasText: '监测设备' }).click();
    await expect(page.locator('.app-subnav .subnav-item', { hasText: '术中实时监测' })).toBeVisible();
    await page.locator('.surgery-subnav-group', { hasText: '专项麻醉' }).click();
    await expect(page.locator('.app-subnav .subnav-item', { hasText: '非手术室麻醉' })).toBeVisible();
    await expect(page.locator('.app-subnav .subnav-item', { hasText: '产科/分娩镇痛' })).toBeVisible();

    await page.locator('.app-sider .arco-menu-item', { hasText: '系统管理' }).click();
    await page.locator('.app-subnav .subnav-item', { hasText: '审计日志/操作日志' }).click();
    await expect(page).toHaveURL(/\/system\/audit$/);
    await expect(page.getByText('审计日志/操作日志').first()).toBeVisible();
  });
});
