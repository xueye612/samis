# current-completed-features（samisweb 麻醉记录单增量）

更新时间：2026-06-02（接口接入）

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
- **2026-06-02 监护会话归属**：会话绑定记录单；刷新/切换患者不串写设备数据；停止 vs 撤销监护。见 `docs/02_specs/麻醉记录单.md`「监护会话归属」
- **2026-06-02 时间轴起点**：未入室用预计开台、已入室用入室时间，整点/半点取整；入室后自动定位页码；数据时间戳不重写
- **2026-06-02 抢救模式时间轴/分页同步**：进入抢救 → 1 分钟小格 + `syncRecordDocument` 重建分页 + 跳转 `rescue.startTime` 页；退出抢救 → 5 分钟小格 + 跳转 `rescue.endTime` 页 + 设备模拟自动恢复 normal（否则右侧面板提示）；`useRecordCoordinates` 在 `minorGridMinutes` 与当前刻度不一致时改用实时分页。见 `docs/02_specs/麻醉记录单.md` 变更记录
- **2026-06-02 用药显示规则修正**：是否画线由 `mode` / `start_time` / `end_time` 决定；是否进入特殊用药区由 `is_special` 决定；特殊持续用药可同时画线并进入特殊用药说明区；特殊单次用药仅时间点编号与说明。见 `docs/02_specs/麻醉记录单用药显示规则.md`、`src/services/medicationDisplayRules.ts`
- **2026-06-02 特殊用药判断与字典**：药品名称只作默认推荐，最终以 `is_special` 为准；字典新增 `default_is_special`、`special_category`、`special_reason_template`、`allow_manual_override` 等；选药弹窗区分系统推荐与医生确认；`mode` 仅决定时间轴展示，`is_special` 仅决定编号与下方说明区。见 `docs/02_specs/麻醉药品字典接口要求.md`、`src/services/drugDictRecommend.ts`
- **2026-06-02 用药记录弹窗临床化**：「用药数据」改为「用药记录」；按药品选择、给药方式、给药明细、特殊用药记录分区；给药方式为单次给药/追加一次/持续给药；底部短规则条；`mode` 与 `is_special` 业务规则不变
- **2026-06-02 真实接口接入（Phase 1）**：`samisHttpClient` + 模块 mock 开关；`operationInfo` / `room` / `auth` API 与 adapter；store `loadRemoteOperationList` / `loadRoomCatalog` / `hydrateCaseFromOperationInfo`；手术排班保存走 `updateOperationInfo`（不含麻醉记录单临床数据）
- **2026-06-02 登录与排班 UI**：Login 手术部/手术间/redirect/顶栏用户；排班筛选、护理排班合并、台次批量保存、麻醉记录单跳转
- **2026-06-02 Apifox 联调对齐**：列表 query `operationRoom`；排班 `startTime`/`endTime`；POST 写回 form-urlencoded + `saveNursePb.data`；更新通知单含 `OPERATINGROOM_CODE`/`NUMBER_OF_STATIONS`；当前用户 fallback `adminUser/getAdminUserInfo`

## 接口接入状态（2026-06-09）

完整接口清单、数据要求、测试引用与缺口说明已迁移到 `docs/05_api/api-integration-status.md`。

| 类型 | 接口 | 状态 |
|---|---|---|
| 真实可切换 | `admin/login`、`adminUser/getAdminUserInfo`、`user/getLoginUser` | 已实现；用户接口按 Apifox 顺序 fallback |
| 真实可切换 | `operationInfo/getOperationList`（含 `operationRoom`）、`getOperationInfo` | 已实现，默认 mock |
| 真实可切换 | `getNursePbList`（`startTime`+`endTime`）、`saveNursePb`、`updateNumberOfStations`、`updateOperationInfo`（form） | 已实现，默认 mock |
| 真实可切换 | `room/getRoomList`、`getRoomGroupList` | 已实现，默认 mock |
| 真实可切换 | `anesthesiaDict/*`（药品/模板/字典项/液体/血制品） | 已实现；`VITE_USE_REAL_ANESTHESIA_DICT`；POST 为 form-urlencoded |
| 真实可切换 | `anesthesiaRecord/*`、`anesthesiaSync/*`、`anesthesiaDevice/*` | API wrapper + mock 已补齐；字段以联调文档和新清单为准 |

代码入口：`.env.example`、`src/config/apiFlags.ts`、`src/api/samisClient.ts`、`src/services/anesthesia/operationInfoService.ts`。

## 手动验收要点

**登录 UI**

1. 登录页校验、手术部/手术间上下文、登录后 `fetchCurrentUser` 与 `redirect` 回跳。
2. 顶栏显示用户姓名；退出清除 session。

**排班 UI**

1. 日期/手术间/姓名/住院号筛选与刷新；护理排班模式；台次批量保存；麻醉记录单入口。
2. 值班排班页展示 `getNursePbList` 摘要（query 为 `startTime`/`endTime` 同日）。
3. 排班保存 Network：`Content-Type` 为 `application/x-www-form-urlencoded`；`saveNursePb` body 含 `data=[...]`。

**记录单与接口**

1. 设 `VITE_USE_REAL_OPERATION_INFO=true` 并登录 → 排班/记录单列表应请求 `getOperationList`。
2. 打开记录单 → `getOperationInfo`，表头来自通知单；IndexedDB `snapshots` 有数据；锁定/打印后刷新不覆盖 snapshot。
3. 设 `VITE_USE_REAL_ROOM=true` → `getRoomList` 更新手术间筛选。
4. 录入用药/体征后刷新 → 本地 clinical 数据仍在；设备 mock 不改患者信息。

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

- `anesthesiaRecord` / `anesthesiaSync` / `anesthesiaDevice` / `anesthesiaDict`（`src/services/mock/samisMockRouter.ts`）
- pushBatch / batchPushMonitorData / batchPushVentilatorData 成功响应
- server_id 为前端 mock 自增，非数据库真实 ID
- operationInfo / room / auth 在对应 `VITE_USE_REAL_*=false` 时仍走同一 mock 路由

## 等待 Apifox / 后端补充

- `anesthesiaRecord/saveRecord`、`getRecordDetail`、`batchSaveVitalSigns` 等记录单 CRUD
- `anesthesiaSync/pushBatch` 真实幂等与冲突
- `anesthesiaDevice/batchPush*` 真实入库
- `anesthesiaDict/get*` 与药品字典正式字段

## 历史参考（非主接口）

- `/anesthesia/records` legacy mock 路由仍保留
- shuhu-surgianes 中 `/api/anes/*` 为护理后端规划（非 samisweb 主链路）
