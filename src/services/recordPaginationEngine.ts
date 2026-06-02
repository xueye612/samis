import type { TimeAxisPageConfig, TimeAxisMinorInterval } from '@/types/anesthesiaRecord';
import {
  calculateLiveSheetEnd,
  clockToMinutes,
  collectRecordTimes,
  isRecordClinicallyComplete,
  isoOrClockToClock,
  minutesToClock,
  resolveClinicalAxisCapClock,
  resolveRecordAxisReferenceIso,
  roundAxisStartTime,
  timeToFractionalMinutes,
} from '@/services/anesthesiaRecordEngine';
import type { SurgeryCase } from '@/types/anesthesia';

export const DEFAULT_PAGE_DURATION_MINUTES = 210;
export const DEFAULT_MAJOR_INTERVAL = 30;

export interface PaginationOptions {
  pageDurationMinutes?: number;
  minorInterval?: TimeAxisMinorInterval;
  majorInterval?: number;
  minimumFirstPageMinutes?: number;
}

export function resolveRecordAxisStart(record: SurgeryCase, roundMinutes = 30): string {
  const reference = resolveRecordAxisReferenceIso(record);
  const raw = isoOrClockToClock(reference) || '08:00';
  return roundAxisStartTime(raw, roundMinutes);
}

export function resolveRecordAxisEnd(record: SurgeryCase, axisStart: string, options: PaginationOptions = {}): string {
  const minimum = options.minimumFirstPageMinutes ?? DEFAULT_PAGE_DURATION_MINUTES;
  const roundMinutes = options.majorInterval ?? DEFAULT_MAJOR_INTERVAL;
  const dataEnd = calculateLiveSheetEnd(axisStart, collectRecordTimes(record), minimum, roundMinutes);
  if (!isRecordClinicallyComplete(record)) return dataEnd;
  const capClock = resolveClinicalAxisCapClock(record);
  if (!capClock) return dataEnd;
  const clinicalEnd = calculateLiveSheetEnd(axisStart, [capClock], minimum, roundMinutes);
  const dataMinutes = clockToMinutes(dataEnd);
  const clinicalMinutes = clockToMinutes(clinicalEnd);
  if (dataMinutes === null || clinicalMinutes === null) return dataEnd;
  return dataMinutes > clinicalMinutes ? clinicalEnd : dataEnd;
}

export function buildTimeAxisPages(
  axisStart: string,
  axisEnd: string,
  options: PaginationOptions = {},
): TimeAxisPageConfig[] {
  const pageDuration = options.pageDurationMinutes ?? DEFAULT_PAGE_DURATION_MINUTES;
  const minorInterval = options.minorInterval ?? 5;
  const majorInterval = options.majorInterval ?? DEFAULT_MAJOR_INTERVAL;
  const startMinutes = clockToMinutes(axisStart) ?? 0;
  const endMinutes = clockToMinutes(axisEnd) ?? startMinutes + pageDuration;
  const totalMinutes = Math.max(pageDuration, endMinutes - startMinutes);
  const pageCount = Math.max(1, Math.ceil(totalMinutes / pageDuration));

  return Array.from({ length: pageCount }, (_, index) => {
    const pageStart = startMinutes + index * pageDuration;
    // 纸面每页固定 3.5h 窗宽，末页也不截成不足 1 小时的短页
    const pageEnd = pageStart + pageDuration;
    return {
      pageNo: index + 1,
      pageCount,
      pageStartTime: minutesToClock(pageStart),
      pageEndTime: minutesToClock(pageEnd),
      majorGridMinutes: majorInterval,
      minorGridMinutes: minorInterval,
      pageDurationMinutes: pageEnd - pageStart,
    };
  });
}

export function buildRecordPagination(record: SurgeryCase, options: PaginationOptions = {}) {
  const axisStart = resolveRecordAxisStart(record);
  const axisEnd = resolveRecordAxisEnd(record, axisStart, options);
  const pages = buildTimeAxisPages(axisStart, axisEnd, options);
  return { axisStart, axisEnd, pages };
}

/** 根据时间点定位应展示的页码（抢救退出后用于回到当前术野）。 */
export function resolveRecordPageNoForTime(
  record: SurgeryCase,
  time?: string,
  options: PaginationOptions = {},
): number {
  const clock = isoOrClockToClock(time);
  if (!clock) return 1;
  const { pages } = buildRecordPagination(record, options);
  const matched = pages.find((page) => isTimeOnPage(clock, page));
  return matched?.pageNo ?? pages[pages.length - 1]?.pageNo ?? 1;
}

/** 页内时间归属：非末页 [start, end)，末页 [start, end] 以包含轴终点。 */
export function isTimeOnPage(time: string | undefined, page: TimeAxisPageConfig): boolean {
  if (!time) return false;
  const value = timeToFractionalMinutes(isoOrClockToClock(time));
  const start = clockToMinutes(page.pageStartTime);
  const end = clockToMinutes(page.pageEndTime);
  if (value === null || start === null || end === null) return false;
  const isLastPage = page.pageNo >= page.pageCount;
  if (isLastPage) return value >= start && value <= end;
  return value >= start && value < end;
}

export function isSegmentCrossingPage(
  startTime: string | undefined,
  endTime: string | undefined,
  page: TimeAxisPageConfig,
): boolean {
  if (!startTime) return false;
  const start = clockToMinutes(isoOrClockToClock(startTime));
  const end = clockToMinutes(isoOrClockToClock(endTime ?? startTime));
  const pageStart = clockToMinutes(page.pageStartTime);
  const pageEnd = clockToMinutes(page.pageEndTime);
  if (start === null || end === null || pageStart === null || pageEnd === null) return false;
  return end >= pageStart && start <= pageEnd;
}

export function clipSegmentToPage(
  startTime: string,
  endTime: string | undefined,
  page: TimeAxisPageConfig,
): { start: string; end: string; continuesFromPrev: boolean; continuesToNext: boolean } | null {
  const start = clockToMinutes(isoOrClockToClock(startTime));
  const end = clockToMinutes(isoOrClockToClock(endTime ?? startTime));
  const pageStart = clockToMinutes(page.pageStartTime);
  const pageEnd = clockToMinutes(page.pageEndTime);
  if (start === null || end === null || pageStart === null || pageEnd === null) return null;
  if (end < pageStart || start > pageEnd) return null;
  const clippedStart = Math.max(start, pageStart);
  const clippedEnd = Math.min(end, pageEnd);
  return {
    start: minutesToClock(clippedStart),
    end: minutesToClock(clippedEnd),
    continuesFromPrev: start < pageStart,
    continuesToNext: end > pageEnd,
  };
}

export function timeToPagePercent(
  time: string | undefined,
  page: TimeAxisPageConfig,
): number {
  const value = clockToMinutes(isoOrClockToClock(time));
  const start = clockToMinutes(page.pageStartTime);
  const end = clockToMinutes(page.pageEndTime);
  if (value === null || start === null || end === null || end <= start) return 0;
  return Number(Math.max(0, Math.min(100, ((value - start) / (end - start)) * 100)).toFixed(6));
}
