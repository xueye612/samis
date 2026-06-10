import { expect, test } from '@playwright/test';
import { corePages, openImplementedPage } from './helpers/pages';

test.describe('核心页面冒烟测试', () => {
  for (const target of corePages) {
    test(`${target.name} 可以访问且不白屏`, async ({ page }) => {
      await openImplementedPage(page, target);
    });
  }

  test('麻醉质控指标左侧列表使用内部滚动且不被右侧详情撑高', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openImplementedPage(page, corePages.find((item) => item.path === '/quality/dashboard')!);

    const metrics = await page.evaluate(() => {
      const leftCard = document.querySelector('.indicator-list-card')?.getBoundingClientRect();
      const list = document.querySelector('.indicator-list') as HTMLElement | null;
      const layout = document.querySelector('.quality-layout')?.getBoundingClientRect();

      return {
        leftCardHeight: leftCard?.height ?? 0,
        listClientHeight: list?.clientHeight ?? 0,
        listScrollHeight: list?.scrollHeight ?? 0,
        layoutHeight: layout?.height ?? 0,
        viewportHeight: window.innerHeight,
        pageOverflowX: document.body.scrollWidth > document.documentElement.clientWidth,
      };
    });

    expect(metrics.leftCardHeight).toBeLessThanOrEqual(metrics.viewportHeight - 240);
    expect(metrics.listScrollHeight).toBeGreaterThan(metrics.listClientHeight);
    expect(metrics.layoutHeight).toBeGreaterThan(metrics.leftCardHeight);
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
