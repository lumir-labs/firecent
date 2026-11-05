"use client";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { stripLocalePrefix } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function Redirect({
  href,
  callbackUrl = false,
}: {
  href?: string;
  callbackUrl?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    // usePathname from @/i18n/navigation already comes without the locale prefix.
    const callback = `${pathname}?${searchParams.toString()}`;
    if (callbackUrl) {
      const raw = searchParams.get("callbackUrl") || DEFAULT_LOGIN_REDIRECT;
      // Strip the prefix in case it comes with a locale: the localized router re-adds it.
      router.push(stripLocalePrefix(raw));
      return;
    } else if (href) {
      router.push(`${href}?callbackUrl=${encodeURIComponent(callback)}`);
    } else {
      router.push(DEFAULT_LOGIN_REDIRECT);
    }
  });
  return null;
}
