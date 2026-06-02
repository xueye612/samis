# 手术麻醉管理系统 · 文档主索引

生成时间：2026-06-02
说明：本索引是手术麻醉系统文档的**唯一入口**。后续开发只能从这里进入。

**samisweb 本地持久化/同步/设备模拟**：见 [docs/00_INDEX.md](../../00_INDEX.md)（当前主事实）。

原则：
- 主源（A）：当前唯一权威，编辑请直接改这里
- 补充（B）：用于查漏补缺，可与主源交叉对照
- 归档（C）：仅作历史追溯，不作为开发依据

---

## 1. 必读主源（A）

| 文档 | 用途 | 路径 |
|---|---|---|
| 当前主事实说明 | 系统定位、当前实现边界、文档优先级、AI 协作时应优先读这份 | [docs/04_delivery/当前主事实说明.md](04_delivery/当前主事实说明.md) |
| 手术麻醉系统功能总览 | 按业务模块汇总的功能清单与完成度 | [docs/01_overview/手术麻醉系统功能总览.md](01_overview/手术麻醉系统功能总览.md) |
| 与手术护理系统复用边界说明 | 哪些复用、哪些扩展、哪些必须新建 | [docs/01_overview/与手术护理系统复用边界说明.md](01_overview/与手术护理系统复用边界说明.md) |
| 前端已完成功能核对 | 当前 PC / 原型 / 记录单的真实完成度 | [docs/02_current/前端已完成功能核对.md](02_current/前端已完成功能核对.md) |
| 后端现状与护理系统合并开发说明 | 麻醉后端如何在护理后端基础上扩展 | [docs/02_current/后端现状与护理系统合并开发说明.md](02_current/后端现状与护理系统合并开发说明.md) |
| 麻醉数据库开发主文档 | 麻醉数据库核心表分类、复用/新增标注 | [docs/03_dictionary/麻醉数据库开发主文档.md](03_dictionary/麻醉数据库开发主文档.md) |

---

## 2. 现存规格主源（A）

以下是 shuhu-surgianes 原有规格文档，仍然作为主源使用，但读法上以“当前主事实说明”为准。

| 文档 | 用途 |
|---|---|
| [docs/02_specs/frontend-pages.md](02_specs/frontend-pages.md) | PC 页面菜单与路由 |
| [docs/02_specs/backend-apis.md](02_specs/backend-apis.md) | 后端控制器模块划分 |
| [docs/02_specs/anesthesia-record.md](02_specs/anesthesia-record.md) | 麻醉记录页面与数据表 |
| [docs/02_specs/pacu.md](02_specs/pacu.md) | PACU 页面、状态机、Aldrete |
| [docs/02_specs/quality-center.md](02_specs/quality-center.md) | 一期基础统计 + 二期 26 项指标 |
| [docs/02_specs/mobile-app.md](02_specs/mobile-app.md) | 移动端页面与聚合接口 |
| [docs/02_specs/bigscreen.md](02_specs/bigscreen.md) | 大屏端规范（一期基础） |
| [docs/03_dictionary/database-tables.md](03_dictionary/database-tables.md) | 表前缀、复用边界、麻醉特有表 |
| [docs/03_dictionary/api-fields.md](03_dictionary/api-fields.md) | 接口字段约定、错误码 |
| [docs/03_dictionary/status-machine.md](03_dictionary/status-machine.md) | 手术 / 文书 / PACU / 计费状态机 |
| [docs/03_dictionary/permission-codes.md](03_dictionary/permission-codes.md) | 权限码清单 |
| [docs/03_dictionary/menu.md](03_dictionary/menu.md) | 一期菜单 seed |
| [docs/03_dictionary/护理系统新版本数据库文档.md](03_dictionary/护理系统新版本数据库文档.md) | 护理 SoT 数据库字典（仅引用） |
| [docs/04_delivery/current-completed-features.md](04_delivery/current-completed-features.md) | 已完成功能（后端 + 前端 + 移动 + 大屏） |
| [docs/04_delivery/current-implemented-apis.md](04_delivery/current-implemented-apis.md) | 已实现 API 路由清单 |
| [docs/04_delivery/current-database-dictionary.md](04_delivery/current-database-dictionary.md) | 已实现数据表汇总 |
| [docs/04_delivery/development-handbook.md](04_delivery/development-handbook.md) | 启动、联调、提交流程 |
| [docs/05_adr/0001-nursing-sot-integration.md](05_adr/0001-nursing-sot-integration.md) | 护理 SoT 集成关键决策 |
| [README.md](../README.md) | 项目入口与启动方式 |
| [术护手术麻醉管理系统完整功能规划表.md](../术护手术麻醉管理系统完整功能规划表.md) | 完整业务蓝图（作为最广覆盖参考） |

---

## 3. 高价值补充（B）

下列文档不在本仓库内，但承载了重要的设计沉淀，必要时引用，不直接作为实现依据。

| 文档 | 价值 | 路径 |
|---|---|---|
| 麻醉记录单 FEATURES | 记录单已实现能力（纸质版 + 实时版 + 打印） | e:/code/麻醉记录单/docs/FEATURES.md |
| 麻醉记录单 CHANGES | 异常预警、修改留痕、打印增强变更点 | e:/code/麻醉记录单/docs/CHANGES.md |
| 麻醉记录单 打印界面修复说明 | 打印样式专项修复说明 | e:/code/麻醉记录单/docs/打印界面修复说明.md |
| 麻醉管理系统 Web 原型与质控指标设计文档 | 26 项质控指标展示规范、原型菜单 | e:/code/samisweb/docs/麻醉管理系统_Web原型与质控指标设计文档.md |
| 麻醉数据库基础功能规划_含人员权限日志 | 麻醉数据库 12 业务域优先级与字段建议 | e:/code/samisweb/docs/麻醉数据库基础功能规划_含人员权限日志.md |
| 前端原型优化方向与组件规划 | 组件提取与质控完整性方案 | e:/code/samisweb/docs/前端原型优化方向与组件规划.md |
| 项目说明.txt | 明确“麻醉并入护理后端 samis 应用”的决策 | e:/code/mazui/项目说明.txt |
| 文档分类总览 | 跨仓库文档分布与阅读顺序 | e:/code/mazui/文档分类总览.md |
| 手麻系统-功能详细描述 | 功能枚举颗粒度补充 | e:/code/mazuixitong/手麻系统-功能详细描述.md |
| 高价值文档汇总（前次整理） | 文档级 A/B/C 分级 | [docs/06_workspace_merged/高价值文档汇总-仅文档信息.md](06_workspace_merged/高价值文档汇总-仅文档信息.md) |
| 全工作区文档整合（前次整理） | 文档要点合并版 | [docs/06_workspace_merged/手术麻醉管理系统-全工作区文档整合.md](06_workspace_merged/手术麻醉管理系统-全工作区文档整合.md) |

---

## 4. 历史归档（C）

仅追溯使用，不再维护，不作为开发依据。

| 文档 | 归档原因 |
|---|---|
| [docs/90_archive/00_INDEX_legacy.md](90_archive/00_INDEX_legacy.md) | 旧索引，已被本文件取代 |
| [docs/90_archive/README.md](90_archive/README.md) | 归档区说明 |
| e:/code/mazui/huliTp6System-master/开发指南.md | 护理系统历史开发指南 |
| e:/code/mazui/huliTp6System-master/数据库文档.md | 护理系统现有 49 表字典（仍可作为复用对照） |
| e:/code/mazui/huliTp6System-master/项目布局分析.md | 护理后端结构分析 |
| e:/code/mazui/huliTp6System-master/重构计划.md | 护理系统重构历史 |
| e:/code/mazui/huliTp6System-master/输血模块迁移分析.md | 输血模块迁移专项 |
| e:/code/mazui/huliTp6System-master/tp6规划文档.md | 护理 TP6 规划 |
| e:/code/麻醉记录单/.trae/documents/项目功能分析与改进建议.md | 内部分析材料 |
| docs/01_plan/ 下各阶段计划 | 历史阶段计划，已被“当前主事实说明”收口 |

注：`docs/01_plan/` 整体降级为参考，不作为当前开发依据；后续不再新增阶段计划，统一通过 `04_delivery/` 表达事实。

---

## 5. 冲突裁决规则

当多份文档冲突时，按以下优先级：

1. `docs/04_delivery/当前主事实说明.md`
2. `docs/04_delivery/current-completed-features.md` / `current-implemented-apis.md` / `current-database-dictionary.md`
3. 代码实现现状（backend-tp6 migrations + frontend-admin 实际页面）
4. `docs/03_dictionary/` 字典与契约
5. `docs/02_specs/` 规格
6. `README.md`
7. `docs/01_plan/`（历史规划）
8. 90_archive 与外部仓库历史文档

仓库优先级：shuhu-surgianes > samisweb > mazui > mazuixitong > 麻醉记录单（专项除外）。
