import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Lightweight wrappers over Next.js navigation that add the locale prefix by themselves.
// ALWAYS use these instead of next/link and next/navigation for pages.
// Exception: useSearchParams still comes from next/navigation, native <a> for /api/*.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
