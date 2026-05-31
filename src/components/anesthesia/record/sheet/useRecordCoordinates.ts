import { computed } from 'vue';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildLiveTimeScale,
  buildRecordBandGrid,
  resolveTimeAxisIntervals,
  timeToPercent,
} from '@/services/anesthesiaRecordEngine';
import { buildRecordPagination, clipSegmentToPage } from '@/services/recordPaginationEngine';

/**
 * 坐标层（time / grid 坐标换算）。
 *
 * 此前这些换算散落在 3000+ 行的 `LiveAnesthesiaSheet.vue` 里，与业务带、SVG 趋势层、
 * 交互层混在一起。抽成独立 composable 后：
 * - 时间轴分页、刻度、网格、点位/线段坐标只依赖 `record` 与当前页码；
 * - 业务带、趋势图、交互层都复用同一套坐标，避免重复实现导致错位；
 * - 接入后端/设备采集数据时，坐标换算逻辑可单独测试与替换。
 */
export function useRecordCoordinates(getRecord: () => SurgeryCase, getPageNo: () => number) {
  const pagination = computed(() => {
    const record = getRecord();
    const intervals = resolveTimeAxisIntervals(record);
    return buildRecordPagination(record, {
      minorInterval: intervals.minorInterval,
      majorInterval: intervals.majorInterval,
    });
  });

  const currentPage = computed(() => {
    const record = getRecord();
    const pages = record.recordDocument?.timeAxisPages?.length
      ? record.recordDocument.timeAxisPages
      : pagination.value.pages;
    const fallback = pages[0] ?? pagination.value.pages[0];
    return pages.find((item) => item.pageNo === getPageNo()) ?? fallback;
  });

  const isLastPage = computed(() => (currentPage.value ? currentPage.value.pageNo === currentPage.value.pageCount : true));
  const sheetStart = computed(() => currentPage.value?.pageStartTime ?? pagination.value.axisStart);
  const sheetEnd = computed(() => currentPage.value?.pageEndTime ?? pagination.value.axisEnd);

  const timeScale = computed(() => {
    const intervals = resolveTimeAxisIntervals(getRecord());
    return buildLiveTimeScale(sheetStart.value, sheetEnd.value, intervals.minorInterval, intervals.majorInterval);
  });

  const gridBackgroundStyle = computed(() => ({ '--minor-count': Math.max(1, timeScale.value.minorTicks.length - 1) }));
  const bandGrid = (rows: number) => buildRecordBandGrid(timeScale.value, rows);
  const chartGrid = computed(() => buildRecordBandGrid(timeScale.value, 8));

  const topFor = (index: number, total: number) => `${((index + 0.5) / Math.max(total, 1)) * 100}%`;
  const leftFor = (time?: string) => `${timeToPercent(time, sheetStart.value, sheetEnd.value)}%`;
  const pointStyle = (time: string | undefined, index: number, total: number) => ({ left: leftFor(time), top: topFor(index, total) });
  const segmentStyle = (start: string | undefined, end: string | undefined, index: number, total: number): Record<string, string> => {
    if (!start || !currentPage.value) return { display: 'none' };
    const clipped = clipSegmentToPage(start, end, currentPage.value);
    if (!clipped) return { display: 'none' };
    const left = timeToPercent(clipped.start, sheetStart.value, sheetEnd.value);
    const right = timeToPercent(clipped.end, sheetStart.value, sheetEnd.value);
    return {
      left: `${left}%`,
      top: topFor(index, total),
      width: `${Math.max(4, right - left)}%`,
      opacity: String(clipped.continuesFromPrev || clipped.continuesToNext ? 0.92 : 1),
    };
  };

  return {
    pagination,
    currentPage,
    isLastPage,
    sheetStart,
    sheetEnd,
    timeScale,
    gridBackgroundStyle,
    bandGrid,
    chartGrid,
    leftFor,
    topFor,
    pointStyle,
    segmentStyle,
  };
}
