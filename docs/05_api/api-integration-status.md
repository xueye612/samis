# SAMIS-PC API 集成状态清单

更新时间：2026-06-09  
接口前缀：`/api-samis/pc/v1`  
测试策略：Mock + API wrapper / adapter 单测，不依赖真实 token 或后端环境。

## 来源与范围

- Apifox 公开页：`https://s.apifox.cn/e353ce56-51ce-42e6-87f4-05c9af26f546/466589765e0`。该页可机器读取到当前手术通知单接口和部分 SAMIS-PC 侧边栏路径，但不是完整 OpenAPI JSON。
- 本仓库联调文档：`docs/02_specs/麻醉记录单后端联调字段对照表.md`、`docs/02_specs/麻醉药品字典接口要求.md`。
- 代码入口：`src/api/*`、`src/services/mock/samisMockRouter.ts`、`src/services/anesthesia/adapters/*`。

状态说明：

| 状态 | 含义 |
|---|---|
| 已集成 | 有 API wrapper，走 `samisRequest`，Mock 模式可返回稳定数据，已有测试文件引用 |
| 部分集成 | 有 wrapper 或 mock，但字段/真实响应/页面消费仍有缺口 |
| 未集成 | Apifox 可见但当前 SAMIS 麻醉前端未接 API wrapper |
| 待后端确认 | 路径或字段来自前端联调建议/旧 mock，未在可读 Apifox 页面完整确认 |

## 接口总表

| 模块 | 接口名称 | 方法 | 路径 | 请求数据要求 | 响应数据要求 | 前端消费者 | Mock 数据要求 | 状态 | 测试文件 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| auth | 登录 | POST | `/admin/login` | form-urlencoded；`loginName/login_name/username`、`password` | `token`，`userInfo.id/name/GH/department_*` | 登录页、`authStore` | 固定 token + 用户信息 | 已集成 | `src/services/auth/authAdapter.test.ts` | Apifox 可见 |
| auth | 登录用户 | GET | `/user/getLoginUser` | token/header | 用户 id/name/loginName/角色 | `authStore` fallback | 当前用户基础信息 | 已集成 | `src/services/auth/authAdapter.test.ts` | 当前公开页未直接列出，前端保留 fallback |
| auth | 当前用户 | GET | `/user/getCurrentUser` | token/header | 同上 | `authStore` fallback | 当前用户基础信息 | 已集成 | `src/services/auth/authAdapter.test.ts` | 前端保留 fallback |
| adminUser | 当前管理员信息 | GET | `/adminUser/getAdminUserInfo` | token/header | `userId/userName/loginName/gh/room/roomGroup/roleNames` | `authStore` fallback | 当前用户基础信息 | 已集成 | `src/services/auth/authAdapter.test.ts` | Apifox 可见 |
| adminUser | 用户列表 | GET | `/adminUser/adminUserList` | 分页、关键字、科室/角色筛选待确认 | 用户列表、分页总数 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见，非当前麻醉业务页面消费 |
| adminUser | 用户详情 | GET | `/adminUser/getAdminUserById` | 用户 id | 用户详情 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminUser | 新增用户 | POST | `/adminUser/adminUserCreate` | 用户表单字段待确认 | 创建结果/id | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminUser | 更新用户 | POST | `/adminUser/adminUserUpdate` | 用户 id + 用户表单字段待确认 | 更新结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminUser | 删除用户 | POST | `/adminUser/adminUserDelete` | 用户 id | 删除结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminUser | 修改密码 | POST | `/adminUser/changePassword` | old/new password 字段待确认 | 修改结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminCategory | 获取菜单 | GET | `/adminCategory/getMenu` | token/header | 菜单树 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminCategory | 新增菜单 | POST | `/adminCategory/menuCreate` | 菜单表单字段待确认 | 创建结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminCategory | 更新菜单 | POST | `/adminCategory/menuUpdate` | 菜单 id + 字段待确认 | 更新结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminCategory | 删除菜单 | POST | `/adminCategory/menuDelete` | 菜单 id | 删除结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| adminCategory | 批量更新菜单排序 | POST | `/adminCategory/menuBatchUpdateOrder` | 菜单排序数组 | 更新结果 | 暂无 | 暂无 | 未集成 | 无 | Apifox 可见 |
| operationInfo | 手术通知单列表 | GET | `/operationInfo/getOperationList` | query：`page/pageSize/operationDate/patientNumber/patientName/operationRoom` | `list/total`；行需含 `operationId/patientName/patientNumber/room/roomId/numberOfStations/scheduledStart/scheduledEnd` | 手术排班页、麻醉记录入口 | 按日期、房间、患者姓名、住院/患者号过滤 | 已集成 | `src/services/anesthesia/adapters/operationInfoAdapter.test.ts`、`src/services/mock/samisMockRouter.test.ts` | 本轮修复日期筛选 |
| operationInfo | 手术通知单详情 | GET | `/operationInfo/getOperationInfo` | query：`operationId` 或 `OPERATIONID` | 患者、手术、诊断、麻醉、术前访视、护理人员字段 | 记录单初始化、排班详情 | 按 `operationId` 返回 seed case | 已集成 | `src/services/anesthesia/adapters/operationInfoAdapter.test.ts` | Apifox 可见 |
| operationInfo | 更新手术信息 | POST | `/operationInfo/updateOperationInfo` | form-urlencoded；通知单字段，房间/台次使用 Apifox 字段 | 更新结果 | 手术排班编辑 | `{ updated: true }` | 已集成 | `src/api/samisFormBody.test.ts` | 不写麻醉记录单临床字段 |
| operationInfo | 人员预安排列表 | GET | `/operationInfo/getNursePbList` | query：`startTime/endTime` | `list/total`；行含手术间、台次、护士、麻醉医生、日期 | 手术排班护理视图 | 按同日起止日期过滤 | 已集成 | `src/services/mock/samisMockRouter.test.ts` | 本轮修复同日语义 |
| operationInfo | 保存人员安排 | POST | `/operationInfo/saveNursePb` | form-urlencoded；`data` 为 JSON 数组 | 保存结果 | 手术排班护理视图 | `{ saved: true }` | 已集成 | `src/api/samisFormBody.test.ts` | Apifox 可见 |
| operationInfo | 批量更新台次/排序 | POST | `/operationInfo/updateNumberOfStations` | form-urlencoded；`data` 为排序/台次数组或字段表单 | 更新结果 | 手术排班 | `{ updated: true }` | 已集成 | `src/api/samisFormBody.test.ts` | Apifox 可见 |
| room | 手术间列表 | GET | `/room/getRoomList` | query：`roomGroup/roomGroupId/keyword` 可选 | `list`；房间需含 `roomId/roomName/roomGroup` | 手术排班房间筛选 | OR-01..OR-06、PACU | 已集成 | `src/api/samisHttpClient.test.ts` | 当前 Apifox 页面侧边栏可见房间模块，接口路径来自项目封装 |
| room | 手术部/房间组 | GET | `/room/getRoomGroupList` | query 可选 | `list`；组需含 `roomGroupId/roomGroupName/rooms` | 登录上下文、房间筛选 | 手术中心、恢复区 | 已集成 | `src/api/samisHttpClient.test.ts` | 路径来自项目封装 |
| anesthesiaDict | 药品字典 | GET | `/anesthesiaDict/getDrugDict` | `keyword/drug_category/special_category/default_is_special/enabled/page/page_size` | `list/data/records` 均可适配；药品字段见药品字典文档 | 记录单用药、药品配置 | seed 药品字典 + 推荐字段 | 已集成 | `src/services/anesthesia/adapters/anesthesiaDictAdapter.test.ts` | 字段已文档化 |
| anesthesiaDict | 保存药品字典 | POST | `/anesthesiaDict/saveDrugDict` | form-urlencoded；药品字段，`defaultIsSpecial` 仅为默认推荐 | `drugId` | 药品配置 | 返回 drugId | 已集成 | `src/api/samisFormBody.test.ts` | 真实写回开关 `VITE_USE_REAL_ANESTHESIA_DICT` |
| anesthesiaDict | 停用药品字典 | POST | `/anesthesiaDict/disableDrugDict` | form-urlencoded；`drugId` | 成功/失败 | 药品配置 | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 特殊用药分类 | GET | `/anesthesiaDict/getSpecialDrugCategories` | 无 | `{ value,label }[]` | 用药弹窗、配置 | 固定分类 | 已集成 | `src/services/anesthesia/adapters/anesthesiaDictAdapter.test.ts` | 前端推荐展示 |
| anesthesiaDict | 用药默认推荐 | GET | `/anesthesiaDict/getDrugRecommend` | `drug_id/drug_name/anesthesia_method/surgery_type/patient_age` | 推荐模式、特殊用药分类、原因模板 | 用药弹窗 | 从 seed 药品生成 | 已集成 | `src/services/anesthesia/adapters/anesthesiaDictAdapter.test.ts` | 可选增强接口 |
| anesthesiaDict | 模板列表 | GET | `/anesthesiaDict/getTemplate` | `id/page/page_size` | 模板分页列表 | 配置页预留 | 空分页 | 部分集成 | `src/services/mock/samisMockRouter.test.ts` | 真实响应字段待确认 |
| anesthesiaDict | 保存模板 | POST | `/anesthesiaDict/saveTemplate` | form-urlencoded；模板字段待确认 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 停用模板 | POST | `/anesthesiaDict/disableTemplate` | form-urlencoded；模板 id | 停用结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 模板字段列表 | GET | `/anesthesiaDict/getTemplateField` | `id/template_id/page/page_size` | 模板字段分页列表 | 配置页预留 | 空分页 | 部分集成 | `src/services/mock/samisMockRouter.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 保存模板字段 | POST | `/anesthesiaDict/saveTemplateField` | form-urlencoded；模板字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 删除模板字段 | POST | `/anesthesiaDict/deleteTemplateField` | form-urlencoded；字段 id | 删除结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 字典分类列表 | GET | `/anesthesiaDict/getDictCategory` | `id/page/page_size` | 分类分页列表 | 配置页预留 | 空分页 | 部分集成 | `src/services/mock/samisMockRouter.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 保存字典分类 | POST | `/anesthesiaDict/saveDictCategory` | form-urlencoded；分类字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 停用字典分类 | POST | `/anesthesiaDict/disableDictCategory` | form-urlencoded；分类 id/code | 停用结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 字典项列表 | GET | `/anesthesiaDict/getDictItem` | `id/category_code/page/page_size` | 字典项分页列表 | 配置页预留 | 空分页 | 部分集成 | `src/services/mock/samisMockRouter.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 保存字典项 | POST | `/anesthesiaDict/saveDictItem` | form-urlencoded；字典项字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 停用字典项 | POST | `/anesthesiaDict/disableDictItem` | form-urlencoded；字典项 id/code | 停用结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 液体字典 | GET | `/anesthesiaDict/getFluidDict` | `id/page/page_size` | 液体分页列表 | 记录单输液、配置预留 | seed 液体字典 | 已集成 | `src/services/anesthesia/adapters/anesthesiaDictAdapter.test.ts` | 可支持 `list/data/records` |
| anesthesiaDict | 保存液体字典 | POST | `/anesthesiaDict/saveFluidDict` | form-urlencoded；液体字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 停用液体字典 | POST | `/anesthesiaDict/disableFluidDict` | form-urlencoded；液体 id | 停用结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 血制品字典 | GET | `/anesthesiaDict/getBloodProductDict` | `id/page/page_size` | 血制品分页列表 | 记录单输血、配置预留 | 空分页 | 部分集成 | `src/services/anesthesia/adapters/anesthesiaDictAdapter.test.ts` | `getTransfusionDict` 已别名 |
| anesthesiaDict | 保存血制品字典 | POST | `/anesthesiaDict/saveBloodProductDict` | form-urlencoded；血制品字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 停用血制品字典 | POST | `/anesthesiaDict/disableBloodProductDict` | form-urlencoded；血制品 id | 停用结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | 数据字段待后端确认 |
| anesthesiaDict | 事件字典 | GET | `/anesthesiaDict/getEventDict` | 待确认 | 事件列表 | 记录单事件候选预留 | 空分页 | 待后端确认 | 无 | OpenAPI 未定义，mock 保留 |
| anesthesiaDict | 设备字典 | GET | `/anesthesiaDict/getDeviceDict` | 待确认 | 设备列表 | 设备配置预留 | 空分页 | 待后端确认 | 无 | OpenAPI 未定义，mock 保留 |
| anesthesiaRecord | 记录单详情 | GET | `/anesthesiaRecord/getRecordDetail` | `operationId`，可选 `recordLocalId/recordServerId` | 记录单全量详情或 `record:null` | 麻醉记录单初始化 | 从 `mockApi.getAnesthesiaRecord` 返回 | 已集成 | `src/api/anesthesiaSync.test.ts` | 字段见联调对照表 |
| anesthesiaRecord | 保存记录单 | POST | `/anesthesiaRecord/saveRecord` | JSON；record 主表/全量 payload | `localId/serverId` | 同步队列、记录单保存 | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | 粗粒度保存 |
| anesthesiaRecord | 保存快照 | POST | `/anesthesiaRecord/saveSnapshot` | JSON；患者/手术/记录快照 | `snapshotId/serverId/savedAt` | 打印/归档预留 | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | 需后端保证打印追溯 |
| anesthesiaRecord | 批量保存时间轴事件 | POST | `/anesthesiaRecord/batchSaveTimelineEvents` | JSON；`items[]`，每项含 `localId`、`operationId`、事件字段 | `results[]`；逐项 `localId/serverId/status/serverSyncVersion` | 同步队列 | 批量 success | 已集成 | `src/services/mock/samisMockRouter.test.ts`、`src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存用药 | POST | `/anesthesiaRecord/batchSaveMedications` | JSON；`items[]`，药名、剂量、单位、途径、时间、特殊用药字段 | `results[]` 同上 | 同步队列、用药记录 | 批量 success | 已集成 | `src/services/mock/samisMockRouter.test.ts`、`src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存输液 | POST | `/anesthesiaRecord/batchSaveFluids` | JSON；`items[]`，液体名、容量、起止时间 | `results[]` 同上 | 同步队列预留 | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存输血 | POST | `/anesthesiaRecord/batchSaveTransfusions` | JSON；`items[]`，血制品、容量/单位、起止时间 | `results[]` 同上 | 同步队列预留 | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存生命体征 | POST | `/anesthesiaRecord/batchSaveVitalSigns` | JSON；`items[]`，测量时间、HR/SBP/DBP/SpO2 等 | `results[]` 同上 | 同步队列、设备修正 | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 已有接口统一到通用 batch mock |
| anesthesiaRecord | 锁定记录单 | POST | `/anesthesiaRecord/lockRecord` | JSON；`operationId/recordLocalId/recordServerId` | `locked/lockedAt` | 归档/打印预留 | 返回 locked | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 作废记录单 | POST | `/anesthesiaRecord/voidRecord` | JSON；`operationId/recordLocalId/voidReason` | `voided/voidedAt` | 记录单管理预留 | 返回 voided | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 保存出入量 | POST | `/anesthesiaRecord/saveIoRecord` | JSON；`localId/operationId/intake/output/time` | `localId/serverId/savedAt` | 同步队列预留 | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 保存检验结果 | POST | `/anesthesiaRecord/saveLabResult` | JSON；`localId/operationId/itemName/value/unit/time` | `localId/serverId/savedAt` | 同步队列预留 | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaSync | 批量同步 | POST | `/anesthesiaSync/pushBatch` | JSON；`batchNo/operationId/recordLocalId/clientTime/items[]`；item 见联调文档 | `batchNo/results[]`；支持 success/failed/conflict | 同步队列 | 幂等、冲突、设备去重模拟 | 已集成 | `src/api/anesthesiaSync.test.ts` | 主同步链路 |
| anesthesiaSync | 同步状态 | GET | `/anesthesiaSync/getSyncStatus` | `operationId` | `pendingCount/online/lastSyncedAt` | 同步状态栏 | online + 0 pending | 已集成 | `src/api/anesthesiaSync.test.ts` | mock 稳定 |
| anesthesiaSync | 待同步数量 | GET | `/anesthesiaSync/getPendingCount` | 可选 `operationId` | `pendingCount` | 同步状态栏 | 0 pending | 已集成 | `src/api/anesthesiaSync.test.ts` | mock 稳定 |
| anesthesiaSync | 确认批次 | POST | `/anesthesiaSync/confirmBatch` | JSON；`batchNo` | `batchNo/confirmed` | 同步队列预留 | confirmed true | 已集成 | `src/api/anesthesiaSync.test.ts` | 批次确认 |
| anesthesiaSync | 解决冲突 | POST | `/anesthesiaSync/resolveConflict` | JSON；`conflictId/localId/action/resolvedPayload` | `conflictId/resolved/resolvedAt` | 冲突面板预留 | resolved true | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaDevice | 批量推送监护仪原始数据 | POST | `/anesthesiaDevice/batchPushMonitorData` | JSON；`items[]`，含 `localId/collectTime/deviceId/payload` | `results[]` | 设备采集服务 | 去重 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 与 `monitor_raw` 对齐 |
| anesthesiaDevice | 批量推送呼吸机原始数据 | POST | `/anesthesiaDevice/batchPushVentilatorData` | JSON；`items[]`，含 `localId/collectTime/deviceId/payload` | `results[]` | 设备采集服务 | 去重 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 与 `ventilator_raw` 对齐 |
| anesthesiaDevice | 最新设备数据 | GET | `/anesthesiaDevice/getLatestDeviceData` | `operationId` | `{ monitor, ventilator }` | 记录单设备展示预留 | null/null | 已集成 | `src/api/anesthesiaSync.test.ts` | 本轮覆盖测试 |

## 当前缺口清单

| 缺口 | 影响 | 数据要求 | 建议处理 |
|---|---|---|---|
| Apifox 公开页不是完整 OpenAPI JSON | 无法自动确认所有响应字段 | 需要导出 SAMIS-PC OpenAPI JSON，包含请求、响应、示例和字段说明 | 后端/接口负责人提供 OpenAPI 导出后，再把 `待后端确认` 改为确认字段 |
| adminUser / adminCategory 管理接口未接入 | 当前麻醉业务页面无消费者；若后续做用户/菜单管理会缺 API wrapper | 需要确认分页字段、表单字段、权限字段、删除语义 | 新增 `src/api/adminUser.ts`、`src/api/adminCategory.ts` 并补 mock/test |
| room 模块写接口未接入 | 当前只用于房间筛选；房间维护页若启用会缺 CRUD | 需要确认 `roomCreate/roomUpdate/roomDelete`、手术部 CRUD 的准确路径和字段 | 等 Apifox 路径确认后接入 |
| 部分字典配置接口只有空分页 mock | 页面可稳定运行，但不能真实验证配置数据结构 | 模板、模板字段、字典分类/项、血制品字段要给出完整示例 | 后端给字段后补 adapter 测试和 seed mock |
| `getEventDict/getDeviceDict` 路径未在 OpenAPI 确认 | 旧 mock 保留，不应作为真实联调依据 | 事件类型/设备类型字段、启停用字段待确认 | 若后端不提供，改走通用 `getDictItem(category_code)` |
| `saveAuditLog` 未定义 | 本地有 `audit_log` 概念，但主接口未确认 | 操作人、操作时间、实体、前后值、客户端信息 | 待后端确认是否纳入 `pushBatch` 或独立接口 |

## 验收记录

本清单要求：

1. `已集成` 接口必须有 API wrapper、mock 行为和测试文件引用。
2. `部分集成` 接口不得伪装字段已确认，必须在备注中说明缺失的数据要求。
3. `未集成/待后端确认` 接口必须说明缺口和后续处理方式。
