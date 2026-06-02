import { backendFetch } from '@/services/mockApi';
import type { SamisApiResponse } from '@/api/samisResponse';
import { ANESTHESIA_USE_MOCK, unwrapSamisResponse } from '@/api/samisResponse';

const SAMIS_PREFIX = '/api-samis/pc/v1';

export async function samisRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const fullPath = path.startsWith(SAMIS_PREFIX) ? path : `${SAMIS_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await backendFetch<SamisApiResponse<T>>(fullPath, init);
  return unwrapSamisResponse(response);
}

export { ANESTHESIA_USE_MOCK };
