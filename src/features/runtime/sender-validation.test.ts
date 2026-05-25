import { describe, expect, it } from "vitest";
import { isFromExtensionViewer } from "./sender-validation";

const viewerOrigin = "chrome-extension://test-id/";

describe("isFromExtensionViewer", () => {
  it("returns true when sender.url starts with the extension origin", () => {
    expect(
      isFromExtensionViewer(
        { url: `${viewerOrigin}viewer.html` },
        () => viewerOrigin
      )
    ).toBe(true);
  });

  it("returns false when sender is undefined", () => {
    expect(isFromExtensionViewer(undefined, () => viewerOrigin)).toBe(false);
  });

  it("returns false when sender.url is from an X tab", () => {
    expect(
      isFromExtensionViewer(
        { url: "https://x.com/home" },
        () => viewerOrigin
      )
    ).toBe(false);
  });

  it("returns false when sender.url is missing", () => {
    expect(isFromExtensionViewer({}, () => viewerOrigin)).toBe(false);
  });

  it("returns false when sender.url is a different extension origin", () => {
    expect(
      isFromExtensionViewer(
        { url: "chrome-extension://other-id/viewer.html" },
        () => viewerOrigin
      )
    ).toBe(false);
  });

  it("returns false when the viewer origin lookup yields the empty string", () => {
    expect(
      isFromExtensionViewer(
        { url: `${viewerOrigin}viewer.html` },
        () => ""
      )
    ).toBe(false);
  });

  it("returns false when sender.url is the empty string", () => {
    expect(isFromExtensionViewer({ url: "" }, () => viewerOrigin)).toBe(false);
  });
});
