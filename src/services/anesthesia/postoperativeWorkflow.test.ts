import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/apiFlags", () => ({
  useRealPostoperative: vi.fn(() => false),
}));
vi.mock("@/api/postoperative", () => ({
  postoperativeApi: {
    followupDetail: vi.fn(),
    followupSaveDraft: vi.fn(),
    followupSubmit: vi.fn(),
    followupCancelSubmit: vi.fn(),
    complicationSave: vi.fn(),
    complicationReport: vi.fn(),
    complicationVoid: vi.fn(),
  },
}));
import { useRealPostoperative } from "@/config/apiFlags";
import { postoperativeApi } from "@/api/postoperative";
import {
  buildComplicationSavePayload,
  buildFollowupDraftPayload,
  cancelFollowup,
  hasPostoperativePermission,
  reportComplication,
  resetPostoperativeMock,
  saveComplication,
  saveFollowupDraft,
  submitFollowup,
  voidComplication,
} from "./postoperativeWorkflow";
describe("postoperative workflow", () => {
  beforeEach(() => {
    resetPostoperativeMock();
    vi.mocked(useRealPostoperative).mockReturnValue(false);
    vi.clearAllMocks();
  });
  it("runs versioned state flow", async () => {
    let d = await saveFollowupDraft({
      operationId: "OP",
      expectedVersion: 0,
      painScore: 2,
    });
    expect(d.followup?.version).toBe(1);
    d = await submitFollowup("OP", 1);
    d = await cancelFollowup("OP", 2, "修订");
    expect(d.followup?.version).toBe(3);
    d = await saveComplication({
      operationId: "OP",
      expectedVersion: 0,
      complicationType: "PONV",
    });
    const c = d.complications[0];
    d = await reportComplication("OP", c.complicationId, 1);
    d = await voidComplication("OP", c.complicationId, 2, "误报");
    expect(d.complications[0].reportStatus).toBe("voided");
  });
  it("filters master fields", () => {
    expect(
      buildFollowupDraftPayload({
        operationId: "OP",
        expectedVersion: 0,
        painScore: 1,
        patientName: "bad",
      } as never),
    ).toEqual({ operationId: "OP", expectedVersion: 0, painScore: 1 });
    expect(
      buildComplicationSavePayload({
        operationId: "OP",
        expectedVersion: 0,
        complicationType: "x",
        patientName: "bad",
      } as never),
    ).toEqual({ operationId: "OP", expectedVersion: 0, complicationType: "x" });
  });
  it("forces GET after POST", async () => {
    vi.mocked(useRealPostoperative).mockReturnValue(true);
    const d = {
      operationCase: { operationId: "OP" },
      followup: null,
      complications: [],
    };
    vi.mocked(postoperativeApi.followupDetail).mockResolvedValue(d);
    vi.mocked(postoperativeApi.followupSaveDraft).mockResolvedValue(d);
    await saveFollowupDraft({ operationId: "OP", expectedVersion: 0 });
    expect(postoperativeApi.followupSaveDraft).toHaveBeenCalledWith({
      operationId: "OP",
      expectedVersion: 0,
    });
    expect(postoperativeApi.followupDetail).toHaveBeenCalledWith("OP");
  });
  it("checks permissions", () => {
    expect(
      hasPostoperativePermission(["postop.*"], "postop.followup.manage"),
    ).toBe(true);
    expect(hasPostoperativePermission([], "postop.followup.manage")).toBe(
      false,
    );
  });
});
