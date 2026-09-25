import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { user, row } = vi.hoisted(() => ({ user: vi.fn(), row: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: user },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: row }) }) }),
  }),
}));
import { InternalText } from "./internal-text";

it("renders nothing for anonymous visitors and never queries the text", async () => {
  user.mockResolvedValue({ data: { user: null } });
  expect(await InternalText({ documentId: "d1" })).toBeNull();
  expect(row).not.toHaveBeenCalled();
});
it("renders nothing when RLS returns no row (signed in without editor permission)", async () => {
  user.mockResolvedValue({ data: { user: { id: "u" } } });
  row.mockResolvedValue({ data: null, error: null });
  expect(await InternalText({ documentId: "d1" })).toBeNull();
});
it("shows the private text to editors, labelled as internal", async () => {
  user.mockResolvedValue({ data: { user: { id: "u" } } });
  row.mockResolvedValue({ data: { text: "Synthetic extracted text", extractor: "html-text-v1", extracted_at: "2026-09-25T00:00:00Z" }, error: null });
  const html = renderToStaticMarkup((await InternalText({ documentId: "d1" }))!);
  expect(html).toContain("nội bộ");
  expect(html).toContain("Synthetic extracted text");
});
