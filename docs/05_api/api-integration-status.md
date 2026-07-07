# SAMIS-PC API 集成状态清单

更新时间：2026-07-04  
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
| anesthesiaDict | 模板列表 | GET | `/anesthesiaDict/getTemplate` | `id/page/page_size` | 模板分页列表（`template_code/template_name/template_type/is_default/is_active`） | ConfigPrint | seed 模板 | 已集成 | `src/services/anesthesia/adapters/templateDictAdapter.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 保存模板 | POST | `/anesthesiaDict/saveTemplate` | form-urlencoded；`template_code/template_name/template_type/is_default/is_active` | `{ id }` | ConfigPrint | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 停用模板 | POST | `/anesthesiaDict/disableTemplate` | form-urlencoded；`id` | 停用结果 | ConfigPrint | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 模板字段列表 | GET | `/anesthesiaDict/getTemplateField` | `id/template_id/page/page_size` | 模板字段分页列表 | 配置页预留 | 空分页 | 部分集成 | `src/services/mock/samisMockRouter.test.ts` | Slice 2 暂未消费 |
| anesthesiaDict | 保存模板字段 | POST | `/anesthesiaDict/saveTemplateField` | form-urlencoded；模板字段 | 保存结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | Slice 2 暂未消费 |
| anesthesiaDict | 删除模板字段 | POST | `/anesthesiaDict/deleteTemplateField` | form-urlencoded；字段 id | 删除结果 | 配置页预留 | success null | 部分集成 | `src/api/samisFormBody.test.ts` | Slice 2 暂未消费 |
| anesthesiaDict | 字典分类列表 | GET | `/anesthesiaDict/getDictCategory` | `id/page/page_size` | 分类分页列表（`category_code/category_name/sort_no/is_active`） | ConfigMethods（大类） | seed 麻醉方式大类 | 已集成 | `src/services/anesthesia/adapters/dictListAdapter.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 保存字典分类 | POST | `/anesthesiaDict/saveDictCategory` | form-urlencoded；分类字段 | `{ id }` | ConfigMethods | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 停用字典分类 | POST | `/anesthesiaDict/disableDictCategory` | form-urlencoded；分类 id/code | 停用结果 | ConfigMethods | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 字典项列表 | GET | `/anesthesiaDict/getDictItem` | `id/category_code/page/page_size`（`category_code` 精确匹配） | 字典项分页列表（`item_code/item_name/parent_code/sort_no/is_active`） | ConfigMethods/Events/Scores | seed 方式/事件/评分 | 已集成 | `src/services/anesthesia/adapters/dictListAdapter.test.ts` | Slice 2 修复为精确匹配 |
| anesthesiaDict | 保存字典项 | POST | `/anesthesiaDict/saveDictItem` | form-urlencoded；`category_code/item_code/item_name/parent_code/sort_no/is_active` | `{ id }` | ConfigMethods/Events/Scores | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 停用字典项 | POST | `/anesthesiaDict/disableDictItem` | form-urlencoded；字典项 id | 停用结果 | ConfigMethods/Events/Scores | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 液体字典 | GET | `/anesthesiaDict/getFluidDict` | `id/page/page_size` | 液体分页列表 | ConfigFluids、记录单输液 | seed 液体字典 | 已集成 | `src/services/anesthesia/adapters/fluidDictAdapter.test.ts` | 可支持 `list/data/records` |
| anesthesiaDict | 保存液体字典 | POST | `/anesthesiaDict/saveFluidDict` | form-urlencoded；`fluid_code/fluid_name/default_unit/default_volume/is_count_input/is_active` | `{ id }` | ConfigFluids | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 停用液体字典 | POST | `/anesthesiaDict/disableFluidDict` | form-urlencoded；液体 id | 停用结果 | ConfigFluids | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 血制品字典 | GET | `/anesthesiaDict/getBloodProductDict` | `id/page/page_size` | 血制品分页列表 | ConfigFluids、记录单输血 | seed 血制品 | 已集成 | `src/services/anesthesia/adapters/fluidDictAdapter.test.ts` | Slice 2 接 ConfigFluids |
| anesthesiaDict | 保存血制品字典 | POST | `/anesthesiaDict/saveBloodProductDict` | form-urlencoded；`product_code/product_name/...` | `{ id }` | ConfigFluids | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 字段确认 |
| anesthesiaDict | 停用血制品字典 | POST | `/anesthesiaDict/disableBloodProductDict` | form-urlencoded；血制品 id | 停用结果 | ConfigFluids | success null | 已集成 | `src/api/samisFormBody.test.ts` | 逻辑停用 |
| anesthesiaDict | 生命体征字典 | GET | `/anesthesiaDict/getVitalDict` | `id/page/page_size` | 生命体征分页列表（`code/short_code/item_name/unit/normal_range/chart_*`） | ConfigVitals | seed 生命体征 | 已集成 | `src/services/anesthesia/adapters/vitalDictAdapter.test.ts` | Slice 2 新建资源 |
| anesthesiaDict | 保存生命体征字典 | POST | `/anesthesiaDict/saveVitalDict` | form-urlencoded；生命体征字段 | `{ id }` | ConfigVitals | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 新建资源 |
| anesthesiaDict | 停用生命体征字典 | POST | `/anesthesiaDict/disableVitalDict` | form-urlencoded；`id` | 停用结果 | ConfigVitals | success null | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 新建资源 |
| anesthesiaDict | 麻醉人员字典 | GET | `/anesthesiaDict/getStaff` | `id/page/page_size` | 人员分页列表（`gh/name/title/department_name/role/scheduling_weight`） | ConfigStaff | seed 人员 | 已集成 | `src/services/anesthesia/adapters/staffDictAdapter.test.ts` | Slice 2 新建资源 |
| anesthesiaDict | 保存麻醉人员 | POST | `/anesthesiaDict/saveStaff` | form-urlencoded；人员字段 | `{ id }` | ConfigStaff | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 新建资源 |
| anesthesiaDict | 停用麻醉人员 | POST | `/anesthesiaDict/disableStaff` | form-urlencoded；`id` | 停用结果 | ConfigStaff | success null | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 新建资源 |
| room | 新建手术间 | POST | `/room/roomCreate` | form-urlencoded；`OPERATION_ROOM_NAME/CODE/TYPE/GROUP` | `{ id }` | ConfigRooms（预留） | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | Slice 2 委托 huli addRoom |
| room | 更新手术间 | POST | `/room/roomUpdate` | form-urlencoded；`OPERATION_ROOM_ID/...` | 更新结果 | ConfigRooms（预留） | success true | 已集成 | `src/api/samisFormBody.test.ts` | 委托 huli updateRoom |
| room | 删除手术间 | POST | `/room/roomDelete` | form-urlencoded；`id` | 删除结果 | ConfigRooms（预留） | success true | 已集成 | `src/api/samisFormBody.test.ts` | 委托 huli deleteRoom |
| room | 新建手术部 | POST | `/room/roomGroupCreate` | form-urlencoded；`OPERATION_ROOM_TYPE/TYPE_NAME/GROUP/...` | `{ id }` | ConfigRooms（预留） | 返回 id | 已集成 | `src/api/samisFormBody.test.ts` | 委托 huli addRoomType |
| room | 更新手术部 | POST | `/room/roomGroupUpdate` | form-urlencoded；`ID/...` | 更新结果 | ConfigRooms（预留） | success true | 已集成 | `src/api/samisFormBody.test.ts` | 委托 huli updateRoomType |
| room | 删除手术部 | POST | `/room/roomGroupDelete` | form-urlencoded；`id` | 删除结果 | ConfigRooms（预留） | success true | 已集成 | `src/api/samisFormBody.test.ts` | 委托 huli deleteRoomType |
| anesthesiaDict | 事件字典 | GET | `/anesthesiaDict/getEventDict` | 待确认 | 事件列表 | 记录单事件候选预留 | 空分页 | 待后端确认 | 无 | OpenAPI 未定义，mock 保留 |
| anesthesiaDict | 设备字典 | GET | `/anesthesiaDict/getDeviceDict` | 待确认 | 设备列表 | 设备配置预留 | 空分页 | 待后端确认 | 无 | OpenAPI 未定义，mock 保留 |
| anesthesiaRecord | 记录单详情 | GET | `/anesthesiaRecord/getRecordDetail` | `operationId`，可选 `recordLocalId/recordServerId` | 聚合详情或 `record:null` | 麻醉记录单冷启动回读/手动重载 | 从 `mockApi.getAnesthesiaRecord` 返回 | 已集成(真实回读) | `src/api/anesthesiaSync.test.ts`、`src/api/anesthesiaRecord.real.integration.test.ts` | Slice 3a 后端已落地；**Slice 3f 改为聚合回读**：`record` 含主表元数据 + `casePayload`（case 级非列表 JSON）+ 7 类关系列表（medications/timelineEvents/vitalSigns/fluids/transfusions/ioRecords/labResults）；**不含 device raw**。前端 `hydrateCaseFromServer`（冷启动）+ `reloadCaseFromServer`（手动重载）重建 SurgeryCase 并 seed/覆盖本地 |
| anesthesiaRecord | 打印快照检索 | GET | `/anesthesiaRecord/getPrintSnapshot` | `operationId` | 最新 immutable 打印快照（snapshotPayload/printedAt/operator）或 `snapshot:null` | 打印/重打追溯 | 无则 `snapshot:null` | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c 新增：用于打印不依赖实时 operationInfo；后端按 `immutable=1` + `snapshot_no desc` 取最新 |
| anesthesiaRecord | 保存记录单 | POST | `/anesthesiaRecord/saveRecord` | JSON；record 主表/全量 payload（`operationId/localId/recordStatus/pageCount/currentPage` 必填） | `localId/serverId` | 同步队列、记录单保存 | 返回 serverId | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts`、`src/api/anesthesiaRecord.real.integration.test.ts` | 粗粒度保存；Slice 3a 幂等 `(operationId,localId)` upsert，update 路径最新覆盖+sync_version+1 |
| anesthesiaRecord | 保存快照 | POST | `/anesthesiaRecord/saveSnapshot` | JSON；患者/手术/记录快照 | `snapshotId/serverId/savedAt` | 打印/归档预留 | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c 打印追溯：经 pushBatch `snapshot` 项落库，`snapshotReason=print/lock` 置 immutable=1、snapshot_no 递增不覆盖 |
| anesthesiaRecord | 批量保存时间轴事件 | POST | `/anesthesiaRecord/batchSaveTimelineEvents` | JSON；`items[]`，每项含 `localId`、`operationId`、事件字段 | `results[]`；逐项 `localId/serverId/status/serverSyncVersion` | 同步队列 | 批量 success | 已集成 | `src/services/mock/samisMockRouter.test.ts`、`src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存用药 | POST | `/anesthesiaRecord/batchSaveMedications` | JSON；`items[]`，药名、剂量、单位、途径、时间、特殊用药字段 | `results[]` 同上 | 同步队列、用药记录 | 批量 success | 已集成 | `src/services/mock/samisMockRouter.test.ts`、`src/api/anesthesiaSync.test.ts` | 本轮新增 wrapper/mock |
| anesthesiaRecord | 批量保存输液 | POST | `/anesthesiaRecord/batchSaveFluids` | JSON；`items[]`，液体名、容量、起止时间 | `results[]` 同上 | 同步队列（Slice 3c 生产者接入） | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c：`appendFluid/upsertFluid/deleteFluid` 按 `category!=='血液制品'` 经 pushBatch `fluid` 项落库 |
| anesthesiaRecord | 批量保存输血 | POST | `/anesthesiaRecord/batchSaveTransfusions` | JSON；`items[]`，血制品、容量/单位、起止时间 | `results[]` 同上 | 同步队列（Slice 3c 生产者接入） | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c：`FluidRecord.category==='血液制品'` 经 pushBatch `transfusion` 项落库 |
| anesthesiaRecord | 批量保存生命体征 | POST | `/anesthesiaRecord/batchSaveVitalSigns` | JSON；`items[]`，测量时间、HR/SBP/DBP/SpO2 等 | `results[]` 同上 | 同步队列、设备修正 | 批量 success | 已集成 | `src/api/anesthesiaSync.test.ts` | 已有接口统一到通用 batch mock |
| anesthesiaRecord | 锁定记录单 | POST | `/anesthesiaRecord/lockRecord` | JSON；`operationId/recordLocalId/recordServerId` | `locked/lockedAt` | 归档/打印预留 | 返回 locked | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts`、`src/api/anesthesiaRecord.real.integration.test.ts` | Slice 3a 后端幂等锁定（record_locked=1/record_status=locked） |
| anesthesiaRecord | 作废记录单 | POST | `/anesthesiaRecord/voidRecord` | JSON；`operationId/recordLocalId/voidReason` | `voided/voidedAt` | 记录单管理预留 | 返回 voided | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts`、`src/api/anesthesiaRecord.real.integration.test.ts` | Slice 3a 后端软删 `deleted_at`，getRecordDetail 随后返回 null |
| anesthesiaRecord | 保存出入量 | POST | `/anesthesiaRecord/saveIoRecord` | JSON；`localId/operationId/intake/output/time` | `localId/serverId/savedAt` | 同步队列（Slice 3c 生产者接入） | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c：`upsertOutputRecord/deleteOutputRecord` 经 pushBatch `io_record` 项落库（case_payload 派生 outputs 不重复入队） |
| anesthesiaRecord | 保存检验结果 | POST | `/anesthesiaRecord/saveLabResult` | JSON；`localId/operationId/itemName/value/unit/time` | `localId/serverId/savedAt` | 同步队列（Slice 3c 生产者接入） | 返回 serverId | 已集成 | `src/api/anesthesiaSync.test.ts` | Slice 3c：`upsertLabResult` 经 pushBatch `lab_result` 项落库 |
| anesthesiaSync | 批量同步 | POST | `/anesthesiaSync/pushBatch` | JSON；`batchNo/operationId/recordLocalId/clientTime/items[]`；item 见联调文档 | `batchNo/results[]`；支持 success/failed/conflict | 同步队列 | 幂等、冲突、设备去重模拟 | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts` | Slice 3b 落地 5 处理器；Slice 3c 扩 4 处理器（fluid/transfusion/io_record/lab_result）+ snapshot 打印追溯；Slice 3d 扩 device 处理器（monitor_raw/ventilator_raw）；Slice 3e 产出全量 conflictType；**Slice 3f record 处理器持久化 `casePayload`→`anes_record.case_payload`（≤512KB，超限 failed）**；单端点按 `entityType` 分发，幂等+版本+冲突，单 item 事务允许部分成功；`VITE_USE_REAL_ANESTHESIA_SYNC=true` 走真，默认 mock |
| anesthesiaSync | 同步状态 | GET | `/anesthesiaSync/getSyncStatus` | `operationId` | `pendingCount/online/lastSyncedAt` | 同步状态栏 | online + 0 pending | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts` | Slice 3b 后端真实落地，后端 pendingCount 恒 0 |
| anesthesiaSync | 待同步数量 | GET | `/anesthesiaSync/getPendingCount` | 可选 `operationId` | `pendingCount` | 同步状态栏 | 0 pending | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts` | Slice 3b 后端真实落地 |
| anesthesiaSync | 确认批次 | POST | `/anesthesiaSync/confirmBatch` | JSON；`batchNo` | `batchNo/confirmed` | 同步队列预留 | confirmed true | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts` | Slice 3b 后端真实落地 |
| anesthesiaSync | 解决冲突 | POST | `/anesthesiaSync/resolveConflict` | JSON；`conflictId/operationId/entityType/localId/serverId/conflictType/action/mergedPayload/serverSyncVersion/note` | `conflictId/resolved/resolvedAt/serverSyncVersion` | SyncConflictPanel 冲突决策 | resolved true | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts`、`src/services/anesthesia/anesthesiaSyncConflict.test.ts` | Slice 3e 后端真实落地：force-apply（keep_local_correction/manual_merge/retry_sync）绕过版本/锁定校验强制 upsert + sync_version+1（子表复活已软删行）；use_server/ignore_local 仅审计；幂等 `conflict_id`；写 `anes_sync_conflict_resolution` + audit。前端 `resolveSyncConflict` 在 `useRealAnesthesiaSync()` 时 best-effort 调用（失败仅 warn 不阻断本地收敛） |
| anesthesiaDevice | 批量推送监护仪原始数据 | POST | `/anesthesiaDevice/batchPushMonitorData` | JSON；`items[]`，含 `localId/collectTime/deviceId/payload` | `results[]` | 设备采集服务 | 去重 success | 已集成(可选开启) | `src/api/anesthesiaSync.test.ts` | Slice 3d：device 原始写入走 pushBatch（`entityType=monitor_raw`），独立 batchPush* 端点暂缓；前端按 `useRealDevice()` 门控入队（默认 false），置 `VITE_USE_REAL_DEVICE=true` 即同步 |
| anesthesiaDevice | 批量推送呼吸机原始数据 | POST | `/anesthesiaDevice/batchPushVentilatorData` | JSON；`items[]`，含 `localId/collectTime/deviceId/payload` | `results[]` | 设备采集服务 | 去重 success | 已集成(可选开启) | `src/api/anesthesiaSync.test.ts` | Slice 3d：device 原始写入走 pushBatch（`entityType=ventilator_raw`），与 `ventilator_raw` 对齐 |
| anesthesiaDevice | 最新设备数据 | GET | `/anesthesiaDevice/getLatestDeviceData` | `operationId` | `{ monitor, ventilator }`（各最新一条原始行，无则 null） | 记录单设备展示预留 | null/null | 已集成(真实可切) | `src/api/anesthesiaSync.test.ts` | Slice 3d 后端真实落地：取该手术最新一条 monitor 行 + 最新一条 ventilator 行；无 UI 消费者，wrapper 可用 |
| pacu | PACU 恢复单列表 | GET | `/pacu/list` | `status/room/caseId/pacuInTimeStart/pacuInTimeEnd/page/page_size` | `{ list, page, page_size, total }`（camelCase 恢复单行） | PACU 列表、预警派生 | mock 种子恢复单 | 已集成(真实可切) | `src/services/anesthesia/adapters/pacuAdapter.test.ts` | Slice 4：独立 REST CRUD（非 pushBatch）；`VITE_USE_REAL_PACU=true` 走真，默认 mock |
| pacu | PACU 恢复单详情 | GET | `/pacu/getById` | `id` | 恢复单行 | 恢复单编辑 | mock 行 | 已集成(真实可切) | `src/services/anesthesia/adapters/pacuAdapter.test.ts` | Slice 4 |
| pacu | 入 PACU | POST | `/pacu/admit` | form-urlencoded；`caseId/pacuInTime`（必填）+ `patientName/room/operationId/bedNo/firstTemp/hr/bp/spo2/rr/aldreteIn/vasScore/remark` | 新建恢复单行（含 id） | PacuReceive 入室 | 返回 mock 行 | 已集成(真实可切) | `src/services/anesthesia/adapters/pacuAdapter.test.ts` | Slice 4：同 case 已有活跃单→`1003`；患者信息前端补传（plan R1） |
| pacu | 更新恢复记录 | POST | `/pacu/update` | form-urlencoded；`id`（必填）+ 恢复单字段（firstTemp/hr/bp/spo2/rr/aldreteIn/aldreteOut/vasScore/flags/status/bedNo/remark） | 更新后恢复单行 | 恢复单编辑保存 | true | 已集成(真实可切) | `src/services/anesthesia/adapters/pacuAdapter.test.ts` | Slice 4：不经此端点置转出时间/去向 |
| pacu | 转出 | POST | `/pacu/transferOut` | form-urlencoded；`id/pacuOutTime/outDestination`（必填）+ `aldreteOut/handoverNurseId` | 转出后恢复单行 | 转出确认 | true | 已集成(真实可切) | `src/services/anesthesia/adapters/pacuAdapter.test.ts` | Slice 4：置 status=已转出；已转出重复→`1004`；转出后允许同 case 再入 |
| pacu | 预约列表 | GET | `/pacu/bookingList` | `status/pacuRoomId/caseId/bookingTimeStart/bookingTimeEnd/page/page_size` | `{ list, page, page_size, total }`（camelCase 预约行） | PacuBooking 列表 | mock 种子预约 | 已集成(真实可切) | — | Slice 4b：独立 REST CRUD；`VITE_USE_REAL_PACU=true` 走真，默认 mock |
| pacu | 预约详情 | GET | `/pacu/bookingGetById` | `id` | 预约行 | 预约编辑 | mock 行 | 已集成(真实可切) | — | Slice 4b |
| pacu | 创建预约 | POST | `/pacu/bookingCreate` | form-urlencoded；`caseId/bookingTime`（必填）+ `patientName/pacuRoomId/bedId/bookingDoctor/bookingType` | 新建预约行（含 id，status=待接收） | 新增预约 | mock 行 | 已集成(真实可切) | — | Slice 4b：bookingType 常规预约/紧急预约；床位 bedId 自由字段不校验 |
| pacu | 更新预约 | POST | `/pacu/bookingUpdate` | form-urlencoded；`id`（必填）+ `patientName/pacuRoomId/bedId/bookingTime/bookingDoctor/bookingType` | 更新后预约行 | 编辑预约 | 更新后 mock 行 | 已集成(真实可切) | — | Slice 4b：不修改 status（用 cancel 改状态） |
| pacu | 取消预约 | POST | `/pacu/bookingCancel` | form-urlencoded；`id`（必填） | 取消后预约行（status=已取消） | 取消预约 | mock 行 | 已集成(真实可切) | — | Slice 4b：已取消重复→`1104`；不回滚已入室 anes_pacu_record |
| postoperative | 术后随访列表 | GET | `/postoperative/followupList` | `caseId/followupType/followTimeStart/followTimeEnd/page/page_size` | `{ list, page, page_size, total }`（camelCase 随访行） | 随访管理页列表 | mock 种子随访 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5：独立 REST CRUD（非 pushBatch）；`VITE_USE_REAL_POSTOPERATIVE=true` 走真，默认 mock |
| postoperative | 术后随访详情 | GET | `/postoperative/followupGetById` | `id` | 随访行 | 随访编辑 | mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5 |
| postoperative | 新增随访 | POST | `/postoperative/followupCreate` | form-urlencoded；`caseId/followupType/followTime`（必填）+ `patientName/operationId/vasScore/nausea/headache/hoarseness/hoarsenessDurationHours/numbness/motorDisorder/awareness/respiratoryDepression/reintubation/transferredIcu/newComa/neuroDurationHours/death24h/deathTime/advice` | 新建随访行（含 id） | 随访新增/编辑 | mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5：followupType ∈ 术后镇痛随访/全麻术后随访/区域阻滞术后随访；同 case 多条无唯一约束 |
| postoperative | 更新随访 | POST | `/postoperative/followupUpdate` | form-urlencoded；`id`（必填）+ 随访字段 | 更新后随访行 | 随访编辑保存 | 更新后 mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5 |
| postoperative | 删除随访 | POST | `/postoperative/followupDelete` | form-urlencoded；`id`（必填） | `{ id }` | 随访删除 | `{ id }` | 已集成(真实可切) | `src/services/mock/samisMockRouter.test.ts` | Slice 5：软删（deleted_at） |
| postoperative | 并发症列表 | GET | `/postoperative/complicationList` | `caseId/status/complicationType/reportTimeStart/reportTimeEnd/page/page_size` | `{ list, page, page_size, total }`（camelCase 并发症行） | 并发症追踪页列表 | mock 种子并发症 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5 |
| postoperative | 并发症详情 | GET | `/postoperative/complicationGetById` | `id` | 并发症行 | 并发症编辑 | mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5 |
| postoperative | 新增并发症 | POST | `/postoperative/complicationCreate` | form-urlencoded；`caseId/complicationType/reportTime`（必填）+ `patientName/operationId/severity/stage/symptoms/treatment/outcome/status` | 新建并发症行（含 id） | 并发症登记 | mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5：severity ∈ 轻度/中度/重度/危及生命；status ∈ 草稿/已提交；已提交仍可编辑（R4） |
| postoperative | 更新并发症 | POST | `/postoperative/complicationUpdate` | form-urlencoded；`id`（必填）+ 并发症字段 | 更新后并发症行 | 并发症编辑保存 | 更新后 mock 行 | 已集成(真实可切) | `src/services/anesthesia/postoperativeService.test.ts` | Slice 5 |
| postoperative | 删除并发症 | POST | `/postoperative/complicationDelete` | form-urlencoded；`id`（必填） | `{ id }` | 并发症删除 | `{ id }` | 已集成(真实可切) | `src/services/mock/samisMockRouter.test.ts` | Slice 5：软删 |
| postoperative | 镇痛病例聚合 | GET | `/postoperative/analgesiaCases` | `room/page/page_size` | `{ list, page, page_size, total }`（case 摘要行） | 术后镇痛页病例列表 | 派生自 cases postoperativeAnalgesia | 已集成(真实可切) | `src/services/mock/samisMockRouter.test.ts` | Slice 5：查 anes_record.case_payload.postoperativeAnalgesia=true；无 case_payload 的记录不命中（operationInfo 兜底，R1） |
| postoperative | 非计划事件聚合 | GET | `/postoperative/unplannedCases` | `room/page/page_size` | `{ list, page, page_size, total }`（case 摘要行） | 非计划事件页病例列表 | 派生自 cases 标志 | 已集成(真实可切) | `src/services/mock/samisMockRouter.test.ts` | Slice 5：transferIcuPlanned / reintubation / transferTo=ICU 任一命中 |
| quality | 26 指标列表 | GET | `/quality/indicators` | `startDate/endDate 或 startMonth/endMonth/doctorId/department/locationType/roomId/category`（均可选） | `{ list? }` 即 26 行 `{code,name,category,unit,numerator,denominator,rate,value,expression,displayValue,target,warningRule,met,status}` | 质控看板/概览（26 指标卡片） | 服务端权威计算（非 mock） | 已集成(真实可切) | `src/services/quality.qualityParity.test.ts` | Slice 6a：服务端计算；`VITE_USE_REAL_QUALITY=true` 走真，默认 mock（TS qualityCalculator 兜底）。公式以 TS 为基准、PHP 对齐 |
| quality | 指标穿透 | GET | `/quality/indicatorDetail` | `code`（必填）+ 同上过滤 | `{code,...,numeratorCases[],denominatorCases[],defectCases[],totals}`（CaseSummary 列表） | 看板穿透抽屉（分子/分母 case 列表） | 服务端权威计算 | 已集成(真实可切) | `src/services/quality.qualityParity.test.ts` | Slice 6a：分子/分母 case 数量须 = indicators 的 numerator/denominator |
| quality | 月度报表 | GET | `/quality/report` | `period(YYYY-MM) 或 startMonth~endMonth` + 过滤 | `{periods:[{month,indicators[],categorySubtotals[]}],months[]}` | 月度质控报表页 | 服务端权威计算 | 已集成(真实可切) | — | Slice 6a：按月聚合 + 分类小计（达标/有数据计数） |
| quality | 低体温病例聚合 | GET | `/quality/hypothermiaCases` | 同 indicators 过滤 | `{total,list:[{caseId,patientName,room,department,operationName,anesthesiaMethod,doctorName,isGeneralAnesthesia,evidence[]}]}` | 低体温专项页 | 派生自 timeline_event/vital_sign/pacu_record | 已集成(真实可切) | — | Slice 6c B：命中 ∪ (event 含低体温) ∪ (TEMP<36) ∪ (pacu first_temp<36)；evidence.source ∈ event/vital_temp/pacu_first_temp |
| quality | 不良事件聚合 | GET | `/quality/adverseEvents` | 同 indicators 过滤 | `{total,list:[{id,caseId,patientName,room,department,operationName,type,name,stage,severity,treatment,description,reviewStatus,eventTime}]}` | 不良事件统计页 | 派生自 timeline_event（12 类 isQualityEvent） | 已集成(真实可切) | — | Slice 6c B：12 类枚举与 6b 缺陷规则、前端 store inline 同源（R4） |
| quality | 抽查列表 | GET | `/quality/checkList` | `result/rectifyStatus/checkItem/page/page_size` | `{list,page,page_size,total}`（camelCase 抽查行） | 质控总览抽查记录 | anes_quality_check | 已集成(真实可切) | — | Slice 6c B：人工抽查活动记录（独立于 6b 规则缺陷，R6） |
| quality | 抽查详情 | GET | `/quality/checkGetById` | `id` | 抽查行 | 抽查编辑 | anes_quality_check | 已集成(真实可切) | — | Slice 6c B |
| quality | 新增抽查 | POST | `/quality/checkCreate` | form-urlencoded；`checkItem`（必填）+ `standard/result/checker/checkDate/issueDesc/rectifyStatus` | 新建抽查行（含 id） | 质控总览新增 | anes_quality_check | 已集成(真实可切) | — | Slice 6c B：result ∈ 合格/不合格/待查；rectifyStatus ∈ 待整改/整改中/已闭环 |
| quality | 更新抽查 | POST | `/quality/checkUpdate` | form-urlencoded；`id`（必填）+ 抽查字段 | 更新后抽查行 | 质控总览编辑/闭环 | 更新后行 | 已集成(真实可切) | — | Slice 6c B |
| quality | 删除抽查 | POST | `/quality/checkDelete` | form-urlencoded；`id`（必填） | `true` | 质控总览删除 | `{ id }` | 已集成(真实可切) | — | Slice 6c B：物理删除（审计留痕） |
| pacu | 床位列表 | GET | `/pacu/bedList` | `roomId/status/page/page_size` | `{list,page,page_size,total}`（camelCase 床位行） | PACU 床位维护页 | anes_pacu_bed | 已集成(真实可切) | — | Slice 6c A |
| pacu | 床位分组全量 | GET | `/pacu/bedAllGrouped` | — | `[{roomId,roomName,beds[]}]` | QualityPacu 床位看板 | anes_pacu_bed | 已集成(真实可切) | — | Slice 6c A：保留 PacuRoom{beds:PacuBed[]} 形状，兼容 pacuBedStats getter |
| pacu | 床位详情 | GET | `/pacu/bedGetById` | `id` | 床位行 | 床位编辑 | anes_pacu_bed | 已集成(真实可切) | — | Slice 6c A |
| pacu | 床位统计 | GET | `/pacu/bedStats` | — | `{total,used,free,reserved,maintenance}` | QualityPacu 床位统计卡 | anes_pacu_bed | 已集成(真实可切) | — | Slice 6c A：明确分类，预留/维护不计入 used/free（R2） |
| pacu | 新增床位 | POST | `/pacu/bedCreate` | form-urlencoded；`roomId/bedNo`（必填）+ `status/remark` | 新建床位行（含 id） | 床位维护 | anes_pacu_bed | 已集成(真实可切) | — | Slice 6c A：UNIQUE(room_id,bed_no) 冲突→1203；占用态冲突→1202 |
| pacu | 更新床位 | POST | `/pacu/bedUpdate` | form-urlencoded；`id`（必填）+ `status/remark/patientName/caseId` | 更新后床位行 | 床位维护 | 更新后行 | 已集成(真实可切) | — | Slice 6c A：roomId/bedNo 不可改（唯一约束保护） |
| pacu | 删除床位 | POST | `/pacu/bedDelete` | form-urlencoded；`id`（必填） | `true` | 床位维护删除 | `{ id }` | 已集成(真实可切) | — | Slice 6c A：占用态禁止删除→1204（需先 transferOut） |
| pacu | 入 PACU（床位联动） | POST | `/pacu/admit` | 增可选 `bedId` | 恢复单行 | PACU 入室 | admit 事务内翻转床位占用 | 已集成(真实可切) | — | Slice 6c A：admit+床位更新同事务原子（R1）；bedId 可选 |
| pacu | 转出（床位联动） | POST | `/pacu/transferOut` | 同 4a | 恢复单行 | PACU 转出 | transferOut 事务内释放床位 | 已集成(真实可切) | — | Slice 6c A：按 caseId 查占用床→置空闲/清 case_id |
| preoperative | 申请列表 | GET | `/preoperative/requestList` | `status/urgency/department/requestDateStart/requestDateEnd/page/page_size` | `{list,total}`（camelCase 申请行） | 手术申请接收 | anes_preop_request | 已集成(真实可切) | `src/services/anesthesia/preoperativeService.test.ts` | Slice 7a：以 operation_id 为键 |
| preoperative | 申请详情 | GET | `/preoperative/requestGetById` | `id` | 申请行 | — | anes_preop_request | 已集成(真实可切) | — | 不存在→1300 |
| preoperative | 新建申请 | POST | `/preoperative/requestCreate` | form-urlencoded；`operationId`（必填）+患者/科室/手术/主刀/urgency/requestDate | 新建行（status=待接收） | — | anes_preop_request | 已集成(真实可切) | — | 同 operation_id 重复→1301；HIS 批量入库留后续（R1） |
| preoperative | 更新申请 | POST | `/preoperative/requestUpdate` | form-urlencoded；`id`（必填）+字段 | 更新后行 | — | anes_preop_request | 已集成(真实可切) | — | 不改 status（用 receive/cancel） |
| preoperative | 接收申请 | POST | `/preoperative/requestReceive` | form-urlencoded；`id` | 更新后行（status=已排班+receivedAt/By） | 手术申请接收 | anes_preop_request | 已集成(真实可切) | — | 非待接收→1302；仅状态联动不创建记录单（R4） |
| preoperative | 取消申请 | POST | `/preoperative/requestCancel` | form-urlencoded；`id` | 更新后行（status=已取消） | 手术申请接收 | anes_preop_request | 已集成(真实可切) | — | 已取消重复→1302 |
| preoperative | 会诊列表 | GET | `/preoperative/consultationList` | `caseId/status/consultDateStart/consultDateEnd/page/page_size` | `{list,total}`（会诊行） | 麻醉会诊 | anes_preop_consultation | 已集成(真实可切) | `src/services/anesthesia/preoperativeService.test.ts` | Slice 7a：一 case 多条（无唯一） |
| preoperative | 会诊详情/新建/更新 | GET/POST | `/preoperative/consultationGetById`、`consultationCreate`、`consultationUpdate` | create：`caseId`（必填）+科室/医师/consultDate/opinion/status | 会诊行 | 麻醉会诊 | anes_preop_consultation | 已集成(真实可切) | — | status 可经 update 置已完成 |
| preoperative | 检查审核列表 | GET | `/preoperative/examReviewList` | `caseId/reviewResult/reviewDateStart/reviewDateEnd/page/page_size` | `{list,total}`（审核行） | 术前检查审核 | anes_preop_exam_review | 已集成(真实可切) | `src/services/anesthesia/preoperativeService.test.ts` | Slice 7a：一 case 多条 |
| preoperative | 检查审核详情/新建/更新 | GET/POST | `/preoperative/examReviewGetById`、`examReviewCreate`、`examReviewUpdate` | create：`caseId`（必填）+labItems/imagingItems/reviewResult/reviewer/reviewDate | 审核行 | 术前检查审核 | anes_preop_exam_review | 已集成(真实可切) | — | reviewResult 通过/待补检/异常 |
| preoperative | 同意书列表/详情/按病例 | GET | `/preoperative/consentList`、`consentGetById`、`consentGetByCaseId` | `caseId/status/page/page_size`；getByCaseId：`caseId` | 同意书行（1:1 per case） | 知情同意 | anes_preop_consent | 已集成(真实可切) | `src/services/anesthesia/preoperativeService.test.ts` | Slice 7b：getByCaseId 无则返回 null（前端据此 create 草稿） |
| preoperative | 新建/更新同意书 | POST | `/preoperative/consentCreate`、`consentUpdate` | create：`caseId`（必填）；update：`id`+风险/方案/签名位 bool | 同意书行 | 知情同意 | anes_preop_consent | 已集成(真实可切) | — | 同 case 重复→1401；已提交再 update→1402；签名位为布尔标记非电子签影像（R5） |
| preoperative | 提交同意书 | POST | `/preoperative/consentSubmit` | form-urlencoded；`id` | 更新后行（status=已提交+signedAt） | 知情同意 | anes_preop_consent | 已集成(真实可切) | — | 已提交重复→1402 |
| preoperative | 核查列表/详情/按病例 | GET | `/preoperative/safetyCheckList`、`safetyCheckGetById`、`safetyCheckGetByCaseId` | `caseId/status/page/page_size`；getByCaseId：`caseId` | 核查行（1:1 per case） | 手术安全核查 | anes_preop_safety_check | 已集成(真实可切) | `src/services/anesthesia/preoperativeService.test.ts` | Slice 7b |
| preoperative | 新建/更新核查 | POST | `/preoperative/safetyCheckCreate`、`safetyCheckUpdate` | create：`caseId`（必填）；update：`id`+三查位 bool/checker/checkDate | 核查行 | 手术安全核查 | anes_preop_safety_check | 已集成(真实可切) | — | 同 case 重复→1501；三查全勾置已完成；唯一性 Service 判重无 DB UNIQUE（R2，同 PACU admit） |

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
