// 统一服务器时间来源：优先用后端/设备会话返回的 serverTime 校准本地时钟，
// 避免以浏览器 new Date() 作为唯一可信时间。保存时统一使用带时区的完整时间。
let serverOffsetMs = 0;
let calibrated = false;
let lastServerTime: string | null = null;
let recalibrationTimer: ReturnType<typeof setInterval> | null = null;

/** 用后端返回的 serverTime 校准本地偏移（设备会话 getLatestDeviceData 已返回 serverTime）。 */
export function applyServerTime(serverIso: string): void {
  const server = Date.parse(serverIso);
  if (Number.isFinite(server)) {
    serverOffsetMs = server - Date.now();
    calibrated = true;
    lastServerTime = serverIso;
  }
}

export function isServerClockCalibrated(): boolean {
  return calibrated;
}

export function getLastServerTime(): string | null {
  return lastServerTime;
}

/**
 * 独立获取服务器时间（不依赖设备 binding）。
 * 页面打开时调用一次，定期重新校准（防本地时钟漂移）。
 */
export async function initServerClock(fetcher: () => Promise<{ serverTime: string }>): Promise<void> {
  try {
    const res = await fetcher();
    applyServerTime(res.serverTime);
  } catch {
    // 获取失败不静默使用本地时间：标记未校准，由 UI 提示。
    calibrated = false;
  }
  if (!recalibrationTimer) {
    recalibrationTimer = setInterval(() => {
      fetcher().then((res) => applyServerTime(res.serverTime)).catch(() => {});
    }, 5 * 60 * 1000); // 每 5 分钟重新校准
  }
}

export function stopServerClock(): void {
  if (recalibrationTimer) {
    clearInterval(recalibrationTimer);
    recalibrationTimer = null;
  }
}

/** 取已校准的当前服务器时间（未校准时回退本地时间，仍返回带时区 ISO）。 */
export function getServerNowIso(): string {
  return new Date(Date.now() + serverOffsetMs).toISOString();
}

/** 以服务器时间生成 HH:mm（默认时间选择）。 */
export function getServerNowClock(): string {
  const d = new Date(Date.now() + serverOffsetMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
