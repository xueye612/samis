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
- **2026-07-08 浏览器可用性缺陷簇修复（T21/T23/T28）**（来源计划 `.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md`）：
  - **T21 token 竞态**：`main.ts` 将 `restoreSessionIfPresent()` 提到 `bootstrapAnesthesiaLocalPersistence()` 之前（刷新页 saved-session 有 token 再加载远程目录）；`authService.loginWithCredentials` 在 `setSamisSession` 后 fire-and-forget 触发 `loadSamisBaseCatalog()`（fresh 登录重载 dict/room/operationInfo 目录，绕过 bootstrap guard）。修复前引导期 catalog GET 全 400（pre-token），登录后 guard 不再重发。
  - **T23 record 回读门控**：`anesthesiaRecordHydrate.ts` 的 `hydrateCaseFromServer`/`reloadCaseFromServer` 门控由全局 `ANESTHESIA_USE_MOCK` 改为 `!useRealAnesthesiaRecord()`（import 同步替换）。修复前 opt-in real 下 `ANESTHESIA_USE_MOCK` 恒 true → 这两条恒 skip `getRecordDetail`；record opted-in 时开记录单/重载现发 `getRecordDetail` 并聚合回读（失败仍降级本地不崩）。
  - **T28 质控面板接后端**：`qualityAggregatorService` 增 `loadIndicators`/`loadIndicatorDetail`（`shouldUseReal()` = `useRealQuality() && isSamisLoggedIn()` token-safe 范式）；store 增 `remoteIndicators`/`remoteIndicatorDetail` 状态 + `loadRemoteIndicators`/`loadRemoteIndicatorDetail` actions；`indicatorDetails`/`selectedIndicator` getter 真实模式优先后端（TS 计算降级 fallback）；`qualityCalculator` 增 `mergeRemoteIndicatorDetail`（**混合**：后端权威值+穿透 cases 覆盖，维度分析 client 侧从后端 cases 再派生，趋势/yoy/mom 维持演示，nullAnalysis 后端模式置空）；`QualityDashboard.vue` onMounted 拉取 indicators + 默认选中 detail、查询/切换指标触发重拉、真实模式展示"真实数据"横幅。TS `qualityCalculator` 保留为 mock/失败 fallback，mock 模式行为不变。

## 接口接入状态（2026-07-04）

完整接口清单、数据要求、测试引用与缺口说明已迁移到 `docs/05_api/api-integration-status.md`。

| 类型 | 接口 | 状态 |
|---|---|---|
| 真实可切换 | `admin/login`、`adminUser/getAdminUserInfo`、`user/getLoginUser` | 已实现；用户接口按 Apifox 顺序 fallback |
| 真实可切换 | `operationInfo/getOperationList`（含 `operationRoom`）、`getOperationInfo` | 已实现，默认 mock |
| 真实可切换 | `getNursePbList`（`startTime`+`endTime`）、`saveNursePb`、`updateNumberOfStations`、`updateOperationInfo`（form） | 已实现，默认 mock |
| 真实可切换 | `room/getRoomList`、`getRoomGroupList` | 已实现，默认 mock |
| 真实可切换 | `anesthesiaDict/*`（药品/模板/字典项/液体/血制品） | 已实现；`VITE_USE_REAL_ANESTHESIA_DICT`；POST 为 form-urlencoded |
| 真实可切换（Slice 3a） | `anesthesiaRecord/getRecordDetail`、`saveRecord`、`lockRecord`、`voidRecord` | **后端已落地**，`VITE_USE_REAL_ANESTHESIA_RECORD=true` 走真（信封 `code===0/message/data` 兼容，`unwrapSamisResponse` + `readSamisResponseMessage` 已覆盖）；真实链路集成测试 `src/api/anesthesiaRecord.real.integration.test.ts`（默认 skip）。**第三轮联调通过（2026-07-07）：3a 集成测试 6/6 全绿；3b-curl `saveRecord` 建主表→`getRecordDetail` 聚合回读闭环**（详见 `联调日志.md`「第三轮联调结论」）。**【发现】浏览器 hydrate/reload 以全局 `ANESTHESIA_USE_MOCK` 门控 skip getRecordDetail，不经浏览器 UI 触发**（见 T23） |
| 真实可切换（Slice 3b） | `anesthesiaSync/pushBatch`、`getSyncStatus`、`getPendingCount`、`confirmBatch` | **后端已落地**（单端点按 `entityType` 分发到处理器 + 幂等 + 版本 + 冲突）；`VITE_USE_REAL_ANESTHESIA_SYNC=true` 走真，默认 mock。读仍 local-first（R1）。**第三轮联调通过（2026-07-07）：3b-curl medication 全往返（create→getRecordDetail 聚合→delete→voidRecord 清理）7/7 断言通过**；getSyncStatus/getPendingCount/confirmBatch 各 `code:0`（pendingCount 后端恒 0，非同步证据） |
| 真实可切换（Slice 3c） | `pushBatch` 扩 `fluid`/`transfusion`/`io_record`/`lab_result` 4 处理器；`anesthesiaRecord/getPrintSnapshot` 打印追溯 | **前后端同步落地**：输液/输血/出入量/检验编辑点经 pushBatch 落库（按 `FluidRecord.category==='血液制品'` 区分 fluid/transfusion）；打印/锁定入队不可变 snapshot（`immutable=1`、`snapshot_no` 递增不覆盖），`getPrintSnapshot` 取最新打印快照。新增表 `anes_fluid`/`anes_transfusion`/`anes_io_record`/`anes_lab_result`；snapshot 补 `snapshot_no/printed_at/operator/immutable` |
| 真实可切换 | `anesthesiaDevice/*` | API wrapper + mock 已补齐；Slice 3d 后端落地：device 原始写入走 pushBatch（`entityType=monitor_raw/ventilator_raw`，统一落 `anes_device_raw_message`，追加幂等无冲突）；`getLatestDeviceData` 真实读（取该手术最新 monitor/ventilator 行）。前端按 `useRealDevice()` 门控入队（默认 false，置 `VITE_USE_REAL_DEVICE=true` 即同步） |
| 真实可切换（Slice 4） | `pacu/list`、`getById`、`admit`、`update`、`transferOut` | **前后端同步落地**：PACU 独立 REST CRUD（非 pushBatch 本地优先）。后端新增表 `anes_pacu_record` + domain（model/repository/service/validate）+ 控制器 `Pacu`；Service 层校验"同 case 单活跃单"（admit→1003，transferOut→1004；转出后允许同 case 再入）。前端 `src/api/pacu.ts` + adapter + `pacuService` + store actions（`loadRemotePacuList`/`admitPacu`/`updatePacuRecord`/`transferOutPacu`）；PacuReceive 入室接真实、PacuAlerts 从真实派生（低体温/超时/Aldrete<9/SpO2<90，阈值常量 `src/config/pacuThresholds.ts` 对齐质控指标）。`VITE_USE_REAL_PACU=true` 走真，默认 mock。患者信息前端补传（plan R1）；PACU 不回写 anes_record（R5） |
| 真实可切换（Slice 4b） | `pacu/bookingList`、`bookingGetById`、`bookingCreate`、`bookingUpdate`、`bookingCancel` | **前后端同步落地**：PACU 床位预约独立 REST CRUD。后端新增表 `anes_pacu_booking` + repository/model/validate；booking 方法并入 `PacuService`，控制器 `Pacu@bookingXxx`。admit 联动：`PacuService::admit` 成功后调 `markBookingReceived(caseId)`（按 caseId 严格匹配 + status=待接收 → 已接收；无匹配静默跳过，fire-and-forget）。前端 `src/api/pacu.ts` 增 booking 方法 + adapter（`mapPacuBookingToBooking` 等）+ `pacuService`（`loadRemotePacuBookings`/`createPacuBookingRemote`/`updatePacuBookingRemote`/`cancelPacuBookingRemote`）+ store actions（`loadRemotePacuBookings`/`createPacuBooking`/`updatePacuBooking`/`cancelPacuBooking`，复用 `useRealPacu()` 开关）；`PacuBooking.vue` 接真实 + 增改取消弹窗闭环；admit action 成功后重拉预约同步状态。床位（PacuBed）无独立表，`bedId` 为自由字符串字段不校验（R1/R3）；不设预约冲突校验（R1）。`VITE_USE_REAL_PACU=true` 走真，默认 mock。mock router 补 booking 分支保持稳定 |
| 真实可切换（Slice 6a） | `quality/indicators`、`quality/indicatorDetail`、`quality/report` | **前后端同步落地（服务端权威计算）**：26 项麻醉质控指标跨 6 类（structure 3 / process 6 / outcome 7 / pacu 4 / postoperative 5 / obstetric 1）。决策：质控为监管上报输出，须权威/一致/可导出 → 服务端计算。后端新增 domain `quality/{config,repository,service}`：`QualityIndicatorConfig`（26 定义，对齐 `qualityIndicators.ts`）、`QualityQueryRepository`（跨表聚合：anes_record.case_payload + anes_staff + anes_timeline_event + anes_vital_sign[TEMP] + anes_fluid/anes_transfusion + anes_pacu_record + anes_post_followup）、`QualityCalculatorService`（逐指标公式对齐 TS `qualityCalculator`，规范化 case_payload→CaseRow 与 `clinicalSync.syncCaseToDataset` 一致）、`QualityService`（indicators/indicatorDetail/report 聚合）；控制器 `Quality` + 路由组 `quality`（PcAuth+ApiRequestLog）。无新业务表（计算型）。过滤：startDate/endDate|startMonth/endMonth、doctorId、department、locationType、roomId、category。前端 `src/api/quality.ts` + 开关 `useRealQuality()`（`VITE_USE_REAL_QUALITY=true`，默认 mock）；QualityReports 页接真实月度报表（按月聚合 + 分类小计）；TS `qualityCalculator` 保留为 mock 兜底 + parity 基准（`src/services/quality.qualityParity.test.ts` 锁定 26 指标 rate/numerator/denominator 自洽）。**QualityDashboard onMounted/查询/切换指标现已接后端 indicators/indicatorDetail（T28，2026-07-08）**；趋势仍为模拟（R4），真实历史快照表 `anes_quality_snapshot` 留后续 |
| 真实可切换（Slice 6c） | `pacu/bed*`、`quality/hypothermiaCases`、`quality/adverseEvents`、`quality/check*`、`QualityReports` 真实导出 | **前后端同步落地（Slice 6 收尾）**。A=PACU 床位：新表 `anes_pacu_bed`（UNIQUE(room_id,bed_no)，状态 空闲/占用/预留/维护）+ `PacuService` 床位 CRUD/`bedStats`/`bedAllGrouped`；`admit(bedId)`/`transferOut` 与床位状态翻转**同事务原子**（R1）；bedStats 明确分类（预留/维护不计入 used/free，R2）。B=质控专项/导出/抽查：新表 `anes_quality_check`（人工抽查活动，独立于 6b 规则缺陷 R6）；聚合端点 `hypothermiaCases`（event 低体温 ∪ TEMP<36 ∪ pacu first_temp<36）+ `adverseEvents`（12 类 isQualityEvent，与 6b 同源 R4）；抽查 CRUD。前端：`src/api/pacu.ts` 床位方法 + `src/api/quality.ts` 聚合/抽查方法 + adapter（`mapBedGroupedToRooms`/`mapBedStats`）；store `loadRemotePacuBeds`（真实模式覆盖 `pacuRooms`+`remoteBedStats`，`buildPacuRooms` rebuild 门控 `!useRealPacu()`）+ 床位 getter 扩 reserved/maintenance；`loadRemoteHypothermiaCases`/`loadRemoteAdverseEvents`/抽查 CRUD actions；`QualityHypothermia`/`QualityAdverseEvents`/`QualityOverview` 接真实（onMounted 按 `useRealQuality()` 拉取）；`QualityReports` 移除导出 `v-if="!useReal"` 门控，真实模式从后端 `getIndicators` 生成 CSV（复用 `exportQualityCsv`）。mock 路由补床位/聚合/抽查分支（mock 模式稳定）。curl 验收：bed CRUD + bedStats + admit→占用/transferOut→空闲事务联动 + hypothermia/adverseEvents + check CRUD 闭环均通过 |
| 真实可切换（Slice 7a+7b） | `preoperative/request*`、`consultation*`、`examReview*`、`consent*`、`safetyCheck*` | **前后端同步落地（术前管理闭环上游入口）**。专用 REST CRUD（同 PACU/术后 风格），5 实体聚合一 Service。新表：`anes_preop_request`（以 operation_id 为键，一手术一申请）、`anes_preop_consultation`（一 case 多条）、`anes_preop_exam_review`（一 case 多条）、`anes_preop_consent`（1:1 per case）、`anes_preop_safety_check`（1:1 per case）。后端 `PreoperativeService`（5 实体）+ `Preoperative` 控制器 + 路由组 `preoperative`（PcAuth+ApiRequestLog）。**唯一性全部 Service 层判重**（`findActiveByOperationId`/`findActiveByCaseId`+`whereNull('deleted_at')`，无 DB UNIQUE，软删 NULL≠NULL 同 PACU admit，R2）：request 同 operation_id→1301；receive 非待接收→1302/cancel 已取消→1302；consent 同 case→1401、已提交再 update→1402、submit 已提交→1402；safetyCheck 同 case→1501。状态联动：request 待接收→receive→已排班（+receivedAt/By）/cancel→已取消；consent 草稿→submit→已提交（+signedAt）；safetyCheck 三查全勾→已完成。接收仅状态联动不创建记录单（R4）。前端：`src/api/preoperative.ts`（5 实体 list/get/create/update + request receive/cancel + consent submit/getByCaseId + safetyCheck getByCaseId）+ `preoperativeService`（map/build/load/upsert/动作，枚举收敛）+ store `loadRemotePreop*`/`receive`/`cancel`/`submit`/`upsert` actions + 开关 `useRealPreoperative()`（`VITE_USE_REAL_PREOPERATIVE=true`，默认 mock）+ `SamisApiModule='preoperative'` + mock 路由 5 实体分支；5 页接真实（Requests 接收/取消、Consultation/ExamReview 新增/编辑表单、Consent 按病例读→无则建草稿→勾签名位 update→submit、SafetyCheck 三查 update）。签名位为布尔标记非电子签影像（R5）。mock 路由稳定；curl 验收 5 实体状态流转闭环通过 |

## 真实链路联调状态（T01，6 轮全部走真）

> 各模块逐轮联调结论（配置落地、curl 矩阵、发现的非阻塞缺陷、回滚步骤）已迁至 [`docs/04_delivery/联调日志.md`](./联调日志.md)。
> 接口实现/字段细节见上方「接口接入状态」与 [`docs/05_api/api-integration-status.md`](../05_api/api-integration-status.md)。统一走真开关 = `samisWeb/.env.local` 的 `VITE_USE_REAL_*`（`ANESTHESIA_USE_MOCK=true` 基线下按模块 opt-in）；改 `.env*` 后须 `docker restart samis-web`。

| 模块 | 走真开关 | 联调状态 | 轮次 | 权威证据 |
|---|---|---|---|---|
| auth | `VITE_USE_REAL_AUTH` | ✅ 走真 | 第 1 轮 | `e2e/real-integration.spec.ts` 4/4 + curl |
| operationInfo / room | `VITE_USE_REAL_OPERATION_INFO` / `_ROOM` | ✅ 走真 | 第 1 轮 | 浏览器 e2e + curl |
| anesthesiaDict | `VITE_USE_REAL_ANESTHESIA_DICT` | ✅ 走真 | 第 2 轮 | `e2e/real-integration-dict.spec.ts` 2/2 + curl 32/32 |
| anesthesiaRecord + anesthesiaSync | `VITE_USE_REAL_ANESTHESIA_RECORD` + `_SYNC` | ✅ 走真 | 第 3 轮 | 集成测试 6/6 + curl 7/7；浏览器 hydrate/reload 门控已改 `!useRealAnesthesiaRecord()`（T23，2026-07-08 修复） |
| pacu + postoperative + preoperative | `VITE_USE_REAL_PACU` / `_POSTOPERATIVE` / `_PREOPERATIVE` | ✅ 走真 | 第 4 轮 | curl 93/93 + `e2e/real-integration-clinical.spec.ts` 3/3 |
| quality | `VITE_USE_REAL_QUALITY` | ✅ 走真 | 第 5 轮 | curl（5 聚合读 + check CRUD + 合成病例计算）+ `e2e/real-integration-quality.spec.ts` 5/5（T28 增 indicators/indicatorDetail 用例） |
| admin（系统管理） | `VITE_USE_REAL_ADMIN` | ✅ 走真 | 第 6 轮 | curl（3 读 + create→update→delete 往返，含后端 deleteUser 500 修复）+ `e2e/real-integration-admin.spec.ts` 2/2 PASS（T04 用户全CRUD + T05 角色/菜单只读） |
| device | `VITE_USE_REAL_DEVICE` | ⚪ 后端落地、前端默认 mock（opt-in） | — | 后端 pushBatch 处理器已落地；置 `true` 即同步 |

> 已知非阻塞缺陷登记见 [`docs/AI-待开发任务清单.md`](../AI-待开发任务清单.md)：dict 分页 `page_size` 被忽略、vital `short_code` NOT NULL、校验器层 `500` vs service 业务码（错误码分层说明）。（T21 token 竞态 / T23 record hydrate 门控 / T28 质控面板接后端 已于 2026-07-08 修复，详见上方「真实完成（前端）」。）

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

- `anesthesiaRecord` / `anesthesiaSync` / `anesthesiaDevice` / `anesthesiaDict`（`src/services/mock/samisMockRouter.ts`）——其中 `anesthesiaDict` 已于 T01 第二轮（2026-07-07）真链路联调通过，`VITE_USE_REAL_ANESTHESIA_DICT=true` 时走真，关时回此 mock 路由
- pushBatch / batchPushMonitorData / batchPushVentilatorData 成功响应
- server_id 为前端 mock 自增，非数据库真实 ID
- operationInfo / room / auth 在对应 `VITE_USE_REAL_*=false` 时仍走同一 mock 路由

## 等待 Apifox / 后端补充

- ~~`anesthesiaRecord/saveRecord`、`getRecordDetail`、`lockRecord`、`voidRecord`~~ **Slice 3a 已落地**（主表 `anes_record` + 生命周期）；~~其余记录单子表 CRUD（batchSave*）与 `saveSnapshot` 待 3c~~ **Slice 3c 已落地**：输液/输血/出入量/检验 4 子表生产者接入 + snapshot 打印追溯（`getPrintSnapshot`）
- ~~`anesthesiaSync/pushBatch` 真实幂等与冲突（Slice 3b）~~ **Slice 3b 已落地**（pushBatch 同步引擎 + record/medication/timeline_event/vital_sign/snapshot 5 处理器；子表 `anes_medication`/`anes_timeline_event`/`anes_vital_sign`/`anes_record_snapshot`；幂等 `(operation_id,local_id[,metric])` + 版本 `sync_version` + 冲突 `version_conflict`/`server_locked`；状态端点 getSyncStatus/getPendingCount/confirmBatch）。`VITE_USE_REAL_ANESTHESIA_SYNC=true` 走真；device 入队按 `useRealDevice()` 门控（默认 false，Slice 3d 已落地后端处理器，置 true 即同步）。**Slice 3c 扩 4 处理器**（fluid/transfusion/io_record/lab_result）+ snapshot 打印追溯（print/lock 置 immutable=1、snapshot_no 递增）
- ~~`anesthesiaDevice/batchPush*` 真实入库（Slice 3d）~~ **Slice 3d 已落地**：device 原始写入经 pushBatch（`entityType=monitor_raw/ventilator_raw`）分发，统一落 `anes_device_raw_message` 单表（按 `device_type` 区分），追加幂等（`(operation_id, local_id)` 重复 → success 不重复插，无版本/冲突）；`getLatestDeviceData` 真实读取该手术最新 monitor/ventilator 行。前端门控 `useRealDevice()`（默认 false）保留，置 `VITE_USE_REAL_DEVICE=true` 即同步。独立 `batchPushMonitorData/batchPushVentilatorData` 端点暂缓（真实硬件直连摄入属未来）。新增表 `anes_device_raw_message`
- ~~`anesthesiaSync/resolveConflict` + 冲突精细化（Slice 3e）~~ **Slice 3e 已落地**：pushBatch 产出全量 conflictType（新增 `record_printed`/`vital_corrected`/`deleted_remote`/`duplicate_time_point`，`field_conflict` 待产出）；`resolveConflict` 端点 force-apply（keep_local_correction/manual_merge/retry_sync）绕过版本/锁定校验强制 upsert + sync_version+1（子表复活已软删行）、use_server/ignore_local 仅审计、幂等 `conflict_id`、写审计表 `anes_sync_conflict_resolution`。前端：扩 `SyncConflictType` 联合 + 全量映射/标签；`resolveSyncConflict` 在 `useRealAnesthesiaSync()` 时 best-effort 调后端（失败仅 warn）；`SyncConflictPanel` 按 conflictType 收敛可见 action。新增表 `anes_sync_conflict_resolution`
- `anesthesiaDict/get*` 与药品字典正式字段

## 历史参考（非主接口）

- `/anesthesia/records` legacy mock 路由仍保留
- shuhu-surgianes 中 `/api/anes/*` 为护理后端规划（非 samisweb 主链路）
