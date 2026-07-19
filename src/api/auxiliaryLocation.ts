import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

export interface AuxiliaryLocationQuery {
  keyword?: string;
  status?: string;
  locationType?: string;
  page?: number;
  pageSize?: number;
}

function queryString(params: AuxiliaryLocationQuery): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function post<T>(path: string, data: Record<string, unknown>) {
  const normalized = {
    ...data,
    ...(data.changes && typeof data.changes === 'object' ? { changes: JSON.stringify(data.changes) } : {}),
  };
  return samisRequest<T>(`/auxiliaryLocation/${path}`, buildFormPost(flatFormFieldsFromRecord(normalized)), { module: 'pacu' });
}

export const auxiliaryLocationApi = {
  locationList(params: AuxiliaryLocationQuery = {}) {
    return samisRequest<unknown>(`/auxiliaryLocation/locationList${queryString(params)}`, undefined, { module: 'pacu' });
  },
  locationGetById(locationId: number) {
    return samisRequest<unknown>(`/auxiliaryLocation/locationGetById?locationId=${encodeURIComponent(String(locationId))}`, undefined, { module: 'pacu' });
  },
  locationCreate(data: Record<string, unknown>) {
    return post<unknown>('locationCreate', data);
  },
  impactPreview(data: { locationId: number; changes: Record<string, unknown> }) {
    return post<unknown>('impactPreview', data);
  },
  locationUpdate(data: Record<string, unknown>) {
    return post<unknown>('locationUpdate', data);
  },
};
