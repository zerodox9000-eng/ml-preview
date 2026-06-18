import { describe, expect, it } from "vitest";
import { createId } from "./ids";

describe("createId", () => {
  it("uses randomUUID when it is available", () => {
    expect(createId({ randomUUID: () => "uuid-value" })).toBe("uuid-value");
  });

  it("falls back when randomUUID is missing", () => {
    expect(createId(null)).toMatch(/^id-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("falls back when randomUUID throws", () => {
    expect(
      createId({
        randomUUID: () => {
          throw new Error("insecure origin");
        },
      }),
    ).toMatch(/^id-[a-z0-9]+-[a-z0-9]+$/);
  });
});
