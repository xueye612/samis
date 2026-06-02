/** 抢救模式进入/退出后返回给页面的同步结果 */
export interface RescueModeTransitionResult {
  ok: boolean;
  pageNo?: number;
  focusTime?: string;
  /** 退出抢救时是否已将设备模拟从 rescue 恢复为 normal */
  deviceSimRestored?: boolean;
}
