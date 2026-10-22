import { describe, expect, it } from "vitest";
import { STUDIO_DISPLAY_NAME, STUDIO_LEGACY_NAMESPACE } from "../studioBranding";

describe("Provisional SuperAgent Studio display identity", () => {
  it("does not reuse Studio Studio as the product label", () => {
    expect(STUDIO_DISPLAY_NAME).toBe("SuperAgent Studio");
    expect(STUDIO_DISPLAY_NAME).not.toBe("Studio Studio");
  });
  it("preserves the motion project API namespace for backward compatibility", () => {
    expect(STUDIO_LEGACY_NAMESPACE).toBe("motion");
  });
});
