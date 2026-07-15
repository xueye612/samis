import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/apiFlags", () => ({ useRealPacu: vi.fn(() => false) }));
vi.mock("@/api/pacu", () => ({
  pacuApi: {
    detail: vi.fn(),
    admit: vi.fn(),
    saveRecovery: vi.fn(),
    markReady: vi.fn(),
    discharge: vi.fn(),
    forceDischarge: vi.fn(),
    void: vi.fn(),
    bookingCreate: vi.fn(),
    bookingUpdate: vi.fn(),
    bookingCancel: vi.fn(),
    bookingList: vi.fn(),
    bedCreate: vi.fn(),
    bedUpdate: vi.fn(),
    bedList: vi.fn(),
  },
}));
import { useRealPacu } from "@/config/apiFlags";
import { pacuApi } from "@/api/pacu";
import {
  buildPacuWorkflowPayload,
  hasPacuPermission,
  pacuAction,
  resetPacuWorkflowMock,
} from "./pacuWorkflow";
describe("pacu workflow", () => {
  beforeEach(() => {
    resetPacuWorkflowMock();
    vi.clearAllMocks();
    vi.mocked(useRealPacu).mockReturnValue(false);
  });
  it("mock flow keeps versions", async () => {
    let d = await pacuAction("admit", {
      operationId: "OP",
      expectedVersion: 0,
    });
    expect(d.pacuRecord?.version).toBe(1);
    d = await pacuAction("saveRecovery", {
      operationId: "OP",
      expectedVersion: 1,
    });
    expect(d.pacuRecord?.version).toBe(2);
  });
  it("filters master data and keeps versions", () => {
    expect(
      buildPacuWorkflowPayload("admit", {
        operationId: "OP",
        expectedVersion: 0,
        bedId: "B",
        patientName: "bad",
      }),
    ).toEqual({ operationId: "OP", expectedVersion: 0, bedId: "B" });
  });
  it("forces GET after real POST", async () => {
    vi.mocked(useRealPacu).mockReturnValue(true);
    const detail = { operationCase: { operationId: "OP" }, pacuRecord: null };
    vi.mocked(pacuApi.detail).mockResolvedValue(detail);
    await pacuAction("admit", { operationId: "OP", expectedVersion: 0 });
    expect(pacuApi.admit).toHaveBeenCalledWith({
      operationId: "OP",
      expectedVersion: 0,
    });
    expect(pacuApi.detail).toHaveBeenCalledWith("OP");
  });
  it("checks permission", () => {
    expect(
      hasPacuPermission(["pacu.workflow.manage"], "pacu.workflow.manage"),
    ).toBe(true);
    expect(hasPacuPermission([], "pacu.workflow.manage")).toBe(false);
  });
});
