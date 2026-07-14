import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord, formPostInit } from '@/api/samisFormBody';
import type { ApiDrugDictItem, DrugRecommendResponse, SpecialDrugCategory } from '@/types/drugDict';

export type { ApiDrugDictItem, DrugRecommendResponse, SpecialDrugCategory };

export interface DrugDictQuery {
  keyword?: string;
  drugCategory?: string;
  specialCategory?: SpecialDrugCategory;
  defaultIsSpecial?: boolean;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PagedDictQuery {
  id?: number | string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DictItemQuery extends PagedDictQuery {
  categoryCode?: string;
}

export interface TemplateFieldQuery extends PagedDictQuery {
  templateId?: number | string;
}

export interface DrugRecommendQuery {
  drugId?: string | number;
  drugName?: string;
  anesthesiaMethod?: string;
  surgeryType?: string;
  patientAge?: number | string;
}

function appendQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (typeof value === 'boolean') query.set(key, value ? '1' : '0');
    else query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function dictGet<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  return samisRequest<T>(`/anesthesiaDict${path}${appendQuery(params)}`, undefined, {
    module: 'anesthesiaDict',
  });
}

function dictFormPost<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(
    `/anesthesiaDict${path}`,
    buildFormPost(flatFormFieldsFromRecord(data)),
    { module: 'anesthesiaDict' },
  );
}

/**
 * 专业字典富表单提交：数组/对象（scopes、ruleDefinition）以 JSON 字符串传输；
 * 布尔转 1/0；空串保留以支持清除；null/undefined 跳过。
 */
function dictFormPostRich<T>(path: string, data: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) || (typeof value === 'object')) {
      params.set(key, JSON.stringify(value));
      return;
    }
    if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0');
      return;
    }
    params.set(key, String(value));
  });
  return samisRequest<T>(`/anesthesiaDict${path}`, formPostInit(params.toString()), { module: 'anesthesiaDict' });
}

/** SAMIS 麻醉字典 — 对齐 Apifox `anesthesia_dict_apifox_openapi.json` */
export const anesthesiaDictApi = {
  // —— 药品字典 ——
  getDrugDict(params?: DrugDictQuery) {
    return dictGet<unknown>('/getDrugDict', {
      keyword: params?.keyword,
      drug_category: params?.drugCategory,
      special_category: params?.specialCategory,
      default_is_special: params?.defaultIsSpecial,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveDrugDict(payload: ApiDrugDictItem | Record<string, unknown>) {
    return dictFormPost<{ drugId?: string | number }>('/saveDrugDict', payload as Record<string, unknown>);
  },
  disableDrugDict(drugId: string | number) {
    return dictFormPost<void>('/disableDrugDict', { drugId });
  },
  getSpecialDrugCategories() {
    return dictGet<Array<{ value: SpecialDrugCategory; label: string }>>('/getSpecialDrugCategories');
  },
  getDrugRecommend(params: DrugRecommendQuery) {
    return dictGet<DrugRecommendResponse>('/getDrugRecommend', {
      drug_id: params.drugId,
      drug_name: params.drugName,
      anesthesia_method: params.anesthesiaMethod,
      surgery_type: params.surgeryType,
      patient_age: params.patientAge,
    });
  },

  // —— 模板 ——
  getTemplate(params?: PagedDictQuery) {
    return dictGet<unknown>('/getTemplate', {
      id: params?.id,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveTemplate(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveTemplate', data);
  },
  disableTemplate(data: Record<string, unknown>) {
    return dictFormPost<void>('/disableTemplate', data);
  },

  // —— 模板字段 ——
  getTemplateField(params?: TemplateFieldQuery) {
    return dictGet<unknown>('/getTemplateField', {
      id: params?.id,
      template_id: params?.templateId,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveTemplateField(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveTemplateField', data);
  },
  deleteTemplateField(data: Record<string, unknown>) {
    return dictFormPost<void>('/deleteTemplateField', data);
  },

  // —— 字典分类 / 字典项 ——
  getDictCategory(params?: PagedDictQuery) {
    return dictGet<unknown>('/getDictCategory', {
      id: params?.id,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveDictCategory(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveDictCategory', data);
  },
  disableDictCategory(data: Record<string, unknown>) {
    return dictFormPost<void>('/disableDictCategory', data);
  },
  getDictItem(params?: DictItemQuery) {
    return dictGet<unknown>('/getDictItem', {
      id: params?.id,
      category_code: params?.categoryCode,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveDictItem(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveDictItem', data);
  },
  disableDictItem(data: Record<string, unknown>) {
    return dictFormPost<void>('/disableDictItem', data);
  },

  // —— 液体 / 血制品 ——
  getFluidDict(params?: PagedDictQuery) {
    return dictGet<unknown>('/getFluidDict', {
      id: params?.id,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveFluidDict(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveFluidDict', data);
  },
  disableFluidDict(data: Record<string, unknown>) {
    return dictFormPost<void>('/disableFluidDict', data);
  },
  getBloodProductDict(params?: PagedDictQuery) {
    return dictGet<unknown>('/getBloodProductDict', {
      id: params?.id,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveBloodProductDict(data: Record<string, unknown>) {
    return dictFormPost<unknown>('/saveBloodProductDict', data);
  },
  disableBloodProductDict(data: Record<string, unknown>) {
    return dictFormPost<void>('/disableBloodProductDict', data);
  },

  // —— 生命体征字典 ——
  getVitalDict(params?: PagedDictQuery) {
    return dictGet<unknown>('/getVitalDict', {
      id: params?.id,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  saveVitalDict(data: Record<string, unknown>) {
    return dictFormPost<{ id?: string | number }>('/saveVitalDict', data);
  },
  disableVitalDict(id: string | number) {
    return dictFormPost<void>('/disableVitalDict', { id });
  },

  // —— 麻醉人员字典 ——
  getStaff(params?: PagedDictQuery) {
    return dictGet<unknown>('/getStaff', {
      id: params?.id,
      enabled: params?.enabled,
      page: params?.page,
      page_size: params?.pageSize,
    });
  },
  disableStaff(id: string | number) {
    return dictFormPost<void>('/disableStaff', { id });
  },

  /** @deprecated OpenAPI 未定义；mock 保留 */
  getEventDict() {
    return dictGet<unknown[]>('/getEventDict');
  },
  /** @deprecated 请用 getBloodProductDict */
  getTransfusionDict(params?: PagedDictQuery) {
    return anesthesiaDictApi.getBloodProductDict(params);
  },
  /** @deprecated OpenAPI 未定义；mock 保留 */
  getDeviceDict() {
    return dictGet<unknown[]>('/getDeviceDict');
  },

  // —— P06A 专业字典结构化端点（人员/方式/事件/评分）——
  getStaffConfig(params?: { allStatus?: boolean; keyword?: string }) {
    return dictGet<unknown>('/getStaff', { allStatus: params?.allStatus, keyword: params?.keyword });
  },
  getStaffDetail(id: number | string) {
    return dictGet<unknown>('/getStaffDetail', { id });
  },
  saveStaff(data: Record<string, unknown>) {
    return dictFormPostRich<{ id?: number; version?: number }>('/saveStaff', data);
  },
  getProfessionalItems(params: { categoryCode: string; allStatus?: boolean }) {
    return dictGet<unknown>('/getProfessionalItems', {
      categoryCode: params.categoryCode,
      allStatus: params.allStatus,
    });
  },
  getProfessionalItemDetail(id: number | string) {
    return dictGet<unknown>('/getProfessionalItemDetail', { id });
  },
  saveProfessionalItem(data: Record<string, unknown>) {
    return dictFormPostRich<{ id?: number; version?: number }>('/saveProfessionalItem', data);
  },
  changeProfessionalStatus(data: Record<string, unknown>) {
    return dictFormPost<{ status?: string; version?: number }>('/changeProfessionalStatus', data);
  },
  professionalHistory(entityType: string, id: number | string) {
    return dictGet<unknown>('/professionalHistory', { entityType, id });
  },
};
