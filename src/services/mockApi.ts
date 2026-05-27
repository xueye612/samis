import { getMutableDataset } from '@/services/datasetStore';
import type { QualityDataset } from '@/types/mockTables';

export function getQualityDataset(): QualityDataset {
  return getMutableDataset();
}

export const mockApi = {
  getQualityDataset,
};

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (path.startsWith('/quality/dataset')) return getQualityDataset() as T;
  throw new Error(`Mock backend route not implemented: ${path}`);
}
