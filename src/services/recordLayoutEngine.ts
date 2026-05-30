import type { LayoutObject, LayoutWarning } from '@/types/anesthesiaRecord';
import type { LabResultRecord } from '@/types/anesthesiaRecord';
import type { MonitorCell } from '@/services/anesthesiaRecordEngine';
import { isoOrClockToClock } from '@/services/anesthesiaRecordEngine';

const PRIORITY = {
  critical: 100,
  event: 90,
  vital: 80,
  lab: 60,
  medication: 50,
  fluid: 45,
  io: 40,
  special: 20,
} as const;

function overlaps(a: LayoutObject, b: LayoutObject): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function buildMonitorLayoutObjects(cells: MonitorCell[]): LayoutObject[] {
  return cells.map((cell) => ({
    id: cell.key,
    type: 'vital' as const,
    time: cell.time,
    x: cell.leftPercent,
    y: cell.topPercent,
    width: 4,
    height: 6,
    priority: PRIORITY.vital,
    allowOffset: true,
    maxOffsetY: 18,
    displayMode: 'text' as const,
  }));
}

export function buildLabLayoutObjects(
  labs: LabResultRecord[],
  timeToPercent: (time: string) => number,
): LayoutObject[] {
  return labs
    .filter((item) => item.status === 'active')
    .map((item, index) => ({
      id: item.id,
      type: 'lab' as const,
      time: item.resultTime,
      x: timeToPercent(isoOrClockToClock(item.resultTime)),
      y: 8 + (index % 3) * 7,
      width: item.displayMode === 'number' ? 3 : 12,
      height: item.displayMode === 'number' ? 4 : 10,
      priority: PRIORITY.lab,
      allowOffset: true,
      maxOffsetY: 24,
      displayMode: item.displayMode === 'number' ? 'number' as const : 'text' as const,
    }));
}

export function resolveLayoutCollisions(objects: LayoutObject[]): { objects: LayoutObject[]; warnings: LayoutWarning[] } {
  const sorted = [...objects].sort((a, b) => b.priority - a.priority || a.y - b.y);
  const placed: LayoutObject[] = [];
  const warnings: LayoutWarning[] = [];

  sorted.forEach((object) => {
    let candidate = { ...object };
    let attempts = 0;
    while (attempts < 6) {
      const conflict = placed.find((item) => overlaps(candidate, item));
      if (!conflict) break;
      if (!candidate.allowOffset) {
        warnings.push({
          id: `layout-${candidate.id}`,
          type: candidate.type,
          message: `${candidate.type} 与 ${conflict.type} 在 ${candidate.time} 附近重叠，建议改为编号显示`,
          time: candidate.time,
          severity: 'warning',
          objectIds: [candidate.id, conflict.id],
        });
        break;
      }
      candidate = {
        ...candidate,
        y: Math.min(candidate.y + candidate.maxOffsetY / 3, candidate.y + candidate.maxOffsetY),
      };
      attempts += 1;
    }
    if (attempts >= 6) {
      warnings.push({
        id: `layout-${candidate.id}-overflow`,
        type: candidate.type,
        message: `${candidate.type} 在 ${candidate.time} 无法自动避让，打印前请人工调整`,
        time: candidate.time,
        severity: 'error',
        objectIds: [candidate.id],
      });
    }
    placed.push(candidate);
  });

  return { objects: placed, warnings };
}

export function mergeLayoutWarnings(...groups: LayoutWarning[][]): LayoutWarning[] {
  const map = new Map<string, LayoutWarning>();
  groups.flat().forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

export function resolveTimelineNodeLanes<T extends { leftPercent: number }>(
  nodes: T[],
  nodeWidthPercent = 4.8,
): Array<T & { lane: number; displayPercent: number }> {
  const sorted = [...nodes].sort((a, b) => a.leftPercent - b.leftPercent);
  const placed: Array<T & { lane: number; displayPercent: number }> = [];

  const overlaps = (percent: number, laneIndex: number) => placed.some((item) =>
    item.lane === laneIndex && Math.abs(item.displayPercent - percent) < nodeWidthPercent,
  );

  sorted.forEach((node) => {
    let lane = 0;
    let displayPercent = node.leftPercent;

    while (overlaps(displayPercent, lane)) {
      lane += 1;
    }

    if (lane > 0) {
      const prevLane = placed
        .filter((item) => item.lane === lane - 1)
        .sort((a, b) => Math.abs(a.displayPercent - displayPercent) - Math.abs(b.displayPercent - displayPercent))[0];
      if (prevLane && Math.abs(prevLane.displayPercent - displayPercent) < nodeWidthPercent) {
        displayPercent = Math.min(
          99,
          Math.max(1, displayPercent + (nodeWidthPercent - Math.abs(prevLane.displayPercent - displayPercent)) * 0.55),
        );
      }
    }

    placed.push({ ...node, lane, displayPercent });
  });

  return placed;
}
