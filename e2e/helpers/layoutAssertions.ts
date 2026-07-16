import type { Page } from '@playwright/test';

export interface Viewport {
  width: number;
  height: number;
}

export const configPages = [
  { name: '手术间', path: '/config/rooms' },
  { name: '人员', path: '/config/staff' },
  { name: '麻醉方式', path: '/config/methods' },
  { name: '药品', path: '/config/drugs' },
  { name: '液体血制品', path: '/config/fluids' },
  { name: '事件', path: '/config/events' },
  { name: '评分', path: '/config/scores' },
  { name: '生命体征', path: '/config/vitals' },
  { name: '打印模板', path: '/config/print' },
] as const;

export const layoutViewports: Viewport[] = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

/** 普通表头允许至多两行；超过该高度即视为逐字竖排或异常增高。 */
export const HEADER_MAX_HEIGHT = 64;
/** 操作列单元高度上限；超过即视为按钮无规则多行堆叠。 */
export const ACTION_CELL_MAX_HEIGHT = 60;
/** 麻醉方式左侧大类最小宽度（桌面端）。 */
export const METHODS_LEFT_MIN_WIDTH = 280;

export interface HeaderEntry {
  name: string;
  found: boolean;
  left: number;
  right: number;
  width: number;
}

export interface TableState {
  index: number;
  outerRight: number;
  outerWidth: number;
  bodyScrollable: boolean;
  bodyOverflowX: string;
  maxThHeight: number;
  maxActionCellHeight: number;
  tallHeaders: string[];
  fixedRightLeft: number | null;
  lastDataColRight: number | null;
}

export interface CodeColumnState {
  header: string;
  nowrap: boolean;
  ellipsis: boolean;
}

export interface LayoutReport {
  viewportWidth: number;
  docScrollWidth: number;
  pageOverflow: boolean;
  bodyOverflowX: string;
  contentRight: number;
  contentWidth: number;
  headerEntries: HeaderEntry[];
  headerOverlaps: number;
  tables: TableState[];
  methodsLeftWidth: number;
  methodsRightOuterRight: number;
  codeColumns: CodeColumnState[];
}

function rectOf(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, width: r.width, height: r.height };
}

/**
 * 在浏览器内采集页面几何状态。所有判定均基于真实 DOM 坐标，
 * 不依赖 scrollWidth 被 overflow-x:hidden 裁切后的表象。
 */
export async function collectLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(
    (cfg) => {
      const HEADER_MAX_HEIGHT = cfg.HEADER_MAX_HEIGHT;
      const vw = document.documentElement.clientWidth;
      const pick = (sel: string) => {
        const r = rectOf(document.querySelector(sel));
        return r;
      };
      const overlaps = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a, tol = 1) =>
        a.left < b.right - tol && a.right > b.left + tol && a.top < b.bottom - tol && a.bottom > b.top + tol;

      const contains = (parent: Element, child: Element | null) => !!(child && parent.contains(child));

      // 头部关键入口：头像、用户名、我的手术、质控缺陷、页面标题
      const headerQuery = (sel: string, text?: string) => {
        const all = Array.from(document.querySelectorAll<HTMLElement>(sel));
        const node = text ? all.find((n) => (n.textContent || '').includes(text)) : all[0];
        const r = rectOf(node ?? null);
        return r ? { found: true, left: r.left, right: r.right, width: r.width } : { found: false, left: 0, right: 0, width: 0 };
      };

      const headerEntries = [
        { name: '用户头像', ...headerQuery('.app-header .header-avatar') },
        { name: '用户名', ...headerQuery('.app-header .header-user-name') },
        { name: '我的手术', ...headerQuery('.app-header button', '我的手术') },
        { name: '质控缺陷', ...headerQuery('.app-header button', '质控缺陷') },
        { name: '页面标题', ...headerQuery('.app-header .header-title') },
      ];

      // 头部徽标与按钮重叠检测：计数位于可视区的徽标计数与“非自身按钮”相交的数量
      let headerOverlaps = 0;
      const headerActions = document.querySelector('.header-actions');
      if (headerActions) {
        const badges = Array.from(headerActions.querySelectorAll<HTMLElement>('.arco-badge-count')).filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (b.textContent || '').trim() !== '0';
        });
        const buttons = Array.from(headerActions.querySelectorAll<HTMLElement>('button'));
        for (const badge of badges) {
          const br = badge.getBoundingClientRect();
          const owner = badge.closest('button, .arco-badge, .arco-space');
          for (const btn of buttons) {
            if (owner && contains(owner, btn)) continue;
            if (btn.contains(badge)) continue;
            const bb = btn.getBoundingClientRect();
            if (overlaps({ left: br.left, right: br.right, top: br.top, bottom: br.bottom }, { left: bb.left, right: bb.right, top: bb.top, bottom: bb.bottom })) {
              headerOverlaps += 1;
            }
          }
        }
      }

      // 表格几何
      const tables: TableState[] = [];
      const tableEls = Array.from(document.querySelectorAll<HTMLElement>('.arco-table'));
      tableEls.forEach((table, index) => {
        const outer = rectOf(table)!;
        const body = table.querySelector<HTMLElement>('.arco-table-body, .arco-table-element') ?? table;
        const bodyScrollable = body.scrollWidth > body.clientWidth + 1;
        const bodyOverflowX = getComputedStyle(body).overflowX;

        const ths = Array.from(table.querySelectorAll<HTMLElement>('.arco-table-th'));
        const thHeights = ths.map((th) => th.getBoundingClientRect().height);
        const maxThHeight = thHeights.length ? Math.max(...thHeights) : 0;
        const tallHeaders = ths
          .filter((th) => th.getBoundingClientRect().height > HEADER_MAX_HEIGHT)
          .map((th) => (th.textContent || '').trim().slice(0, 12));

        // 操作列单元高度：取最右侧列的 td 高度
        const actionCells = Array.from(table.querySelectorAll<HTMLElement>('.arco-table-td'));
        const lastColIdx = ths.length - 1;
        const actionCellHeights = lastColIdx >= 0
          ? Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).map((tr) => {
              const tds = tr.querySelectorAll('.arco-table-td');
              const cell = tds[lastColIdx];
              return cell ? cell.getBoundingClientRect().height : 0;
            })
          : [];
        const maxActionCellHeight = actionCellHeights.length ? Math.max(...actionCellHeights) : 0;

        // 固定操作列：区分固定列与数据列，比较数据列最大右边缘与固定列最小左边缘
        const isFixedCell = (el: Element) => {
          const cls = el.className || '';
          return /fixed-right/i.test(String(cls)) || !!el.closest('.arco-table-col-fixed-right, .arco-table-fixed-right, .arco-table-cell-fixed-right');
        };
        const fixedThs = ths.filter(isFixedCell);
        const dataThs = ths.filter((th) => !isFixedCell(th));
        const fixedRightLeft = fixedThs.length ? Math.min(...fixedThs.map((th) => th.getBoundingClientRect().left)) : null;
        const lastDataColRight = dataThs.length ? Math.max(...dataThs.map((th) => th.getBoundingClientRect().right)) : null;

        tables.push({
          index,
          outerRight: outer.right,
          outerWidth: outer.width,
          bodyScrollable,
          bodyOverflowX,
          maxThHeight,
          maxActionCellHeight,
          tallHeaders,
          fixedRightLeft,
          lastDataColRight,
        });
      });

      // 麻醉方式左右区域
      const methodList = document.querySelector('.config-methods-page .arco-list, .config-methods-page .method-category-col');
      const methodsLeftWidth = methodList ? methodList.getBoundingClientRect().width : 0;
      const methodsRight = document.querySelector('.config-methods-page .arco-table');
      const methodsRightOuterRight = methodsRight ? methodsRight.getBoundingClientRect().right : 0;

      // 编码列省略检测
      const codeColumns: CodeColumnState[] = [];
      document.querySelectorAll<HTMLElement>('.arco-table').forEach((table) => {
        const ths = Array.from(table.querySelectorAll<HTMLElement>('.arco-table-th'));
        ths.forEach((th, idx) => {
          const text = (th.textContent || '').trim();
          if (!/编码|code/i.test(text)) return;
          const sampleTd = table.querySelector<HTMLElement>(`tbody tr .arco-table-td:nth-child(${idx + 1})`);
          const cs = sampleTd ? getComputedStyle(sampleTd) : null;
          codeColumns.push({
            header: text,
            nowrap: cs ? cs.whiteSpace === 'nowrap' : false,
            ellipsis: cs ? cs.textOverflow === 'ellipsis' : false,
          });
        });
      });

      const content = pick('.app-content');

      return {
        viewportWidth: vw,
        docScrollWidth: document.documentElement.scrollWidth,
        pageOverflow: document.documentElement.scrollWidth > vw + 1,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        contentRight: content ? content.right : 0,
        contentWidth: content ? content.width : 0,
        headerEntries,
        headerOverlaps,
        tables,
        methodsLeftWidth,
        methodsRightOuterRight,
        codeColumns,
      };

      function rectOf(el: Element | null) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height };
      }
    },
    { HEADER_MAX_HEIGHT },
  );
}

export interface LayoutViolations {
  pageOverflow: string[];
  bodyClipped: string[];
  headerClipped: string[];
  headerOverlap: string[];
  verticalHeaders: string[];
  tablePushesPage: string[];
  actionStacked: string[];
  fixedCoversData: string[];
  methodsSqueezed: string[];
  codeWrapped: string[];
}

/**
 * 将采集结果按十类门禁规则归约为可读的违规说明。
 * 返回空对象表示全部通过。
 */
export function summarizeViolations(report: LayoutReport): LayoutViolations {
  const v: LayoutViolations = {
    pageOverflow: [],
    bodyClipped: [],
    headerClipped: [],
    headerOverlap: [],
    verticalHeaders: [],
    tablePushesPage: [],
    actionStacked: [],
    fixedCoversData: [],
    methodsSqueezed: [],
    codeWrapped: [],
  };
  const vw = report.viewportWidth;

  // 1. 页面主体没有被 body 的 overflow-x 裁切，且无页面级横向溢出
  if (report.bodyOverflowX === 'hidden') v.bodyClipped.push('body 仍使用 overflow-x:hidden 掩盖溢出');
  if (report.pageOverflow) v.pageOverflow.push(`文档横向溢出 scrollWidth=${report.docScrollWidth} > 视口 ${vw}`);
  if (report.contentRight > vw + 1) v.pageOverflow.push(`内容区右边缘 ${Math.round(report.contentRight)} 超出视口 ${vw}`);

  // 2 & 头部入口可视
  for (const e of report.headerEntries) {
    if (!e.found) {
      v.headerClipped.push(`${e.name} 未找到`);
    } else if (e.right > vw + 1 || e.left < -1 || e.width <= 0) {
      v.headerClipped.push(`${e.name} 超出可视区 right=${Math.round(e.right)}`);
    }
  }

  // 3. 头部按钮与徽标不重叠
  if (report.headerOverlaps > 0) v.headerOverlap.push(`检测到 ${report.headerOverlaps} 处徽标/按钮重叠`);

  // 4 & 表头不竖排
  for (const t of report.tables) {
    for (const h of t.tallHeaders) v.verticalHeaders.push(`表格${t.index} 表头「${h}」高度 ${Math.round(t.maxThHeight)}px 超过 ${HEADER_MAX_HEIGHT}px`);
  }

  // 5. 表格只允许内部横向滚动
  for (const t of report.tables) {
    if (t.outerRight > vw + 1) v.tablePushesPage.push(`表格${t.index} 外框右边缘 ${Math.round(t.outerRight)} 挤出页面`);
    if (t.bodyScrollable && !/^(auto|scroll)$/.test(t.bodyOverflowX)) {
      v.tablePushesPage.push(`表格${t.index} 内部超宽但未启用横向滚动 overflow-x=${t.bodyOverflowX}`);
    }
  }

  // 7. 操作按钮不无规则多行堆叠
  for (const t of report.tables) {
    if (t.maxActionCellHeight > ACTION_CELL_MAX_HEIGHT) v.actionStacked.push(`表格${t.index} 操作列高度 ${Math.round(t.maxActionCellHeight)}px 超过 ${ACTION_CELL_MAX_HEIGHT}px`);
  }

  // 6. 固定操作列不得遮挡数据列
  for (const t of report.tables) {
    if (t.fixedRightLeft != null && t.lastDataColRight != null && t.fixedRightLeft < t.lastDataColRight - 1) {
      v.fixedCoversData.push(`表格${t.index} 固定列 left=${Math.round(t.fixedRightLeft)} 遮挡数据列 right=${Math.round(t.lastDataColRight)}`);
    }
  }

  // 8. 麻醉方式左右不互相挤压
  if (report.methodsLeftWidth > 0 && report.methodsLeftWidth < METHODS_LEFT_MIN_WIDTH) {
    v.methodsSqueezed.push(`麻醉方式左侧大类宽度 ${Math.round(report.methodsLeftWidth)} 小于 ${METHODS_LEFT_MIN_WIDTH}px`);
  }
  if (report.methodsRightOuterRight > vw + 1) {
    v.methodsSqueezed.push(`麻醉方式右侧子项表格右边缘 ${Math.round(report.methodsRightOuterRight)} 挤出页面`);
  }

  // 9. 长编码单行省略
  for (const c of report.codeColumns) {
    if (!c.nowrap) v.codeWrapped.push(`编码列「${c.header}」未设置单行不换行`);
    else if (!c.ellipsis) v.codeWrapped.push(`编码列「${c.header}」未设置省略号`);
  }

  return v;
}

export function hasViolations(v: LayoutViolations): boolean {
  return Object.values(v).some((arr) => arr.length > 0);
}

export function flattenViolations(v: LayoutViolations): string[] {
  return Object.entries(v).flatMap(([key, arr]) => arr.map((msg) => `[${key}] ${msg}`));
}

/* ----------------------------------------------------------------------------
 * 配置页面布局验收：会话种子与富数据 Mock。
 *
 * 这些 Mock 仅用于在布局门禁中提供真实体量的表格数据，不验证业务写回；
 * 写回与生命周期仍由各业务 spec（room-configuration / clinical-dictionaries 等）覆盖。
 * 返回结构遵循各 service 的 unwrap 行为：外层 {code,msg,data}，data 为数组或 {list}。
 * ------------------------------------------------------------------------- */

function okJson(data: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 0, msg: 'ok', data }),
  };
}

/** 注入与 room-configuration.spec 一致的会话种子，避免被重定向到登录页。 */
export async function seedConfigSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'config-layout-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer config-layout-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_hospital_code', 'LAYOUT');
    sessionStorage.setItem(
      'samis_user_profile',
      JSON.stringify({ userId: 'layout-e2e', loginName: 'layout-e2e', displayName: '布局验收' }),
    );
  });
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0');
}

/** 药品 / 液体 / 血制品 / 生命体征 / 模板 统一走 getClinicalDictionary。 */
function clinicalRows(entityType: string): Record<string, unknown>[] {
  return range(12).map((i) => {
    const base: Record<string, unknown> = {
      id: i,
      version: i % 3 + 1,
      status: i % 4 === 0 ? 'paused' : 'enabled',
      sortNo: i,
    };
    if (entityType === 'drug') {
      Object.assign(base, {
        drugCode: `DRG-PROPOFOL-2024-${pad(i)}-INJ-IV`,
        drugName: `丙泊酚注射液（Propofol）${i}`,
        genericName: '丙泊酚',
        drugCategory: '静脉麻醉药',
        specification: `200mg/20ml（第${i}规格）`,
        dosageForm: '注射剂',
        minDose: 1,
        maxDose: 2.5,
        defaultUnit: 'mg/kg',
        defaultRoute: '静脉注射',
      });
    } else if (entityType === 'fluid' || entityType === 'blood') {
      Object.assign(base, {
        fluidCode: `FLD-LR-${pad(i)}`,
        fluidName: `乳酸钠林格液 ${i}`,
        productCode: `BLD-RBC-${pad(i)}-O`,
        productName: `红细胞悬液 O型 ${i}U`,
        specification: '500ml/袋',
        defaultRate: '500ml/h',
        statisticalCategory: '晶体液',
        bloodTypeRequirement: entityType === 'blood' ? 'O型阳性' : null,
      });
    } else if (entityType === 'vital') {
      Object.assign(base, {
        code: `VITAL-HR-${pad(i)}`,
        itemName: `心率 HR ${i}`,
        unit: 'bpm',
        normalRange: '60-100',
        samplingIntervalSeconds: 300,
        qualityAttribute: '必采',
      });
    } else if (entityType === 'template') {
      Object.assign(base, {
        templateCode: `TPL-ANES-GEN-${pad(i)}`,
        templateName: `全身麻醉记录模板 ${i}`,
        templateType: 'general',
        applicableAnesthesiaMethod: '全身麻醉',
        fields: range(8).map((f) => ({ fieldCode: `f${f}`, fieldName: `字段${f}` })),
      });
    }
    return base;
  });
}

function professionalItemRows(categoryCode: string): Record<string, unknown>[] {
  return range(10).map((i) => {
    const profile: Record<string, unknown> = {};
    if (categoryCode === 'anesthesia_event') {
      profile.eventCategory = '气道事件';
      profile.severity = i % 2 ? '中度' : '轻度';
      profile.qualityIncluded = true;
    } else if (categoryCode === 'anesthesia_score') {
      profile.scoreType = '生理';
      profile.ruleDefinition = [{ dimension: '心率', scores: [0, 1, 2] }, { dimension: '血压', scores: [0, 1, 2] }];
      profile.applicableScenario = 'PACU 评分';
    } else {
      profile.airwayStrategy = '气管插管';
      profile.defaultTemplateCode = 'TPL-ANES-GEN-001';
      profile.applicableOperationTypes = '普外科、骨科';
    }
    return {
      id: i,
      itemCode: `${categoryCode.toUpperCase().replace(/[^A-Z]/g, '')}-${pad(i)}-E2E-CODE`,
      itemName: `${categoryCode === 'anesthesia_event' ? '困难气道事件' : categoryCode === 'anesthesia_score' ? 'Aldrete 评分' : '静吸复合麻醉'} ${i}`,
      categoryCode,
      parentCode: categoryCode === 'anesthesia_method' ? 'CAT-GEN-001' : null,
      sortNo: i,
      status: i % 4 === 0 ? 'paused' : 'enabled',
      version: i % 2 + 1,
      profile,
    };
  });
}

function methodCategoryRows(): Record<string, unknown>[] {
  return [
    { id: 1, categoryCode: 'CAT-GEN-001', categoryName: '全身麻醉', status: 'enabled', version: 1, sortNo: 1, description: '全身麻醉大类' },
    { id: 2, categoryCode: 'CAT-LOC-001', categoryName: '局部麻醉', status: 'enabled', version: 1, sortNo: 2, description: '局部麻醉大类' },
    { id: 3, categoryCode: 'CAT-NER-001', categoryName: '神经阻滞', status: 'paused', version: 1, sortNo: 3, description: '神经阻滞大类' },
  ];
}

function staffRows(): Record<string, unknown>[] {
  return range(10).map((i) => ({
    id: i,
    gh: `STAFF-ANES-${pad(i)}`,
    name: `麻醉医生${pad(i)}号`,
    title: i % 2 ? '主任医师' : '副主任医师',
    professionalGroup: '麻醉科',
    scopes: [{ scopeType: 'department', scopeCode: 'ANES', scopeName: '麻醉科' }],
    status: i % 4 === 0 ? 'paused' : 'enabled',
    version: 1,
  }));
}

function roomRows(): Record<string, unknown>[] {
  return range(8).map((i) => ({
    roomId: i,
    roomCode: `OR-${pad(i)}-HYBRID-CARDIO`,
    roomName: `第${i}号杂交心脏手术间`,
    shortName: `杂交${i}`,
    roomType: '杂交手术间',
    roomGroupId: 'ANES',
    roomGroupName: '麻醉手术部',
    campus: '院本部',
    floor: `${10 + i}层`,
    location: `A区${pad(i)}室`,
    cleanLevel: '百级',
    emergencyCapable: true,
    negativePressure: i % 2 === 0,
    hybridRoom: true,
    stationCapacity: 2,
    openTime: '08:00',
    closeTime: '20:00',
    defaultAnesthesiaMachine: 'Drager Perseus',
    defaultMonitor: 'Philips MX800',
    sortNo: i,
    status: i % 4 === 0 ? 'paused' : 'enabled',
    version: i % 2 + 1,
    capabilities: [
      { capabilityType: 'anesthesia', capabilityCode: 'GA', capabilityName: '全身麻醉' },
      { capabilityType: 'surgery', capabilityCode: 'CARDIO', capabilityName: '心脏手术' },
    ],
  }));
}

function roomFieldConfigRows(): Record<string, unknown>[] {
  const fields: Array<[string, string]> = [
    ['roomCode', '手术间编码'],
    ['roomName', '手术间名称'],
    ['shortName', '简称'],
    ['roomType', '类型'],
    ['roomGroupName', '手术部名称'],
    ['campus', '院区'],
    ['floor', '楼层'],
    ['location', '位置'],
    ['cleanLevel', '洁净等级'],
    ['capabilities', '能力'],
    ['stationCapacity', '台位'],
    ['openTime', '开放时间'],
    ['sortNo', '排序'],
    ['version', '版本'],
    ['status', '状态'],
  ];
  const always = ['roomCode', 'status', 'version', 'capabilities'];
  return fields.map(([fieldCode, displayName], idx) => ({
    fieldCode,
    displayName,
    dataType: 'string',
    visible: true,
    required: always.includes(fieldCode),
    systemField: always.includes(fieldCode),
    sortNo: idx + 1,
    groupName: '基础信息',
    serverRequired: always.includes(fieldCode),
    defaultValue: null,
    options: null,
    version: null,
    id: idx + 1,
    updatedAt: null,
  }));
}

/** 为九个配置页面安装真实体量的只读 Mock。 */
export async function installConfigDataMock(page: Page): Promise<void> {
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method !== 'GET') {
      await route.continue().catch(() => route.fulfill(okJson({ ok: true })));
      return;
    }

    if (url.includes('/auth/myPermissions')) {
      await route.fulfill(okJson({ permissions: ['*'], role: 'admin', groupid: 1 }));
      return;
    }
    if (url.includes('/room/getRoomGroupList')) {
      await route.fulfill(okJson([{ groupCode: 'ANES', groupName: '麻醉手术部' }]));
      return;
    }
    if (url.includes('/room/getRoomList')) {
      await route.fulfill(okJson(roomRows()));
      return;
    }
    if (url.includes('/configuration/fieldConfig')) {
      await route.fulfill(okJson(roomFieldConfigRows()));
      return;
    }
    if (url.includes('/getClinicalDictionary')) {
      const entity = new URL(url).searchParams.get('entityType') ?? 'drug';
      await route.fulfill(okJson(clinicalRows(entity)));
      return;
    }
    if (url.includes('/getProfessionalItems')) {
      const category = new URL(url).searchParams.get('categoryCode') ?? 'anesthesia_method';
      await route.fulfill(okJson(professionalItemRows(category)));
      return;
    }
    if (url.includes('/getDictCategory')) {
      await route.fulfill(okJson(methodCategoryRows()));
      return;
    }
    if (url.includes('/getStaffDetail')) {
      await route.fulfill(okJson(null));
      return;
    }
    if (url.includes('/getStaff')) {
      await route.fulfill(okJson(staffRows()));
      return;
    }
    if (url.includes('/getEventDict')) {
      await route.fulfill(okJson(professionalItemRows('anesthesia_event')));
      return;
    }
    if (url.includes('/professionalHistory') || url.includes('/roomHistory') || url.includes('History')) {
      await route.fulfill(okJson([]));
      return;
    }

    await route.fulfill(okJson({ list: [] }));
  });
}
