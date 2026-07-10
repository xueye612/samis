import { Message } from '@arco-design/web-vue';
import { anesthesiaDictApi } from '@/api/anesthesiaDict';
import { roomApi } from '@/api/room';
import { useRealAnesthesiaDict, useRealRoom } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import {
  mapFluidDictListResponse,
} from '@/services/anesthesia/adapters/fluidDictAdapter';
import {
  mapTemplateListResponse,
  templateNamesFromItems,
} from '@/services/anesthesia/adapters/templateDictAdapter';
import {
  mapVitalDictListResponse,
} from '@/services/anesthesia/adapters/vitalDictAdapter';
import {
  mapStaffListResponse,
  staffNamesFromItems,
} from '@/services/anesthesia/adapters/staffDictAdapter';
import {
  assembleMethodTree,
  mapDictListItems,
} from '@/services/anesthesia/adapters/dictListAdapter';
import {
  mapRoomListResponse,
  roomNamesFromCatalog,
} from '@/services/anesthesia/adapters/roomAdapter';
import {
  seedFluidBloodDict,
  seedMethodCategories,
  seedVitalSignDict,
} from '@/mock/configSeed';
import type {
  AnesthesiaMethodCategory,
  FluidBloodDictItem,
  PrintTemplateItem,
  StaffDictItem,
  VitalSignDictItem,
} from '@/types/system';

type Source = 'remote' | 'mock' | 'seed';

function msgOf(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

// ---------------- 液体/血制品 ----------------
export async function loadFluidDictCatalog(): Promise<{ items: FluidBloodDictItem[]; source: Source }> {
  try {
    const [fluidRaw, bloodRaw] = await Promise.all([
      anesthesiaDictApi.getFluidDict({ enabled: true, page: 1, pageSize: 500 }),
      anesthesiaDictApi.getBloodProductDict({ enabled: true, page: 1, pageSize: 500 }),
    ]);
    const items = [...mapFluidDictListResponse(fluidRaw), ...mapFluidDictListResponse(bloodRaw)];
    if (items.length) return { items, source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
    return { items: [...seedFluidBloodDict], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载液体字典失败'));
    return { items: [...seedFluidBloodDict], source: 'seed' };
  }
}

export async function persistFluidDictItem(item: FluidBloodDictItem): Promise<FluidBloodDictItem | null> {
  if (!useRealAnesthesiaDict()) return item;
  const payload = itemToPayload({
    fluid_code: item.code, fluid_name: item.name, default_unit: item.defaultUnit,
    default_volume: item.defaultVolume, is_count_input: item.requiresDoubleCheck ? 1 : 0,
    is_active: item.enabled ? 1 : 0, remark: item.remark,
  });
  try {
    if (item.id && /^\d+$/.test(String(item.id))) payload.id = item.id;
    const api = item.subCategory === '血液制品' ? anesthesiaDictApi.saveBloodProductDict : anesthesiaDictApi.saveFluidDict;
    const saved = await api(payload);
    return { ...item, id: String((saved as Record<string, unknown>)?.id ?? item.id) };
  } catch (error) {
    Message.error(msgOf(error, '保存液体字典失败'));
    return null;
  }
}

export async function disableFluidDictItem(item: FluidBloodDictItem): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  const api = item.subCategory === '血液制品' ? anesthesiaDictApi.disableBloodProductDict : anesthesiaDictApi.disableFluidDict;
  try {
    await api({ id: item.id });
    return true;
  } catch (error) {
    Message.error(msgOf(error, '停用液体失败'));
    return false;
  }
}

// ---------------- 打印模板 ----------------
export async function loadTemplateCatalog(): Promise<{ items: PrintTemplateItem[]; names: string[]; source: Source }> {
  try {
    const raw = await anesthesiaDictApi.getTemplate({ page: 1, pageSize: 500 });
    const items = mapTemplateListResponse(raw);
    if (items.length) return { items, names: templateNamesFromItems(items), source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
    return { items: [], names: ['麻醉记录单', '术前访视单', 'PACU恢复记录', '术后随访表'], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载打印模板失败'));
    return { items: [], names: ['麻醉记录单', '术前访视单', 'PACU恢复记录', '术后随访表'], source: 'seed' };
  }
}

export async function persistTemplateItem(item: PrintTemplateItem): Promise<PrintTemplateItem | null> {
  if (!useRealAnesthesiaDict()) return item;
  const payload = itemToPayload({
    template_code: item.templateCode ?? item.id,
    template_name: item.templateName,
    template_type: item.templateType,
    is_default: item.isDefault ? 1 : 0,
    is_active: item.enabled ? 1 : 0,
    remark: item.remark,
  });
  try {
    if (item.id && /^\d+$/.test(String(item.id))) payload.id = item.id;
    const saved = await anesthesiaDictApi.saveTemplate(payload);
    return { ...item, id: String((saved as Record<string, unknown>)?.id ?? item.id) };
  } catch (error) {
    Message.error(msgOf(error, '保存打印模板失败'));
    return null;
  }
}

export async function disableTemplateItem(id: string | number): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.disableTemplate({ id });
    return true;
  } catch (error) {
    Message.error(msgOf(error, '停用打印模板失败'));
    return false;
  }
}

// ---------------- 生命体征 ----------------
export async function loadVitalDictCatalog(): Promise<{ items: VitalSignDictItem[]; source: Source }> {
  try {
    const raw = await anesthesiaDictApi.getVitalDict({ page: 1, pageSize: 500 });
    const items = mapVitalDictListResponse(raw);
    if (items.length) return { items, source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
    return { items: [...seedVitalSignDict], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载生命体征字典失败'));
    return { items: [...seedVitalSignDict], source: 'seed' };
  }
}

export async function persistVitalDictItem(item: VitalSignDictItem): Promise<VitalSignDictItem | null> {
  if (!useRealAnesthesiaDict()) return item;
  const payload = itemToPayload({
    code: item.code, short_code: item.shortCode, item_name: item.name, unit: item.unit,
    normal_range: item.normalRange, lower_limit: item.lowerLimit, upper_limit: item.upperLimit,
    default_value: item.defaultValue, chart_enabled: item.chartEnabled ? 1 : 0,
    chart_color: item.chartColor, chart_symbol: item.chartSymbol, decimal_places: item.decimalPlaces,
    sort_no: item.sortOrder, is_active: item.enabled ? 1 : 0, enabled: item.enabled ? 1 : 0,
    remark: item.remark,
  });
  try {
    if (item.id && /^\d+$/.test(String(item.id))) payload.id = item.id;
    const saved = await anesthesiaDictApi.saveVitalDict(payload);
    return { ...item, id: String((saved as Record<string, unknown>)?.id ?? item.id) };
  } catch (error) {
    Message.error(msgOf(error, '保存生命体征字典失败'));
    return null;
  }
}

export async function disableVitalDictItem(id: string | number): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.disableVitalDict(id);
    return true;
  } catch (error) {
    Message.error(msgOf(error, '停用生命体征失败'));
    return false;
  }
}

// ---------------- 麻醉人员 ----------------
export async function loadStaffCatalog(): Promise<{ items: StaffDictItem[]; names: string[]; source: Source }> {
  try {
    const raw = await anesthesiaDictApi.getStaff({ page: 1, pageSize: 500 });
    const items = mapStaffListResponse(raw);
    if (items.length) return { items, names: staffNamesFromItems(items), source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
    return { items: [], names: [], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载人员字典失败'));
    return { items: [], names: [], source: 'seed' };
  }
}

export async function persistStaffItem(item: StaffDictItem): Promise<StaffDictItem | null> {
  if (!useRealAnesthesiaDict()) return item;
  // gh 在 anes_staff 上有唯一约束；string 流新增时无 gh，这里兜底生成保证唯一。
  const gh = item.gh || `STAFF-${Date.now()}`;
  const payload = itemToPayload({
    gh, name: item.name, title: item.title,
    department_code: item.departmentCode,
    department_name: item.departmentName, role: item.role,
    scheduling_weight: item.schedulingWeight, sort_no: item.sortOrder,
    is_active: item.enabled ? 1 : 0, remark: item.remark,
  });
  try {
    if (item.id && /^\d+$/.test(String(item.id))) payload.id = item.id;
    const saved = await anesthesiaDictApi.saveStaff(payload);
    return { ...item, gh, id: String((saved as Record<string, unknown>)?.id ?? item.id) };
  } catch (error) {
    Message.error(msgOf(error, '保存人员字典失败'));
    return null;
  }
}

export async function disableStaffItem(id: string | number): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.disableStaff(id);
    return true;
  } catch (error) {
    Message.error(msgOf(error, '停用人员失败'));
    return false;
  }
}

// ---------------- 通用字典项 (events/scores) ----------------
export async function loadDictListByCategory(categoryCode: string): Promise<{ names: string[]; source: Source }> {
  try {
    const raw = await anesthesiaDictApi.getDictItem({ categoryCode, page: 1, pageSize: 500 });
    const names = mapDictListItems(raw);
    return { names, source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
  } catch (error) {
    Message.warning(msgOf(error, `加载字典(${categoryCode})失败`));
    return { names: [], source: 'seed' };
  }
}

export async function persistDictListItem(categoryCode: string, name: string, code?: string): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.saveDictItem({
      category_code: categoryCode,
      item_code: code ?? name,
      item_name: name,
      is_active: 1,
    });
    return true;
  } catch (error) {
    Message.error(msgOf(error, '保存字典项失败'));
    return false;
  }
}

export async function disableDictListItem(id: string | number): Promise<boolean> {
  if (!useRealAnesthesiaDict()) return true;
  try {
    await anesthesiaDictApi.disableDictItem({ id });
    return true;
  } catch (error) {
    Message.error(msgOf(error, '停用字典项失败'));
    return false;
  }
}

// ---------------- 麻醉方式树 ----------------
export async function loadMethodTree(): Promise<{ tree: AnesthesiaMethodCategory[]; source: Source }> {
  try {
    const [catRaw, itemRaw] = await Promise.all([
      anesthesiaDictApi.getDictCategory({ page: 1, pageSize: 500 }),
      anesthesiaDictApi.getDictItem({ categoryCode: 'anesthesia_method', page: 1, pageSize: 500 }),
    ]);
    const catList = Array.isArray(catRaw) ? catRaw : (catRaw && typeof catRaw === 'object' && Array.isArray((catRaw as Record<string, unknown>).list) ? (catRaw as Record<string, unknown>).list as unknown[] : []);
    const itemList = Array.isArray(itemRaw) ? itemRaw : (itemRaw && typeof itemRaw === 'object' && Array.isArray((itemRaw as Record<string, unknown>).list) ? (itemRaw as Record<string, unknown>).list as unknown[] : []);
    const tree = assembleMethodTree(catList as unknown[], itemList);
    if (tree.length) return { tree, source: useRealAnesthesiaDict() ? 'remote' : 'mock' };
    return { tree: [...seedMethodCategories], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载麻醉方式失败'));
    return { tree: [...seedMethodCategories], source: 'seed' };
  }
}

// ---------------- 手术间 ----------------
export async function loadRoomNameCatalog(): Promise<{ names: string[]; source: Source }> {
  try {
    const raw = await roomApi.getRoomList();
    const names = roomNamesFromCatalog(mapRoomListResponse(raw));
    if (names.length) return { names, source: useRealRoom() ? 'remote' : 'mock' };
    return { names: [], source: 'seed' };
  } catch (error) {
    Message.warning(msgOf(error, '加载手术间失败'));
    return { names: [], source: 'seed' };
  }
}

function itemToPayload(fields: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...fields };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') delete payload[key];
  });
  return payload;
}
