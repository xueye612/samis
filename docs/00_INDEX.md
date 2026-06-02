# samisweb 文档入口（唯一索引）

更新时间：2026-06-02

## 麻醉记录单（当前主事实）

| 文档 | 用途 |
|---|---|
| [麻醉记录单](02_specs/麻醉记录单.md) | 本地持久化、同步、冲突、设备模拟、后端接口、验收（合并版） |
| [用药显示规则](02_specs/麻醉记录单用药显示规则.md) | 画线 / 特殊用药区 / 时间轴标注 |
| [药品字典接口要求](02_specs/麻醉药品字典接口要求.md) | getDrugDict、特殊用药推荐字段 |
| [后端联调字段对照表](02_specs/麻醉记录单后端联调字段对照表.md) | pushBatch、实体 payload、表映射 |
| [current-completed-features](04_delivery/current-completed-features.md) | 已完成能力（mock / 真实后端） |
| [麻醉数据库开发主文档](03_dictionary/麻醉数据库开发主文档.md) | OceanBase 表与 IndexedDB 映射 |

## 接口风格（主链路）

```text
/api-samis/pc/v1/operationInfo/getOperationInfo
/api-samis/pc/v1/anesthesiaRecord/*
/api-samis/pc/v1/anesthesiaSync/*
/api-samis/pc/v1/anesthesiaDevice/*
```

**不作为当前主接口：** `/api/anesthesia/records`（legacy mock）、`/api/anes/*`（护理后端规划，见 shuhu-surgianes 仓库）。

## 补充参考（非主事实）

| 文档 | 说明 |
|---|---|
| [麻醉管理系统 Web 原型与质控](麻醉管理系统_Web原型与质控指标设计文档.md) | 26 项质控展示规范 |
| [麻醉数据库基础功能规划](麻醉数据库基础功能规划_含人员权限日志.md) | 12 业务域优先级 |
| [前端原型优化方向](前端原型优化方向与组件规划.md) | 组件与质控完整性 |
| [护理系统新版本数据库文档](护理系统新版本数据库文档.md) | 护理 SoT 字典引用 |
