import { describe, expect, it } from "vitest";
import { MOTION_DISPLAY_NAME, MOTION_LEGACY_NAMESPACE } from "../motionBranding";

describe("Provisional SuperAgent Studio display identity", () => {
  it("does not reuse Motion Studio as the product label", () => {
    expect(MOTION_DISPLAY_NAME).toBe("SuperAgent Studio");
    expect(MOTION_DISPLAY_NAME).not.toBe("Motion Studio");
  });
  it("preserves the motion project API namespace for backward compatibility", () => {
    expect(MOTION_LEGACY_NAMESPACE).toBe("motion");
  });
});
