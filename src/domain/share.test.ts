import { describe, expect, it } from "vitest";
import { createFeed } from "./defaults";
import { decodeSharePayload, encodeSharePayload } from "./share";

describe("share codec", () => {
  it("round-trips compressed feed links", () => {
    const payload = { kind: "feed" as const, version: 1 as const, feed: createFeed("Reddit Rec List") };
    const encoded = encodeSharePayload(payload);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(decodeSharePayload(encoded)).toEqual(payload);
  });
});
