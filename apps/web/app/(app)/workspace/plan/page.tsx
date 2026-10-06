import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { compareHref } from "@/lib/compare/domain";
import { countryName } from "@/lib/registry/domain";
import { targetDegreeLabel } from "@/lib/workspace/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { Card, List, ListRow, Notice, PageHeader, Section, BackLink } from "@/components/ui";
import { PlanForm } from "../forms";

export default async function PlanPage() {
  await requireAuth();
  const client = await createClient();
  const [planResult, planCountries, countriesResult] = await Promise.all([
    client.from("user_plans").select("current_position,education,target_role,target_degree,target_year,language_goals,application_status,budget_amount,budget_currency,budget_period").maybeSingle(),
    client.from("user_plan_countries").select("country_id,countries(slug,name)"),
    client.from("countries").select("id,name,slug").order("name"),
  ]);
  if (planResult.error || planCountries.error || countriesResult.error) throw new Error("Không tải được Kế hoạch châu Âu.");
  const plan = planResult.data;
  const chosen = (planCountries.data ?? []) as unknown as { country_id: string; countries: { slug: string; name: string } }[];
  const countries = countriesResult.data as { id: string; name: string; slug: string }[];
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, w] = [dict.workspace.plan, dict.workspace];
  const name = (c: { slug: string; name: string }) => countryName(c.slug, c.name, locale);
  // Shortcuts are plain links built from the user's own answers. They filter
  // public lists; they do not rank, score or recommend anything.
  const shortcuts: [string, string, string][] = [];
  if (chosen.length >= 2) shortcuts.push([compareHref(chosen.map((c) => c.countries.slug)), t.compare, chosen.map((c) => name(c.countries)).join(", ")]);
  for (const c of chosen) {
    shortcuts.push([`/programmes?country=${c.countries.slug}${plan?.target_degree ? `&degree=${plan.target_degree}` : ""}`, t.programmes(plan?.target_degree ? targetDegreeLabel(plan.target_degree, locale) : null, name(c.countries)), t.programmesSub]);
    shortcuts.push([`/immigration?country=${c.countries.slug}`, t.rules(name(c.countries)), t.rulesSub]);
  }
  if (plan?.target_role) shortcuts.push([`/occupations?q=${encodeURIComponent(plan.target_role)}`, t.occupation(plan.target_role), t.occupationSub]);
  return <>
    <PageHeader back={<BackLink href="/workspace">{w.title}</BackLink>} eyebrow={w.title} title={t.title}
      description={t.description} />
    <Section title={t.shortcuts}>
      <div className="mb-4"><Notice tone="neutral">{t.noticeBefore}<strong>{t.noticeStrong}</strong>{t.noticeAfter}</Notice></div>
      {shortcuts.length ? <List>{shortcuts.map(([href, title, sub]) => <ListRow key={href} href={href} title={title} subtitle={sub} />)}</List>
        : <p className="px-1 text-[15px] text-ink-2">{t.noShortcuts}</p>}
    </Section>
    <Section title={t.profile}>
      <Card><PlanForm locale={locale} plan={plan} countries={countries.map((c) => ({ id: c.id, label: name(c) }))} selected={chosen.map((c) => c.country_id)} /></Card>
    </Section>
    <p className="mt-8 px-1 text-[13px] text-ink-3">{t.deleteHint} <Link href="/workspace" className="text-accent hover:underline">{w.title}</Link>.</p>
  </>;
}
