# 麻醉字典配置契约（Slice 2）

> 对应后端 `app\samis\domain\dict` + `app\samis\domain\room`，前端 `/www/soft/samis-main`。
> 通用响应：`api_success(data)` / `api_paginate(list, page, page_size, total)` / `api_error(code, msg)`。
> 写接口统一 `application/x-www-form-urlencoded`（前端 `buildFormPost`）。
> 真实开关：`VITE_USE_REAL_ANESTHESIA_DICT=true`（默认 mock）；房间读写复用 `VITE_USE_REAL_ROOM`。

## 1. 资源清单

| 配置页 | 后端资源 | 读接口 | 写接口 | category_code |
|---|---|---|---|---|
| ConfigDrugs | drugDict | `GET /anesthesiaDict/getDrugDict` | `saveDrugDict` / `disableDrugDict` | — |
| ConfigFluids | fluidDict + bloodProductDict | `getFluidDict` / `getBloodProductDict` | `saveFluidDict` / `saveBloodProductDict` / `disable*` | — |
| ConfigPrint | template | `getTemplate` | `saveTemplate` / `disableTemplate` | — |
| ConfigMethods | dictCategory + dictItem | `getDictCategory` + `getDictItem?category_code=anesthesia_method` | `saveDictCategory` / `saveDictItem` / `disable*` | `anesthesia_method` |
| ConfigEvents | dictItem | `getDictItem?category_code=anesthesia_event` | `saveDictItem` / `disableDictItem` | `anesthesia_event` |
| ConfigScores | dictItem | `getDictItem?category_code=anesthesia_score` | `saveDictItem` / `disableDictItem` | `anesthesia_score` |
| ConfigVitals | anesVitalDict（新） | `GET /anesthesiaDict/getVitalDict` | `saveVitalDict` / `disableVitalDict` | — |
| ConfigStaff | anesStaff（新） | `GET /anesthesiaDict/getStaff` | `saveStaff` / `disableStaff` | — |
| ConfigRooms | room（委托 huli） | `GET /room/getRoomList` | `roomCreate/Update/Delete`、`roomGroupCreate/Update/Delete` | — |

## 2. 分页结构

- 请求 query：`page`（从 1）、`page_size`（前端统一传 `page_size`；后端 `pageSize` 兼容）。
- 响应：`{ list: [], total, page, page_size }`，前端适配器兼容 `list/data/records`。
- 列表查询统一带 `page=1&page_size=500` 拉全量回填配置页。

## 3. 关键字段约定

### anesVitalDict（生命体征）
读响应（camelCase）：`id, code, shortCode, itemName/name, unit, normalRange, lowerLimit, upperLimit, defaultValue, chartEnabled, chartColor, chartSymbol, decimalPlaces, sortOrder, enabled, remark`。
写字段（snake_case 兼容 camelCase）：`code, short_code, item_name, unit, normal_range, lower_limit, upper_limit, default_value, chart_enabled, chart_color, chart_symbol, decimal_places, sort_no, is_active, enabled, remark`。

### anesStaff（麻醉人员）
读响应：`id, gh, name, title, departmentCode, departmentName, role, schedulingWeight, adminUserId, sortOrder, enabled, remark`。
写字段：`gh, name, title, department_code, department_name, role, scheduling_weight, admin_user_id, sort_no, is_active, remark`。

### anes_template（打印模板）
读响应：`id, template_code, template_name, template_type, applicable_*, is_default, is_active, created_at`。
写字段：`id(更新时), template_code, template_name, template_type, is_default, is_active, remark`。

### anes_dict_category / anes_dict_item（通用字典）
- dictCategory：`id, category_code(唯一), category_name, description, sort_no, is_active`。
- dictItem：`id, category_code, item_code, item_name, item_value, parent_code, sort_no, remark, is_active`。
- **`category_code` 走精确匹配**（Slice 2 修复 `AnesDictService::buildWhere`，从 likeFields 移至 exactFields）。
- 麻醉方式树：大类存 dictCategory（`category_code = GA/NEURAXIAL/REGIONAL/MAC/LOCAL`），具体方式存 dictItem（`category_code='anesthesia_method'`，`parent_code` 指向大类）。

### room（委托 huli）
字段沿用 huli 大写命名：手术间 `OPERATION_ROOM_ID/NAME/CODE/TYPE/GROUP`；手术部 `ID/OPERATION_ROOM_TYPE/TYPE_NAME/GROUP/GROUP_NAME`。
samis `RoomService` → `RoomExportService` → huli `RoomService`，写方法一对一委托（`addRoom/updateRoom/deleteRoom/addRoomType/updateRoomType/deleteRoomType`）。

## 4. Seed 数据对齐

- `doc/sql/samis_anes_vital_dict.sql`、`doc/sql/samis_anes_staff.sql`、`doc/sql/samis_dict_seed_methods_events_scores.sql`。
- 前端 `src/mock/configSeed.ts` 的 `seedVitalSignDict` / `seedMethodCategories` / `seedFluidBloodDict` 与后端 seed 值一致，确保 mock↔真实切换无缝。

## 5. 前端数据流

1. 登录后 `loadSamisBaseCatalog` → `bootstrapRemoteConfigs()` 并发加载 9 类字典，失败回退 seed。
2. 配置页 `computed` 读 store（`configDrugs/configFluids/configVitals/configMethods/configEvents/configScores/configPrintTemplates/configStaff/configRooms` + 对象数组 `configTemplateItems/configStaffItems`）。
3. 保存：整表替换型面板经 `useDictArrayPersist`（`persistArrayDiff` / `persistStringListDiff`）拆为逐条 `save*Entry/disable*Entry`，真实开关开→调后端，关→仅本地。
4. mock 模式：`src/services/mock/samisMockRouter.ts` 为新资源（vital/staff/template/dictItem 分类/room 写）提供稳定 mock，`useReal=false` 时页面可用。

## 6. 已知边界

- ConfigRooms / ConfigMethods 当前以"读后端 + 本地编辑"为主；结构化房间/方式树的逐条写需后续按 huli 字段语义增强（房间写接口已就绪）。
- `anesStaff.admin_user_id` 与系统账号关联为可选，本切片不做权限绑定。
