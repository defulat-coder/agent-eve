import { describe, expect, it } from "vitest";
import { cn } from "./utils.js";

describe("cn", () => {
  it("merges Tailwind classes predictably", () => {
    const isHidden = false;

    expect(cn("px-2", "px-4", isHidden && "hidden")).toBe("px-4");
  });
});
