import { describe, expect, it } from "vitest";
import { KIND_GROUPS, KIND_LABELS, videoKind } from "./videoKind";

const ad = { id: "a1", title: "Turn Screen Time Into a World Adventure", source_url: "https://www.geoquestadventures.com/", kind: "ad" };

describe("videoKind", () => {
  it("files a Product Ad as an ad even though it carries a website link", () => {
    expect(videoKind(ad)).toBe("ad");
  });

  it("still files a plain link video as an article", () => {
    expect(videoKind({ id: "v2", title: "5 Things to Do for Your Cat", source_url: "https://en.wikipedia.org/wiki/Cat", kind: "normal" })).toBe("article");
  });

  it("labels the ad category Product Ad and keeps it in the filter list", () => {
    expect(KIND_LABELS.ad).toBe("Product Ad");
    expect(KIND_GROUPS.map((g) => g.kind)).toContain("ad");
  });
});
