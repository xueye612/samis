// 统一服务器时间来源：优先用后端/设备会话返回的 serverTime 校准本地时钟，
// 避免以浏览器 new Date() 作为唯一可信时间。保存时统一使用带时区的完整时间。
let serverOffsetMs = 0;
let calibrated = false;

/** 用后端返回的 serverTime 校准本地偏移（设备会话 getLatestDeviceData 已返回 serverTime）。 */
export function applyServerTime(serverIso: string): void {
  const server = Date.parse(serverIso);
  if (Number.isFinite(server)) {
    serverOffsetMs = server - Date.now();
    calibrated = true;
  }
}

export function isServerClockCalibrated(): boolean {
  return calibrated;
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
