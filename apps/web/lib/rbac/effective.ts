import { localizedPermissionGroups, otherGroupTitle, permissionLabel } from "./labels";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

type Role = { id: string; name: string; role_permissions: { permission_key: string }[] };

/**
 * What a user can actually do: the union of the permissions of their roles,
 * grouped like the role editor, each with the role(s) that grant it. Shown in
 * the user inspector on /admin/access so an administrator does not have to
 * open every role to find out.
 *
 * Display only — the database computes access itself (has_permission).
 */
export function effectivePermissions(roles: readonly Role[], roleIds: readonly string[], locale: Locale = defaultLocale) {
  const permissionGroups = localizedPermissionGroups(locale);
  const from = new Map<string, string[]>();
  for (const r of roles) if (roleIds.includes(r.id))
    for (const { permission_key } of r.role_permissions) from.set(permission_key, [...(from.get(permission_key) ?? []), r.name]);
  const known = new Set(permissionGroups.flatMap((g) => g.keys as string[]));
  const item = (key: string) => ({ key, label: permissionLabel(key, locale), roles: from.get(key)! });
  const groups = [
    ...permissionGroups.map((g) => ({ title: g.title, items: (g.keys as string[]).filter((k) => from.has(k)).map(item) })),
    { title: otherGroupTitle[locale], items: [...from.keys()].filter((k) => !known.has(k)).sort().map(item) },
  ].filter((g) => g.items.length);
  return { total: from.size, groups };
}
