# samisweb 文档入口

本文件与 `docs/主文档集/00_入口/INDEX.md` 并列，专门索引**麻醉记录单本地持久化 / 同步 / 设备模拟**相关主事实文档。

## 当前主事实（A）

| 文档 | 用途 |
|---|---|
| [麻醉记录单本地持久化设计](02_specs/麻醉记录单本地持久化设计.md) | IndexedDB 表结构、刷新恢复、自动保存 |
| [麻醉记录单实时同步设计](02_specs/麻醉记录单实时同步设计.md) | 上传队列、断网补传、失败重试、节流 |
| [麻醉记录单同步冲突处理设计](02_specs/麻醉记录单同步冲突处理设计.md) | 版本冲突、锁定冲突、冲突面板与处理策略 |
| [麻醉设备模拟采集设计](02_specs/麻醉设备模拟采集设计.md) | 监护仪/呼吸机 mock 采集、raw 与显示点 |
| [麻醉记录单后端接口要求](02_specs/麻醉记录单后端接口要求.md) | `/api-samis/pc/v1/...` 接口清单与 mock 切换 |
| [麻醉记录单用药显示规则](02_specs/麻醉记录单用药显示规则.md) | 画线 / 特殊用药区 / mode 与 is_special |
| [麻醉药品字典接口要求](02_specs/麻醉药品字典接口要求.md) | getDrugDict、特殊用药推荐字段 |
| [麻醉数据库开发主文档](03_dictionary/麻醉数据库开发主文档.md) | OceanBase 表与 IndexedDB 映射 |
| [current-completed-features](04_delivery/current-completed-features.md) | 已完成能力（区分 mock / 真实后端） |
| [麻醉记录单持久化与设备模拟验收说明](04_delivery/麻醉记录单持久化与设备模拟验收说明.md) | 验收步骤 |

## 历史参考（C）

以下旧风格接口文档**不作为当前主接口**：

- `/api/anesthesia/records`（`src/services/mockApi.ts` 中仍保留兼容路由，仅历史参考）
- `/api/anes/*`（见 `docs/主文档集/04_主源参考/已实现接口.md`，护理后端规划）

当前主接口风格：

```text
/api-samis/pc/v1/operationInfo/getOperationInfo
/api-samis/pc/v1/anesthesiaRecord/*
/api-samis/pc/v1/anesthesiaSync/*
/api-samis/pc/v1/anesthesiaDevice/*
```
