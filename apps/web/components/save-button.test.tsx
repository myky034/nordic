import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/app/(app)/workspace/actions", () => ({ toggleSaved: async () => ({ saved: true }) }));
import { SaveButton } from "./save-button";

it("asks guests to sign in instead of offering a save action", () => {
  const html = renderToStaticMarkup(<SaveButton kind="programme" id="p1" signedIn={false} initialSaved={false} />);
  expect(html).toContain('href="/login"');
  expect(html).not.toContain("<form");
});
it("reflects the saved state for signed-in users and posts only kind and id", () => {
  const html = renderToStaticMarkup(<SaveButton kind="programme" id="p1" signedIn initialSaved />);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Đã lưu");
  const inputs = [...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]);
  expect(inputs.sort()).toEqual(["id", "kind"]);
});
