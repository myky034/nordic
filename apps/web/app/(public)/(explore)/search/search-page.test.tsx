import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
import SearchPage from "./page";
const render = async (q?: string) => renderToStaticMarkup(await SearchPage({ params: Promise.resolve({}), searchParams: Promise.resolve(q === undefined ? {} : { q }) }));

it("does not query the database without a search term", async () => {
  rpc.mockClear();
  expect(await render()).toContain("Accents are optional");
  expect(rpc).not.toHaveBeenCalled();
});
it("searches through the anonymous public RPC and groups results", async () => {
  rpc.mockResolvedValue({ data: [
    { entity_type: "programme", id: "p", title: "Synthetic MSc", subtitle: "Synthetic Uni", link_key: "p1", rank: 0.5, total: 9 },
    { entity_type: "country", id: "c", title: "Sweden", subtitle: null, link_key: "sweden", rank: 0.9, total: 1 },
  ], error: null });
  const html = await render("  msc ");
  expect(rpc).toHaveBeenLastCalledWith("search_public", { p_query: "msc", p_per_type: 5 });
  expect(html.indexOf("Countries")).toBeLessThan(html.indexOf("Programmes"));
  for (const t of ['href="/countries/sweden"', 'href="/programmes/p1"', 'href="/programmes?q=msc"', "Synthetic MSc"]) expect(html).toContain(t);
});
it("shows an honest empty state and fails closed on errors", async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await render("zzz")).toContain("No public results");
  rpc.mockResolvedValue({ data: null, error: { message: "down" } });
  await expect(render("x")).rejects.toThrow("Không tìm kiếm được");
});
