# 手术麻醉管理系统 Web 前端原型

本项目是手术麻醉管理系统的前端原型，需求依据归档在 `docs/麻醉管理系统_Web原型与质控指标设计文档.md`。当前阶段只做前端，不接真实后端 API，所有业务数据来自本地 Mock 数据和 Pinia 状态管理模拟。

## 技术栈

- Vue 3 + TypeScript + Vite
- Arco Design Vue
- ECharts
- Pinia
- Vue Router
- dayjs
- Vitest
- Playwright

## 安装与启动

```bash
npm install
npm run dev -- --port 5174
```

浏览器访问：

```text
http://127.0.0.1:5174/
```

构建与单元测试：

```bash
npm test
npm run build
```

## Playwright 冒烟与截图

首次使用 Playwright 前安装 Chromium 浏览器：

```bash
npx playwright install chromium
```

如果本机已经安装 Chrome 或 Edge，`playwright.config.ts` 会在 Playwright 托管 Chromium 不可用时自动使用系统 Chromium 内核浏览器作为 fallback；CI 环境仍建议显式执行上面的安装命令。

运行核心页面冒烟测试：

```bash
npm run test:smoke
```

生成核心页面截图：

```bash
npm run test:screenshot
```

运行全部 e2e 测试或打开 UI 模式：

```bash
npm run test:e2e
npm run test:e2e:ui
```

Playwright 会通过 `playwright.config.ts` 自动启动 `npm run dev -- --port 5173`，测试基准地址为 `http://localhost:5173`。截图保存到 `test-results/screenshots`。如果测试失败，可查看终端输出，或打开 HTML 报告：

```bash
npx playwright show-report
```

当前 e2e 覆盖登录页、麻醉工作台、手术排班、术前访视、麻醉记录单、PACU 列表、PACU 恢复记录、术后随访、麻醉质控看板、质控缺陷列表。若后续某个路由被移除或尚未实现，测试会在运行时标记为跳过。

## 当前页面范围

- 登录页：模拟账号入口，进入工作台。
- 工作台：今日手术、手术间状态、质控预警、待办提醒。
- 手术麻醉：手术排班、术前访视、麻醉记录单、患者麻醉全过程详情。
- PACU 恢复室：PACU 患者列表、恢复记录、转出占位管理。
- 术后管理：术后镇痛、全麻术后、区域阻滞随访。
- 麻醉质控：26 项麻醉专业医疗质量控制指标、指标详情分析、病例穿透抽屉。
- 质控缺陷：自动识别 Mock 数据中的质控缺陷，并展示整改闭环字段。
- 基础配置 / 系统管理：手术间、药品、规则、角色、锁定策略等模拟配置。

## Mock 场景

- OR-01：腹腔镜胆囊切除，全麻，正常完成，记录单已锁定。
- OR-02：全髋关节置换，全麻，预计超过 120 分钟但未记录体温，连续泵入未停止。
- OR-03：腹腔镜子宫肌瘤剔除，全麻，出现低体温。
- OR-04：剖宫产，椎管内麻醉。
- OR-05：颅内占位切除，全麻，非计划转 ICU，特殊事件处理措施待补记。
- OR-06：无痛胃肠镜，手术室外麻醉，择期术前访视未完成并取消。
- PACU：至少 3 名患者，包含停留超过 2 小时、入室低体温、首次体温缺失样例。

## 关键文件

- `src/config/qualityIndicators.ts`：26 项质控指标统一配置。
- `src/mock/qualitySeed.ts`：质控与临床业务的归一化 Mock 数据集。
- `src/mock/anesthesiaCases.ts`：既有临床页面演示数据。
- `src/services/mockApi.ts`：本地 Mock API 边界。
- `src/services/qualityCalculator.ts`：指标计算服务。
- `src/services/qualityDefectRules.ts`：质控缺陷识别规则。
- `src/components/quality/`：质控指标列表、详情、趋势图、公式卡、穿透抽屉、缺陷表。
- `src/stores/anesthesia.ts`：Pinia 状态管理与模拟业务操作。
- `e2e/`：Playwright 冒烟测试与截图留档测试。
