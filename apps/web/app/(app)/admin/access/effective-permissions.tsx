import type { RoleRow } from "@/lib/rbac/access";
import { effectivePermissions } from "@/lib/rbac/effective";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

/**
 * "Quyền hiện có" in the user inspector: every permission the user holds
 * through their roles, grouped, with the role(s) that grant it. Read-only;
 * permissions are changed by editing a role or assigning another one.
 */
export function EffectivePermissions({ roles, roleIds, locale = defaultLocale }: { roles: RoleRow[]; roleIds: string[]; locale?: Locale }) {
  const t = dictionaries[locale].adminAccess;
  const { total, groups } = effectivePermissions(roles, roleIds, locale);
  return <section aria-labelledby="effective-permissions" className="mt-4 overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
    <div className="px-5 pb-2 pt-4">
      <h3 id="effective-permissions" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t.effective} <span className="normal-case tracking-normal">· {total}</span></h3>
      <p className="mt-1 text-[13px] leading-snug text-ink-2">{t.effectiveHelp}</p>
    </div>
    {total ? groups.map((g) => <div key={g.title} className="border-t border-hairline">
      <p className="px-5 pb-1 pt-3 text-[12px] font-semibold text-ink-3">{g.title}</p>
      <ul className="pb-2">{g.items.map((p) => <li key={p.key} className="flex items-start justify-between gap-3 px-5 py-1.5">
        <span className="min-w-0">
          <span className="block text-[15px] text-ink">{p.label}</span>
          <span className="block font-mono text-[12px] text-ink-3">{p.key}</span>
        </span>
        <span className="shrink-0 text-right text-[12px] text-ink-3">{t.from(p.roles.join(", "))}</span>
      </li>)}</ul>
    </div>)
      : <p className="border-t border-hairline px-5 py-4 text-[15px] text-ink-2">{t.noEffective}</p>}
  </section>;
}
