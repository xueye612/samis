import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openAnesthesiaRecord } from './helpers/anesthesiaRecord';
import { startMonitorMockFromQuickToolbar } from './helpers/anesthesiaRecord';

const shotDir = path.resolve('test-results/record-design');
const VPS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test.describe('麻醉记录单工作台布局门禁', () => {
  test.setTimeout(90_000);

  for (const vp of VPS) {
    test(`${vp.width}×${vp.height} 无横向溢出且四区齐备`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openAnesthesiaRecord(page, 'case-or01');
      await page.waitForTimeout(800);

      // 1) 页面与工作区均不得横向溢出
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        sheetScroll: (document.querySelector('.sheet-workbench') as HTMLElement | null)?.scrollWidth
          > ((document.querySelector('.sheet-workbench') as HTMLElement | null)?.clientWidth ?? 0) + 1,
      }));
      expect(overflow.doc, `${vp.width} 页面横向溢出`).toBe(false);

      // 2) 四区齐备：顶部操作区、记录单主体、实时设备区、快捷录入
      await expect(page.locator('.record-workstation-topbar')).toBeVisible();
      await expect(page.locator('.live-record-card').first()).toBeVisible();
      await expect(page.locator('.toolbox-pinned-zone .realtime-device-panel')).toBeVisible();
      await expect(page.locator('.toolbox-pinned-zone .realtime-waveform-placeholder')).toBeVisible();

      if (vp.width > 1100) {
        const toolboxBox = await page.locator('.record-toolbox').boundingBox();
        expect(toolboxBox).not.toBeNull();
        expect(Math.abs(vp.height - 16 - (toolboxBox!.y + toolboxBox!.height))).toBeLessThanOrEqual(3);

        const scrollState = await page.locator('.record-toolbox').evaluate((toolbox) => {
          const flow = toolbox.querySelector<HTMLElement>('.toolbox-scroll-zone');
          const nestedScrollers = flow
            ? [...flow.querySelectorAll<HTMLElement>('*')].filter((element) => {
              const style = getComputedStyle(element);
              return element.offsetParent !== null
                && ['auto', 'scroll'].includes(style.overflowY)
                && element.scrollHeight > element.clientHeight + 1;
            })
            : [];
          if (flow) flow.scrollTop = flow.scrollHeight;
          const lastChild = flow?.lastElementChild?.getBoundingClientRect();
          const flowRect = flow?.getBoundingClientRect();
          return {
            flowOverflowY: flow ? getComputedStyle(flow).overflowY : '',
            nestedScrollerCount: nestedScrollers.length,
            lastChildVisible: !lastChild || !flowRect || lastChild.bottom <= flowRect.bottom + 2,
          };
        });
        expect(scrollState.flowOverflowY).toBe('auto');
        expect(scrollState.nestedScrollerCount, '右侧滚动区内不得再嵌套滚动条').toBe(0);
        expect(scrollState.lastChildVisible, '右侧最后一个工具项必须可滚入可视区').toBe(true);
      }

      // 3) 实时设备区与快捷录入位于同一右栏滚动流，波形占位 ≤56px
      const waveHeight = await page.locator('.realtime-waveform-placeholder').first().boundingBox();
      expect(waveHeight?.height ?? 999).toBeLessThanOrEqual(56);

      // 证据截图：禁止 fullPage，仅截视口
      fs.mkdirSync(shotDir, { recursive: true });
      await page.screenshot({ path: path.join(shotDir, `record-gate-${vp.width}x${vp.height}.png`) });
    });
  }

  test('手动缩放后不被 ResizeObserver 重置', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAnesthesiaRecord(page, 'case-or02');
    await page.waitForTimeout(800);

    // 记录自动适宽缩放值
    const autoZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 手动放大
    await page.locator('.record-workstation-topbar .clinical-actions, .record-workstation-topbar .topbar-center')
      .getByRole('button', { name: '+' }).first().click();
    await page.waitForTimeout(200);
    const manualZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 改变视口宽度触发 ResizeObserver
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(600);
    const afterResizeZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 手动缩放后，ResizeObserver 不得将其重置回自动适宽值
    expect(manualZoom).not.toBe(autoZoom);
    expect(afterResizeZoom, '手动缩放被 ResizeObserver 重置').toBe(manualZoom);
  });

  test('启动记录不代替麻醉开始，模拟监护自动采集，关键时间完整后结束进入待签名', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'simulation');
      localStorage.setItem('samis.anesthesia.deviceRawIntervalSeconds', '2');
    });
    await page.route('**/quality/configGet?**', async (route) => {
      if (!route.request().url().includes('device_realtime_data_source')) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'e2e' } }),
      });
    });
    await openAnesthesiaRecord(page, 'case-or02');
    await page.evaluate(async () => {
      const { useAnesthesiaStore } = await import('/src/stores/anesthesia.ts');
      const store = useAnesthesiaStore();
      store.stopAllMonitoringDevices();
      const item = store.cases.find((row) => row.id === 'case-or02');
      if (!item) throw new Error('case-or02 missing');
      item.locked = false;
      item.recordStatus = '未开始';
      item.signatures = { status: '未签名' };
      delete item.roomInTime;
      delete item.anesthesiaStart;
      delete item.surgeryStart;
      delete item.surgeryEnd;
      delete item.anesthesiaEnd;
      delete item.leaveRoomTime;
    });
    const actions = page.locator('.record-workstation-topbar .clinical-actions');
    const start = actions.getByRole('button', { name: '启动记录', exact: true });
    await expect(start).toBeVisible();
    await start.click();
    await expect(actions.getByRole('button', { name: '记录中', exact: true })).toBeDisabled();
    await expect(actions.getByRole('button', { name: '结束记录', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('monitor-live-values')).toBeVisible({ timeout: 7_000 });
    expect(await page.evaluate(async () => {
      const { useAnesthesiaStore } = await import('/src/stores/anesthesia.ts');
      return useAnesthesiaStore().cases.find((row) => row.id === 'case-or02')?.anesthesiaStart ?? null;
    })).toBeNull();

    await page.locator('.device-quick').getByRole('button', { name: '停止监护仪' }).click();
    await page.evaluate(async () => {
      const { useAnesthesiaStore } = await import('/src/stores/anesthesia.ts');
      const store = useAnesthesiaStore();
      const item = store.cases.find((row) => row.id === 'case-or02');
      if (!item) throw new Error('case-or02 missing');
      Object.assign(item, {
        roomInTime: '2026-07-16T08:00:00+08:00',
        anesthesiaStart: '2026-07-16T08:10:00+08:00',
        surgeryStart: '2026-07-16T08:40:00+08:00',
        surgeryEnd: '2026-07-16T10:00:00+08:00',
        anesthesiaEnd: '2026-07-16T10:10:00+08:00',
        leaveRoomTime: '2026-07-16T10:20:00+08:00',
      });
    });
    await expect(actions.getByRole('button', { name: '结束记录', exact: true })).toBeVisible();
    await actions.getByRole('button', { name: '结束记录', exact: true }).click();
    await page.getByRole('button', { name: '结束记录', exact: true }).last().click();
    await expect(page.locator('.arco-message').filter({ hasText: '等待签名' })).toBeVisible();
    await expect(actions.getByRole('button', { name: '待签名', exact: true })).toBeDisabled();
    await expect(page.locator('.live-record-card').first()).toContainText('麻醉结束');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sheet-hydration-shell')).toHaveCount(0, { timeout: 45_000 });
    await expect(page.locator('.record-workstation-topbar .clinical-actions').getByRole('button', { name: '待签名', exact: true })).toBeDisabled();
  });

  test('模拟监护启动前后设备区高度固定且首帧立即显示', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'simulation');
      localStorage.setItem('samis.anesthesia.deviceRawIntervalSeconds', '2');
    });
    await page.route('**/quality/configGet?**', async (route) => {
      if (!route.request().url().includes('device_realtime_data_source')) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'e2e' } }),
      });
    });
    await openAnesthesiaRecord(page, 'case-or02');

    const panel = page.getByTestId('record-realtime-device-panel');
    await expect(page.getByTestId('device-source-mode')).toHaveText('模拟数据');
    await expect(page.getByTestId('device-live-empty')).toContainText('模拟采集尚未启动');
    const monitorStart = page.locator('.device-quick').getByRole('button', { name: '启动监护仪' });
    const ventilatorStart = page.locator('.device-quick').getByRole('button', { name: '启动呼吸机' });
    await expect(monitorStart).toHaveClass(/arco-btn-primary/);
    await expect(ventilatorStart).toHaveClass(/arco-btn-primary/);
    const before = await panel.boundingBox();

    await startMonitorMockFromQuickToolbar(page);
    await expect(page.getByTestId('monitor-live-values')).toBeVisible({ timeout: 7_000 });
    await expect(page.getByTestId('device-freshness')).toHaveText('实时');
    await expect(page.locator('.device-quick').getByText('设备读取')).toBeVisible();
    await expect(page.locator('.device-quick').getByText('记录入单')).toBeVisible();
    const stopButton = page.locator('.device-quick').getByRole('button', { name: '停止采集' });
    const pauseButton = page.locator('.device-quick').getByRole('button', { name: '暂停采集' });
    await expect(stopButton).toBeVisible();
    await expect(pauseButton).toBeVisible();
    const after = await panel.boundingBox();

    expect(before?.height).toBe(210);
    expect(after?.height).toBe(210);

    const initialRawCount = await page.evaluate(async () => {
      const { getAnesthesiaLocalDb } = await import('/src/services/anesthesia/localDb.ts');
      return getAnesthesiaLocalDb().monitor_raw.count();
    });
    await expect.poll(async () => page.evaluate(async () => {
      const { getAnesthesiaLocalDb } = await import('/src/services/anesthesia/localDb.ts');
      return getAnesthesiaLocalDb().monitor_raw.count();
    }), { timeout: 8_000 }).toBeGreaterThan(initialRawCount);
    const latestRawHr = await page.evaluate(async () => {
      const { getAnesthesiaLocalDb } = await import('/src/services/anesthesia/localDb.ts');
      const rows = await getAnesthesiaLocalDb().monitor_raw.toArray();
      return rows.sort((a, b) => b.collect_time.localeCompare(a.collect_time))[0]?.hr;
    });
    await expect(page.getByTestId('monitor-live-values').locator('.metric-cell').filter({ hasText: 'HR' }).locator('strong')).toHaveText(String(latestRawHr));

    await pauseButton.click();
    await expect(page.locator('.device-quick').getByRole('button', { name: '继续采集' })).toBeVisible();
    const pausedFrame = await page.getByTestId('monitor-live-values').innerText();
    const pausedRawCount = await page.evaluate(async () => {
      const { getAnesthesiaLocalDb } = await import('/src/services/anesthesia/localDb.ts');
      return getAnesthesiaLocalDb().monitor_raw.count();
    });
    await page.waitForTimeout(6_000);
    expect(await page.getByTestId('monitor-live-values').innerText()).toBe(pausedFrame);
    expect(await page.evaluate(async () => {
      const { getAnesthesiaLocalDb } = await import('/src/services/anesthesia/localDb.ts');
      return getAnesthesiaLocalDb().monitor_raw.count();
    })).toBe(pausedRawCount);

    await stopButton.click();
    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.locator('.device-quick').getByRole('button', { name: '启动监护仪' })).toBeVisible();
    await expect(page.locator('.device-quick').getByRole('button', { name: '停止采集' })).toHaveCount(0);
  });

  test('已记录关键时间可在纸面上拖动并按分钟保存', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAnesthesiaRecord(page, 'case-or03');

    const node = page.locator('.chart-status-symbol:not(.is-template)').first();
    await expect(node).toBeVisible();
    await node.scrollIntoViewIfNeeded();
    const beforeTitle = await node.getAttribute('title');
    const nodeBox = await node.boundingBox();
    const trackBox = await page.locator('.chart-status-overlay').first().boundingBox();
    expect(nodeBox).not.toBeNull();
    expect(trackBox).not.toBeNull();

    const nodeGrabX = nodeBox!.x + nodeBox!.width / 2;
    const nodeY = nodeBox!.y + nodeBox!.height / 2;
    // 仅拖动约 1 分钟，既证明可编辑，也不越过已记录的下一临床节点。
    const nodeTargetX = Math.min(trackBox!.x + trackBox!.width - 24, nodeGrabX + 20);
    await node.dispatchEvent('pointerdown', { button: 0, clientX: nodeGrabX, clientY: nodeY });
    await expect(node).toHaveClass(/is-dragging/);
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, button: 0 })), { x: nodeTargetX, y: nodeY });
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, button: 0 })), { x: nodeTargetX, y: nodeY });
    await expect(node).not.toHaveAttribute('title', beforeTitle ?? '', { timeout: 8_000 });

    const operationMarker = page.locator('.sequence-marker.pink').first();
    await expect(operationMarker).toBeVisible();
    await operationMarker.scrollIntoViewIfNeeded();
    const markerBefore = await operationMarker.boundingBox();
    const ioTrack = await operationMarker.locator('xpath=..').boundingBox();
    expect(markerBefore).not.toBeNull();
    expect(ioTrack).not.toBeNull();
    const markerGrabX = markerBefore!.x + markerBefore!.width - 3;
    const markerY = markerBefore!.y + markerBefore!.height / 2;
    const markerTargetX = Math.min(ioTrack!.x + ioTrack!.width - 20, markerGrabX + ioTrack!.width * 0.06);
    await operationMarker.dispatchEvent('pointerdown', { button: 0, clientX: markerGrabX, clientY: markerY });
    await expect(operationMarker).toHaveClass(/is-dragging/);
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, button: 0 })), { x: markerTargetX, y: markerY });
    await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, button: 0 })), { x: markerTargetX, y: markerY });
    await expect.poll(async () => (await operationMarker.boundingBox())?.x ?? 0).not.toBe(markerBefore!.x);
  });

  test('基础临床信息结构化展示且出入量可一次保存多项', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAnesthesiaRecord(page, 'case-or02');

    await expect(page.getByText('禁食状态', { exact: true })).toBeVisible();
    await expect(page.getByText('术前状况', { exact: true })).toBeVisible();
    await expect(page.getByText('手术类型', { exact: true })).toBeVisible();
    await expect(page.getByText('手术等级', { exact: true })).toBeVisible();
    await expect(page.getByText('BMI', { exact: true })).toBeVisible();
    await expect(page.getByText('术后诊断', { exact: true })).toBeVisible();
    await expect(page.locator('.sheet-quick-strip').getByRole('button', { name: '体征', exact: true })).toHaveCount(0);
    await expect(page.locator('.device-quick').getByRole('button', { name: '体征', exact: true })).toHaveCount(0);

    await page.locator('.sheet-quick-strip').getByRole('button', { name: '出入量', exact: true }).click();
    const outputModal = page.locator('.record-modal-backdrop.top').filter({ hasText: '出入量设置' });
    await expect(outputModal).toBeVisible();
    await outputModal.locator('label.field-block').filter({ hasText: '尿量（ml）' }).locator('input').fill('120');
    await outputModal.locator('label.field-block').filter({ hasText: '出血量（ml）' }).locator('input').fill('50');
    await outputModal.getByRole('button', { name: '保存', exact: true }).click();
    const outputSummary = page.locator('.footer-io-block').filter({ hasText: '出量 (ml)' });
    await expect(outputSummary.locator('.footer-io-item').filter({ hasText: '尿量' })).toContainText('120');
    await expect(outputSummary.locator('.footer-io-item').filter({ hasText: '出血' })).toContainText('50');

    await expect(page.getByText('交班时间', { exact: true })).toBeAttached();
    await expect(page.getByText('交班人', { exact: true })).toBeAttached();
    await expect(page.getByText('接班人', { exact: true })).toBeAttached();

    const handoverRow = page.getByTestId('record-handover-row');
    const handoverFields = handoverRow.locator('.footer-field');
    await expect(handoverFields).toHaveCount(3);
    const handoverBoxes = await handoverFields.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
    expect(Math.max(...handoverBoxes) - Math.min(...handoverBoxes)).toBeLessThanOrEqual(1);
    const handoverOptions = await handoverRow.locator('select option:not([value=""])').allTextContents();
    handoverOptions.forEach((name) => expect(name).not.toMatch(/[、,，;；/|]/));

    const timelineList = page.locator('.timeline-workbench-card .timeline-list');
    await expect(timelineList).toBeAttached();
    const timelineOverflow = await timelineList.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(timelineOverflow.overflowY).toBe('visible');
    expect(timelineOverflow.scrollHeight - timelineOverflow.clientHeight).toBeLessThanOrEqual(1);
  });

  test('后台切换真实设备源后刷新保持并提示先连接设备', async ({ page }) => {
    let configuredSource: 'simulation' | 'real' = 'simulation';
    await page.addInitScript(() => {
      sessionStorage.setItem('samis_token', 'record-source-e2e-token');
      sessionStorage.setItem('samis_authorization', 'Bearer record-source-e2e-token');
      sessionStorage.setItem('samis_room', 'OR-02');
      sessionStorage.setItem('samis_room_group', 'ANES');
      sessionStorage.setItem('samis_user_profile', JSON.stringify({
        userId: 'record-source-e2e',
        displayName: '记录单设备源验收用户',
      }));
    });
    await page.route('**/quality/configGet?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { key: 'device_realtime_data_source', value: configuredSource, scope: 'global', source: 'e2e' },
        }),
      });
    });
    await page.route('**/quality/configSet', async (route) => {
      const form = new URLSearchParams(route.request().postData() ?? '');
      const requested = form.get('value');
      if (requested === 'simulation' || requested === 'real') configuredSource = requested;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { key: 'device_realtime_data_source', value: configuredSource, scope: 'global', source: 'e2e' },
        }),
      });
    });
    await page.route('**/api-samis/pc/v1/anesthesiaDevice/getLatestDeviceData**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { monitor: null, ventilator: null } }),
      });
    });
    const ensureDeviceSourcePage = async (navigate: boolean) => {
      if (navigate) await page.goto('/system/mock');
      const selector = page.getByTestId('device-realtime-source-selector');
      const loginButton = page.getByRole('button', { name: '登录', exact: true });
      await Promise.race([
        selector.waitFor({ state: 'visible', timeout: 15_000 }),
        loginButton.waitFor({ state: 'visible', timeout: 15_000 }),
      ]);
      if (await loginButton.isVisible()) {
        await loginButton.click();
        await expect(selector).toBeVisible({ timeout: 20_000 });
      }
      return selector;
    };
    const selectSource = async (label: '模拟采集数据' | '真实设备网关') => {
      const selector = await ensureDeviceSourcePage(true);
      await selector.getByText(label, { exact: true }).click();
      await page.getByRole('button', { name: '保存设备数据源' }).click();
      const expectedSource = label === '模拟采集数据' ? 'simulation' : 'real';
      await expect.poll(() => page.evaluate(() => (
        localStorage.getItem('samis.anesthesia.deviceRealtimeDataSource')
      ))).toBe(expectedSource);
    };

    try {
      await selectSource('真实设备网关');
      await page.reload();
      const reloadedSelector = await ensureDeviceSourcePage(false);
      await expect(
        reloadedSelector.locator('input[value="real"]'),
      ).toBeChecked();

      await openAnesthesiaRecord(page, 'case-or02');
      await expect(page.getByTestId('device-source-mode')).toHaveText('真实设备');
      await expect(page.getByTestId('device-live-empty')).toContainText('未连接实时设备');
      await expect(page.getByRole('button', { name: /启动监护仪|启动呼吸机/ })).toHaveCount(0);
    } finally {
      // 清理失败不能覆盖主体断言的原始错误；addInitScript 会在清理导航时恢复 mock 会话。
      await selectSource('模拟采集数据').catch(() => undefined);
    }
  });
});
