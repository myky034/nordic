import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { user, perms, text, requests } = vi.hoisted(() => ({ user: vi.fn(), perms: vi.fn(), text: vi.fn(), requests: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./extraction-forms", () => ({ RequestExtractionForm: () => <button>request</button>, CancelExtractionForm: () => <button>cancel</button> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: user },
    rpc: perms,
    from: (table: string) => table === "document_texts"
      ? { select: () => ({ eq: () => ({ maybeSingle: text }) }) }
      : { select: () => ({ eq: () => ({ order: () => ({ limit: requests }) }) }) },
  }),
}));
import { ExtractionPanel } from "./extraction-panel";

const signedIn = (keys: string[]) => { user.mockResolvedValue({ data: { user: { id: "u" } } }); perms.mockResolvedValue({ data: keys.map((key) => ({ key })), error: null }); };

it("is invisible to visitors and to users who cannot propose", async () => {
  user.mockResolvedValue({ data: { user: null } });
  expect(await ExtractionPanel({ documentId: "d1" })).toBeNull();
  signedIn(["facts.review"]);
  expect(await ExtractionPanel({ documentId: "d1" })).toBeNull();
});
it("is hidden for documents without stored text (nothing to send)", async () => {
  signedIn(["facts.propose"]);
  text.mockResolvedValue({ data: null, error: null });
  requests.mockResolvedValue({ data: [], error: null });
  expect(await ExtractionPanel({ documentId: "d1" })).toBeNull();
});
it("offers a request, or shows the open one with a cancel button", async () => {
  signedIn(["facts.propose"]);
  text.mockResolvedValue({ data: { document_id: "d1" }, error: null });
  requests.mockResolvedValue({ data: [], error: null });
  expect(renderToStaticMarkup((await ExtractionPanel({ documentId: "d1" }))!)).toContain("request");
  requests.mockResolvedValue({ data: [{ id: "q1", status: "pending", note: null, created_at: "2026-09-28T08:00:00Z", finished_at: null, truncated: false }], error: null });
  const html = renderToStaticMarkup((await ExtractionPanel({ documentId: "d1" }))!);
  expect(html).toContain("Đang chờ lần chạy tới");
  expect(html).toContain("cancel");
  expect(html).not.toContain(">request<");
});
