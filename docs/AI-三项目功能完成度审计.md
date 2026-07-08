# 三项目功能完成度审计（AI 生成）

> 生成时间：2026-07-07
> 范围：`index`（后端，ThinkPHP 6 双应用）、`samisWeb`（麻醉前端，Vue3，本次重点）、`huliWeb`（护理前端，Vue2，只读参考）
> 方法：读取三仓库文档 → 扫描路由/控制器/store/api/页面代码 → 对照文档判断完成度
> 说明：本次为**只读审计**，未修改任何业务代码。

---

## 一、三仓库概览

| 仓库 | 角色 | 技术栈 | 地址 | 文档情况 |
|---|---|---|---|---|
| index | 后端（`app/huli` 护理 + `app/samis` 麻醉 双应用，共享 `app/shared`） | ThinkPHP 6 / PHP | http://192.168.10.178:8022/ | `doc/` 下 9 份 md + 多份 sql + `samis_apifox_openapi.json`，较完整 |
| samisWeb | 麻醉前端（本次重点） | Vue3 + TS + Vite + Arco + Pinia + ECharts + Playwright | http://192.168.10.178:9022/ | `docs/` 下结构化文档（`00_INDEX.md` 唯一索引），极完整 |
| huliWeb | 护理前端（只读参考） | Vue2 + VueRouter + Vuex + ElementUI 推测 | http://192.168.10.178:9021/ | **几乎无文档**（`README.md` 为空，仅 `src/view/README.md`） |

后端单仓承载双业务域，两库分离（`huli` 库 / `samis` 库），跨库走 `huli export`，规范见 `index/doc/samis_huli_跨库实现规范.md`。`operationInfo`/`room`/`department` 归 `huli`，`samis` 仅做适配。

> 注：`index/doc/项目布局分析.md`（2026-01-05）描述的是旧 `app/api/` 单应用规划，**与当前实际双应用结构不符**，仅作历史参考；以 `多应用改造方案.md` 与实际代码为准。

## 二、状态定义

| 状态 | 含义 |
|---|---|
| 已完成 | 有前端页面、有数据交互（store/api）、有保存/提交、有校验/测试或可验证路径，前后端真实链路均已落地 |
| 半完成 | 有页面或接口，但流程不完整（如仅 mock、无后端端点、前端未消费已有后端接口） |
| 只有框架 | 只有菜单/页面骨架/静态字段/mock 数据/空方法/TODO/未接接口 |
| 未开始 | 文档有要求，但代码里没有对应实现 |
| 不确定 | 找不到足够证据，需人工确认 |

## 三、功能完成度总表

> 编号采用 `模块-序号`。`前端位置`/`后端位置`均为相对仓库根的路径。

| 编号 | 功能模块 | 文档要求 | 前端位置 | 后端位置 | 当前状态 | 缺少细节 | 优先级 | 建议修改仓库 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| auth-1 | 登录 / 当前用户 | 登录、获取当前用户、退出 | `samisWeb/src/views/Login.vue`、`src/api/auth.ts`、`src/services/auth/` | `index/app/samis/api/controller/pc/AdminUser.php`（login/getAdminUserInfo）、`route/samis.php` | 已完成 | 真实链路默认关闭（`VITE_USE_REAL_AUTH=false`） | 高 | samisWeb/index | user/getLoginUser、getCurrentUser、adminUser/getAdminUserInfo 多 fallback 已实现 |
| op-1 | 手术通知单列表 / 详情 | 列表（日期/房间/患者筛选）、详情初始化记录单 | `samisWeb/src/views/SurgerySchedule.vue`、`src/api/operationInfo.ts`、`src/services/anesthesia/adapters/operationInfoAdapter.ts` | `index/.../OperationInfo.php`（getOperationInfoList/getOperationInfo） | 已完成 | 默认 mock | 高 | samisWeb/index | operationInfo 走 huli export；Apifox form-urlencoded 写回 |
| op-2 | 手术排班 / 台次 / 护理排班 | 排班保存、台次批量、值班排班 | `samisWeb/src/views/SurgerySchedule.vue`、`surgery/ScheduleDuty.vue` | `...OperationInfo.php`（saveNursePb/updateNumberOfStations/updateOperationInfo/getNursePbList） | 已完成 | 默认 mock；saveNursePb `data=JSON` | 高 | samisWeb/index | — |
| wb-1 | 今日麻醉工作台 | 今日手术/手术间状态/汇总/待办/无排班/紧急 | `samisWeb/src/views/workbench/*.vue`（5 页） | `...OperationInfo.php`（todayWorkbench 聚合端点） | 已完成 | 默认 mock；后端聚合已落地 | 中 | samisWeb/index | WorkbenchOverview 优先走 todayWorkbench |
| room-1 | 手术间 / 手术部 | 房间列表、房间组、维护 CRUD | `samisWeb/src/views/config/ConfigRooms.vue`、`src/api/room.ts` | `...Room.php`（10 端点含 roomCreate/Update/Delete/Group） | 已完成 | 写接口页面"预留"未启用；委托 huli room | 中 | samisWeb/index | room 归 huli，samis 适配 |
| dict-1 | 药品字典 | getDrugDict/save/disable/特殊用药推荐 | `samisWeb/src/views/config/ConfigDrugs.vue`、`src/api/anesthesiaDict.ts`、`src/services/anesthesia/adapters/anesthesiaDictAdapter.ts` | `...AnesDict.php`（~30 端点）、`app/samis/domain/dict/` | 已完成 | 默认 mock | 高 | samisWeb/index | 含 default_is_special/special_category 等推荐字段 |
| dict-2 | 模板 / 打印模板字典 | getTemplate/save/disable/field | `samisWeb/src/views/config/ConfigPrint.vue` | `...AnesDict.php`（getTemplate/Field 等） | 已完成 | templateField 仅空分页 mock，页面预留 | 中 | samisWeb/index | ConfigPrint 接真实模板 |
| dict-3 | 麻醉方式 / 字典分类项 | getDictCategory/getDictItem/save/disable | `samisWeb/src/views/config/ConfigMethods.vue` | `...AnesDict.php` | 已完成 | — | 中 | samisWeb/index | 含精确匹配 category_code |
| dict-4 | 液体 / 血制品字典 | getFluidDict/getBloodProductDict/save/disable | `samisWeb/src/views/config/ConfigFluids.vue` | `...AnesDict.php` | 已完成 | — | 中 | samisWeb/index | ConfigFluids 接真实 |
| dict-5 | 生命体征字典 | getVitalDict/save/disable | `samisWeb/src/views/config/ConfigVitals.vue` | `...AnesDict.php`、`app/samis/domain/dict/model/AnesVitalDict.php` | 已完成 | — | 中 | samisWeb/index | — |
| dict-6 | 麻醉人员字典 | getStaff/save/disable | `samisWeb/src/views/config/ConfigStaff.vue` | `...AnesDict.php`、`AnesStaff.php` model | 已完成 | — | 中 | samisWeb/index | — |
| dict-7 | 评分模板字典 | 复用 getDictItem（评分 category） | `samisWeb/src/views/config/ConfigScores.vue` | `...AnesDict.php`（getDictItem） | 半完成 | 评分规则/模板字段未单独建模 | 低 | samisWeb/index | 走通用 dict item，无专用评分端点 |
| dict-8 | 事件字典 | getEventDict（专用） | `samisWeb/src/views/config/ConfigEvents.vue` | 无专用端点（走通用 getDictItem） | 半完成 | **getEventDict 路径未在 OpenAPI 确认**，getDeviceDict 同 | 中 | index | 见 `api-integration-status.md` 缺口清单 |
| rec-1 | 麻醉记录单（核心） | 本地持久化/同步/冲突/设备/打印/抢救模式 | `samisWeb/src/views/AnesthesiaRecord.vue`、`src/api/anesthesiaRecord.ts`、`src/services/anesthesia/`（IndexedDB 同步冲突引擎） | `...AnesthesiaRecord.php`（getRecordDetail/saveRecord/lockRecord/voidRecord/getPrintSnapshot）+ `app/samis/domain/anesthesiarecord/` | 已完成 | 默认 mock；Slice 3a-3f 全落地 | 高 | samisWeb/index | 主表 `anes_record` + case_payload 聚合回读（Slice 3f） |
| rec-2 | 同步引擎 / 冲突处理 | pushBatch 幂等/版本/冲突、resolveConflict | `samisWeb/src/api/anesthesiaSync.ts`、`src/services/anesthesia/anesthesiaSyncConflict.ts`、`SyncConflictPanel.vue` | `...AnesthesiaSync.php`（pushBatch/getSyncStatus/getPendingCount/confirmBatch/resolveConflict）+ `app/samis/domain/anesthesiasync/`（22 文件 9 子表） | 已完成 | 默认 mock；field_conflict 待产出 | 高 | samisWeb/index | 单端点按 entityType 分发 5+4+device 处理器 |
| rec-3 | 设备采集（监护仪/呼吸机） | batchPushMonitor/Ventilator、getLatestDeviceData | `samisWeb/src/views/monitor/MonitorDevices.vue`、`src/services/anesthesia/monitorMockService.ts` | `...AnesthesiaDevice.php`（getLatestDeviceData）+ device_raw 经 pushBatch | 半完成 | **真实硬件直连摄入未做**，仅 mock 采集；独立 batchPush* 端点暂缓 | 中 | samisWeb/index | 前端 `useRealDevice()` 默认 false |
| rec-4 | 打印 / 快照追溯 | 打印态隐藏编辑痕迹、immutable 快照 | `samisWeb/src/views/AnesthesiaRecord.vue`、`src/components/anesthesia/record/`、`src/api/anesthesiaRecord.ts`（getPrintSnapshot） | `...AnesthesiaRecord.php`（getPrintSnapshot）+ `anes_record_snapshot` | 已完成 | — | 高 | samisWeb/index | print/lock 置 immutable=1、snapshot_no 递增 |
| rec-5 | 术中用药 / 输液输血 / 事件（独立子页） | 独立查看入口 | `samisWeb/src/views/surgery/SurgeryMedications.vue`、`SurgeryFluids.vue`、`SurgeryEvents.vue` | 经记录单 sync/pushBatch（fluid/transfusion/io_record/timeline_event） | 半完成 | 子页为只读/演示视图，录入主入口在记录单 | 低 | samisWeb | 数据经记录单 store 持久化 |
| rec-6 | 麻醉计划 / 交班 / 小结 | 计划、交班、小结记录 | `samisWeb/src/views/surgery/AnesthesiaPlan.vue`、`AnesthesiaHandover.vue`、`AnesthesiaSummary.vue` | 无专用接口/表（疑随 case_payload） | 半完成 | **无独立后端表/接口**，前端走 store | 中 | index | 需确认持久化方式 |
| mon-1 | 术中实时监测 / 告警 | 监测看板、告警 | `samisWeb/src/views/monitor/MonitorDashboard.vue`、`MonitorAlerts.vue` | 依赖 device 真实数据（见 rec-3） | 半完成 | 依赖真实设备数据，当前 mock 趋势 | 中 | samisWeb/index | — |
| pacu-1 | PACU 恢复室（恢复单） | 列表/详情/入室/更新/转出 | `samisWeb/src/views/PacuList.vue`、`PacuRecord.vue`、`pacu/PacuReceive.vue`、`PacuTransfer.vue`、`src/api/pacu.ts` | `...Pacu.php`（list/getById/admit/update/transferOut）+ `app/samis/domain/pacu/` | 已完成 | 默认 mock；患者信息前端补传（R1） | 高 | samisWeb/index | 同 case 单活跃单校验 |
| pacu-2 | PACU 预约 | 预约 CRUD、admit 联动 | `samisWeb/src/views/pacu/PacuBooking.vue` | `...Pacu.php`（bookingList/Create/Update/Cancel）+ `anes_pacu_booking` | 已完成 | 不设预约冲突校验（R1） | 中 | samisWeb/index | admit 成功后 markBookingReceived |
| pacu-3 | PACU 床位 | 床位 CRUD/统计、admit+床位同事务 | `samisWeb/src/views/quality/QualityPacu.vue`（床位看板）、store `loadRemotePacuBeds` | `...Pacu.php`（bedList/bedAllGrouped/bedStats/bedCreate/Update/Delete）+ `anes_pacu_bed` | 已完成 | — | 中 | samisWeb/index | Slice 6c A |
| pacu-4 | PACU 质控预警 | 低体温/超时/Aldrete/SpO2 预警 | `samisWeb/src/views/pacu/PacuAlerts.vue`、`src/config/pacuThresholds.ts` | 派生自真实 pacu 数据 | 已完成 | — | 中 | samisWeb/index | 阈值常量对齐质控 |
| preop-1 | 术前管理（申请/会诊/检查审核/同意书/安全核查） | 5 实体闭环、状态联动、唯一性判重 | `samisWeb/src/views/preoperative/*.vue`（5 页）、`src/api/preoperative.ts`、`src/services/anesthesia/preoperativeService.ts` | `...Preoperative.php`（25 端点）+ `app/samis/domain/preoperative/`（5 表） | 已完成 | 默认 mock；签名位为布尔标记非电子签影像（R5） | 高 | samisWeb/index | Slice 7a+7b，5 实体聚合一 Service |
| post-1 | 术后随访 | 随访 CRUD、随访类型 | `samisWeb/src/views/postoperative/PostoperativeFollowupPage.vue`、`PostoperativeFollowUp.vue`、`src/api/postoperative.ts` | `...Postoperative.php`（followup*）+ `anes_post_followup` | 已完成 | 默认 mock | 高 | samisWeb/index | Slice 5 |
| post-2 | 术后并发症追踪 | 并发症 CRUD、严重度/状态 | `samisWeb/src/views/postoperative/PostoperativeComplications.vue` | `...Postoperative.php`（complication*）+ `anes_post_complication` | 已完成 | 已提交仍可编辑（R4） | 中 | samisWeb/index | — |
| post-3 | 术后镇痛 / 非计划事件 | 病例聚合（case_payload 派生） | `samisWeb/src/views/postoperative/PostoperativeAnalgesia.vue`、`PostoperativeUnplannedEvents.vue` | `...Postoperative.php`（analgesiaCases/unplannedCases） | 已完成 | 无 case_payload 的记录不命中（operationInfo 兜底 R1） | 中 | samisWeb/index | — |
| qc-1 | 26 项质控指标 / 穿透 / 月报 | 服务端权威计算、穿透 case 列表、月度报表 | `samisWeb/src/views/quality/QualityDashboard.vue`、`QualityOverview.vue`、`QualityReports.vue`、`src/api/quality.ts`、`src/services/qualityCalculator.ts`（mock 兜底） | `...Quality.php`（indicators/indicatorDetail/report）+ `app/samis/domain/quality/`（服务端计算） | 已完成 | Dashboard/Overview 真实模式切换待 IndicatorDetail 富展示适配；趋势为模拟 | 高 | samisWeb/index | Slice 6a，TS parity 测试锁定 26 指标 |
| qc-2 | 质控专项（低体温/不良事件） | 专项病例聚合 | `samisWeb/src/views/quality/QualityHypothermia.vue`、`QualityAdverseEvents.vue` | `...Quality.php`（hypothermiaCases/adverseEvents） | 已完成 | — | 中 | samisWeb/index | Slice 6c B |
| qc-3 | 质控抽查 / 缺陷 | 抽查 CRUD、缺陷识别 | `samisWeb/src/views/quality/QualityOverview.vue`、`QualityDefects.vue`、`src/services/qualityDefectRules.ts` | `...Quality.php`（checkList/CRUD）+ `anes_quality_check` | 已完成 | 历史快照表 `anes_quality_snapshot` 留后续 | 中 | samisWeb/index | Slice 6c B |
| qc-4 | PACU 专项 / PDCA | PACU 指标、PDCA 持续改进 | `samisWeb/src/views/quality/QualityPacu.vue`、`QualityPdca.vue` | PACU 指标后端计算；PDCA 无独立接口 | 半完成 | **QualityPdca 为展示框架**，无 PDCA 环节后端建模 | 低 | samisWeb | PDCA 走 store 展示 |
| rep-1 | 报表统计（工作量/方式/运营） | 统计报表 | `samisWeb/src/views/reports/*.vue`（3 页）、`src/mock/clinicalModulesSeed.ts` | **无 report 后端端点** | 半完成 | **前端 `buildWorkloadStats(store.cases)` 本地计算**，无后端聚合/导出 | 中 | index | 建议新增 report 域或复用 quality |
| spec-1 | 专科场景（产科分娩镇痛 / 非手术室麻醉） | 专科记录 | `samisWeb/src/views/special/SpecialObstetric.vue`、`SpecialNonOr.vue` | 无专用接口/表 | 半完成 | 前端走 store 派生，无专科后端建模 | 低 | samisWeb/index | 文档有 26 指标含产科 1 项 |
| sys-1 | 用户管理 | 用户列表/CRUD/改密 | `samisWeb/src/views/system/SystemUsers.vue` | `...AdminUser.php`（adminUserList/Create/Update/Delete/changePassword，后端已实现） | 半完成 | **前端未消费已有 adminUser 管理接口**，走 store | 中 | samisWeb | 见 `api-integration-status.md` 缺口 |
| sys-2 | 角色权限 / 菜单 | 角色、菜单管理 | `samisWeb/src/views/system/SystemRoles.vue` | `...AdminCategory.php`、`AdminUserGroup.php`（后端已实现） | 半完成 | **前端未消费 adminCategory/adminUserGroup 接口**，走 store | 中 | samisWeb | — |
| sys-3 | 审计 / 操作日志 | 审计日志 | `samisWeb/src/views/system/SystemAudit.vue` | **`saveAuditLog` 接口未定义** | 半完成 | 本地有 audit_log 概念，主接口未确认 | 中 | index | 待后端确认是否纳入 pushBatch 或独立接口 |
| sys-4 | 接口配置 | 接口开关配置展示 | `samisWeb/src/views/system/SystemIntegration.vue` | n/a | 只有框架 | 展示用 UI，无后端 | 低 | samisWeb | — |
| sys-5 | 数据模拟配置 | mock 开关 | `samisWeb/src/views/system/SystemMock.vue` | n/a | 半完成 | 配置 `useReal*` 开关的 UI | 低 | samisWeb | — |
| ref-1 | huliWeb 护理前端（参考） | 手术安排/患者/护理流程/接口字段 | `huliWeb/src/view/*`（115 路由，surgeryTable/Huli/Qixie/Dayin/Zidian/...） | `index/app/huli/`（护理后端，已迁移部分模块） | 半完成（作为参考） | **无文档**；只读不修改；与 samis 接口字段未对齐梳理 | 低 | 不修改 | 详见第六节 |

## 四、核心结论

1. **samisWeb 麻醉前端 + index/samis 麻醉后端是高度完整的一对**：14 个后端控制器、80+ 路由端点、完整 domain 分层（model/repository/service/validate）；前端 60+ 路由全部接入 `useAnesthesiaStore`，无 TODO/占位标记。麻醉记录单（持久化/同步/冲突/设备/打印）、PACU、术前、术后、质控、字典六大主链路**前后端真实链路均已落地**。

2. **唯一系统性"半完成"特征：所有真实链路默认关闭**（`VITE_USE_REAL_*=false`，见 `.env.example`、`src/config/apiFlags.ts`）。即真实后端已就绪，但默认仍走 `samisMockRouter`。**生产启用前必须逐模块联调验证**（详见 `AI-待开发任务清单.md`）。

3. **明确的缺口（半完成/框架）集中在 4 类**：
   - 报表统计无后端端点（前端本地计算）
   - 麻醉计划/交班/小结、PDCA、专科场景无独立后端建模
   - 系统管理（用户/角色/审计）前端未消费已有后端管理接口
   - 设备监测真实硬件直连未做（仅 mock 采集）；事件/设备字典无专用端点

4. **huliWeb 无文档、且为 Vue2 旧护理前端**，与 samis 接口字段未做对齐梳理，本次仅作只读参考。

## 五、文档读取与 .doc/.docx 说明

**已读取的文档：**

index 后端（`index/doc/`）：`README.md`、`数据库文档.md`、`samis_huli_跨库实现规范.md`、`开发指南.md`、`tp6规划文档.md`、`重构计划.md`、`项目布局分析.md`、`输血模块迁移分析.md`、`多应用改造方案.md`；SQL：`samis_anes_*.sql`（record/postop/preop/pacu_*/staff/quality_check/clinical/conflict_resolution/subtables/device_raw/vital_dict 等）、`samis_dict_seed_methods_events_scores.sql`、`samis_admin_seed.sql`、`timescale-samis.sql`；接口：`samis_apifox_openapi.json`。

samisWeb 前端（`samisWeb/docs/`）：`00_INDEX.md`、`04_delivery/current-completed-features.md`、`05_api/api-integration-status.md`、`05_api/anesthesiaRecord-contract.md`、`05_api/anesthesiaDict-contract.md`、`02_specs/麻醉记录单.md`、`02_specs/麻醉记录单用药显示规则.md`、`02_specs/麻醉药品字典接口要求.md`、`02_specs/麻醉记录单后端联调字段对照表.md`、`03_dictionary/麻醉数据库开发主文档.md`、`麻醉管理系统_Web原型与质控指标设计文档.md`、`麻醉数据库基础功能规划_含人员权限日志.md`、`护理系统新版本数据库文档.md`、`前端原型优化方向与组件规划.md`；`README.md`。

huliWeb 前端：`README.md`（空）、`src/view/README.md`。

**.doc/.docx 读取说明：** 三仓库中**未发现 .doc/.docx 文件**（仅 .md / .sql / .json / 源码 / 一张 png 截图）。`.md` 与 `.sql`、`.json` 均可直接稳定读取，无需转换。如后续有 .docx 需求，可按规范先提取为 Markdown 摘要。

## 六、核心代码目录索引

| 仓库 | 关键目录 | 说明 |
|---|---|---|
| index | `app/samis/api/controller/pc/`（14 控制器）、`app/samis/domain/{anesthesiarecord,anesthesiasync,pacu,preoperative,postoperative,quality,dict,operationinfo,room,department,user,adminuser}/`、`app/huli/domain/`（护理）、`app/shared/`（公共）、`route/samis.php`、`route/huli.php`、`doc/sql/` | 麻醉后端核心 |
| samisWeb | `src/views/`（60 页）、`src/router/index.ts`、`src/stores/anesthesia.ts`（中枢 store）、`src/api/`（15 文件含真实 wrapper + 测试）、`src/services/anesthesia/`（适配器/同步/冲突/设备 mock）、`src/services/mock/samisMockRouter.ts`、`src/config/apiFlags.ts`、`src/config/qualityIndicators.ts`、`src/components/anesthesia/record/`（记录单纸面/状态栏）、`src/services/qualityCalculator.ts` | 麻醉前端核心 |
| huliWeb | `src/router/index.js`（115 路由）、`src/view/{surgeryTable 手术排班, surgeryHuli 手术护理, surgeryQixie 器械, surgeryDayin 打印, surgeryZidian 字典, surgeryXitong 系统, surgeryBaobiao 报表, surgeryYupai 预排, surgeryZhikong 质控, surgeryZhuisu 追溯, surgeryRizhi 日志, surgeryChaxun 查询}/`、`src/store/`（vuex）、`src/components/{print, surgeryHeadList, surgeryTime, tableTime}/` | 护理前端（只读参考） |

## 七、状态汇总统计

| 状态 | 模块数 | 占比 |
|---|---|---|
| 已完成 | 24 | ~63% |
| 半完成 | 12 | ~32% |
| 只有框架 | 1（sys-4 接口配置） | ~3% |
| 未开始 | 0 | 0% |
| 不确定 | 0 | 0% |

> 备注：本统计以"功能模块"为粒度。若以"是否默认启用真实后端"计，则几乎所有"已完成"模块当前仍默认走 mock，需启用联调后才算生产可用。

---

详见姊妹文档：[AI-待开发任务清单.md](./AI-待开发任务清单.md)。
