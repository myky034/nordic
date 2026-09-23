"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { accessMessage, type ActionState } from "@/lib/rbac/messages";
import { canonicalSourceUrl, parseTopics, sourceStatuses, crawlPolicies, tiers } from "@/lib/registry/domain";
import { uuidPattern } from "@/lib/documents/domain";

export async function saveSource(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { client } = await requirePermission("sources.manage");
    const get = (key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
    const id = get("id");
    const url = canonicalSourceUrl(get("canonicalUrl"));
    const tier = get("sourceTier");
    const status = get("status");
    const policy = get("crawlPolicy");
    const country = get("countryId");
    if ((id && !uuidPattern.test(id)) || !url || (tier && !Object.hasOwn(tiers, tier))
      || !sourceStatuses.includes(status as typeof sourceStatuses[number])
      || !crawlPolicies.includes(policy as typeof crawlPolicies[number])
      || (country && !uuidPattern.test(country))) {
      return { error: accessMessage("sources_invalid") };
    }
    const { error } = await client.rpc("save_source", {
      p_id: id || null, p_name: get("name"), p_canonical_url: url, p_country_id: country || null,
      p_source_tier: tier || null, p_source_type: get("sourceType") || null, p_topics: parseTopics(get("topics")),
      p_language: get("language") || null, p_authority_notes: get("authorityNotes") || null, p_status: status,
      p_crawl_policy: policy, p_crawl_enabled: form.get("crawlEnabled") === "on",
      p_crawl_frequency: get("crawlFrequency") || null, p_notes: get("notes") || null,
    });
    if (error) {
      logAccessError("save_source");
      const duplicate = error.code === "23505" && error.message.includes("sources_canonical_url_key");
      return { error: duplicate ? "URL này đã có trong Source Registry." : accessMessage(error.message) };
    }
    revalidatePath("/admin/sources"); revalidatePath("/sources"); revalidatePath("/countries");
    return { message: "Đã lưu nguồn." };
  } catch (error) { logAccessError("save_source"); return { error: accessMessage(error instanceof Error ? error.message : "unknown") }; }
}
