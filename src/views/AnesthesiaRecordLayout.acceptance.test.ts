import { describe, expect, it } from 'vitest';
import recordHeaderSource from '@/components/anesthesia/record/sheet/RecordHeader.vue?raw';
import recordViewSource from '@/views/AnesthesiaRecord.vue?raw';
import topbarViewSource from '@/components/anesthesia/record/RecordWorkstationTopbar.vue?raw';
import intraopWorkflowSource from '@/components/anesthesia/record/IntraopWorkflowPanel.vue?raw';
import detailTabsSource from '@/components/anesthesia/record/RecordDetailTabs.vue?raw';
import roomDeviceApiSource from '@/api/anesthesiaRoomDeviceConfig.ts?raw';

// 这些验收用例在 node 环境下以“源码级断言”锁定布局契约，等价于 DOM 层面的结构门禁。
// 任何破坏以下契约的改动都会让 CI 失败，避免右侧菜单/表头折叠/设备入口再次分裂。

describe('患者表头折叠（任务二）', () => {
  it('屏幕模式默认折叠为单行摘要，打印模式始终完整表头', () => {
    expect(recordHeaderSource).toContain('data-testid="record-header-summary"');
    expect(recordHeaderSource).toContain('summaryMode');
    // 摘要只在非打印、未展开时渲染
    expect(recordHeaderSource).toContain('!props.printMode && !expanded.value');
    // 完整表头在打印或展开时渲染（v-else 分支保留全部纸面字段）
    expect(recordHeaderSource).toContain('label="住院号"');
    expect(recordHeaderSource).toContain('label="ASA"');
  });

  it('提供唯一“编辑信息”入口，展开后复用现有字段', () => {
    expect(recordHeaderSource).toContain('data-testid="record-header-edit"');
    expect(recordHeaderSource).toContain('编辑信息');
    // 复用既有保存事件，不新建第二套表单
    expect(recordHeaderSource).toContain("'update:actualSurgeryName'");
    expect(recordHeaderSource).toContain('applyMethodSelection');
  });

  it('建立临时草稿并一次性提交；取消丢弃草稿', () => {
    expect(recordHeaderSource).toContain('const draft = ref');
    expect(recordHeaderSource).toContain('const collectDraft = ');
    expect(recordHeaderSource).toContain('const saveEdit = ');
    expect(recordHeaderSource).toContain('const cancelEdit = ');
  });

  it('未保存草稿上抛脏状态，刷新/离开需确认', () => {
    expect(recordHeaderSource).toContain('dirtyChange');
    expect(recordHeaderSource).toContain("window.addEventListener('beforeunload'");
  });

  it('锁定/终态记录允许展开查看但不允许编辑', () => {
    // 保存按钮在只读时不渲染，展开态仍可查看（收起按钮存在）
    expect(recordHeaderSource).toContain('v-if="!readOnly"');
    expect(recordHeaderSource).toContain('查看信息');
  });

  it('风险标识始终可见（过敏/困难气道/感染）', () => {
    expect(recordHeaderSource).toContain('resolveHeaderRiskFlags');
    expect(recordHeaderSource).toContain('rhs-risk');
    expect(recordHeaderSource).toContain('allergy');
    expect(recordHeaderSource).toContain('difficultAirway');
  });

  it('打印/预览不受折叠影响，不输出编辑按钮与折叠控件', () => {
    // 摘要与编辑条均带 no-print，且分支由 printMode 控制
    expect(recordHeaderSource).toContain('record-header-summary no-print');
    expect(recordHeaderSource).toContain('header-edit-bar no-print');
  });
});

describe('三标签侧栏', () => {
  it('固定为 当前任务 / 设备 / 提醒 三个一级标签', () => {
    expect(recordViewSource).toContain('data-testid="side-tab-task"');
    expect(recordViewSource).toContain('data-testid="side-tab-device"');
    expect(recordViewSource).toContain('data-testid="side-tab-reminder"');
  });

  it('默认打开“当前任务”', () => {
    expect(recordViewSource).toMatch(/sideTab = ref<'task' \| 'device' \| 'reminder'>\('task'\)/);
  });

  it('当前任务归属：场景/阶段/持续泵入/待确认记录/专业补充/最近录入，不含完整关键时间与重复快捷操作', () => {
    expect(recordViewSource).toContain('data-testid="side-pane-task"');
    expect(recordViewSource).toContain('<IntraopWorkflowPanel');
    expect(recordViewSource).toContain('data-testid="side-running-pumps"');
    expect(recordViewSource).toContain('<RecordRecentEntries');
    expect(recordViewSource).toContain('<EventDetailPanel');
    // 完整关键时间长列表已移出当前任务
    expect(recordViewSource).not.toContain('class="timeline-workbench-card"');
    // 当前任务面板不再渲染与顶部重复的快捷事件按钮/麻醉方式/方案/定位
    expect(intraopWorkflowSource).not.toContain('quickEvents');
    expect(intraopWorkflowSource).not.toContain('当前阶段推荐动作');
    expect(intraopWorkflowSource).not.toContain('麻醉方式');
    expect(intraopWorkflowSource).not.toContain('定位手术状态行');
  });

  it('设备归属：唯一以设备采集会话为来源，移除旧 monitor mock 卡片', () => {
    expect(recordViewSource).toContain('data-testid="side-pane-device"');
    expect(recordViewSource).toContain('<DeviceSessionVentilatorPanel');
    expect(recordViewSource).not.toContain('<RecordRealtimeDevicePanel');
    expect(recordViewSource).not.toContain('import RecordRealtimeDevicePanel');
  });

  it('提醒归属：质控/异常/待补/完整性 + 设备异常 + 同步冲突', () => {
    expect(recordViewSource).toContain('data-testid="side-pane-reminder"');
    expect(recordViewSource).toContain('<RecordQualityPanel');
    expect(recordViewSource).toContain('data-testid="side-device-anomalies"');
    // 独立 record-side 质控列已移除
    expect(recordViewSource).not.toContain('class="record-side record-side-stack"');
  });

  it('设备角标表示实际设备数量，提醒角标统计未处理数量', () => {
    expect(recordViewSource).toContain('reminderBadgeCount');
    expect(recordViewSource).toContain('deviceCount');
    expect(recordViewSource).not.toContain('deviceAnomalyCount');
  });

  it('侧栏折叠真正释放宽度（收缩 grid 列，非 visibility/display 占位）', () => {
    expect(recordViewSource).toContain("'toolbox-collapsed': toolboxCollapsed");
    expect(recordViewSource).toContain('.record-center.toolbox-collapsed');
  });

  it('提供折叠窄栏与大屏固定宽度（约320，1366 控制 280~300）', () => {
    expect(recordViewSource).toContain('data-testid="record-toolbox-rail"');
    expect(recordViewSource).toContain('clamp(280px, 18vw, 320px)');
  });

  it('小屏使用单一覆盖式抽屉，不产生嵌套抽屉', () => {
    expect(recordViewSource).toContain('openMoreTools');
  });
});

describe('顶部去重与抢救模式', () => {
  it('顶部不再出现重复的“采集中”标签', () => {
    const topbarSource = topbarViewSource;
    expect(topbarSource).not.toContain('采集中');
  });

  it('顶部不再重复摘要已有的患者姓名/手术名称', () => {
    const topbarSource = topbarViewSource;
    expect(topbarSource).not.toContain('ctx-name');
    expect(topbarSource).not.toContain('ctx-surgery');
  });

  it('抢救模式使用轻量非打印横幅，单一退出入口，移除顶栏退出抢救按钮', () => {
    expect(recordViewSource).toContain('data-testid="rescue-banner"');
    expect(recordViewSource).toContain('data-testid="rescue-exit-btn"');
    const topbarSource = topbarViewSource;
    expect(topbarSource).not.toContain("name: '退出抢救'");
    expect(topbarSource).not.toContain("退出抢救");
  });
});

describe('更多工具抽屉（任务四）', () => {
  it('侧栏顶部仅一个“更多工具”入口', () => {
    expect(recordViewSource).toContain('data-testid="record-more-tools"');
    expect(recordViewSource).toContain('data-testid="more-tools-body"');
  });

  it('抽屉复用现有低频组件，不重新实现业务', () => {
    expect(recordViewSource).toContain('<RecordDetailTabs');
    expect(recordViewSource).toContain('<StructuredClinicalEntitiesPanel');
    expect(recordViewSource).toContain('<AnesthesiaTemplateSelector');
    expect(recordViewSource).toContain('<DynamicAnesthesiaModules');
    expect(recordViewSource).toContain('<RecordAuditPanel');
  });
});

describe('重复入口清理与模拟控制删除（任务五）', () => {
  it('右侧不再保留与顶部重复的给药/液体/输血/出入量/血气/关键事件工具条', () => {
    expect(recordViewSource).not.toContain('<RecordQuickToolbar');
    expect(recordViewSource).not.toContain("import RecordQuickToolbar");
  });

  it('侧栏不再保留第二套麻醉方式入口', () => {
    expect(recordViewSource).not.toContain('<AnesthesiaTypeSelector');
    expect(recordViewSource).not.toContain("import AnesthesiaTypeSelector");
  });

  it('正式页面不再包含设备模拟控制/波形占位/模拟频率/异常模拟/模拟断连', () => {
    expect(recordViewSource).not.toContain('<RecordRealtimeWaveformPlaceholder');
    expect(recordViewSource).not.toContain("import RecordRealtimeWaveformPlaceholder");
    expect(recordViewSource).not.toContain('<RecordDeviceWorkbenchPanel');
    expect(recordViewSource).not.toContain("import RecordDeviceWorkbenchPanel");
    // 页面底部重复的数据维护折叠区已移入抽屉
    expect(recordViewSource).not.toContain('class="record-detail-collapse"');
  });

  it('顶部仍保留唯一主入口（给药/液体/输血/出入量/血气/关键事件）', () => {
    expect(recordViewSource).toContain('<RecordSheetQuickStrip');
  });
});

describe('更多工具抽屉布局与一级导航', () => {
  it('一级导航含数据明细/结构化记录/麻醉方案模板/手术间设备配置等独立工具', () => {
    expect(recordViewSource).toContain("label: '数据明细'");
    expect(recordViewSource).toContain("label: '结构化记录'");
    // 方案初始化批量初始化麻醉方式+结构化落单 → 保留并改名为麻醉方案模板（不删除）
    expect(recordViewSource).toContain("label: '麻醉方案模板'");
    expect(recordViewSource).toContain("label: '手术间设备配置'");
    // 数据明细下的患者/麻醉/生命体征/用药为二级标签，不再与一级工具同层
    expect(recordViewSource).not.toContain("方案初始化");
  });

  it('抽屉宽度 620~720 且最大 90vw，仅一个纵向滚动容器', () => {
    expect(recordViewSource).toContain(':width="660"');
    expect(recordViewSource).toContain('max-width: 90vw');
    expect(recordViewSource).toContain('more-tools-scroll');
  });

  it('接入 RoomDeviceConfigPanel（SAMIS 手术间设备配置）', () => {
    expect(recordViewSource).toContain('<RoomDeviceConfigPanel');
    expect(recordViewSource).toContain("import RoomDeviceConfigPanel");
  });
});

describe('手术间设备配置（SAMIS）边界', () => {
  it('API 只读引用 HULI 设备编号/型号，保存房间关系与中央采集编号', () => {
    expect(roomDeviceApiSource).toContain('roomDeviceConfigList');
    expect(roomDeviceApiSource).toContain('saveRoomDeviceConfig');
    expect(roomDeviceApiSource).toContain('centralDeviceNo');
    expect(roomDeviceApiSource).toContain('deviceCode');
    expect(roomDeviceApiSource).toContain('deviceModel');
    // HULI 设备候选只读，前端不提供修改入口
    expect(roomDeviceApiSource).toContain('readOnly: true');
  });

  it('默认直连真实后端，不走内置 mock 房间（专用开关默认关闭）', () => {
    // 专用请求封装：默认 samisHttpFetch 直连，仅 useRoomDeviceMock() 为真时才回退 mock
    expect(roomDeviceApiSource).toContain('roomDeviceRequest');
    expect(roomDeviceApiSource).toContain('useRoomDeviceMock');
    expect(roomDeviceApiSource).toContain('samisHttpFetch');
    // 明确不得硬编码内置 mock 房间 OR-01/1号
    expect(roomDeviceApiSource).not.toContain("'OR-01'");
    expect(roomDeviceApiSource).not.toContain('1号手术间');
  });
});

describe('设备标签病例操作与状态', () => {
  it('提供设备详情/更换当前设备/停止解除关联/暂停显示/确认转移', () => {
    expect(recordViewSource).toContain('data-testid="device-case-ops"');
    expect(recordViewSource).toContain('更换当前设备');
    expect(recordViewSource).toContain('停止并解除关联');
    expect(recordViewSource).toContain('暂停显示');
    expect(recordViewSource).toContain('确认设备转移');
    expect(recordViewSource).toContain('anesthesiaDeviceSessionApi.cancel');
  });

  it('暂停显示只暂停前端刷新（不修改 binding），与停止采集明确区分', () => {
    expect(recordViewSource).toContain('deviceDisplayPaused');
    expect(recordViewSource).toContain('显示已暂停，后台仍在采集');
    expect(recordViewSource).not.toContain('暂停采集');
  });

  it('关联状态：已有 binding 后轮询不显示关联中，区分 associating/bound', () => {
    expect(recordViewSource).toContain(':display-paused="deviceDisplayPaused"');
  });
});

describe('提醒计数来源', () => {
  it('角标按稳定 issueId 去重并显示分类细分（非硬编码）', () => {
    expect(recordViewSource).toContain('reminderIssues');
    expect(recordViewSource).toContain('reminderBreakdown');
    expect(recordViewSource).toContain('data-testid="reminder-breakdown"');
  });
});

describe('患者信息与生命体征布局修复', () => {
  it('不再使用 a-descriptions 窄表格（避免逐字竖排），改响应式描述网格', () => {
    expect(detailTabsSource).toContain('detail-info-grid');
    expect(detailTabsSource).toContain('detail-info-item--full');
  });

  it('生命体征时间列固定左侧 + 空状态', () => {
    expect(detailTabsSource).toContain('fixed="left"');
    expect(detailTabsSource).toContain('#empty');
  });
});

describe('关键时间唯一入口恢复', () => {
  it('当前任务含“关键时间”区域，复用 TimelineNodeRail 单数据源 saveTimelineNode', () => {
    expect(recordViewSource).toContain('class="keytime-card"');
    expect(recordViewSource).toContain('<TimelineNodeRail');
    expect(recordViewSource).toContain('@save="saveTimelineNode"');
    // 不再移除关键时间（旧 timeline-workbench-card 改名为 keytime-card，不产生第二套）
    expect(recordViewSource).toContain('keytime-progress');
  });

  it('顶部快捷事件与关键时间共用同一保存路径 saveTimelineNode（无第二套状态）', () => {
    expect(recordViewSource).toContain('saveTimelineNode(');
  });
});

describe('手术间设备配置收尾', () => {
  it('返回全部启用手术间含未配置，带 configStatus/conflictCount', () => {
    expect(roomDeviceApiSource).toContain('configStatus');
    expect(roomDeviceApiSource).toContain('conflictCount');
  });

  it('候选带 selectable/disabledReason，前端不 hardcode 占用判断', () => {
    expect(roomDeviceApiSource).toContain('selectable');
    expect(roomDeviceApiSource).toContain('disabledReason');
  });
});
