import type { SamisApiResponse } from '@/api/samisResponse';
import { unwrapSamisResponse } from '@/api/samisResponse';
import {
  ANESTHESIA_USE_MOCK,
  resolveSamisModule,
  useRealForModule,
  type SamisApiModule,
} from '@/config/apiFlags';
import { normalizeSamisPath, samisHttpFetch } from '@/api/samisHttpClient';
import { routeSamisMock } from '@/services/mock/samisMockRouter';

export async function samisRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { module?: SamisApiModule; forceMock?: boolean },
): Promise<T> {
  const normalizedPath = normalizeSamisPath(path);
  const module = options?.module ?? resolveSamisModule(normalizedPath);
  const useReal = !options?.forceMock && useRealForModule(module);

  if (useReal) {
    return samisHttpFetch<T>(normalizedPath, init);
  }

  const response = await routeSamisMock<SamisApiResponse<T>>(normalizedPath, init);
  return unwrapSamisResponse(response);
}

export { ANESTHESIA_USE_MOCK };
