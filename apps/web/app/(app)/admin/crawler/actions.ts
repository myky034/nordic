"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { canonicalSourceUrl } from "@/lib/registry/domain";
import { crawlerError, type CrawlerState } from "@/lib/crawler/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };

export async function saveCrawlTarget(_: CrawlerState, form: FormData): Promise<CrawlerState> {
  try {
    const { client } = await requirePermission("crawler.manage");
    const id = text(form, "id"), source = text(form, "source"), kind = text(form, "kind"), max = Number(text(form, "maxUrls") || "20");
    const url = canonicalSourceUrl(text(form, "url"));
    if ((id && !uuidPattern.test(id)) || !uuidPattern.test(source) || !url || !["page", "sitemap"].includes(kind) || !Number.isInteger(max)) {
      return { error: crawlerError("crawler_invalid") };
    }
    const { error } = await client.rpc("save_crawl_target", {
      p_id: id || null, p_source: source, p_url: url, p_kind: kind, p_prefix: kind === "sitemap" ? text(form, "prefix") || null : null,
      p_max_urls: max, p_selector: text(form, "selector") || null, p_active: form.get("active") === "on",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/crawler");
    return { message: id ? "Đã lưu thay đổi." : "Đã đăng ký URL." };
  } catch (e) { logAccessError("save_crawl_target"); return { error: crawlerError(e instanceof Error ? e.message : "") }; }
}
