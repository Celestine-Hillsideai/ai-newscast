import { describe, expect, it } from "vitest";
import { hashContent } from "./content-hash.js";

describe("hashContent", () => {
  it("hashes identical content the same regardless of whitespace/case", () => {
    const a = hashContent("CBN raises interest rate to 27.5%");
    const b = hashContent("  cbn   raises interest rate to 27.5%  ");
    expect(a).toBe(b);
  });

  it("hashes different content differently", () => {
    const a = hashContent("CBN raises interest rate to 27.5%");
    const b = hashContent("CBN cuts interest rate to 25%");
    expect(a).not.toBe(b);
  });
});
