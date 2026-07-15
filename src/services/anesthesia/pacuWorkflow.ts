import { pacuApi } from "@/api/pacu";
import { useRealPacu } from "@/config/apiFlags";
export type PacuStatus =
  | "pending"
  | "admitted"
  | "recovering"
  | "ready_to_discharge"
  | "discharged"
  | "voided";
export interface PacuRecordContract {
  operationId: string;
  pacuRecordId: string;
  status: PacuStatus;
  version: number;
  bookingId?: string | null;
  bedId?: string | null;
  bedName?: string | null;
  admittedAt?: string | null;
  recoveredAt?: string | null;
  dischargeReadyAt?: string | null;
  dischargedAt?: string | null;
  anesthesiologist?: string | null;
  nurse?: string | null;
  aldreteScore?: number | null;
  painScore?: number | null;
  nauseaVomiting?: boolean;
  shivering?: boolean;
  oxygenSupport?: string | null;
  airwayStatus?: string | null;
  vitalSummary?: unknown;
  dischargeDestination?: string | null;
  dischargeCriteriaMet?: boolean;
  notes?: string | null;
}
export interface PacuDetailContract {
  operationCase: Record<string, unknown>;
  pacuRecord: PacuRecordContract | null;
  nursingSummary?: Record<string, unknown> | null;
  handoverSummary?: Record<string, unknown> | null;
  timeline?: Record<string, unknown>[];
}
export type PacuAction =
  | "admit"
  | "saveRecovery"
  | "markReady"
  | "discharge"
  | "forceDischarge"
  | "void";
const allowed: Record<PacuAction, string[]> = {
  admit: [
    "operationId",
    "expectedVersion",
    "bookingId",
    "bookingExpectedVersion",
    "bedId",
    "bedExpectedVersion",
    "bedName",
    "admittedAt",
    "anesthesiologist",
    "nurse",
    "notes",
  ],
  saveRecovery: [
    "operationId",
    "expectedVersion",
    "recoveredAt",
    "anesthesiologist",
    "nurse",
    "aldreteScore",
    "painScore",
    "nauseaVomiting",
    "shivering",
    "oxygenSupport",
    "airwayStatus",
    "vitalSummary",
    "notes",
  ],
  markReady: [
    "operationId",
    "expectedVersion",
    "dischargeReadyAt",
    "dischargeCriteriaMet",
    "aldreteScore",
    "notes",
  ],
  discharge: [
    "operationId",
    "expectedVersion",
    "dischargedAt",
    "dischargeDestination",
    "nurse",
    "notes",
  ],
  forceDischarge: [
    "operationId",
    "expectedVersion",
    "dischargedAt",
    "dischargeDestination",
    "reason",
    "reasonCode",
    "approverId",
    "nurse",
    "notes",
  ],
  void: ["operationId", "expectedVersion", "voidReason", "notes"],
};
export function buildPacuWorkflowPayload(
  action: PacuAction,
  input: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(input).filter(([k]) => allowed[action].includes(k)),
  );
}
export function hasPacuPermission(
  permissions: string[] | null | undefined,
  code: string,
) {
  return Boolean(
    permissions?.some((p) => p === "*" || p === "pacu.*" || p === code),
  );
}
const mock = new Map<string, PacuDetailContract>();
const mockCase = (id: string) => ({ operationId: id });
export async function pacuDetail(
  operationId: string,
): Promise<PacuDetailContract> {
  if (useRealPacu())
    return pacuApi.detail(operationId) as Promise<PacuDetailContract>;
  return structuredClone(
    mock.get(operationId) ?? {
      operationCase: mockCase(operationId),
      pacuRecord: null,
      nursingSummary: null,
      handoverSummary: null,
      timeline: [],
    },
  );
}
export async function pacuAction(
  action: PacuAction,
  input: Record<string, unknown>,
): Promise<PacuDetailContract> {
  const payload = buildPacuWorkflowPayload(action, input);
  const id = String(payload.operationId ?? "");
  if (useRealPacu()) {
    const actions = {
      admit: pacuApi.admit,
      saveRecovery: pacuApi.saveRecovery,
      markReady: pacuApi.markReady,
      discharge: pacuApi.discharge,
      forceDischarge: pacuApi.forceDischarge,
      void: pacuApi.void,
    };
    await actions[action](payload);
    return pacuApi.detail(id) as Promise<PacuDetailContract>;
  }
  const current = await pacuDetail(id);
  const status: PacuStatus =
    action === "admit"
      ? "admitted"
      : action === "saveRecovery"
        ? "recovering"
        : action === "markReady"
          ? "ready_to_discharge"
          : action === "discharge" || action === "forceDischarge"
            ? "discharged"
            : "voided";
  const version = (current.pacuRecord?.version ?? 0) + 1;
  const detail = {
    ...current,
    pacuRecord: {
      ...(current.pacuRecord ?? {
        operationId: id,
        pacuRecordId: `mock-${id}`,
      }),
      ...payload,
      status,
      version,
    } as PacuRecordContract,
    timeline: [
      ...(current.timeline ?? []),
      { eventType: action, toStatus: status, version },
    ],
  };
  mock.set(id, detail);
  return structuredClone(detail);
}
export async function savePacuBooking(input: Record<string, unknown>) {
  const operationId = String(input.operationId ?? "");
  await (input.bookingId
    ? pacuApi.bookingUpdate(input)
    : pacuApi.bookingCreate(input));
  return pacuApi.bookingList({ caseId: operationId, pageSize: 200 });
}
export async function cancelPacuBooking(input: Record<string, unknown>) {
  await pacuApi.bookingCancel(input);
  return pacuApi.bookingList({
    caseId: String(input.operationId ?? ""),
    pageSize: 200,
  });
}
export async function savePacuBed(input: Record<string, unknown>) {
  await (input.bedId ? pacuApi.bedUpdate(input) : pacuApi.bedCreate(input));
  return pacuApi.bedList({ pageSize: 200 });
}
export function resetPacuWorkflowMock() {
  mock.clear();
}
