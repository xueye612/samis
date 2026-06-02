import { samisRequest } from '@/api/samisClient';
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

export const anesthesiaDictApi = {
  getEventDict() {
    return samisRequest<unknown[]>('/anesthesiaDict/getEventDict');
  },
  getDrugDict(params?: DrugDictQuery) {
    const query = new URLSearchParams();
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.drugCategory) query.set('drug_category', params.drugCategory);
    if (params?.specialCategory) query.set('special_category', params.specialCategory);
    if (params?.defaultIsSpecial !== undefined) query.set('default_is_special', String(params.defaultIsSpecial));
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('page_size', String(params.pageSize));
    const suffix = query.toString() ? `?${query}` : '';
    return samisRequest<ApiDrugDictItem[]>(`/anesthesiaDict/getDrugDict${suffix}`);
  },
  saveDrugDict(payload: ApiDrugDictItem) {
    return samisRequest<{ drugId: string }>('/anesthesiaDict/saveDrugDict', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  disableDrugDict(drugId: string) {
    return samisRequest<void>('/anesthesiaDict/disableDrugDict', {
      method: 'POST',
      body: JSON.stringify({ drugId, enabled: false }),
    });
  },
  getSpecialDrugCategories() {
    return samisRequest<Array<{ value: SpecialDrugCategory; label: string }>>('/anesthesiaDict/getSpecialDrugCategories');
  },
  getDrugRecommend(params: { drugId?: string; drugName?: string; anesthesiaMethod?: string; surgeryType?: string; patientAge?: number }) {
    const query = new URLSearchParams();
    if (params.drugId) query.set('drug_id', params.drugId);
    if (params.drugName) query.set('drug_name', params.drugName);
    if (params.anesthesiaMethod) query.set('anesthesia_method', params.anesthesiaMethod);
    if (params.surgeryType) query.set('surgery_type', params.surgeryType);
    if (params.patientAge !== undefined) query.set('patient_age', String(params.patientAge));
    return samisRequest<DrugRecommendResponse>(`/anesthesiaDict/getDrugRecommend?${query}`);
  },
  getFluidDict() {
    return samisRequest<unknown[]>('/anesthesiaDict/getFluidDict');
  },
  getTransfusionDict() {
    return samisRequest<unknown[]>('/anesthesiaDict/getTransfusionDict');
  },
  getDeviceDict() {
    return samisRequest<unknown[]>('/anesthesiaDict/getDeviceDict');
  },
};
