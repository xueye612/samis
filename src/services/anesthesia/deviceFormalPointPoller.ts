import { anesthesiaRoomDeviceConfigApi } from '@/api/anesthesiaRoomDeviceConfig';

/**
 * 后端设备查询正式落点轮询（普通5分钟 / 抢救1分钟）。
 *
 * 取代前端模拟服务直接写正式生命体征：定期用当前时间调 queryRecordPoint，
 * 后端按 mode 对齐到 5 分钟(normal)/1 分钟(rescue)桶，幂等生成正式代表点。
 * - 新桶产生（skipped=created）时回调刷新，让记录单显示该正式点；
 * - 已有桶（already_exists）/ 手工桶（manual_exists）不重复刷新。
 *
 * 设备监护库（anes_device_raw_message）每分钟有数据，但正式点频率由桶决定，
 * 普通模式 10 分钟只会生成 2 个 5 分钟点。
 */
export interface DeviceFormalPointResult {
  operationId: string;
  bucketTime: string;
  mode: string;
  skipped: string;
  metrics: Record<string, number>;
}

export interface DeviceFormalPointPollerOptions {
  operationId: () => string;
  rescueActive: () => boolean;
  intervalMs?: number;
  onFormalPoint?: (result: DeviceFormalPointResult) => void;
  now?: () => Date;
}

export interface DeviceFormalPointPoller {
  start: () => void;
  refresh: () => Promise<DeviceFormalPointResult | null>;
  stop: () => void;
}

export function createDeviceFormalPointPoller(options: DeviceFormalPointPollerOptions): DeviceFormalPointPoller {
  const intervalMs = Math.max(15_000, options.intervalMs ?? 30_000);
  const now = options.now ?? (() => new Date());
  let running = false;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastBucket = '';

  const refresh = async (): Promise<DeviceFormalPointResult | null> => {
    const operationId = options.operationId();
    if (!operationId) return null;
    const mode = options.rescueActive() ? 'rescue' : 'normal';
    try {
      const r = await anesthesiaRoomDeviceConfigApi.queryRecordPoint({
        operationId,
        targetTime: now().toISOString(),
        mode,
      });
      if (!active) return null;
      const result: DeviceFormalPointResult = {
        operationId: r.operationId,
        bucketTime: r.bucketTime,
        mode: r.mode,
        skipped: r.skipped,
        metrics: r.metrics,
      };
      // 仅新代表点（created）或抢救切换产生新桶时回调刷新，避免每 tick 刷新。
      if (r.skipped === 'created' && r.bucketTime !== lastBucket) {
        lastBucket = r.bucketTime;
        options.onFormalPoint?.(result);
      } else if (r.bucketTime !== lastBucket) {
        lastBucket = r.bucketTime;
      }
      return result;
    } catch {
      return null;
    }
  };

  const schedule = () => {
    if (!running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void refresh().finally(() => schedule()); }, intervalMs);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      active = true;
      void refresh().finally(() => schedule());
    },
    refresh,
    stop: () => {
      running = false;
      active = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
