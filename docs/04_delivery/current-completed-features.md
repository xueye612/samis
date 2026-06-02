# current-completed-features（samisweb 麻醉记录单增量）

更新时间：2026-06-02

## 真实完成（前端）

- IndexedDB 本地持久化（records + 子表 + settings）
- 刷新后恢复：用药/液体/输血/事件/生命体征/页码/锁定状态
- 自动保存（防抖 1s）与「本地已保存」提示
- 上传队列 sync_queue 生成与 pending 计数
- 在线 mock 批量同步 pushBatch
- 断网本地保存 + 在线补传（navigator.onLine）
- 失败重试（指数退避）
- **同步冲突处理**：sync_conflicts 表、版本/锁定/修正冲突检测、冲突面板与 5 种处理策略
- 监护仪/呼吸机 mock 采集与趋势图刷新
- 记录单 UI 结构未重写
- **2026-06-02 修复**：状态提示移至固定 32px 状态栏，不遮挡打印区
- **2026-06-02 修复**：hydration 门控 + 骨架屏，刷新后减少布局抖动与 seed 闪变
- **2026-06-02 收尾**：自适应 hydration 骨架高度（`--record-sheet-skeleton-height`）
- **2026-06-02 收尾**：全局 bootstrap 门控（`AppLayout` + 路由守卫 + `useAnesthesiaPersistenceGate`）
- **2026-06-02 收尾**：本地清理 `anesthesiaLocalCleanupService`（raw / success 队列，启动低频 + 手动 API）
- **2026-06-02 收尾**：Playwright E2E（`e2e/anesthesia-*.spec.ts`）
- **2026-06-02 Phase7**：设备模拟三模式（正常/异常/抢救）
- **2026-06-02 Phase7**：跨页 vital 半开区间页边界
- **2026-06-02 Phase7**：纸面空字段 + 右侧待完善列表
- **2026-06-02 Phase7**：冲突 E2E（注入测试冲突，不再 skip）
- **2026-06-02 UI 收口**：顶部 `RecordStatusBar` 仅全局摘要；右侧「设备与同步」紧凑列表；开发测试按钮仅 DEV+mock；打印隐藏全部运行态 UI
- **2026-06-02 用药显示规则修正**：是否画线由 `mode` / `start_time` / `end_time` 决定；是否进入特殊用药区由 `is_special` 决定；特殊持续用药可同时画线并进入特殊用药说明区；特殊单次用药仅时间点编号与说明。见 `docs/02_specs/麻醉记录单用药显示规则.md`、`src/services/medicationDisplayRules.ts`
- **2026-06-02 特殊用药判断与字典**：药品名称只作默认推荐，最终以 `is_special` 为准；字典新增 `default_is_special`、`special_category`、`special_reason_template`、`allow_manual_override` 等；选药弹窗区分系统推荐与医生确认；`mode` 仅决定时间轴展示，`is_special` 仅决定编号与下方说明区。见 `docs/02_specs/麻醉药品字典接口要求.md`、`src/services/drugDictRecommend.ts`
- **2026-06-02 用药记录弹窗临床化**：「用药数据」改为「用药记录」；按药品选择、给药方式、给药明细、特殊用药记录分区；给药方式为单次给药/追加一次/持续给药；底部短规则条；`mode` 与 `is_special` 业务规则不变

## 清理策略（已实现）

| 能力 | 方式 |
|---|---|
| 清理已同步旧 raw | `runConservativeLocalCleanup()` / 启动后每 6h |
| 清理旧 success 队列 | 同上 |
| 统计 | `getLocalStorageStats()` |
| UI 入口 | 暂无独立按钮，仅服务层手动调用 |

## Playwright

- 配置：`playwright.config.ts`（复用系统 Chrome）
- 命令：`npm run test:e2e`
- 用例：
  - `e2e/anesthesia-persistence.spec.ts` — 刷新恢复
  - `e2e/anesthesia-device-mock.spec.ts` — 设备 mock
  - `e2e/anesthesia-print-layout.spec.ts` — 状态栏/打印预览/冲突 chip
  - `e2e/anesthesia-conflict-cross-page.spec.ts` — 冲突处理、跨页 vital

## E2E 状态

| 用例 | 状态 |
|---|---|
| 刷新持久化 | 已完成 |
| 设备 mock | 已完成 |
| 打印态隐藏编辑痕迹 | 已完成 |
| 冲突流程 | 已完成（DEV + mock 注入按钮；E2E hook `__samisAnesthesiaE2E`） |
| 跨页 vital 边界 | 基础用例（seed + 翻页） |

## mock 完成（非真实后端）

- 全部 `/api-samis/pc/v1/anesthesia*` 接口（`backendFetch` mock）
- operationInfo/getOperationInfo mock 返回
- pushBatch / batchPushMonitorData / batchPushVentilatorData 成功响应
- server_id 为前端 mock 自增，非数据库真实 ID

## 等待后端

- 真实 TP6/sam is 控制器实现
- 真实 OceanBase 写入与幂等
- Token/权限与护理系统统一鉴权
- 关闭 mock：`VITE_ANESTHESIA_USE_MOCK=false` 并接入真实 HTTP

## 历史参考（非主接口）

- `/anesthesia/records` legacy mock 路由仍保留
- shuhu-surgianes 中 `/api/anes/*` 为护理后端规划（非 samisweb 主链路）
