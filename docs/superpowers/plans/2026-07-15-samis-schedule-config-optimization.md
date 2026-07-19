# SAMIS 基础配置与手术排班第一部分专项优化计划

> 执行人说明：本计划以 `dbe6220` 为代码基线。按 P0、P1、P2 顺序实施；每个任务先补测试再改实现。不得顺带重构无关模块，不得新增重量级依赖，不得改变既有接口协议；需要新增或修改后端协议时，先停止该任务并提交独立接口变更清单审批。

**目标：** 在保留现有正式数据/异常数据分流、mock 模式、接口适配层和受控保存链路的前提下，把排班页调整为“可操作摘要 + 共用筛选 + 待排手术池 + 房间时间轴/全院列表互斥视图”，并渐进补齐时间轴语义、字典治理及数据异常闭环。

**总体架构：** 原始 `SurgeryCase` 和临床状态保持兼容；新增排班投影层，将业务状态、异常状态、可空时间与页面坐标派生为只读视图模型。页面状态由 URL 查询参数承载，用户上次视图仅作为本地回退。排班冲突和时间轴布局使用无副作用纯函数，未来拖拽只需更换交互输入，不改数据投影和保存协议。

**技术约束：** Vue 3、TypeScript、Pinia、Vue Router、Arco Design Vue、dayjs、Vitest、Playwright；不更换技术栈，不引入拖拽库。用户要求中提到 Element Plus，但当前项目实际组件库为 Arco Design Vue，本计划复用现有 Arco 组件。

## 1. 当前代码现状和相关文件定位

### 1.1 排班页面

- `src/views/SurgerySchedule.vue`
  - 当前单文件约 700 余行，同时承担标题区、筛选、房间卡片、列表、抽屉、真实/模拟数据读取、主数据保存和护理排班保存，组件职责过重。
  - 页面仍渲染 `module-hero`，而 `src/layout/AppLayout.vue` 已提供页面级标题，实际代码仍存在重复标题来源。
  - `viewMode !== 'list'` 时渲染房间卡片区，但下方明细表格始终渲染，因此“房间视图”和“全院列表”不是同一区域互斥切换。
  - `viewMode`、日期、房间、患者、住院号和关键字均为页面局部状态；未同步到路由查询参数，也未保存用户上次视图，刷新后会丢失。
  - 右侧抽屉已经具备手术间、台次、预计开始/结束、麻醉医生等编辑能力；真实模式保存走权限、版本、原因、POST 后 GET 回读及护理排班保存链路，应直接复用。
  - `formatRange()` 直接格式化输入时间，非法字符串会显示 `Invalid Date`。

- `src/services/scheduleHelpers.ts`
  - `toValidIso()` 将缺失或非法时间替换为“当前时间”，会把本应进入待排池或数据异常的数据伪装成已排时间。
  - `groupCasesByRoom()` 对房间编码存在 `OR-` 等硬编码过滤，A1、A2、B1 等合法房间可能被丢弃。
  - 现有分组只输出已知房间，不表达“未分配房间”“未分配人员”“非法时间”三种不同问题。

- `src/services/anesthesia/scheduleService.ts`、`src/services/anesthesia/adapters/operationInfoAdapter.ts`
  - 已提供手术通知单到 `SurgeryCase` 的适配和房间匹配能力，适合作为原始数据层，不应在页面再次复制接口字段判断。

- `src/api/operationInfo.ts`
  - 已有手术通知单读取、受控主数据更新、护理排班读取/保存和台次更新接口。
  - 当前没有通用排班冲突、数据质量处理或重复数据合并接口；P0/P1 不扩展协议。

- `src/stores/anesthesia.ts`
  - 已保存病例、房间字符串和房间分组，但加载房间目录后丢弃了部分富字段，难以准确计算“已启用手术间”。
  - `todaySummary` 和排序仍围绕临床过程状态，不等同于排班业务状态。

- `src/types/anesthesia.ts`、`src/components/common/StatusTag.vue`
  - 现有 `CaseStatus` 是临床过程状态：待入室、已入室、麻醉诱导、麻醉中、手术中、苏醒中、PACU、已离室、已取消。
  - 当前没有独立的排班业务状态和异常数组；不能直接把该枚举替换成排班状态，否则会影响术中记录等模块。

- `src/router/index.ts`、`src/layout/AppLayout.vue`、`src/styles/global.css`
  - 路由未声明排班页“占满剩余高度”能力。
  - `.app-content` 没有 `flex: 1` 和 `min-height: 0` 的页面级填充模式，排班工作区容易产生底部空白或页面级双滚动。

### 1.2 基础配置

- `src/views/config/ConfigRooms.vue`
  - 已具备富字段、状态流转、版本、历史入口和抽屉编辑；无物理删除入口。
- `src/views/config/ConfigStaff.vue`
  - 已覆盖工号、职称、专业组、授权、岗位、范围、有效期和状态生命周期。
- `src/views/config/ConfigMethods.vue`、`src/components/config/MethodCategoryPanel.vue`
  - 已形成麻醉大类/子项主从工作区。
  - 单个编辑抽屉仍同时承载基础字典、临床 profile、模板关联、用药监测、风险禁忌等内容，边界过宽。
- `src/views/config/ConfigDrugs.vue`、`ConfigFluids.vue`、`ConfigVitals.vue`、`ConfigPrintTemplates.vue`
  - 已有高密度表格、抽屉、状态和版本能力；部分页面仍使用 `any` 或松散 `Record` 类型。
  - 药品配置的排序字段能力不完整。
- `src/components/config/ProfessionalDictItemPanel.vue`
  - 事件、评分等专业字典已复用主从和状态治理模式。
- `src/services/configuration/professionalDictionaryService.ts`、`clinicalDictionaryService.ts`、`roomConfigurationService.ts`
  - 已有增改、状态流转、历史和版本冲突处理。
  - 当前历史接口主要是状态迁移记录，并非完整字段差异或版本快照。

### 1.3 数据异常与测试

- 当前前端未发现完整“数据异常”路由、页面和通用处理服务；设计截图中的入口尚未形成可执行闭环。
- `src/services/scheduleHelpers.test.ts` 当前断言“非法时间自动变为有效 ISO”，该语义需要在 P0 改为“保留空值并产生异常”。
- `src/views/SurgerySchedule.master-data.test.ts` 已覆盖真实模式权限、版本、POST→GET 回读和受控保存，必须保留。
- 现有专业字典、临床字典 E2E 已覆盖状态生命周期和禁止删除。
- 审查时已在 `samis-web` 容器运行相关 7 个测试文件，共 65 项通过；宿主 Node 10 不满足当前项目运行要求，后续验证继续使用项目容器 Node 22。

## 2. 截图设计中已经合理的部分

1. 单一页面标题、紧凑筛选和摘要位于同一视觉层级，方向正确，能减少配置类页面重复横幅造成的纵向浪费。
2. 房间时间轴与全院列表使用视图切换，符合“同一批数据、不同观察方式”的业务认知。
3. 普通字典使用高密度表格和右侧抽屉，适合大量编码型配置，且与现有 Arco 表格、抽屉实现兼容。
4. 麻醉方式采用大类/子项主从工作区，适合表达层级和当前选中上下文，应继续保留。
5. 正式数据与测试/脏数据分流的产品原则合理，可避免测试数据污染临床工作区。
6. 页面整体使用项目既有浅色工作台视觉，不需要引入新的设计系统或组件库。

说明：以上是应保留的设计方向；其中“重复标题已去除”“数据异常入口已完成”等在当前代码中尚未完全落地，实施时应以代码事实为准。

## 3. 当前存在的主要问题

### 3.1 信息架构

- 未分配数据没有独立业务容器，容易被误解为真实手术间。
- 房间卡片区和全院列表上下重复展示，视图切换没有减少信息噪声。
- 页面局部状态与 URL/持久化脱节，刷新、返回或分享链接后上下文丢失。
- 房间列表存在编码硬过滤，真实手术间可能被遗漏。
- 页面未建立内部滚动工作区，房间多时无法稳定横向浏览，底部也会出现空白。

### 3.2 时间轴语义

- 当前房间卡片是普通任务卡片，没有按预计时长缩放。
- 非法时间被替换成当前时间，会制造错误排班位置并掩盖数据质量问题。
- 没有显式表达开始/预计结束、交叠、接台间隔、清洁、设备准备、延迟和预计超时。
- 卡片和详情信息边界不清，诊断等信息容易挤压时间轴核心字段。

### 3.3 状态与风险

- 临床过程状态、排班业务状态和异常状态没有分层。
- 一台已排班手术无法同时表达“麻醉人员待确认”或多个冲突。
- 顶部数字缺少点击筛选行为，“运行手术间 8/10”语义不明确。

### 3.4 配置治理

- 启停、版本和禁止删除已有基础，但生效/失效语义、普通编辑原因、修改人/时间、完整版本差异和引用关系并不统一。
- 历史记录中部分实体保存了编码和名称快照，但液体/血制品等链路尚未形成统一不可变快照约束。
- 麻醉方式抽屉内容跨度过大，后续继续加入质控和打印规则会快速失控。

### 3.5 数据异常闭环

- 尚无统一异常模型、严重程度、来源定位和处置状态。
- “重新同步、合并重复、标记忽略”等动作需要后端权限和审计支持，不能只在前端模拟成功。

## 4. 建议保留、调整和暂缓的内容

### 保留

- 现有 AppLayout、Arco Design Vue、Pinia、Vue Router、表格和右侧抽屉。
- 真实/模拟数据适配层和正式数据/异常数据分流原则。
- 手术详情抽屉内已有的房间、时间、麻醉人员编辑字段及受控保存链路。
- 字典高密度表格、状态流转、版本控制、历史入口和禁止物理删除。
- 麻醉方式大类/子项主从工作区。

### 调整

- 排班页改为“操作摘要 → 共用筛选 → 单一工作区”。
- 时间轴工作区采用左侧固定待排池、右侧真实手术间纵向时间轴；手术间列横向滚动。
- 列表视图替换时间轴视图，不在下方重复出现。
- 非法或缺失时间保持为空并进入待排池/异常，不再自动填当前时间。
- 新增排班投影状态和异常数组，不替换现有临床 `CaseStatus`。
- 摘要卡改为可切换筛选的风险入口，并明确三个手术间口径。
- 麻醉方式抽屉按基础信息、临床 profile、关联治理三个区域最小拆分，父组件继续统一保存。

### 暂缓

- 拖拽排班、拖拽缩放、多人实时协同锁。
- 自动资源优化、智能插台、全局最优调度算法。
- 在未确认后端协议前实现权威性的重复数据合并、忽略、跨系统重同步。
- 大规模替换现有类型、页面壳、配置服务或全局布局。

## 5. 推荐页面结构

```text
页面标题：手术排班
├─ 可操作任务摘要
│  ├─ 今日手术
│  ├─ 正在进行
│  ├─ 待排房间
│  ├─ 待排麻醉人员
│  ├─ 排班冲突
│  └─ 数据异常
├─ 紧凑筛选栏
│  ├─ 日期
│  ├─ 手术间
│  ├─ 关键字
│  ├─ 更多筛选
│  ├─ 已选条件标签
│  └─ 清空筛选
└─ 占满剩余高度的排班工作区
   ├─ 工具栏：房间时间轴 | 全院列表
   ├─ 房间时间轴视图
   │  ├─ 固定待排手术池
   │  │  ├─ 未分配房间
   │  │  ├─ 未分配麻醉人员/待确认
   │  │  └─ 时间缺失或非法
   │  └─ 可横向滚动时间轴
   │     ├─ 时间刻度
   │     ├─ A1
   │     ├─ A2
   │     └─ B1 ...
   └─ 全院列表视图（替换时间轴，不重复展示）
```

交互规则：

- 摘要卡点击后切换对应筛选；再次点击当前卡可取消。当前生效卡高亮，并把筛选写入 URL。
- 摘要统计基于当前日期和基础筛选计算，但不受自身摘要筛选影响，避免点选后数字变为零。
- “已启用手术间”“今日使用手术间”“当前使用手术间”分三项展示或使用明确标签，不再使用无解释的 `8/10`。
- 点击待排项或时间轴手术卡均打开同一个右侧详情抽屉；P0 通过抽屉选择手术间、开始/结束时间、麻醉医生并保存。
- 时间轴卡片仅显示时间范围、患者、手术名称、主刀、麻醉医生和业务状态；诊断、详细术式、风险和来源信息进入抽屉。
- 路由查询参数优先级：当前 URL > 本地保存的最后视图 > 系统默认值。URL 保存日期、房间、关键字、更多筛选、视图和摘要筛选；本地仅保存最后视图等偏好，不保存敏感患者关键字。

## 6. 组件拆分方案

### 6.1 排班页最小拆分

- `src/views/SurgerySchedule.vue`
  - 仅负责数据装配、加载状态、抽屉选中项、保存编排和子组件组合。
- 新建 `src/components/schedule/ScheduleSummaryBar.vue`
  - 展示摘要、房间三类口径和当前激活风险；只发出筛选事件。
- 新建 `src/components/schedule/ScheduleFilterBar.vue`
  - 默认四项筛选、更多筛选、已选条件和清空；不直接调用接口。
- 新建 `src/components/schedule/PendingSurgeryPool.vue`
  - 展示未分配房间、未分配人员、非法时间等待排项；允许一条手术同时出现多个异常标记，但列表项只出现一次。
- 新建 `src/components/schedule/RoomScheduleTimeline.vue`
  - 展示时间刻度、房间列、手术块和缓冲块；接收纯布局结果，不承担接口和冲突计算。
- 新建 `src/components/schedule/ScheduleListView.vue`
  - 承接现有全院表格，复用同一筛选结果和点击详情事件。
- 新建 `src/composables/useScheduleWorkspaceState.ts`
  - 负责路由查询参数解析、序列化、默认值、视图偏好恢复和清空。
- 新建 `src/services/anesthesia/scheduleProjection.ts`
  - 将原始病例和房间目录投影为业务状态、异常、待排分组和摘要；保持纯函数。

### 6.2 麻醉方式最小拆分

保持 `ConfigMethods.vue` 和 `MethodCategoryPanel.vue` 的主从关系及统一提交，在 `MethodCategoryPanel.vue` 内拆出：

- `src/components/config/method/MethodBasicSection.vue`：编码、名称、大类、排序、备注。
- `src/components/config/method/MethodClinicalProfileSection.vue`：适用术式、用药、监测、气道、镇痛、PACU、风险和禁忌。
- `src/components/config/method/MethodAssociationSection.vue`：默认表单模板、辅助方式和后续质控规则引用；未有后端合同的字段只读展示，不伪造保存。

父组件继续持有表单、校验、版本和保存事件，避免把一次编辑拆成多个不一致事务。

### 6.3 字典治理和数据异常

- 新建 `src/components/config/DictionaryHistoryPanel.vue`：统一历史展示。
- 新建 `src/components/config/DictionaryReferencePanel.vue`：展示引用数量、引用类型和定位入口。
- 新建 `src/components/config/DictionaryGovernanceDrawer.vue`：生效信息、修改原因、修改人/时间、历史和引用的组合容器。
- 新建 `src/views/config/ConfigDataAnomalies.vue` 和 `src/components/data-quality/DataAnomalyActionDrawer.vue`：异常列表与处理动作分离。

这些组件只抽取重复治理 UI，不统一重写各字典表单和服务。

## 7. 状态模型和数据字段调整

### 7.1 排班视图模型

新增 `src/types/schedule.ts`，定义独立于原始病例的排班模型：

- `ScheduleBusinessStatus`
  - `待确认 | 已排班 | 术前准备 | 手术中 | 已结束 | 已取消`
- `ScheduleAnomalyCode`
  - `ROOM_UNASSIGNED`：未分配房间
  - `STAFF_UNASSIGNED`：未分配麻醉人员
  - `STAFF_UNCONFIRMED`：人员待确认
  - `ROOM_CONFLICT`：房间冲突
  - `STAFF_CONFLICT`：人员冲突
  - `TIME_CONFLICT`：时间冲突
  - `TURNOVER_SHORT`：接台间隔不足
  - `EXPECTED_OVERRUN`：预计超时
  - `INFO_INCOMPLETE`：信息不完整
  - `SYNC_ERROR`：同步异常
  - `TEST_DATA`：测试数据
  - `SUSPECT_DIRTY`：疑似脏数据
- `ScheduleAnomaly`
  - `code`、`severity: blocking | warning | info`、`message`、`sourceField`、`actionType`
- `ScheduleCaseViewModel`
  - 保留 `source: SurgeryCase`
  - `businessStatus`
  - `anomalies[]`
  - `roomId/roomName` 可空
  - `startAt/endAt` 可空
  - `durationMinutes` 可空
  - `surgeonName/anesthesiologistName`
  - `isPending`、`pendingReasons[]`

异常是数组，不进入 `businessStatus`。例如一台手术可同时为 `已排班`，并拥有 `STAFF_UNCONFIRMED` 和 `TURNOVER_SHORT`。

### 7.2 临床状态到排班状态的兼容映射

- `已取消` → `已取消`
- `手术中` → `手术中`
- `苏醒中 / PACU / 已离室` → `已结束`
- `已入室 / 麻醉诱导 / 麻醉中` → `术前准备`
- `待入室` 且房间、有效时间、麻醉人员齐全 → `已排班`
- 其他情况 → `待确认`

此映射仅用于排班投影，不修改原始 `CaseStatus`，避免破坏术中记录、复苏和工作台逻辑。

### 7.3 时间和布局字段

- 缺失/非法时间保持 `null`，产生 `INFO_INCOMPLETE` 或 `TIME_CONFLICT`，不得填充当前时间。
- 时长优先使用有效的 `endAt - startAt`；否则使用 `expectedDurationMinutes`；两者均无效则进入待排池。
- 时间轴采用纵向时间：`top = (start - axisStart) × pixelsPerMinute`，`height = duration × pixelsPerMinute`。
- 为保证可点击可设置最小视觉高度，但标签仍展示真实时间范围和时长，不能因此改变冲突计算。
- 缓冲事件单独建模：`kind = cleaning | equipment-prep | turnover`，使用灰色块，不伪装为手术。

### 7.4 视觉语义

- 红色：房间、人员或时间冲突等阻断问题。
- 橙色：人员待确认、接台不足、预计超时等警告。
- 灰色：清洁、设备准备、接台缓冲。
- 业务状态使用现有状态标签体系；风险颜色不覆盖业务状态文本。

### 7.5 字典治理字段

新增共享治理类型时，统一表达：

- `code`：稳定且唯一；创建后不可修改。
- `status`：启用、暂停、停用。
- `sortOrder`。
- `effectiveAt`、`expiresAt`：业务生效/失效时间；与 `disabledAt` 区分。
- `changeReason`：普通编辑和状态变更均进入审计。
- `version`、`updatedBy`、`updatedAt`。
- `references[]`：业务类型、数量、可定位标识。
- `history[]`：版本、字段差异、原因、操作者、时间。

现有后端尚未统一提供完整版本差异和引用查询，P2 必须先冻结接口合同，前端不得用假数据宣称已治理。

### 7.6 历史记录快照

临床记录引用字典时保存不可变快照：

- `dictionaryEntity`
- `dictionaryId`（有则保存）
- `code`
- `name`
- `version`（有则保存）

历史展示优先使用记录自身的 `code/name`，不能实时回查当前字典名称覆盖历史。药品、麻醉方式、事件已有部分基础；P2 重点补齐液体/血制品等链路。

## 8. 分阶段实施计划

### P0：页面布局、待排手术池、摘要筛选、视图状态

#### P0-1 建立排班投影层并修正非法时间语义

1. 先更新 `scheduleHelpers.test.ts`，断言非法/缺失时间保持为空、A1/A2/B1 不被过滤、未分配原因分别输出。
2. 新增 `scheduleProjection.test.ts`，覆盖临床状态映射、业务状态与多个异常并存、待排池去重、正式/异常分类边界。
3. 实现 `src/types/schedule.ts` 与 `scheduleProjection.ts`。
4. 保留 `SurgeryCase` 和原始适配器字段，不在接口层制造排班状态。
5. 运行相关单测，确认原有主数据测试仍通过。

验收：页面数据中不再出现 `Invalid Date`；非法时间不会落到当前时刻；合法非 `OR-` 房间进入时间轴。

#### P0-2 建立 URL 驱动的共用筛选和视图状态

1. 新增 `useScheduleWorkspaceState.test.ts`，覆盖 URL 优先级、视图本地回退、刷新恢复、清空筛选和未知参数容错。
2. 实现 `useScheduleWorkspaceState.ts`，默认筛选仅为日期、手术间、关键字、更多筛选。
3. 更多筛选字段包括业务状态、手术科室、麻醉医生、主刀医生、麻醉方式、急诊/择期、是否存在异常。
4. 使用 `router.replace()` 更新查询参数，避免每次输入产生历史记录；关键字采用现有输入防抖方式。
5. 时间轴和列表从同一 `filteredCases` 读取，不维护两套筛选。

验收：复制 URL 或刷新后保持当前视图和筛选；清空后回到当日、全部房间、无高级条件；本地存储不保存患者搜索词。

#### P0-3 重组页面和工作区

1. 为排班路由增加页面级 `fillContent` 元信息。
2. 在 `AppLayout.vue` 和 `global.css` 增加仅对该元信息生效的填充类，设置 `flex: 1`、`min-height: 0` 和内部滚动，不改变其他页面。
3. 从排班页移除重复 hero 标题来源，保留 AppLayout 页面标题。
4. 拆出筛选、摘要、待排池、时间轴壳和列表组件。
5. 时间轴视图与列表视图使用条件渲染占据同一个工作区；房间区内部横向滚动，页面本身不产生横向滚动。
6. 复用现有详情抽屉和真实模式受控保存；本阶段不引入拖拽。

验收：待排池不作为房间列；A1/A2/B1 仅出现在房间区；两种视图不再上下重复；工作区在常见分辨率下占满剩余高度。

#### P0-4 可操作摘要和房间口径

1. 为摘要计算补单测：今日手术、正在进行、待排房间、待排麻醉人员、排班冲突、数据异常。
2. 摘要点击设置/取消 `summaryFilter`，并高亮匹配病例或过滤列表。
3. 从富房间目录保留启用状态，分别计算：
   - 已启用手术间：配置状态为启用的房间数。
   - 今日使用手术间：当日非取消病例占用的唯一房间数。
   - 当前使用手术间：当前处于手术中的唯一房间数。
4. 若后端目录缺少启用状态，显示“已启用手术间：数据不可用”，不得回退为含义不明的比例。

验收：摘要卡每个数字都可操作；点击后下方数据响应且 URL 有对应参数；三个房间指标标签明确。

### P1：时间轴时长、冲突提示、缓冲时间

#### P1-1 纯函数时间轴布局

1. 新增 `timelineLayout.test.ts`，覆盖跨小时、短手术最小视觉高度、超出工作时段、无效时长和多个房间列。
2. 新增 `timelineLayout.ts`，输入病例区间和轴配置，输出 `top/height` 等展示坐标。
3. `RoomScheduleTimeline.vue` 只渲染布局结果；房间列使用固定最小宽度并横向滚动。
4. 展示明确时间范围和预计结束；视觉最小高度不参与冲突判断。

验收：90 分钟手术明显长于 30 分钟手术；时间标签和卡片位置一致；房间增加时仅工作区横向滚动。

#### P1-2 冲突和风险计算

1. 新增 `scheduleConflictEngine.test.ts`，覆盖同房间重叠、同麻醉医生重叠、边界相接不误报、时间反转、人员待确认、预计超时。
2. 新增 `scheduleConflictEngine.ts`，使用半开区间 `[start, end)` 计算重叠，输出异常数组，不修改业务状态。
3. 对缺失房间、缺失人员、非法时间分别产生不同代码；一台手术允许多个异常。
4. 摘要和待排池复用同一异常结果，不在组件中重复判断。

验收：冲突病例红色标记并可从摘要直接定位；已排班病例可同时显示人员待确认；相邻但不重叠的病例不误报。

#### P1-3 接台、清洁、设备准备和延迟

1. 在冲突引擎测试中加入房间默认接台时长、病例级覆盖、清洁和设备准备区间。
2. 将缓冲建模为独立只读时间块，灰色展示；接台不足输出橙色警告。
3. 有实际开始时间时计算延迟；手术进行中超过预计结束或预计持续时间时输出预计超时。
4. 卡片仍只显示核心信息，完整风险、诊断和来源放入右侧抽屉。

验收：前后台次重叠、缓冲不足和预计超时可区分；缓冲块不计入今日手术数，也不被当作手术打开。

### P2：字典版本、引用关系、数据异常处理

#### P2-1 统一字典治理展示

1. 先整理现有各字典接口字段矩阵，确认启停、排序、有效期、审计、版本、历史和引用的真实来源。
2. 为药品补齐排序字段的前后端既有合同映射；不新增同义字段。
3. 新增共享治理类型和历史/引用组件，逐页接入但保留各自表单和服务。
4. 普通编辑增加修改原因时，必须传入既有审计字段；若接口不支持，先完成接口审批，不在前端丢弃原因。
5. 编码创建后只读；唯一性依赖后端权威约束，前端将冲突错误翻译为中文并定位编码字段。
6. 引用存在时只允许停用，不提供物理删除；所有页面和 E2E 均不得出现删除入口。

验收：治理字段口径一致；版本冲突仍被拦截；引用来源可查看；无伪造的前端历史或引用数量。

#### P2-2 麻醉方式组件最小拆分

1. 为 `MethodCategoryPanel.vue` 增加组件边界测试或交互测试，锁定现有保存 payload 不变。
2. 拆为基础信息、临床 profile、关联治理三个展示区域，父组件继续统一校验和提交。
3. 辅助方式、专业字段、表单模板、质控规则只通过引用关系连接；不把完整编辑器全部塞入麻醉方式抽屉。
4. 未有后端模型的质控/打印关联只展示入口或空状态，不新增本地私有字段。

验收：现有麻醉方式增改、状态流转和历史测试全部通过；一次保存 payload 与拆分前兼容。

#### P2-3 历史字典快照

1. 为同步 payload 和本地仓储补回归测试：字典改名后，既有麻醉记录仍显示记录发生时的编码和名称。
2. 统一药品、麻醉方式、事件、液体/血制品的快照结构；读取历史时优先快照，当前字典仅用于新建选择。
3. 对缺少稳定编码的旧记录保留原名称并标记“历史编码缺失”，不得自动绑定当前同名字典。
4. 涉及本地数据库 schema 或后端记录协议时，先提供向前兼容迁移和回滚方案审批。

验收：字典改名、停用或版本升级不会改变历史麻醉记录；旧数据可读，mock 模式不受影响。

#### P2-4 可执行的数据异常入口

1. 新增统一异常类型、分类器及其单测，分类为阻断异常、一般异常、同步异常、测试数据、疑似脏数据。
2. 新增数据异常路由、列表和操作抽屉；每条异常展示来源、关联手术、严重程度、发现时间、处理状态和允许动作。
3. 可直接复用的动作先接入：查看来源、定位手术、通过受控抽屉补全信息、重新拉取/重试已有同步。
4. “合并重复数据”“权威重新同步”“标记忽略”必须有后端权限、版本和审计接口；接口审批前按钮显示不可用原因，不模拟成功。
5. 正式排班仅消费通过分类器的正式集合；被分流数据仍完整保留在异常入口，可定位原始来源。

验收：异常页不是只读日志；每条记录至少有一个真实可执行或明确受限的动作；所有写动作有权限、版本、原因和结果回读。

### 暂缓：拖拽排班及复杂资源调度算法

- 不安装 `dnd-kit`、Sortable、FullCalendar resource timeline 等重量级库。
- 不实现拖拽换房、拖拽改时长和自动避让。
- P0/P1 通过稳定的 `ScheduleCaseViewModel`、纯布局函数和统一 `openCase(caseId)` 事件预留扩展点。
- 未来拖拽只负责生成候选 `roomId/startAt/endAt`，仍走现有详情校验、冲突检查、权限、版本和受控保存，不直接修改 DOM 后即视为成功。

## 9. 每个阶段涉及的具体文件

### P0

修改：

- `src/views/SurgerySchedule.vue`
- `src/services/scheduleHelpers.ts`
- `src/services/scheduleHelpers.test.ts`
- `src/services/anesthesia/adapters/roomAdapter.ts`
- `src/stores/anesthesia.ts`
- `src/router/index.ts`
- `src/layout/AppLayout.vue`
- `src/styles/global.css`
- `e2e/helpers/pages.ts`（仅在页面关键字/定位器需同步时）

新增：

- `src/types/schedule.ts`
- `src/services/anesthesia/scheduleProjection.ts`
- `src/services/anesthesia/scheduleProjection.test.ts`
- `src/composables/useScheduleWorkspaceState.ts`
- `src/composables/useScheduleWorkspaceState.test.ts`
- `src/components/schedule/ScheduleSummaryBar.vue`
- `src/components/schedule/ScheduleFilterBar.vue`
- `src/components/schedule/PendingSurgeryPool.vue`
- `src/components/schedule/RoomScheduleTimeline.vue`
- `src/components/schedule/ScheduleListView.vue`
- `e2e/surgery-schedule-workspace.spec.ts`

### P1

修改：

- `src/types/schedule.ts`
- `src/services/anesthesia/scheduleProjection.ts`
- `src/components/schedule/ScheduleSummaryBar.vue`
- `src/components/schedule/PendingSurgeryPool.vue`
- `src/components/schedule/RoomScheduleTimeline.vue`
- `src/views/SurgerySchedule.vue`
- `e2e/surgery-schedule-workspace.spec.ts`

新增：

- `src/services/anesthesia/timelineLayout.ts`
- `src/services/anesthesia/timelineLayout.test.ts`
- `src/services/anesthesia/scheduleConflictEngine.ts`
- `src/services/anesthesia/scheduleConflictEngine.test.ts`

### P2

修改：

- `src/views/config/ConfigRooms.vue`
- `src/views/config/ConfigStaff.vue`
- `src/views/config/ConfigMethods.vue`
- `src/views/config/ConfigDrugs.vue`
- `src/views/config/ConfigFluids.vue`
- `src/views/config/ConfigVitals.vue`
- `src/views/config/ConfigPrintTemplates.vue`
- `src/components/config/MethodCategoryPanel.vue`
- `src/components/config/ProfessionalDictItemPanel.vue`
- `src/types/anesthesia.ts`
- `src/types/anesthesiaLocalDb.ts`
- `src/services/anesthesia/anesthesiaRecordRepository.ts`
- `src/services/anesthesia/syncPayloadMapper.ts`
- `src/router/index.ts`
- 相应配置服务测试与 E2E 文件

新增：

- `src/types/dictionaryGovernance.ts`
- `src/services/configuration/dictionaryGovernanceService.ts`
- `src/components/config/DictionaryGovernanceDrawer.vue`
- `src/components/config/DictionaryHistoryPanel.vue`
- `src/components/config/DictionaryReferencePanel.vue`
- `src/components/config/method/MethodBasicSection.vue`
- `src/components/config/method/MethodClinicalProfileSection.vue`
- `src/components/config/method/MethodAssociationSection.vue`
- `src/types/dataAnomaly.ts`
- `src/services/dataQuality/dataAnomalyClassifier.ts`
- `src/services/dataQuality/dataAnomalyClassifier.test.ts`
- `src/services/dataQuality/dataAnomalyService.ts`
- `src/views/config/ConfigDataAnomalies.vue`
- `src/components/data-quality/DataAnomalyActionDrawer.vue`
- `e2e/data-anomaly-actions.spec.ts`
- `e2e/dictionary-governance.spec.ts`

后端文件不在本轮直接指定修改。P2 若确认需要新增引用查询、完整版本快照、异常忽略或重复合并接口，应另建经批准的后端计划，明确路由、权限、审计、幂等、版本冲突和回滚后再触碰 `index` 项目。

## 10. 风险与兼容性检查

1. **GLM 并行修改风险**：本计划基线为 `dbe6220`。执行每个阶段前先检查 `git status` 和最近提交；若 GLM 继续修改相同文件，先重新对比并以小提交顺序落地，禁止覆盖其工作。
2. **组件库误判风险**：项目是 Arco Design Vue，不按需求文字引入 Element Plus；所有新增 UI 复用 Arco。
3. **状态兼容风险**：不得替换现有 `CaseStatus`。排班业务状态只能存在于新增投影层，避免影响术中、PACU、工作台和统计。
4. **非法时间兼容风险**：改变 `toValidIso()` 语义会影响现有测试和可能的调用者。实施前用 `rg` 清点调用点，仅在排班投影路径调整；需要保留旧函数时新增严格解析函数而非全局改语义。
5. **接口协议风险**：P0/P1 只用现有接口和客户端派生。新增后端筛选、引用、合并、忽略、同步协议均须单独审批。
6. **真实模式保存风险**：继续保留权限、版本、修改原因、POST→GET 回读和护理排班顺序；不得用页面本地状态绕过服务层。
7. **mock 兼容风险**：同一投影函数同时处理真实适配结果和 mock 病例；测试分别覆盖两种模式。
8. **正式/异常分流风险**：异常分类器必须是确定性纯函数；任何被分流记录不能被删除，只能在正式视图隐藏并在异常入口可追溯。
9. **房间口径风险**：已启用数量必须来自配置状态；今日使用和当前使用来自病例投影。数据源缺失时明确不可用，不能猜测。
10. **布局回归风险**：高度填充只由排班路由 meta 启用，避免全局配置页和其他业务页出现滚动回归。
11. **性能风险**：按日期加载后在客户端派生；冲突计算按房间/人员分组后排序扫描，避免全量两两比较。大数据量下用计算属性和稳定键，避免滚动时重复格式化。
12. **历史快照风险**：不能通过回查当前字典修复旧名称；旧记录缺码时保留原始名称并显式标记，迁移必须可回滚。
13. **数据处置风险**：合并和忽略是不可逆或高影响动作，必须有权限、二次确认、原因、版本和审计；前端不得先行实现假闭环。
14. **构建环境风险**：宿主 Node 10 不可用；使用 `samis-web` 容器的 Node 22 运行测试和构建，不重启 Docker 服务。

## 11. 测试和验收清单

### 单元测试

- [ ] 非法/缺失开始或结束时间保持为空，不显示 `Invalid Date`，不自动替换为当前时间。
- [ ] A1、A2、B1 等房间不因编码格式被过滤。
- [ ] 临床状态到排班业务状态的映射符合约定。
- [ ] 业务状态和多个异常状态可同时存在。
- [ ] 未分配房间、未分配人员、时间异常分别分类；同一病例在待排池只出现一次。
- [ ] 摘要六项计数准确，房间三种数量口径准确。
- [ ] 摘要筛选可切换和取消，不污染其他筛选计数。
- [ ] URL 查询参数解析、序列化、清空、刷新恢复和未知参数容错通过。
- [ ] 同房间重叠、同麻醉医生重叠、边界相接、时间反转和跨小时冲突计算通过。
- [ ] 时长映射、最小视觉高度、轴范围和缓冲块坐标通过。
- [ ] 字典编码冲突、版本冲突、状态原因、历史和引用展示通过。
- [ ] 字典改名后历史记录快照不变化。
- [ ] 数据异常分类和允许动作矩阵通过。

### 组件与页面测试

- [ ] 页面只显示一个标题。
- [ ] 默认筛选仅显示日期、手术间、关键字、更多筛选。
- [ ] 更多筛选包含状态、科室、麻醉医生、主刀、麻醉方式、急诊/择期、异常。
- [ ] 时间轴和列表互斥展示并共用筛选。
- [ ] 待排手术池不以普通房间列出现。
- [ ] 房间多时工作区横向滚动，浏览器页面本身不横向滚动。
- [ ] 工作区占满剩余高度，无明显底部空白，无页面级双滚动。
- [ ] 卡片只显示核心信息，点击后详情抽屉展示诊断、风险和来源。
- [ ] 抽屉可编辑房间、时间和麻醉人员，真实模式仍走受控保存。
- [ ] 红、橙、灰三类风险/缓冲视觉语义一致，且不覆盖业务状态文本。
- [ ] 三个手术间指标均有完整中文标签和说明。

### E2E 与回归

- [ ] mock 模式：进入排班、切换视图、应用/清空筛选、刷新恢复、打开抽屉、保存模拟数据。
- [ ] 真实模式：无权限拦截、版本冲突、POST→GET 回读、护理排班保存顺序保持通过。
- [ ] 摘要卡点击后列表/时间轴只显示或高亮对应数据。
- [ ] 待排病例通过抽屉补齐房间、时间和麻醉人员后离开待排池。
- [ ] 字典启停、排序、历史、引用、禁止删除和版本冲突通过。
- [ ] 数据异常的查看来源、定位手术、补全信息、重试动作可执行；受限动作显示中文原因。
- [ ] 正式数据、测试数据和疑似脏数据分流保持，异常记录可追溯。
- [ ] 运行既有 Vitest 和 Playwright 套件，无无关模块回归。
- [ ] 在项目容器执行 `npm run build`，构建通过且无新增类型错误。

### 每阶段验证命令

在 `samis-web` 容器、工作目录 `/app` 执行：

```bash
npx vitest run src/services/scheduleHelpers.test.ts src/services/anesthesia/scheduleProjection.test.ts src/composables/useScheduleWorkspaceState.test.ts src/views/SurgerySchedule.master-data.test.ts
npx playwright test e2e/surgery-schedule-workspace.spec.ts
```

P1 增加：

```bash
npx vitest run src/services/anesthesia/timelineLayout.test.ts src/services/anesthesia/scheduleConflictEngine.test.ts
```

P2 增加：

```bash
npx vitest run src/services/configuration/roomConfigurationService.test.ts src/services/configuration/professionalDictionaryService.test.ts src/services/configuration/clinicalDictionaryService.test.ts src/services/dataQuality/dataAnomalyClassifier.test.ts
npx playwright test e2e/dictionary-governance.spec.ts e2e/data-anomaly-actions.spec.ts
```

阶段结束执行完整验证：

```bash
npm run test
npm run build
```

通过标准：新增测试和既有回归全部通过；浏览器实测无白屏、无 `Invalid Date`、无重复视图；没有未审批的接口变更、依赖变更或无关模块修改。
