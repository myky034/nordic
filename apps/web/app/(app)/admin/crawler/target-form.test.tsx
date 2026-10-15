import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ saveCrawlTarget: async () => ({}) }));
import { TargetForm } from "./forms";

// L6 (Decision Log 2026-10-15): a real browser is the default for new URLs.
it("reads new URLs in a real browser by default and keeps an existing URL's choice", () => {
  const fresh = renderToStaticMarkup(<TargetForm sources={[{ id: "s1", label: "Synthetic" }]} locale="vi" />);
  expect(fresh).toMatch(/name="renderJs" checked=""/);
  expect(fresh).toContain("Đọc bằng trình duyệt thật");
  const plain = renderToStaticMarkup(<TargetForm sources={[]} locale="en" target={{ id: "t1", source_id: "s1", url: "https://a.example.test/", kind: "page",
    path_prefix: null, max_urls: 20, content_selector: null, active: true, render_js: false }} />);
  expect(plain).not.toMatch(/name="renderJs" checked/);
  expect(plain).toContain("Read in a real browser");
});
