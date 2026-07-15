import {
  postoperativeApi,
  type PostoperativeComplicationContract,
  type PostoperativeDetailApi,
  type PostoperativeFollowupContract,
} from "@/api/postoperative";
import { useRealPostoperative } from "@/config/apiFlags";
export interface PostoperativeDetail extends PostoperativeDetailApi {}
export type FollowupDraftInput = Omit<
  Partial<PostoperativeFollowupContract>,
  "status"
> & { operationId: string; expectedVersion: number };
export type ComplicationInput = Omit<
  Partial<PostoperativeComplicationContract>,
  "reportStatus"
> & { operationId: string; complicationType: string; expectedVersion: number };
const mockDetails = new Map<string, PostoperativeDetail>();
const emptyCase = (id: string) => ({ operationId: id });
const clone = (d: PostoperativeDetail) => structuredClone(d);
function mockDetail(id: string, c?: Record<string, unknown>) {
  if (!mockDetails.has(id))
    mockDetails.set(id, {
      operationCase: c ?? emptyCase(id),
      followup: null,
      complications: [],
      nursingVisitSummary: null,
      history: [],
    });
  const d = mockDetails.get(id)!;
  if (c) d.operationCase = c;
  return d;
}
export function hasPostoperativePermission(
  p: string[] | null | undefined,
  code: string,
) {
  return Boolean(p?.some((x) => x === "*" || x === "postop.*" || x === code));
}
export function buildFollowupDraftPayload(i: FollowupDraftInput) {
  const k = [
    "operationId",
    "followupId",
    "expectedVersion",
    "followupAt",
    "followupMethod",
    "painScore",
    "nauseaVomiting",
    "soreThroat",
    "awareness",
    "satisfaction",
    "analgesiaPlan",
    "notes",
    "evaluatorId",
    "evaluatorName",
  ];
  return Object.fromEntries(
    k
      .filter((x) => i[x as keyof FollowupDraftInput] !== undefined)
      .map((x) => [x, i[x as keyof FollowupDraftInput]]),
  );
}
export function buildComplicationSavePayload(i: ComplicationInput) {
  const k = [
    "operationId",
    "complicationId",
    "expectedVersion",
    "complicationType",
    "severity",
    "occurredAt",
    "description",
    "treatment",
    "outcome",
    "reporterId",
    "reporterName",
  ];
  return Object.fromEntries(
    k
      .filter((x) => i[x as keyof ComplicationInput] !== undefined)
      .map((x) => [x, i[x as keyof ComplicationInput]]),
  );
}
export async function loadPostoperativeDetail(
  id: string,
  c?: Record<string, unknown>,
): Promise<PostoperativeDetail> {
  return useRealPostoperative()
    ? postoperativeApi.followupDetail(id)
    : clone(mockDetail(id, c));
}
export async function saveFollowupDraft(
  i: FollowupDraftInput,
  c?: Record<string, unknown>,
) {
  const p = buildFollowupDraftPayload(i);
  if (useRealPostoperative()) {
    await postoperativeApi.followupSaveDraft(p);
    return postoperativeApi.followupDetail(i.operationId);
  }
  const d = mockDetail(i.operationId, c);
  if (d.followup && !["draft", "cancelled"].includes(d.followup.status))
    throw new Error("随访状态不允许保存");
  const version = (d.followup?.version ?? 0) + 1;
  d.followup = {
    operationId: i.operationId,
    followupId: d.followup?.followupId ?? `mock-followup-${Date.now()}`,
    status: "draft",
    version,
    nauseaVomiting: false,
    soreThroat: false,
    awareness: false,
    ...p,
  } as PostoperativeFollowupContract;
  return clone(d);
}
export async function submitFollowup(
  operationId: string,
  expectedVersion: number,
) {
  if (useRealPostoperative()) {
    await postoperativeApi.followupSubmit({ operationId, expectedVersion });
    return postoperativeApi.followupDetail(operationId);
  }
  const d = mockDetail(operationId);
  if (d.followup?.status !== "draft" || d.followup.version !== expectedVersion)
    throw new Error("随访状态或版本冲突");
  d.followup.status = "submitted";
  d.followup.version++;
  return clone(d);
}
export async function cancelFollowup(
  operationId: string,
  expectedVersion: number,
  reason: string,
) {
  if (useRealPostoperative()) {
    await postoperativeApi.followupCancelSubmit({
      operationId,
      expectedVersion,
      reason,
    });
    return postoperativeApi.followupDetail(operationId);
  }
  const d = mockDetail(operationId);
  if (
    d.followup?.status !== "submitted" ||
    d.followup.version !== expectedVersion
  )
    throw new Error("随访状态或版本冲突");
  d.followup.status = "cancelled";
  d.followup.version++;
  return clone(d);
}
export async function saveComplication(
  i: ComplicationInput,
  c?: Record<string, unknown>,
) {
  const p = buildComplicationSavePayload(i);
  if (useRealPostoperative()) {
    await postoperativeApi.complicationSave(p);
    return postoperativeApi.followupDetail(i.operationId);
  }
  const d = mockDetail(i.operationId, c);
  const old = i.complicationId
    ? d.complications.find((x) => x.complicationId === i.complicationId)
    : undefined;
  if (old && old.reportStatus !== "draft")
    throw new Error("并发症状态不允许编辑");
  const row = {
    operationId: i.operationId,
    complicationId: old?.complicationId ?? `mock-complication-${Date.now()}`,
    severity: "moderate",
    reportStatus: "draft",
    version: (old?.version ?? 0) + 1,
    ...p,
  } as PostoperativeComplicationContract;
  if (old) Object.assign(old, row);
  else d.complications.unshift(row);
  return clone(d);
}
export async function reportComplication(
  operationId: string,
  complicationId: string,
  expectedVersion: number,
) {
  if (useRealPostoperative()) {
    await postoperativeApi.complicationReport({
      operationId,
      complicationId,
      expectedVersion,
    });
    return postoperativeApi.followupDetail(operationId);
  }
  const d = mockDetail(operationId);
  const r = d.complications.find((x) => x.complicationId === complicationId);
  if (!r || r.reportStatus !== "draft" || r.version !== expectedVersion)
    throw new Error("并发症状态或版本冲突");
  r.reportStatus = "reported";
  r.version++;
  return clone(d);
}
export async function voidComplication(
  operationId: string,
  complicationId: string,
  expectedVersion: number,
  voidReason: string,
) {
  if (useRealPostoperative()) {
    await postoperativeApi.complicationVoid({
      operationId,
      complicationId,
      expectedVersion,
      voidReason,
    });
    return postoperativeApi.followupDetail(operationId);
  }
  const d = mockDetail(operationId);
  const r = d.complications.find((x) => x.complicationId === complicationId);
  if (!r || r.version !== expectedVersion) throw new Error("并发症版本冲突");
  r.reportStatus = "voided";
  r.version++;
  r.voidReason = voidReason;
  return clone(d);
}
export function resetPostoperativeMock() {
  mockDetails.clear();
}
