/**
 * PACU 预警/质控公共阈值常量（Slice 4）。
 * 预警页（PacuAlerts）与质控指标（Slice 6）共用，避免口径漂移。
 * 对齐 src/config/qualityIndicators.ts：PACU入室低体温率(AQI-PHT-17)、PACU转出延迟率(AQI-PDR-18)。
 */
export const PACU_LOW_TEMP_THRESHOLD = 36; // 入室低体温 < 36℃
export const PACU_LOW_TEMP_SEVERE = 35.5; // 严重低体温 < 35.5℃
export const PACU_STAY_LIMIT_MINUTES = 120; // 停留超过 2 小时（转出延迟）
export const PACU_ALDRETE_LOW_THRESHOLD = 9; // Aldrete 评分 < 9
export const PACU_SPO2_LOW_THRESHOLD = 90; // SpO2 < 90%
