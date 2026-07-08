import { expect, test } from '@playwright/test';
import { login, postOnPathname } from './helpers/realIntegration';

/**
 * T01 第三轮联调（anesthesiaRecord + anesthesiaSync）真实浏览器 live 管线冒烟。
 * 前置：samisWeb/.env.local 已启用 VITE_USE_REAL_ANESTHESIA_RECORD=true + SYNC=true；
 *       vite 代理 target 指向本地 index 192.168.10.178:8022；
 *       samis 库 anes_record + 9 子表已建（含 3c 临床子表）。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration-record.spec.ts`。
 *
 * 目标（计划 T3.5）：在真实浏览器里验证记录单 live 管线可达（真鉴权 + 真病例数据渲染 + 同步服务活跃）。
 *
 * 【实测时序与计划原假设的差异，已据实记录】
 *   - 记录单为「本地优先」。冷启动服务端回读 hydrateCaseFromServer / 手动 reloadCaseFromServer 均以
 *     全局 `if (ANESTHESIA_USE_MOCK) return null` 门控（src/services/anesthesia/anesthesiaRecordHydrate.ts）。
 *     而当前 opt-in 配置下 VITE_ANESTHESIA_USE_MOCK 恒为 true（=「mock 为基线、按模块 opt-in 走真」），
 *     故这两条路径在浏览器里**恒 skip getRecordDetail** —— getRecordDetail 不经浏览器 UI 触发（非失败）。
 *   - 因此 getRecordDetail 的**权威**回读证据 = 3a 集成测试（src/api/anesthesiaRecord.real.integration.test.ts，6/6）
 *     与 3b-curl（saveRecord→pushBatch→getRecordDetail→delete→void 全往返）。本浏览器冒烟只验「live 管线可达」。
 *   - 病例表头（getOperationInfo / 工作台聚合）为真链路，记录单渲染真实患者数据即证明真 API 链路在浏览器内工作。
 *   - pushBatch / 用药编辑 UI 自动化易碎，留手动验证（见文档 T3.2~T3.4）。
 * 来源计划：.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md（round 3）。
 */

// round 1 联调已确认的真实排班 operationId（稳定种子：腹腔镜下胃癌根治术 / A1 / 患者「刘玉学」）。
const REAL_OPERATION_ID = '202506080000146863';
const REAL_PATIENT_NAME = '刘玉学';

test.describe('T01 第三轮：anesthesiaRecord + anesthesiaSync 走真（浏览器 live 冒烟）', () => {
  test('真实病例记录单：真鉴权 + 真病例数据渲染 + 同步服务活跃', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    await page.goto(`/surgery/record/${REAL_OPERATION_ID}`, { waitUntil: 'domcontentloaded' });

    // 1) 记录单工作台挂载
    await expect(page.locator('.anesthesia-record-workstation')).toBeVisible({ timeout: 30_000 });

    // 2) 真实病例数据渲染（患者姓名来自真链路 getOperationInfo / 工作台聚合，非 mock）
    await expect(page.getByText(REAL_PATIENT_NAME).first()).toBeVisible({ timeout: 20_000 });

    // 3) 同步服务活跃：同步状态摘要可见（pushBatch 后台轮询管线在真 sync 下运行）
    await expect(page.locator('[aria-label="同步状态摘要"]').first()).toBeVisible({ timeout: 15_000 });

    // 4) best-effort：若后台同步服务触发 pushBatch（IndexedDB 队列→真 pushBatch），断言 code:0
    const isPushBatch = postOnPathname('/anesthesiaSync/pushBatch');
    const pushBatch = await Promise.race([
      page
        .waitForResponse((r) => isPushBatch(r) && r.status() === 200, { timeout: 12_000 })
        .then(async (r) => ({ resp: r, ok: true as const }))
        .catch(() => ({ resp: null, ok: false as const })),
      page.waitForTimeout(12_000).then(() => ({ resp: null, ok: false as const })),
    ]);
    if (pushBatch.ok && pushBatch.resp) {
      const b = await pushBatch.resp.json();
      // 仅在真触发时软断言；未触发（队列空）不算失败
      expect(b.code).toBe(0);
    }

    // 5) 页面未被鉴权踢回登录（live 管线在有效 token 下工作）
    await expect(page).not.toHaveURL(/\/login/);
  });
});
