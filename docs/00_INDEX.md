# samisweb 文档入口（唯一索引）

更新时间：2026-06-02（Apifox 联调对齐）

## 麻醉记录单（当前主事实）

| 文档 | 用途 |
|---|---|
| [麻醉记录单](02_specs/麻醉记录单.md) | 本地持久化、同步、冲突、设备模拟、后端接口、验收；含抢救模式时间轴/分页同步 |
| [用药显示规则](02_specs/麻醉记录单用药显示规则.md) | 画线 / 特殊用药区 / 时间轴标注 |
| [药品字典接口要求](02_specs/麻醉药品字典接口要求.md) | getDrugDict、特殊用药推荐字段 |
| [后端联调字段对照表](02_specs/麻醉记录单后端联调字段对照表.md) | pushBatch、实体 payload、表映射 |
| [current-completed-features](04_delivery/current-completed-features.md) | 已完成能力（mock / 真实后端） |
| [麻醉数据库开发主文档](03_dictionary/麻醉数据库开发主文档.md) | OceanBase 表与 IndexedDB 映射 |

## 接口风格（主链路）

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
```

**后端联调地址（Apifox / 测试环境）：** `http://47.105.38.226:8022`（开发通过 Vite 代理 `/api-samis` → 该主机，见 `.env.example`）。

**不作为当前主接口：** `/api/anesthesia/records`（legacy mock）、`/api/anes/*`（护理后端规划，见 shuhu-surgianes 仓库）。

## mock / real 替换进度（模块开关）

| 模块 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| 认证 | `VITE_USE_REAL_AUTH` | 开发 false | Login `POST /admin/login`（form `username`/`password`）；当前用户 `adminUser/getAdminUserInfo` |
| 手术通知单 | `VITE_USE_REAL_OPERATION_INFO` | 开发 false | 列表 `operationRoom`；排班 `startTime`/`endTime`；POST 写回为 form-urlencoded |
| 手术间 | `VITE_USE_REAL_ROOM` | 开发 false | `getRoomList` / `getRoomGroupList` → `configRooms` |
| 麻醉字典 | `VITE_USE_REAL_ANESTHESIA_DICT` | 开发 false | `getDrugDict` 等；POST 写回为 form-urlencoded；见 Apifox `anesthesia_dict_apifox_openapi.json` |
| 麻醉记录单 | `VITE_USE_REAL_ANESTHESIA_RECORD` | false | Apifox 未齐，继续 mock |
| 同步 | `VITE_USE_REAL_ANESTHESIA_SYNC` | false | pushBatch 等继续 mock |
| 设备上传 | `VITE_USE_REAL_DEVICE` | false | 监护仪/呼吸机 mock 采集不变 |

全局：`VITE_ANESTHESIA_USE_MOCK=false` 时，上述模块在未单独设为 false 时倾向走真实 HTTP。  
**baseURL 规范：** `VITE_SAMIS_API_BASE` 只含一次 `/api-samis/pc/v1`；业务 path 为 `/operationInfo/...`，禁止再拼完整 baseURL（防 Apifox 双前缀问题）。

**Apifox 写回编码（2026-06-02）：** `updateOperationInfo`、`saveNursePb`（`data`=JSON 数组字符串）、`updateNumberOfStations` 使用 `application/x-www-form-urlencoded`；工具见 `src/api/samisFormBody.ts`。

## 补充参考（非主事实）

| 文档 | 说明 |
|---|---|
| [麻醉管理系统 Web 原型与质控](麻醉管理系统_Web原型与质控指标设计文档.md) | 26 项质控展示规范 |
| [麻醉数据库基础功能规划](麻醉数据库基础功能规划_含人员权限日志.md) | 12 业务域优先级 |
| [前端原型优化方向](前端原型优化方向与组件规划.md) | 组件与质控完整性 |
| [护理系统新版本数据库文档](护理系统新版本数据库文档.md) | 护理 SoT 字典引用 |
