# 麻醉管理系统 Web 原型建设文档

> 适用目标：先完成 Web 前端原型，再逐步接入后端、设备采集、HIS/EMR/手麻/护理系统等数据源。  
> 文档用途：用于后续查阅、核对、拆分开发任务、编写 Codex/Cursor 指令、与医院麻醉科/质控科沟通。  
> 建议系统名称：**手术麻醉管理系统 / 麻醉临床信息与质控管理系统**

---

## 1. 建设背景与系统定位

麻醉管理系统不应只是一张电子麻醉记录单，而应围绕麻醉科完整业务闭环建设：

```text
术前访视
→ 麻醉评估
→ 麻醉计划
→ 患者入室
→ 麻醉实施记录
→ 设备数据采集
→ 用药/输液/输血
→ 特殊事件/抢救
→ PACU恢复
→ 术后镇痛与随访
→ 麻醉质控指标统计
→ 质控缺陷整改
→ 月度/季度/年度上报
```

第一期建议重点做 Web 前端原型，做到：

1. 页面结构完整；
2. 业务流程可演示；
3. 质控指标可展示；
4. 数据来源可解释；
5. 分子分母可穿透；
6. 后续便于接入真实后端和设备数据。

---

## 2. 建设依据

本系统建议参考以下几类要求进行设计：

### 2.1 麻醉专业医疗质量控制指标

系统需要完整覆盖国家麻醉专业医疗质量控制指标中的 26 项指标，包括：

- 麻醉科医护比
- 麻醉医师人均年麻醉例次数
- 手术室外麻醉占比
- 择期手术麻醉前访视率
- 入室后手术麻醉取消率
- 麻醉开始后手术取消率
- 全身麻醉术中体温监测率
- 术中主动保温率
- 术中自体血输注率
- 手术麻醉期间低体温发生率
- 术中牙齿损伤发生率
- 麻醉期间严重反流误吸发生率
- 计划外建立人工气道发生率
- 术中心脏骤停率
- 麻醉期间严重过敏反应发生率
- 全身麻醉术中知晓发生率
- PACU入室低体温发生率
- 麻醉后PACU转出延迟率
- 非计划二次气管插管率
- 非计划转入ICU率
- 术后镇痛满意率
- 区域阻滞麻醉后严重神经并发症发生率
- 全身麻醉气管插管拔管后声音嘶哑发生率
- 麻醉后新发昏迷发生率
- 麻醉后24小时内患者死亡率
- 阴道分娩椎管内麻醉使用率

### 2.2 麻醉记录单标准

麻醉记录单页面需要体现以下要求：

- 患者基本信息完整；
- 麻醉前评估信息完整；
- 入室、麻醉开始、诱导、插管、切皮、手术开始、手术结束、拔管、离室等关键时间点可记录；
- 生命体征可连续记录；
- 术中用药、持续泵入、吸入麻醉药、输液、输血、自体血回输可记录；
- 特殊事件、并发症、抢救过程可记录；
- PACU恢复信息和离室评分可记录；
- 打印后记录单应锁定，修改需授权并留痕。

### 2.3 医疗质量安全改进要求

系统还应预留以下质量改进能力：

- 关键诊疗行为记录完整率；
- 医疗安全不良事件上报；
- 非计划转ICU；
- 非计划二次插管；
- 术后并发症追踪；
- 质控缺陷闭环整改；
- PDCA持续改进记录；
- 月度/季度/年度质控分析。

---

## 3. 系统总体模块

建议菜单结构如下：

```text
麻醉管理系统
├─ 工作台
│  ├─ 今日麻醉工作台
│  ├─ 手术间状态总览
│  └─ 我的待办
│
├─ 手术麻醉
│  ├─ 手术排班
│  ├─ 患者麻醉详情
│  ├─ 术前访视
│  ├─ 麻醉计划
│  ├─ 麻醉记录单
│  ├─ 术中用药
│  ├─ 输液输血
│  └─ 特殊事件/抢救记录
│
├─ PACU恢复室
│  ├─ PACU患者列表
│  ├─ PACU恢复记录
│  ├─ PACU转出管理
│  └─ PACU质控预警
│
├─ 术后管理
│  ├─ 术后镇痛
│  ├─ 术后随访
│  ├─ 并发症追踪
│  └─ 非计划事件追踪
│
├─ 麻醉质控
│  ├─ 质控总览
│  ├─ 26项质控指标
│  ├─ 低体温专项
│  ├─ PACU专项
│  ├─ 不良事件统计
│  ├─ 质控缺陷列表
│  ├─ 月度质控报表
│  └─ PDCA持续改进
│
├─ 基础配置
│  ├─ 手术间管理
│  ├─ 麻醉人员
│  ├─ 麻醉方式字典
│  ├─ 药品字典
│  ├─ 液体/血制品字典
│  ├─ 事件字典
│  ├─ 评分模板
│  └─ 打印模板
│
└─ 系统管理
   ├─ 用户管理
   ├─ 角色权限
   ├─ 操作日志
   └─ 数据模拟配置
```

---

## 4. Web 一期页面范围

第一期建议先做以下核心页面：

| 序号 | 页面 | 目的 |
|---|---|---|
| 1 | 登录页 | 模拟系统入口 |
| 2 | 麻醉工作台首页 | 展示今日手术、状态、质控预警 |
| 3 | 手术排班页面 | 维护手术患者和麻醉任务 |
| 4 | 患者麻醉详情页 | 查看患者麻醉全过程 |
| 5 | 术前访视/麻醉评估页 | 支撑术前访视率指标 |
| 6 | 麻醉记录单页面 | 系统核心操作页面 |
| 7 | 术中用药/输液/输血弹窗 | 支撑用药、输液、输血记录 |
| 8 | 麻醉事件/抢救记录弹窗 | 支撑不良事件和抢救记录 |
| 9 | PACU恢复室列表 | 展示PACU患者状态 |
| 10 | PACU恢复记录页 | 支撑PACU质控指标 |
| 11 | 术后随访页 | 支撑术后镇痛、并发症、知晓等指标 |
| 12 | 麻醉质控指标页 | 展示26项质控指标 |
| 13 | 质控缺陷列表 | 展示系统自动识别的问题 |

---

## 5. 麻醉质控展示界面要求

根据参考截图，麻醉质控页面应采用类似国家/省级质控平台的布局。

### 5.1 页面整体布局

```text
麻醉质控指标
├─ 顶部筛选区
├─ 左侧：26项指标列表
└─ 右侧：当前指标分析区
   ├─ 指标说明卡片
   ├─ 趋势图
   ├─ 同比/环比分析
   ├─ 分子/分母明细
   ├─ 子单元/子实体分析
   ├─ 异常病例
   └─ 数据来源追溯
```

---

## 6. 质控页面顶部筛选区

顶部筛选区用于统一控制左侧指标列表和右侧指标详情。

| 筛选项 | 要求 |
|---|---|
| 医疗机构 | 支持单院区、多院区 |
| 时间范围 | 月度、季度、年度、自定义 |
| 指标分类 | 全部、结构、过程、结果、PACU、术后、产科 |
| 麻醉方式 | 全麻、椎管内麻醉、区域阻滞、MAC、局麻监护 |
| 手术地点 | 手术室内、手术室外、内镜中心、介入室、产房 |
| 手术类型 | 择期、急诊、日间、产科、介入 |
| 麻醉医生 | 支持按医生筛选 |
| 手术间 | OR-01、OR-02、PACU、室外麻醉点 |
| 刷新 | 重新计算当前指标 |
| 导出 | 导出当前指标、明细和图表 |

### 前端要求

- 筛选区固定在页面顶部；
- 默认时间范围为本月；
- 支持连续月份统计，例如 `2024-03 至 2025-02`；
- 筛选条件变化后，左侧指标值和右侧详情同步刷新；
- 切换指标时保留当前筛选条件。

---

## 7. 左侧 26 项指标列表要求

左侧指标列表是质控页面的核心入口。

### 7.1 每个指标项显示内容

| 内容 | 示例 |
|---|---|
| 收藏星标 | ☆ / ★ |
| 指标名称 | 麻醉科医护比 |
| 指标编码 | AQI-DNR-01 |
| 当前值 | 4:1 / 27.25 / 98.02% |
| 同比 | 同比 0.00% |
| 环比 | 环比 -0.79% |
| 迷你趋势图 | 最近12个月 sparkline |
| 状态颜色 | 正常、预警、异常、无数据 |

### 7.2 指标列表交互

| 功能 | 要求 |
|---|---|
| 点击指标 | 右侧刷新为该指标详情 |
| 收藏指标 | 星标后置顶 |
| 搜索指标 | 支持按名称、编码搜索 |
| 指标分组 | 结构、过程、结果、PACU、术后、产科 |
| 趋势图开关 | 可显示/隐藏迷你趋势图 |
| 同比环比开关 | 可显示/隐藏同比、环比 |
| 异常排序 | 异常指标置顶 |
| 无数据提示 | 显示“暂无数据”，不得用 0 误导用户 |

### 7.3 左侧指标展示示例

```text
☆ 麻醉科医护比（AQI-DNR-01）              4:1
2024-03~2025-02       迷你趋势线          同比 0.00%
                                           环比 0.00%

☆ 麻醉医师人均年麻醉例次数（AQI-ACC-02）  27.25
2024-03~2025-02       迷你趋势线          同比 0.00%
                                           环比 +11.1%

☆ 手术室外麻醉占比（AQI-PAO-03）          0.00%
```

---

## 8. 右侧指标详情区要求

右侧是选中指标后的分析区。

### 8.1 指标说明卡片

建议右侧顶部放置指标说明卡片，类似参考图中的黄色说明卡。

| 字段 | 示例 |
|---|---|
| 指标名称 | 麻醉医师人均年麻醉例次数 |
| 指标编码 | AQI-ACC-02 |
| 当前时间 | 2025-03 |
| 当前单位 | 某某医院 |
| 指标值 | 27.25 |
| 计算公式 | 麻醉量 / 麻醉科医生总数 |
| 计算表达式 | 3161 / 116 |
| 分子名称 | 麻醉例次数 |
| 分母名称 | 麻醉医生人数 |
| 指标解释 | 反映麻醉医师工作负荷 |
| 统计周期 | 月度 / 年度 |
| 指标属性 | 结构指标 / 过程指标 / 结果指标 |
| 是否国家指标 | 是 |
| 是否院内重点指标 | 是/否 |

### 8.2 趋势图区域

每个指标都要支持：

| 图表 | 说明 |
|---|---|
| 月度趋势图 | 最近 12 个月 |
| 同比趋势 | 与去年同期比较 |
| 环比趋势 | 与上月比较 |
| 分子趋势 | 分子数量变化 |
| 分母趋势 | 分母数量变化 |
| 指标值趋势 | 百分比或比值变化 |

不同指标推荐图表：

| 指标类型 | 推荐图表 |
|---|---|
| 比率类 | 折线图 |
| 例次数类 | 柱状图 |
| 构成比类 | 堆叠柱状图 |
| 异常事件类 | 柱状图 + 趋势线 |
| 医护比 | 指标卡 + 趋势线 |
| PACU延迟率 | 折线图 + 明细列表 |
| 低体温发生率 | 折线图 + 低体温病例明细 |

### 8.3 明细分析 Tab

建议设计为多 Tab：

```text
明细分析
├─ 子单元
├─ 子实体
├─ 空值
├─ 缺省排序
├─ 分子明细
├─ 分母明细
└─ 异常病例
```

| Tab | 含义 |
|---|---|
| 子单元 | 按科室、院区、手术间、麻醉地点拆分 |
| 子实体 | 按麻醉医生、患者、手术类型拆分 |
| 空值 | 数据缺失情况 |
| 分子明细 | 进入分子的病例清单 |
| 分母明细 | 进入分母的病例清单 |
| 异常病例 | 触发质控风险的病例 |

### 8.4 仪表盘区域

仪表盘可以展示当前指标达标情况，但不能只依赖仪表盘。

示例：

| 仪表盘 | 内容 |
|---|---|
| 最小值 | 各医生/手术间最低值 |
| 平均值 | 全院平均值 |
| 最大值 | 各医生/手术间最高值 |
| 当前值 | 当前筛选范围指标值 |
| 目标值 | 院内目标值 |
| 预警线 | 低于/高于阈值提示 |

---

## 9. 26项指标配置清单

### 9.1 结构类指标

| 编码 | 指标名称 | 展示值示例 |
|---|---|---|
| AQI-DNR-01 | 麻醉科医护比 | 4:1 |
| AQI-ACC-02 | 麻醉医师人均年麻醉例次数 | 27.25 |
| AQI-PAO-03 | 手术室外麻醉占比 | 0.00% |

### 9.2 过程类指标

| 编码 | 指标名称 | 展示值示例 |
|---|---|---|
| AQI-PVR-04 | 择期手术麻醉前访视率 | 98.02% |
| AQI-CRB-05 | 入室后手术麻醉取消率 | 3.10‰ |
| AQI-CRA-06 | 麻醉开始后手术取消率 | 0.30‰ |
| AQI-TMR-07 | 全身麻醉术中体温监测率 | 66.81% |
| AQI-AWR-08 | 术中主动保温率 | 60.75% |
| AQI-ATR-09 | 术中自体血输注率 | 58.54% |

### 9.3 结果与并发症类指标

| 编码 | 指标名称 |
|---|---|
| AQI-IHT-10 | 手术麻醉期间低体温发生率 |
| AQI-DII-11 | 术中牙齿损伤发生率 |
| AQI-AAR-12 | 麻醉期间严重反流误吸发生率 |
| AQI-UPA-13 | 计划外建立人工气道发生率 |
| AQI-ICA-14 | 术中心脏骤停率 |
| AQI-ASA-15 | 麻醉期间严重过敏反应发生率 |
| AQI-AWR-16 | 全身麻醉术中知晓发生率 |

### 9.4 PACU 与术后类指标

| 编码 | 指标名称 |
|---|---|
| AQI-PHT-17 | PACU入室低体温发生率 |
| AQI-PDR-18 | 麻醉后PACU转出延迟率 |
| AQI-URI-19 | 非计划二次气管插管率 |
| AQI-UICU-20 | 非计划转入ICU率 |
| AQI-PAS-21 | 术后镇痛满意率 |
| AQI-RNC-22 | 区域阻滞麻醉后严重神经并发症发生率 |
| AQI-HRS-23 | 全身麻醉气管插管拔管后声音嘶哑发生率 |
| AQI-NCC-24 | 麻醉后新发昏迷发生率 |
| AQI-D24-25 | 麻醉后24小时内患者死亡率 |

### 9.5 产科类指标

| 编码 | 指标名称 |
|---|---|
| AQI-LEA-26 | 阴道分娩椎管内麻醉使用率 |

---

## 10. 数据来源总体要求

质控指标不能只靠人工填报，应从系统业务数据自动计算。

建议分为 8 类数据来源：

```text
1. 手术排班数据
2. 麻醉记录单数据
3. 术前访视数据
4. 麻醉用药与操作事件数据
5. 生命体征与设备采集数据
6. PACU恢复室数据
7. 术后随访数据
8. 人员与组织基础数据
```

### 10.1 数据来源设计原则

1. 所有指标必须能解释分子来源、分母来源；
2. 所有指标必须支持病例穿透；
3. 所有手工录入和自动采集数据都要保留来源标记；
4. 所有质控事件需要审核状态；
5. 作废病例、测试病例、取消病例应有清晰排除规则；
6. 指标计算结果应支持按月缓存，避免每次实时重算；
7. 后续后端实现时，所有计算规则要版本化管理。

---

## 11. 核心数据表设计要求

> 前端阶段可以使用 Mock JSON 模拟这些表结构，后端实现时再落库。

### 11.1 手术病例主表：anesthesia_case

| 字段 | 说明 |
|---|---|
| case_id | 麻醉病例ID |
| patient_id | 患者ID |
| visit_id | 就诊ID |
| hospital_id | 医院ID |
| department_id | 科室ID |
| operating_room_id | 手术间ID |
| anesthesia_location | 麻醉地点 |
| location_type | 手术室内 / 手术室外 |
| surgery_type | 择期 / 急诊 / 日间 |
| operation_name | 手术名称 |
| diagnosis | 诊断 |
| asa_level | ASA分级 |
| anesthesia_method | 麻醉方式 |
| is_general_anesthesia | 是否全麻 |
| is_regional_anesthesia | 是否区域阻滞 |
| is_neuraxial_anesthesia | 是否椎管内麻醉 |
| is_obstetric | 是否产科 |
| is_vaginal_delivery | 是否阴道分娩 |
| status | 状态 |
| scheduled_start_time | 计划开始时间 |
| room_in_time | 入室时间 |
| anesthesia_start_time | 麻醉开始时间 |
| operation_start_time | 手术开始时间 |
| operation_end_time | 手术结束时间 |
| anesthesia_end_time | 麻醉结束时间 |
| room_out_time | 离室时间 |
| pacu_in_time | 入PACU时间 |
| pacu_out_time | 出PACU时间 |
| cancel_time | 取消时间 |
| cancel_stage | 取消阶段 |
| cancel_reason | 取消原因 |
| is_transfer_icu | 是否转ICU |
| transfer_icu_planned | 是否计划转ICU |
| transfer_icu_reason | 转ICU原因 |
| is_deleted | 是否作废 |
| is_test | 是否测试数据 |
| created_at | 创建时间 |
| updated_at | 更新时间 |

### 11.2 患者信息表：patient

| 字段 | 说明 |
|---|---|
| patient_id | 患者ID |
| name | 姓名 |
| gender | 性别 |
| age | 年龄 |
| birth_date | 出生日期 |
| inpatient_no | 住院号 |
| medical_record_no | 病历号 |
| bed_no | 床号 |
| department_name | 科室 |
| height | 身高 |
| weight | 体重 |
| bmi | BMI |
| allergy_history | 过敏史 |

### 11.3 麻醉人员表：anesthesia_staff

| 字段 | 说明 |
|---|---|
| staff_id | 人员ID |
| staff_name | 姓名 |
| staff_type | 麻醉医生 / 麻醉护士 |
| professional_title | 职称 |
| department_id | 所属科室 |
| is_active | 是否在岗 |
| is_counted_for_quality | 是否纳入质控统计 |
| start_date | 入科时间 |
| leave_date | 离岗时间 |

### 11.4 病例人员关系表：anesthesia_case_staff

| 字段 | 说明 |
|---|---|
| case_id | 病例ID |
| staff_id | 人员ID |
| role | 主麻 / 副麻 / 麻醉护士 / 复苏护士 |
| start_time | 参与开始时间 |
| end_time | 参与结束时间 |
| is_primary | 是否主责人员 |

### 11.5 术前访视表：pre_anesthesia_visit

| 字段 | 说明 |
|---|---|
| visit_id | 访视ID |
| case_id | 病例ID |
| visit_time | 访视时间 |
| visit_doctor_id | 访视医师 |
| asa_level | ASA分级 |
| airway_assessment | 气道评估 |
| fasting_status | 禁食情况 |
| anesthesia_plan | 麻醉计划 |
| informed_consent | 是否知情同意 |
| is_completed | 是否完成 |
| completed_time | 完成时间 |

### 11.6 生命体征记录表：vital_sign_record

| 字段 | 说明 |
|---|---|
| record_id | 记录ID |
| case_id | 病例ID |
| record_time | 记录时间 |
| source | 手工 / 监护仪 / 麻醉机 |
| hr | 心率 |
| sbp | 收缩压 |
| dbp | 舒张压 |
| map | 平均动脉压 |
| spo2 | 血氧 |
| rr | 呼吸频率 |
| etco2 | 呼气末二氧化碳 |
| temp | 体温 |
| bis | BIS |
| cvp | CVP |
| created_by | 记录人 |

### 11.7 麻醉机数据表：anesthesia_machine_record

| 字段 | 说明 |
|---|---|
| record_id | 记录ID |
| case_id | 病例ID |
| record_time | 记录时间 |
| fio2 | 吸入氧浓度 |
| etco2 | 呼气末二氧化碳 |
| vt | 潮气量 |
| mv | 分钟通气量 |
| rr_set | 设定呼吸频率 |
| peep | PEEP |
| ppeak | 气道峰压 |
| anesthetic_agent | 吸入麻醉药 |
| agent_inspired | 吸入浓度 |
| agent_expired | 呼气末浓度 |
| fresh_gas_flow | 新鲜气流量 |
| source | 手工 / 麻醉机采集 |

### 11.8 麻醉用药表：anesthesia_medication

| 字段 | 说明 |
|---|---|
| medication_id | 用药ID |
| case_id | 病例ID |
| medication_type | 单次用药 / 持续泵入 / 吸入麻醉药 |
| drug_name | 药品名称 |
| dose | 剂量 |
| dose_unit | 单位 |
| concentration | 浓度 |
| infusion_rate | 泵速 |
| route | 给药途径 |
| start_time | 开始时间 |
| adjust_time | 调速时间 |
| stop_time | 停止时间 |
| total_amount | 累计量 |
| executor_id | 执行人 |
| source | 手工 / 输注泵采集 |

### 11.9 输液输血表：fluid_blood_record

| 字段 | 说明 |
|---|---|
| record_id | 记录ID |
| case_id | 病例ID |
| record_type | 晶体液 / 胶体液 / 血制品 / 自体血 |
| name | 名称 |
| volume | 输注量 |
| unit | 单位 |
| start_time | 开始时间 |
| end_time | 结束时间 |
| blood_type | ABO血型 |
| rh | Rh |
| adverse_reaction | 输血反应 |
| executor_id | 执行人 |

### 11.10 麻醉事件表：anesthesia_event

| 字段 | 说明 |
|---|---|
| event_id | 事件ID |
| case_id | 病例ID |
| event_type | 事件类型 |
| event_code | 事件编码 |
| event_time | 发生时间 |
| event_stage | 诱导 / 维持 / 苏醒 / PACU / 术后 |
| severity | 严重程度 |
| description | 事件描述 |
| treatment | 处理措施 |
| related_to_anesthesia | 是否与麻醉相关 |
| is_quality_event | 是否纳入质控 |
| reported | 是否上报 |
| review_status | 待审核 / 已确认 / 排除 |
| reviewer_id | 审核人 |

### 11.11 PACU记录表：pacu_record

| 字段 | 说明 |
|---|---|
| pacu_id | PACU记录ID |
| case_id | 病例ID |
| pacu_in_time | 入PACU时间 |
| pacu_out_time | 出PACU时间 |
| first_temp | 入PACU首次体温 |
| aldrete_score_in | 入室Aldrete评分 |
| aldrete_score_out | 出室Aldrete评分 |
| vas_score | VAS评分 |
| nausea_vomiting | 恶心呕吐 |
| shivering | 寒战 |
| agitation | 躁动 |
| reintubation | 是否二次插管 |
| out_destination | 转出地点 |
| handover_nurse_id | 交接护士 |
| status | PACU中 / 已转出 |

### 11.12 术后随访表：postoperative_followup

| 字段 | 说明 |
|---|---|
| followup_id | 随访ID |
| case_id | 病例ID |
| followup_time | 随访时间 |
| followup_type | 镇痛 / 全麻 / 区域阻滞 / 产科 |
| vas_score | VAS评分 |
| is_pain_satisfied | 镇痛是否满意 |
| awareness | 是否术中知晓 |
| hoarseness | 是否声音嘶哑 |
| hoarseness_duration_hours | 声音嘶哑持续时间 |
| neuro_complication | 是否神经并发症 |
| neuro_duration_hours | 神经症状持续时间 |
| new_coma | 是否新发昏迷 |
| gcs_score | GCS评分 |
| death_24h | 麻醉后24小时内死亡 |
| death_time | 死亡时间 |
| nausea_vomiting | 恶心呕吐 |
| respiratory_depression | 呼吸抑制 |
| treatment_advice | 处理意见 |

### 11.13 主动保温记录表：warming_record

| 字段 | 说明 |
|---|---|
| warming_id | 主动保温记录ID |
| case_id | 病例ID |
| warming_type | 充气升温毯 / 输液加温 / 输血加温 / 保温被 / 其他 |
| start_time | 开始时间 |
| end_time | 结束时间 |
| operator_id | 操作人 |

### 11.14 气道记录表：airway_record

| 字段 | 说明 |
|---|---|
| airway_id | 气道记录ID |
| case_id | 病例ID |
| airway_type | 气管插管 / 喉罩 / 气管切开 |
| is_planned | 是否计划内 |
| establish_time | 建立时间 |
| remove_time | 拔除时间 |
| reason | 原因 |
| operator_id | 操作人 |

---

## 12. 26项指标数据来源与计算要求

### 12.1 AQI-DNR-01 麻醉科医护比

**公式：**

```text
麻醉科护士人数 / 麻醉科医师人数
```

**数据来源：**

| 数据 | 来源 |
|---|---|
| 麻醉护士人数 | anesthesia_staff.staff_type = 麻醉护士 |
| 麻醉医师人数 | anesthesia_staff.staff_type = 麻醉医生 |
| 是否在岗 | anesthesia_staff.is_active = true |
| 是否纳入统计 | is_counted_for_quality = true |

**展示要求：**

- 当前医护比，例如 `4:1`；
- 医生人数、护士人数可点击查看名单；
- 支持按院区、科室统计。

---

### 12.2 AQI-ACC-02 麻醉医师人均年麻醉例次数

**公式：**

```text
年度麻醉例次数 / 麻醉医师人数
```

**数据来源：**

| 数据 | 来源 |
|---|---|
| 麻醉例次数 | anesthesia_case |
| 麻醉医师人数 | anesthesia_staff |
| 主麻医生 | anesthesia_case_staff |
| 统计周期 | room_in_time 或 anesthesia_start_time |

**展示要求：**

- 当前值，例如 `27.25`；
- 展示计算表达式，例如 `3161 / 116`；
- 支持下钻到每个麻醉医生的例次数排名；
- 支持柱状图展示医生工作量。

---

### 12.3 AQI-PAO-03 手术室外麻醉占比

**公式：**

```text
手术室外麻醉例次数 / 麻醉总例次数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 分子 | anesthesia_case.location_type = 手术室外 |
| 分母 | anesthesia_case 所有已完成麻醉病例 |
| 地点 | anesthesia_location |

**展示要求：**

- 展示室外麻醉地点构成；
- 可下钻查看室外麻醉病例；
- 地点包括：内镜中心、介入室、产房、影像科等。

---

### 12.4 AQI-PVR-04 择期手术麻醉前访视率

**公式：**

```text
完成术前访视的择期手术患者数 / 择期手术患者总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 择期手术 | anesthesia_case.surgery_type = 择期 |
| 是否完成访视 | pre_anesthesia_visit.is_completed |
| 访视完成时间 | completed_time |
| 入室时间 | room_in_time |

**质控规则：**

- 访视完成时间应早于入室时间；
- 择期手术未访视进入质控缺陷。

---

### 12.5 AQI-CRB-05 入室后手术麻醉取消率

**公式：**

```text
入室后、麻醉开始前取消病例数 / 入室病例总数 × 1000‰
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 入室时间 | room_in_time |
| 麻醉开始时间 | anesthesia_start_time |
| 取消时间 | cancel_time |
| 取消阶段 | cancel_stage = 入室后麻醉前 |

**展示要求：**

- 按取消原因统计；
- 展示取消病例明细；
- 区分患者原因、手术原因、麻醉原因、设备原因。

---

### 12.6 AQI-CRA-06 麻醉开始后手术取消率

**公式：**

```text
麻醉开始后、手术开始前取消病例数 / 麻醉开始病例总数 × 1000‰
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 麻醉开始时间 | anesthesia_start_time |
| 手术开始时间 | operation_start_time |
| 取消时间 | cancel_time |
| 取消阶段 | cancel_stage = 麻醉开始后手术前 |

---

### 12.7 AQI-TMR-07 全身麻醉术中体温监测率

**公式：**

```text
全麻术中有体温记录病例数 / 全麻病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 全麻病例 | anesthesia_case.is_general_anesthesia = true |
| 体温记录 | vital_sign_record.temp |
| 记录时间范围 | anesthesia_start_time 至 room_out_time |

**质控规则：**

- 全麻病例应有体温记录；
- 预计手术时间超过 120 分钟必须重点提示；
- 无体温记录进入质控缺陷。

---

### 12.8 AQI-AWR-08 术中主动保温率

**公式：**

```text
实施主动保温病例数 / 需要保温或全麻病例数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 主动保温记录 | warming_record |
| 保温类型 | warming_record.warming_type |
| 时间范围 | 麻醉开始至离室 |

**展示要求：**

- 展示主动保温措施构成；
- 与低体温发生率联动分析；
- 支持查看未主动保温病例。

---

### 12.9 AQI-ATR-09 术中自体血输注率

**公式：**

```text
术中自体血输注患者数 / 术中输血患者总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 自体血输注 | fluid_blood_record.record_type = 自体血 |
| 术中输血 | fluid_blood_record.record_type = 血制品 / 自体血 |
| 病例范围 | anesthesia_case |

---

### 12.10 AQI-IHT-10 手术麻醉期间低体温发生率

**公式：**

```text
手术麻醉期间发生低体温病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 体温 | vital_sign_record.temp |
| 记录时间 | anesthesia_start_time 至 room_out_time |
| 低体温阈值 | temp < 36℃ |

**质控规则：**

- 连续监测低体温持续达到规则要求，判定为低体温病例；
- 间断记录连续两次低体温也应提示；
- 低体温病例可下钻查看体温曲线。

---

### 12.11 AQI-DII-11 术中牙齿损伤发生率

**公式：**

```text
术中牙齿损伤病例数 / 气管插管全麻病例数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 气管插管 | airway_record.airway_type = 气管插管 |
| 牙齿损伤 | anesthesia_event.event_type = 牙齿损伤 |

---

### 12.12 AQI-AAR-12 麻醉期间严重反流误吸发生率

**公式：**

```text
严重反流误吸病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 反流误吸事件 | anesthesia_event.event_type = 反流误吸 |
| 严重程度 | severity = 严重 |
| 是否纳入质控 | is_quality_event = true |

---

### 12.13 AQI-UPA-13 计划外建立人工气道发生率

**公式：**

```text
计划外建立人工气道病例数 / 非全麻或非计划气道病例数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 人工气道 | airway_record |
| 是否计划内 | airway_record.is_planned = false |
| 建立时间 | establish_time |
| 原因 | reason |

---

### 12.14 AQI-ICA-14 术中心脏骤停率

**公式：**

```text
术中心脏骤停病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 心脏骤停事件 | anesthesia_event.event_type = 心脏骤停 |
| 发生时间 | event_time 在 anesthesia_start_time 至 room_out_time 之间 |

---

### 12.15 AQI-ASA-15 麻醉期间严重过敏反应发生率

**公式：**

```text
严重过敏反应病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 过敏反应事件 | anesthesia_event.event_type = 严重过敏 |
| 抢救用药 | anesthesia_medication.drug_name = 肾上腺素 |
| 严重程度 | severity = 严重 |

---

### 12.16 AQI-AWR-16 全身麻醉术中知晓发生率

**公式：**

```text
全麻术中知晓病例数 / 全麻病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 全麻病例 | anesthesia_case.is_general_anesthesia = true |
| 术中知晓 | postoperative_followup.awareness = true |

---

### 12.17 AQI-PHT-17 PACU入室低体温发生率

**公式：**

```text
PACU入室首次体温 <36℃ 患者数 / 入PACU患者总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| PACU入室患者 | pacu_record.pacu_in_time |
| 首次体温 | pacu_record.first_temp |

---

### 12.18 AQI-PDR-18 麻醉后PACU转出延迟率

**公式：**

```text
PACU停留超过2小时患者数 / 入PACU患者总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 入PACU时间 | pacu_record.pacu_in_time |
| 出PACU时间 | pacu_record.pacu_out_time |
| 停留时长 | pacu_out_time - pacu_in_time |

**质控规则：**

- 超过 120 分钟标记为转出延迟；
- 未出PACU但当前时间已超过120分钟，也应实时预警。

---

### 12.19 AQI-URI-19 非计划二次气管插管率

**公式：**

```text
非计划二次气管插管病例数 / 拔管病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 拔管事件 | airway_record.remove_time 或 anesthesia_event.event_type = 拔管 |
| 二次插管事件 | anesthesia_event.event_type = 非计划二次插管 |
| 时间限制 | 拔管后6小时内 |

---

### 12.20 AQI-UICU-20 非计划转入ICU率

**公式：**

```text
非计划转入ICU病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 转ICU | anesthesia_case.is_transfer_icu = true |
| 是否计划内 | transfer_icu_planned = false |
| 转ICU原因 | transfer_icu_reason |

---

### 12.21 AQI-PAS-21 术后镇痛满意率

**公式：**

```text
VAS ≤ 3 的术后镇痛患者数 / 术后镇痛患者总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 术后镇痛患者 | postoperative_followup.followup_type = 镇痛 |
| VAS评分 | postoperative_followup.vas_score |
| 是否满意 | vas_score <= 3 |

---

### 12.22 AQI-RNC-22 区域阻滞麻醉后严重神经并发症发生率

**公式：**

```text
区域阻滞后严重神经并发症病例数 / 区域阻滞麻醉病例数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 区域阻滞病例 | anesthesia_case.is_regional_anesthesia = true |
| 神经并发症 | postoperative_followup.neuro_complication = true |
| 持续时间 | neuro_duration_hours > 72 |

---

### 12.23 AQI-HRS-23 全身麻醉气管插管拔管后声音嘶哑发生率

**公式：**

```text
拔管后声音嘶哑病例数 / 气管插管全麻病例数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 气管插管全麻 | airway_record.airway_type = 气管插管 |
| 声音嘶哑 | postoperative_followup.hoarseness = true |
| 持续时间 | hoarseness_duration_hours |

---

### 12.24 AQI-NCC-24 麻醉后新发昏迷发生率

**公式：**

```text
麻醉后新发昏迷病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 新发昏迷 | postoperative_followup.new_coma = true |
| GCS评分 | postoperative_followup.gcs_score |
| 持续时间 | 术后超过24小时仍昏迷 |

---

### 12.25 AQI-D24-25 麻醉后24小时内患者死亡率

**公式：**

```text
麻醉后24小时内死亡病例数 / 麻醉病例总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 死亡标记 | postoperative_followup.death_24h = true |
| 死亡时间 | death_time |
| 麻醉结束时间 | anesthesia_end_time |

---

### 12.26 AQI-LEA-26 阴道分娩椎管内麻醉使用率

**公式：**

```text
阴道分娩实施椎管内麻醉产妇数 / 阴道分娩产妇总数 × 100%
```

**数据来源：**

| 数据 | 字段 |
|---|---|
| 阴道分娩 | anesthesia_case.is_vaginal_delivery = true |
| 椎管内麻醉 | anesthesia_case.is_neuraxial_anesthesia = true |
| 产科病例 | anesthesia_case.is_obstetric = true |

---

## 13. 质控穿透明细要求

每个指标都必须支持穿透查看。

### 13.1 分子明细

示例：PACU入室低体温发生率的分子明细。

| 患者 | 手术间 | 麻醉方式 | 入PACU时间 | 首次体温 | 麻醉医生 | 操作 |
|---|---|---|---|---|---|---|
| 张某 | OR-03 | 全麻 | 10:35 | 35.6℃ | 王医生 | 查看记录单 |

### 13.2 分母明细

示例：全麻术中体温监测率的分母明细。

| 患者 | 手术间 | 麻醉方式 | 麻醉开始 | 离室时间 | 是否有体温 | 操作 |
|---|---|---|---|---|---|---|
| 李某 | OR-02 | 全麻 | 09:10 | 12:30 | 否 | 查看缺陷 |

### 13.3 缺陷病例

| 缺陷类型 | 患者 | 手术间 | 缺陷说明 | 责任医生 | 状态 |
|---|---|---|---|---|---|
| 体温未记录 | 李某 | OR-02 | 手术超过120分钟未记录体温 | 王医生 | 待整改 |
| PACU延迟 | 赵某 | PACU | PACU停留150分钟 | 李医生 | 已确认 |

---

## 14. 数据来源追溯展示要求

每个指标详情页必须有“数据来源”区域。

### 示例：全身麻醉术中体温监测率

```text
数据来源：
1. 分母来源：anesthesia_case
   条件：is_general_anesthesia = true
   时间字段：anesthesia_start_time

2. 分子来源：vital_sign_record
   条件：temp is not null
   时间范围：anesthesia_start_time 至 room_out_time

3. 关联方式：
   anesthesia_case.case_id = vital_sign_record.case_id

4. 排除规则：
   已取消病例不纳入统计
   测试病例不纳入统计
   作废记录不纳入统计
```

这个功能非常重要，因为医院质控科、麻醉科主任通常会追问：

> 这个数从哪里来的？怎么算出来的？为什么和手工统计不一致？

系统必须能解释清楚。

---

## 15. 质控缺陷自动识别规则

建议单独做“质控缺陷列表”页面。

| 缺陷 | 数据来源 |
|---|---|
| 择期手术未完成术前访视 | pre_anesthesia_visit |
| 全麻无体温记录 | vital_sign_record |
| 手术超过120分钟无体温 | anesthesia_case + vital_sign_record |
| 血压/脉搏记录间隔超过5分钟 | vital_sign_record |
| SpO₂记录间隔超过15分钟 | vital_sign_record |
| EtCO₂记录间隔超过30分钟 | anesthesia_machine_record |
| 连续泵入药物无停止时间 | anesthesia_medication |
| 插管有记录但拔管无记录 | anesthesia_event / airway_record |
| PACU入室无首次体温 | pacu_record |
| PACU停留超过2小时 | pacu_record |
| 术后镇痛患者未随访 | postoperative_followup |
| 特殊事件无处理措施 | anesthesia_event |
| 抢救记录未补记 | anesthesia_event |

### 缺陷闭环字段

| 字段 | 说明 |
|---|---|
| defect_id | 缺陷ID |
| case_id | 病例ID |
| defect_type | 缺陷类型 |
| defect_level | 一般 / 重要 / 严重 |
| defect_desc | 缺陷说明 |
| responsible_staff | 责任人员 |
| discovered_time | 发现时间 |
| status | 待确认 / 待整改 / 已整改 / 已关闭 |
| rectification_note | 整改说明 |
| reviewer | 审核人 |
| review_time | 审核时间 |

---

## 16. 前端技术方案

第一期建议采用：

| 技术 | 用途 |
|---|---|
| Vue 3 | 前端框架 |
| TypeScript | 类型约束 |
| Vite | 构建工具 |
| Arco Design Vue | UI组件库 |
| ECharts | 图表 |
| Pinia | 状态管理 |
| Vue Router | 路由 |
| dayjs | 时间处理 |
| mockjs / 本地 JSON | 模拟数据 |

### 16.1 目录建议

```text
src/
├─ assets/
├─ components/
│  ├─ quality/
│  │  ├─ IndicatorList.vue
│  │  ├─ IndicatorDetail.vue
│  │  ├─ IndicatorFormulaCard.vue
│  │  ├─ IndicatorTrendChart.vue
│  │  ├─ IndicatorDrillDrawer.vue
│  │  └─ QualityDefectTable.vue
│  ├─ anesthesia/
│  └─ common/
├─ config/
│  └─ qualityIndicators.ts
├─ mock/
│  ├─ anesthesiaCases.ts
│  ├─ patients.ts
│  ├─ anesthesiaStaff.ts
│  ├─ caseStaff.ts
│  ├─ preAnesthesiaVisits.ts
│  ├─ vitalSignRecords.ts
│  ├─ anesthesiaMachineRecords.ts
│  ├─ anesthesiaMedications.ts
│  ├─ fluidBloodRecords.ts
│  ├─ anesthesiaEvents.ts
│  ├─ pacuRecords.ts
│  ├─ postoperativeFollowups.ts
│  ├─ warmingRecords.ts
│  └─ airwayRecords.ts
├─ services/
│  ├─ qualityCalculator.ts
│  ├─ qualityDefectRules.ts
│  └─ mockApi.ts
├─ stores/
├─ router/
├─ views/
│  ├─ dashboard/
│  ├─ surgery/
│  ├─ anesthesia/
│  ├─ pacu/
│  ├─ postoperative/
│  ├─ quality/
│  └─ system/
└─ App.vue
```

---

## 17. 质控指标配置文件要求

建议建立：

```text
src/config/qualityIndicators.ts
```

### TypeScript 类型

```ts
export interface QualityIndicator {
  code: string
  name: string
  category: 'structure' | 'process' | 'outcome' | 'pacu' | 'postoperative' | 'obstetric'
  unit: '%' | '‰' | 'ratio' | 'count'
  numeratorName: string
  denominatorName: string
  formulaText: string
  dataSources: string[]
  defaultChartType: 'line' | 'bar' | 'gauge' | 'mixed'
  supportDrillDown: boolean
  supportDoctorAnalysis: boolean
  supportRoomAnalysis: boolean
  warningRule?: {
    operator: '>' | '<' | '>=' | '<='
    value: number
  }
}
```

### 示例配置

```ts
{
  code: 'AQI-TMR-07',
  name: '全身麻醉术中体温监测率',
  category: 'process',
  unit: '%',
  numeratorName: '全麻术中有体温记录病例数',
  denominatorName: '全麻病例总数',
  formulaText: '全麻术中有体温记录病例数 / 全麻病例总数 × 100%',
  dataSources: [
    'anesthesia_case',
    'vital_sign_record'
  ],
  defaultChartType: 'line',
  supportDrillDown: true,
  supportDoctorAnalysis: true,
  supportRoomAnalysis: true,
  warningRule: {
    operator: '<',
    value: 90
  }
}
```

---

## 18. 指标详情数据结构要求

前端阶段可模拟接口返回：

```ts
interface IndicatorDetail {
  code: string
  name: string
  currentValue: number | string
  unit: string
  numerator: number
  denominator: number
  expression: string
  period: string
  hospitalName: string
  yoy: number
  mom: number
  trend: Array<{
    month: string
    value: number
    numerator: number
    denominator: number
  }>
  subUnitAnalysis: Array<{
    unitName: string
    value: number
    numerator: number
    denominator: number
  }>
  doctorAnalysis: Array<{
    doctorName: string
    value: number
    numerator: number
    denominator: number
  }>
  roomAnalysis: Array<{
    roomName: string
    value: number
    numerator: number
    denominator: number
  }>
  numeratorCases: CaseSummary[]
  denominatorCases: CaseSummary[]
  defectCases: CaseSummary[]
}
```

---

## 19. UI风格要求

### 19.1 整体风格

- 医疗蓝 + 青绿为主色；
- 预警使用橙色；
- 严重异常使用红色；
- 不要过重阴影；
- 不做营销大屏风；
- 以“临床操作效率 + 质控专业度”为核心。

### 19.2 左侧指标列表

- 宽度建议 360px 到 420px；
- 当前选中指标使用浅蓝底色；
- 指标值字体要明显；
- 同比环比使用胶囊 Tag；
- 正向提升用绿色；
- 负向异常用红色；
- 无数据用灰色；
- 支持迷你趋势图。

### 19.3 右侧分析面板

建议结构：

```text
第一行：
[指标说明卡片] [当前值卡片] [同比卡片] [环比卡片]

第二行：
[12个月趋势图]

第三行：
[分子分母构成] [机构/手术间/医生对比]

第四行：
[分子明细] [分母明细] [缺陷病例]
```

### 19.4 图表要求

| 图表 | 用途 |
|---|---|
| 折线图 | 12个月指标趋势 |
| 柱状图 | 月度分子/分母数量 |
| 仪表盘 | 当前指标达标情况 |
| 饼图 | 事件原因构成 |
| 横向条形图 | 医生/手术间排名 |
| 表格 | 病例明细穿透 |

---

## 20. Mock 演示数据要求

第一期建议内置：

### 20.1 手术间

| 手术间 | 场景 |
|---|---|
| OR-01 | 腹腔镜胆囊切除，全麻，正常完成 |
| OR-02 | 全髋关节置换，全麻，预计手术超过120分钟但未记录体温 |
| OR-03 | 腹腔镜子宫肌瘤剔除，全麻，出现低体温 |
| OR-04 | 剖宫产，椎管内麻醉 |
| OR-05 | 颅内占位切除，全麻，非计划转ICU |
| OR-06 | 无痛胃肠镜，手术室外麻醉 |

### 20.2 PACU

至少 3 名患者：

| 患者 | 场景 |
|---|---|
| 患者A | 正常恢复转出 |
| 患者B | PACU停留超过2小时 |
| 患者C | 入室体温低于36℃ |

### 20.3 质控缺陷样例

| 缺陷 | 对应场景 |
|---|---|
| 全麻未记录体温 | OR-02 |
| 手术超过120分钟未记录体温 | OR-02 |
| 低体温发生 | OR-03 |
| 非计划转ICU | OR-05 |
| 手术室外麻醉 | OR-06 |
| PACU转出延迟 | PACU患者B |
| PACU入室低体温 | PACU患者C |
| 术后镇痛未随访 | 模拟术后随访缺失病例 |
| 连续泵入无停止时间 | 模拟持续用药缺陷 |

---

## 21. Codex / Cursor 开发指令

以下内容可以直接复制给 Codex 或 Cursor。

```text
你是资深医疗信息化前端工程师和UI/UX设计师。请基于 Vue 3 + TypeScript + Vite + Arco Design Vue + ECharts，为我实现一个“手术麻醉管理系统”的 Web 前端原型。当前阶段只做前端，不接后端，所有数据使用本地 mock 数据和 Pinia 状态管理模拟。

系统重点不是只画一张麻醉记录单，而是要围绕麻醉科完整业务闭环建设：
术前访视、麻醉评估、麻醉计划、患者入室、麻醉记录、设备数据采集展示、术中用药、输液输血、特殊事件、抢救、PACU恢复、术后镇痛随访、麻醉质控指标统计、质控缺陷整改、月度质控分析。

一、技术要求
- Vue 3 + TypeScript + Vite
- Arco Design Vue
- ECharts
- Pinia
- Vue Router
- dayjs
- 使用 mock 数据，不接真实 API
- 代码结构清晰，组件拆分合理
- 页面风格为现代医疗后台，不要营销大屏风，不要过重阴影
- 主色采用医疗蓝/青绿，预警使用橙色和红色
- 所有页面需要有较完整的模拟数据，能演示真实业务流

二、页面和菜单
实现以下一级菜单：
1. 工作台
2. 手术麻醉
3. PACU恢复室
4. 术后管理
5. 麻醉质控
6. 基础配置
7. 系统管理

三、核心页面
至少实现以下页面：
1. 麻醉工作台首页
2. 手术排班页面
3. 术前访视/麻醉评估页面
4. 麻醉记录单页面
5. 术中用药模块
6. 输液输血模块
7. 麻醉事件/抢救记录
8. PACU恢复室列表
9. PACU恢复记录
10. 术后随访页面
11. 麻醉质控看板
12. 质控缺陷列表

四、重点优化麻醉质控模块
请参考国家/省级麻醉质控平台风格，实现专业的麻醉质控指标分析界面。

麻醉质控页面采用左右分栏：
- 顶部为筛选区；
- 左侧为26项麻醉质控指标列表；
- 右侧为选中指标的详细分析。

顶部筛选区包括：
- 医疗机构
- 时间范围
- 指标分类
- 麻醉方式
- 手术地点
- 手术类型
- 麻醉医生
- 手术间
- 刷新
- 导出

左侧指标列表每项展示：
- 星标收藏
- 指标名称
- 指标编码
- 当前指标值
- 单位
- 同比
- 环比
- 最近12个月迷你趋势图
- 异常状态标识

左侧指标列表支持：
- 点击指标切换右侧详情
- 按指标名称和编码搜索
- 按结构、过程、结果、PACU、术后、产科分组
- 收藏指标置顶
- 异常指标置顶
- 趋势图、同比、环比显示开关

右侧指标详情包含：
1. 指标说明卡片
   - 指标名称
   - 指标编码
   - 当前时间
   - 当前单位
   - 指标值
   - 计算公式
   - 计算表达式
   - 分子名称
   - 分母名称
   - 数据来源
   - 排除规则

2. 趋势图
   - 最近12个月趋势
   - 分子趋势
   - 分母趋势
   - 同比/环比趋势

3. 明细分析
   - 子单元分析：按院区、科室、手术间
   - 子实体分析：按麻醉医生、患者、手术类型
   - 空值分析：展示数据缺失情况
   - 异常病例：展示触发质控缺陷的病例

4. 分子/分母穿透
   - 点击分子数量，打开分子病例明细抽屉
   - 点击分母数量，打开分母病例明细抽屉
   - 点击异常病例，进入麻醉记录单或PACU记录单

五、26项质控指标配置
在 src/config/qualityIndicators.ts 中建立26项指标配置，每项包含：
- code
- name
- category
- unit
- numeratorName
- denominatorName
- formulaText
- dataSources
- defaultChartType
- supportDrillDown
- supportDoctorAnalysis
- supportRoomAnalysis
- warningRule

必须配置以下26项：
1. AQI-DNR-01 麻醉科医护比
2. AQI-ACC-02 麻醉医师人均年麻醉例次数
3. AQI-PAO-03 手术室外麻醉占比
4. AQI-PVR-04 择期手术麻醉前访视率
5. AQI-CRB-05 入室后手术麻醉取消率
6. AQI-CRA-06 麻醉开始后手术取消率
7. AQI-TMR-07 全身麻醉术中体温监测率
8. AQI-AWR-08 术中主动保温率
9. AQI-ATR-09 术中自体血输注率
10. AQI-IHT-10 手术麻醉期间低体温发生率
11. AQI-DII-11 术中牙齿损伤发生率
12. AQI-AAR-12 麻醉期间严重反流误吸发生率
13. AQI-UPA-13 计划外建立人工气道发生率
14. AQI-ICA-14 术中心脏骤停率
15. AQI-ASA-15 麻醉期间严重过敏反应发生率
16. AQI-AWR-16 全身麻醉术中知晓发生率
17. AQI-PHT-17 PACU入室低体温发生率
18. AQI-PDR-18 麻醉后PACU转出延迟率
19. AQI-URI-19 非计划二次气管插管率
20. AQI-UICU-20 非计划转入ICU率
21. AQI-PAS-21 术后镇痛满意率
22. AQI-RNC-22 区域阻滞麻醉后严重神经并发症发生率
23. AQI-HRS-23 全身麻醉气管插管拔管后声音嘶哑发生率
24. AQI-NCC-24 麻醉后新发昏迷发生率
25. AQI-D24-25 麻醉后24小时内患者死亡率
26. AQI-LEA-26 阴道分娩椎管内麻醉使用率

六、Mock数据
建立以下 mock 数据：
- anesthesiaCases
- patients
- anesthesiaStaff
- caseStaff
- preAnesthesiaVisits
- vitalSignRecords
- anesthesiaMachineRecords
- anesthesiaMedications
- fluidBloodRecords
- anesthesiaEvents
- pacuRecords
- postoperativeFollowups
- warmingRecords
- airwayRecords

七、指标计算
前端阶段先在 src/services/qualityCalculator.ts 中用 mock 数据计算指标。
每个指标返回：
- currentValue
- numerator
- denominator
- expression
- yoy
- mom
- trend
- subUnitAnalysis
- doctorAnalysis
- roomAnalysis
- numeratorCases
- denominatorCases
- defectCases

八、质控缺陷识别
实现 src/services/qualityDefectRules.ts，至少识别：
- 择期手术未完成术前访视
- 全麻无体温记录
- 手术超过120分钟无体温
- PACU入室低体温
- PACU停留超过2小时
- 连续泵入药物无停止时间
- 插管有记录但拔管无记录
- 术后镇痛患者未随访
- 特殊事件无处理措施

九、麻醉记录单页面
麻醉记录单页面要接近真实临床操作，不要做成普通表单。
顶部显示患者信息、手术信息、麻醉医师、麻醉护士、ASA、手术间。
中间显示生命体征趋势图，至少包含 HR、SBP、DBP、SpO2、EtCO2、TEMP。
提供关键按钮：
入室、麻醉开始、诱导、插管、切皮、手术开始、手术结束、拔管、麻醉结束、离室、转PACU、转ICU、抢救。
点击按钮后自动在事件时间轴追加记录。
支持手工录入生命体征。
支持体温低于36℃自动红色标记。
支持预计手术超过120分钟但未记录体温时显示质控缺陷。
支持抢救模式：点击“抢救”后页面进入红色抢救状态，记录频率提示提高，弹出抢救记录面板。

十、UI风格
整体风格参考医院质控平台：
- 左侧指标列表简洁密集
- 右侧分析区专业、清晰
- 指标说明卡片使用浅黄色或浅蓝色
- 同比环比使用胶囊标签
- 异常指标使用红色标识
- 正常指标使用蓝绿色
- 图表使用ECharts
- 避免空洞大卡片，重点突出指标、趋势、分子分母和病例穿透

十一、输出要求
- 生成完整可运行项目
- 提供 README，说明安装、启动、页面说明
- 页面和组件拆分清晰，便于后续接入真实后端 API
- 所有 mock 数据集中管理
- 质控指标配置集中管理
- 指标计算逻辑集中管理
- 缺陷识别规则集中管理
```

---

## 22. 后续后端实现建议

前端完成后，后端建议再按以下顺序推进：

1. 基础字典与人员组织；
2. 手术病例主数据；
3. 麻醉记录单保存；
4. 术前访视；
5. 用药、输液、输血、事件；
6. PACU记录；
7. 术后随访；
8. 质控指标计算；
9. 质控缺陷识别；
10. 质控上报与导出；
11. 设备采集接入；
12. HIS/EMR/手术排班系统对接。

---

## 23. 对医院沟通时的核心表达

可以这样介绍本系统：

> 本系统不是单纯电子化麻醉记录单，而是围绕麻醉科术前、术中、术后、PACU和质控上报的完整业务闭环建设。系统可以从麻醉记录单、术前访视、设备采集、PACU记录、术后随访和不良事件中自动提取数据，形成国家麻醉专业26项质控指标。每一个指标都可以查看计算公式、数据来源、分子分母、趋势变化和病例明细，能够解释清楚每一个数从哪里来、怎么算出来、哪些病例影响了指标结果，从而支撑麻醉科精细化管理和持续质量改进。
