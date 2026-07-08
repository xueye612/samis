# samisweb 文档入口（唯一索引）

更新时间：2026-07-08（T01 六轮联调收尾：auth/op/room/dict/record/sync/pacu/postop/preop/quality/admin 共 11 模块端到端走真；device 仍 mock）

## 一、三类导航

| 类别 | 文档 | 用途 |
|---|---|---|
| ① 已实现状态 | [current-completed-features](04_delivery/current-completed-features.md) | 已完成能力总表（按轮次结论归类，mock / 真实后端） |
| ① 已实现状态 | [联调日志](04_delivery/联调日志.md) | 逐轮联调细节（与上互补：状态总表 vs 过程日志） |
| ② 待开发 backlog | [AI-待开发任务清单](AI-待开发任务清单.md) | 仅 open backlog（已关闭项压缩为摘要） |
| ③ 参考规格 | 见下方「参考规格」分区 | 契约 / spec / 字典主文档 / 后端核心 / 护理 SoT |

## 二、接口风格（主链路）

```text
/api-samis/pc/v1/admin/login
/api-samis/pc/v1/adminUser/getAdminUserInfo
/api-samis/pc/v1/user/getLoginUser
/api-samis/pc/v1/operationInfo/*
/api-samis/pc/v1/room/*
/api-samis/pc/v1/anesthesiaDict/*
/api-samis/pc/v1/anesthesiaRecord/*
/api-samis/pc/v1/anesthesiaSync/*
/api-samis/pc/v1/anesthesiaDevice/*
/api-samis/pc/v1/pacu/*
/api-samis/pc/v1/postoperative/*
/api-samis/pc/v1/preoperative/*
/api-samis/pc/v1/quality/*
```

**本地联调地址：** `http://192.168.10.178:8022`（index 后端；DB 同机 `192.168.10.178:2881`；dev-server 经 Vite 代理 `/api-samis` → 该主机，见 `vite.config.mjs`）。远程 Apifox 旧地址 `47.105.38.226:8022` 仅留回滚参考，`.env.example` 注释待统一（见任务清单 T19）。

**不作为当前主接口：** `/api/anesthesia/records`（legacy mock）、`/api/anes/*`（护理后端规划，见 shuhu-surgianes 仓库）。

## 三、mock / real 模块开关（联调进度）

| 模块 | 环境变量 | 联调状态 | 说明 |
|---|---|---|---|
| 认证 | `VITE_USE_REAL_AUTH` | 已联调走真 | Login `POST /admin/login`（form `username`/`password`）；当前用户 `adminUser/getAdminUserInfo` |
| 手术通知单 | `VITE_USE_REAL_OPERATION_INFO` | 已联调走真 | 列表/排班/详情；POST 写回 form-urlencoded |
| 手术间 | `VITE_USE_REAL_ROOM` | 已联调走真 | `getRoomList`/`getRoomGroupList`（委托 huli addRoom/updateRoom） |
| 麻醉字典 | `VITE_USE_REAL_ANESTHESIA_DICT` | 已联调走真 | 药品/液体/血制品/生命体征/人员/模板/分类/项 7 类，读路径 + 写往返 |
| 麻醉记录单 | `VITE_USE_REAL_ANESTHESIA_RECORD` | 已联调走真 | `saveRecord` 幂等 upsert（`case_payload`≤512KB）；`getRecordDetail` 聚合回读（主表 + 7 关系列表） |
| 同步 | `VITE_USE_REAL_ANESTHESIA_SYNC` | 已联调走真 | `pushBatch` 9 处理器（record/medication/timeline/vital/fluid/transfusion/io/lab）+ device/snapshot + `resolveConflict` |
| PACU | `VITE_USE_REAL_PACU` | 已联调走真 | 恢复单/预约/床位 CRUD（床位联动原子事务） |
| 术后管理 | `VITE_USE_REAL_POSTOPERATIVE` | 已联调走真 | 随访/并发症 CRUD + 镇痛/非计划病例聚合 |
| 术前管理 | `VITE_USE_REAL_PREOPERATIVE` | 已联调走真 | 申请/会诊/检查审核/知情同意/安全核查 CRUD |
| 质控 | `VITE_USE_REAL_QUALITY` | 已联调走真 | 26 指标服务端聚合 + 穿透/报表/低体温/不良事件/抽查 |
| 系统管理 | `VITE_USE_REAL_ADMIN` | 已联调走真 | 用户全 CRUD + 角色/菜单只读（T04/T05） |
| 设备上传 | `VITE_USE_REAL_DEVICE` | mock（未启用） | 监护仪/呼吸机原始数据 mock 采集不变；真实硬件需网关/适配层（见任务清单 T07） |

**全局开关语义**（`src/config/apiFlags.ts`，纠正旧描述）：`VITE_ANESTHESIA_USE_MOCK` 默认 `true`（mock 基线）。

- **读路径模块**（auth / operationInfo / room / anesthesiaDict）：置 `VITE_ANESTHESIA_USE_MOCK=false` 时**自动走真**，无需逐模块开关。
- **opt-in 模块**（record / sync / device / pacu / postop / quality / preop / admin）：必须显式 `VITE_USE_REAL_*=true` 才走真；全局置 `false` **不会**自动放行这些模块（仍回 mock）。

**baseURL 规范：** `VITE_SAMIS_API_BASE` 只含一次 `/api-samis/pc/v1`；业务 path 为 `/operationInfo/...`，禁止再拼完整 baseURL（防 Apifox 双前缀问题）。

**Apifox 写回编码：** `updateOperationInfo`、`saveNursePb`（`data`=JSON 数组字符串）、`updateNumberOfStations` 使用 `application/x-www-form-urlencoded`；工具见 `src/api/samisFormBody.ts`。

## 四、参考规格

| 文档 | 用途 |
|---|---|
| [麻醉记录单](02_specs/麻醉记录单.md) | 本地持久化、同步、冲突、设备模拟、后端接口、验收；含抢救模式时间轴/分页同步 |
| [用药显示规则](02_specs/麻醉记录单用药显示规则.md) | 画线 / 特殊用药区 / 时间轴标注 |
| [药品字典接口要求](02_specs/麻醉药品字典接口要求.md) | getDrugDict、特殊用药推荐字段 |
| [后端联调字段对照表](02_specs/麻醉记录单后端联调字段对照表.md) | pushBatch、实体 payload、表映射 |
| [anesthesiaRecord 契约](05_api/anesthesiaRecord-contract.md) | 接口契约参考 |
| [anesthesiaDict 契约](05_api/anesthesiaDict-contract.md) | 接口契约参考 |
| [API 集成状态](05_api/api-integration-status.md) | 接口总表 + 已集成状态 + **错误码分层约定（T26）** |
| [麻醉数据库开发主文档](03_dictionary/麻醉数据库开发主文档.md) | OceanBase 表与 IndexedDB 映射 |
| [麻醉管理系统 Web 原型与质控](麻醉管理系统_Web原型与质控指标设计文档.md) | 26 项质控展示规范（实现参考，代码 QualityIndicatorConfig 已权威） |
| [护理系统新版本数据库文档](护理系统新版本数据库文档.md) | 护理 SoT 字典引用 |

## 五、后端核心文档（index/doc）

| 文档 | 用途 |
|---|---|
| [README](../../index/doc/README.md) | index 后端总览 |
| [多应用改造方案](../../index/doc/多应用改造方案.md) | 当前双应用架构（app/samis + app/huli）权威说明 |
| [数据库文档](../../index/doc/数据库文档.md) | schema SoT |
| [samis_huli 跨库实现规范](../../index/doc/samis_huli_跨库实现规范.md) | 跨库写须走 huli export |
| [开发指南](../../index/doc/开发指南.md) | 开发约定 |

## 六、已删除（历史，2026-07-08 整理）

下列会话前过时文档已删除，不再作为事实来源（其内容被 current-completed-features / 联调日志 / 多应用改造方案 / 数据库文档 / 实际代码 取代）：

- `AI-三项目功能完成度审计.md`（pre-联调 快照，38 行完成度判断全过时）
- `麻醉数据库基础功能规划_含人员权限日志.md`（表设计被 `数据库文档.md` + 代码取代）
- `前端原型优化方向与组件规划.md`（描述旧 datasetStore/mockApi 状态）
- `index/doc/项目布局分析.md`（描述旧 `app/api/` TP5→TP6，与实际 `app/samis`+`app/huli` 不符）
- `index/doc/tp6规划文档.md`、`重构计划.md`、`输血模块迁移分析.md`（迁移已完成，被多应用改造方案 + 代码取代）
