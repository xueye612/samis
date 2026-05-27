import { getQualityDataset } from '@/services/mockApi';
import { calculateIndicatorDetails } from '@/services/qualityCalculator';
import type { QualityFilter } from '@/types/quality';

const monthlyCache = new Map<string, ReturnType<typeof calculateIndicatorDetails>>();

export function cacheKey(filter: QualityFilter) {
  return `${filter.startMonth}:${filter.endMonth}:${filter.anesthesiaMethod}:${filter.locationType}:${filter.surgeryType}:${filter.doctorId}:${filter.roomId}:${filter.category}`;
}

export function getCachedIndicators(filter: QualityFilter) {
  const key = cacheKey(filter);
  if (monthlyCache.has(key)) return monthlyCache.get(key)!;
  const dataset = getQualityDataset();
  const result = calculateIndicatorDetails(dataset, filter);
  monthlyCache.set(key, result);
  return result;
}

export function invalidateQualityCache() {
  monthlyCache.clear();
}

export async function fetchQualityDatasetFromBackend() {
  const { backendFetch } = await import('@/services/mockApi');
  return backendFetch<ReturnType<typeof getQualityDataset>>('/quality/dataset');
}
