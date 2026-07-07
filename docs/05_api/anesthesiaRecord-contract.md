# 麻醉记录单主表契约（Slice 3a）

> 对应后端 `app\samis\domain\anesthesiarecord`（model/repository/service/validate）+ `app\samis\api\controller\pc\AnesthesiaRecord`。
> DDL：`doc/sql/samis_anes_record.sql`（samis 库）。前端 wrapper：`src/api/anesthesiaSync.ts` 的 `anesthesiaRecordApi`。
> 通用响应：`api_success(data)`（`code===0/message/data`），前端 `unwrapSamisResponse` + `readSamisResponseMessage` 兼容。
> record 端点为 **JSON body**（区别于 operationInfo 的 form-urlencoded）。
> 真实开关：`VITE_USE_REAL_ANESTHESIA_RECORD=true`（默认 mock）；真实链路集成测试 `src/api/anesthesiaRecord.real.integration.test.ts`（默认 skip，需 `VITE_SAMIS_REAL_INTEGRATION=1`）。

## 1. 接口清单（4）

| 接口 | 方法 | 路径 | 请求 | 响应 data |
|---|---|---|---|---|
| 记录单详情 | GET | `/anesthesiaRecord/getRecordDetail` | query `operationId`（可选 `recordLocalId/recordServerId`） | `{ operationId, record }`；无则 `record:null` |
| 保存记录单 | POST | `/anesthesiaRecord/saveRecord` | JSON | `{ localId, serverId }` |
| 锁定记录单 | POST | `/anesthesiaRecord/lockRecord` | JSON `{ operationId, recordLocalId }` | `{ operationId, recordLocalId, locked, lockedAt }` |
| 作废记录单 | POST | `/anesthesiaRecord/voidRecord` | JSON `{ operationId, recordLocalId, voidReason }` | `{ operationId, recordLocalId, voidReason, voided, voidedAt }` |

## 2. 表结构 `anes_record`（节选）

- 幂等键：`UNIQUE(operation_id, local_id)`；删除语义：void + `deleted_at` 软删（不做物理删除）。
- 行版本：`sync_version`（create=1，update+1）。`baseSyncVersion` 为前端基于版本。
- 完整字段见 `doc/数据库文档.md` 与后端 `doc/sql/samis_anes_record.sql`。

## 3. saveRecord payload（§7.1 字段映射）

请求 JSON（camelCase，后端映射到 snake_case 列）：

| 前端字段 | 后端列 | 必填 | 说明 |
|---|---|---|---|
| `operationId` | `operation_id` | 是 | 手术通知单ID（幂等键1，跨库仅存字符串） |
| `localId` | `local_id` | 是 | 前端记录UUID（幂等键2） |
| `recordStatus` | `record_status` | 是 | draft/recording/to_sign/signed/locked...（3a 透传字符串） |
| `pageCount` | `page_count` | 是 | 总页数 |
| `currentPage` | `current_page` | 是 | 当前页 |
| `recordNo` | `record_no` | 否 | 记录单号 |
| `patientId` | `patient_id` | 否 | 患者ID |
| `operationRoomId` | `operation_room_id` | 否 | 手术间ID |
| `recordStartTime` / `recordEndTime` | `record_start_time` / `record_end_time` | 否 | 记录开始/结束 |
| `anesthesiaMethod` / `asaLevel` | `anesthesia_method` / `asa_level` | 否 | 麻醉方式 / ASA |
| `recordLocked` / `recordPrinted` | `record_locked` / `record_printed` | 否 | 0/1 |
| `lockedAt` / `printedAt` | `locked_at` / `printed_at` | 否 | 时间 |
| `baseSyncVersion` | — | 否 | 前端基于版本（3a 仅记录审计，不阻断覆盖） |
| `casePayload` | `case_payload` | 否 | 粗粒度全量快照 JSON |

## 4. getRecordDetail 响应（record 非 null 时）

`record` 字段（§7.1）：`localId, serverId, recordNo, operationId, patientId, operationRoomId, recordStatus, recordStartTime, recordEndTime, anesthesiaMethod, asaLevel, pageCount, currentPage, printedAt, lockedAt, syncVersion, recordLocked, recordPrinted`。
（子表 medication/vital/... 不含，见 Slice 3c。）

## 5. 行为约定

- **saveRecord 幂等**：按 `(operation_id, local_id)` upsert；不存在 → create（`sync_version=1`）；存在 → 返回同 `serverId`，update 路径最新覆盖 + `sync_version+1`（精细化冲突留 3b pushBatch）。
- **lockRecord 幂等**：已锁定直接返回原 `lockedAt`；否则置 `record_locked=1`/`record_status=locked`/`locked_at=now`。
- **voidRecord**：`deleted_at=now` + `void_reason`；随后 `getRecordDetail` 返回 `record:null`。
- 全部写操作事务 + 审计日志（`audit_log`，channel audit）。

## 6. 本切片外（后续）

- 3b：`pushBatch` 同步引擎（success/failed/conflict、幂等、版本、getSyncStatus/getPendingCount/confirmBatch）。
- 3c：子表批量保存（medication/timeline/fluid/transfusion/vital/io/lab）+ snapshot。
- 3d：设备（monitor_raw/ventilator_raw/getLatestDeviceData）。
- 3e：resolveConflict + SyncConflictPanel 真实 + conflictType 映射。
