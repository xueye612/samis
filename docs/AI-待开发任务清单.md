# 待开发任务清单

> 更新：2026-07-08（精简：已关闭项压缩为摘要，仅展开 open backlog）
> 配套：[current-completed-features](04_delivery/current-completed-features.md)（已实现状态）、[联调日志](04_delivery/联调日志.md)（逐轮过程）
> 原则：审计与文档整理，建议任务按优先级排序，需人工确认后再开发。

## 一、优先级说明

| 优先级 | 含义 |
|---|---|
| P0 | 阻塞生产上线，必须先做 |
| P1 | 影响核心业务完整性，建议本迭代做 |
| P2 | 增强/补全，可排期 |
| P3 | 低频/展示性，可延后 |

## 二、已关闭 / 已修复（摘要，2026-07-08）

> 详情见 [联调日志](04_delivery/联调日志.md) 各轮结论与 [current-completed-features](04_delivery/current-completed-features.md)。

- **T01 全模块真实链路联调收尾**：auth / operationInfo / room / anesthesiaDict / anesthesiaRecord / anesthesiaSync / pacu / postoperative / preoperative / quality / admin 共 **11 模块端到端走真**（device 仍 mock）。累计登记缺陷 T20~T28 已修或并入。
- **T04 系统管理-用户管理**：新增 `src/api/adminUser.ts` + adminAggregatorService（token-safe + groupid↔role 映射）+ store 接线 + SystemUsers 全 CRUD（create/update/delete/changePassword 往返 code:0）。
- **T05 系统管理-角色/菜单（只读接真）**：SystemRoles 只读接真（真组 id/name/权限 + getMenu 菜单树）；curl + e2e 覆盖。**完整 CRUD UI 仍 open（见下）**。
- **分页修复**：T18 `getOperationList` pageSize 被忽略、T20 dict `page_size` 被忽略——根因均为共享基类/服务仅读 camel 或 snake 单键；改双键兜底（`$params['page_size'] ?? $params['pageSize'] ?? null`），切片生效。
- **T21 启动期 token 竞态**：`main.ts` 将 `restoreSessionIfPresent()` 前置；`loginWithCredentials` 登录后 fire-and-forget 触发 `loadSamisBaseCatalog()`。
- **T22 saveVitalDict short_code NOT NULL**：normalizeVitalData 缺省回退 `$params['code']`，不改 DDL（NOT NULL DEFAULT ''）。留后续：同表 NOT NULL 列缺省统一落 `''` 而非 null。
- **T23 getRecordDetail 浏览器门控**：由 `if (ANESTHESIA_USE_MOCK) return null` 改 `if (!useRealAnesthesiaRecord()) return null`。
- **T24 临床子表缺表**：`anes_fluid`/`anes_transfusion`/`anes_io_record`/`anes_lab_result` + snapshot 4 列已临时导入 samis 库。**固化部署仍 open（见下）**。
- **T25 / T28**：同源根因（`bootstrapRemoteConfigs` 从未统一调用），已并入 T27；质量面板子项已页面级补丁关闭。
- **T27 统一预载/loader（部分缓解）**：T21/T23/T28 已修，PACU/质量已页面级 onMounted 补丁。**登录后中央统一预载根治仍 open（见下）**。
- **路由接线**：`route/samis.php` 的 `anesthesiaDict` 组补注册 6 条端点（getStaff/saveStaff/disableStaff、getVitalDict/saveVitalDict/disableVitalDict）——控制器/服务已就绪仅缺路由，零逻辑变更（已登记例外）。

## 三、Open backlog（待开发）

| 编号 | 功能 | 仓库 | 状态 | 待办 | 优先级 |
|---|---|---|---|---|---|
| T02 | 报表统计后端端点（工作量/麻醉方式/运营） | index | 半完成 | 前端本地计算；缺后端聚合 + CSV/Excel 导出。建议 `app/samis/domain/report/` 或复用 quality 聚合 | P1 |
| T03 | 麻醉计划/交班/小结 持久化 | index | 半完成 | 确认是否随 `anes_record.case_payload` 持久化；若需独立查询/历史，需建表 + 接口。**需先与业务确认回读需求** | P1 |
| T06 | 审计日志接口定义 | index | 半完成 | `saveAuditLog` 未定义；待确认纳入 pushBatch 审计项 or 独立 `audit/*`（操作人/时间/实体/前后值/客户端） | P1 |
| T05 | 角色/菜单 完整 CRUD UI | samisWeb | 部分（只读已接真） | 当前 SystemRoles 仅只读；角色/菜单/用户组 CRUD UI 未启用 | P2 |
| T07 | 设备监测真实硬件直连 | index/samisWeb | 半完成 | 当前 mock 采集；需硬件网关/适配层；独立 batchPush* 端点暂缓 | P2 |
| T13 | field_conflict 冲突类型产出 | index | 半完成 | resolveConflict 已支持全量类型，但 **field_conflict 待产出**（Slice 3e 遗留；record_printed/vital_corrected 已产出） | P2 |
| T24 | 临床子表 缺表 固化部署 | index（运维/部署） | 已临时补齐 | 4 表 + snapshot 4 列已临时导入；**需纳入部署/初始化脚本**避免文档与库不一致；同步核对其余 `doc/sql/samis_anes_*.sql` 全量表 | P2 |
| T26 | 校验器层统一返回 code:500 | index | 缺陷（契约不一致） | 控制器 `ValidateException`→`code:500`（非文档业务码 1201/1301 等）；详见 [api-integration-status](05_api/api-integration-status.md)「错误码分层约定」。建议映射 4xx/VALIDATION_*（2001~2005）或据实修错误码字典 | P2 |
| T27 | 统一预载/loader 中央根治 | samisWeb | 部分缓解 | 登录成功（token 就绪）后统一调用 `loadSamisBaseCatalog()`（并补 indicators 进预载清单），替代逐页 onMounted；复核其余 PACU/质控子页是否缺挂载拉取 | P2 |
| T12 | 质控历史快照表 | index | 半完成 | 趋势为模拟；缺定时快照写入 + 历史查询接口（`anes_quality_snapshot`，文档 R4 已标记留后续） | P2 |
| T15 | huliWeb↔samis 字段对齐梳理 | 文档任务 | 半完成(参考) | **无文档**；患者/手术/护理字段两前端未对齐。输出字段映射 md，不改业务代码 | P2 |
| T08 | 事件/设备字典专用端点 | index | 半完成 | getEventDict/getDeviceDict 路径未确认；若后端不提供，改走通用 getDictItem(category_code) | P2 |
| T09 | ConfigRooms 写接口启用 | samisWeb | 半完成 | wrapper 已有但未启用新增/编辑/删除 UI（room 委托 huli） | P2 |
| T10 | 评分模板字段建模 | index | 半完成 | 评分仅走通用 dict item；规则/分项未单独建模 | P3 |
| T11 | PDCA 后端建模 | index | 半完成(框架) | 走 store 展示；缺 PDCA 计划/执行/检查/处理环节后端 | P3 |
| T14 | 模板字段 templateField 确认 | index/samisWeb | 半完成 | 仅空分页 mock；字段定义待后端示例 | P3 |
| T16 | 接口配置页定位（sys-4） | samisWeb | 只有框架 | 补真实能力 or 标注为占位/废弃 | P3 |
| T17 | huliWeb 文档补齐 | 文档任务 | 未开始 | 无任何文档；建议 README + 手术安排/护理流程/接口字段说明 | P3 |
| T19 | 远程地址引用统一 | samisWeb | 待处理 | `.env.example` 注释仍写 `47.105.38.226:8022`（远程 Apifox），与本地 `192.168.10.178:8022` 不一致，需统一（或抽到单一变量） | P3 |

## 四、建议执行顺序

1. **P0（已完成）**：T01 真实链路联调——11 模块端到端走真（device 仍 mock）。
2. **P1（本迭代）**：T02 报表端点、T03 计划/交班/小结持久化、T06 审计日志。补齐后 samisWeb「半完成」核心管理链路闭环。
3. **P2（排期）**：T05 完整 CRUD UI、T07 设备直连、T13 field_conflict、T24 固化部署、T26 错误码契约、T27 中央预载根治、T12 质控快照、T15 字段对齐文档、T08 事件/设备字典、T09 ConfigRooms 启用。
4. **P3（延后）**：T10 评分建模、T11 PDCA、T14 模板字段、T16 接口配置页、T17 huliWeb 文档、T19 地址统一。

## 五、验收口径

- 每个任务完成后，须在 [api-integration-status](05_api/api-integration-status.md) 与 [current-completed-features](04_delivery/current-completed-features.md) 同步更新对应行（状态改为「已集成」）。
- 涉及新接口须补 API wrapper + adapter + mock 分支 + 测试文件（沿用现有 `src/api/*.test.ts` 模式）。
- 涉及新表须在 `index/doc/sql/` 补 `samis_anes_*.sql` 并在 `数据库文档.md` 登记。
- 涉及跨库（写 huli 表）必须走 `huli export`（见 `index/doc/samis_huli_跨库实现规范.md`），不得在 samis 直写。
