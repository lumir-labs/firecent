import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";

/**
 * Revalidates a route across all locales.
 * ALWAYS use this in server actions instead of revalidatePath with a path without locale.
 *
 * @example revalidateLocalized("/admin/users") -> revalidates /es/admin/users + /en/admin/users
 */
export function revalidateLocalized(href: string) {
  const suffix = href === "/" ? "" : href;
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}${suffix}`);
  }
}
