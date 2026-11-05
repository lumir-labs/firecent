/**
 * Active-state helpers for navigation menus.
 *
 * Matching is EXACT only (trailing-slash tolerant) and a section (tab/bar
 * category) highlights when one of its items — or the section itself — is the
 * current path. Prefix matching is intentionally NOT used here:
 * `startsWith("/")` lit up the Dashboard on every page and
 * `/organization/api-keys` lit up BOTH the Organization and the API-keys tabs
 * at once (double highlight). One page = one highlighted item/tab, always.
 */

export function isMenuActive(pathName: string, itemPath: string): boolean {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return norm(pathName) === norm(itemPath);
}

export type NavSection = {
  path?: string;
  items?: Array<{ path: string }>;
};

export function isMenuSectionActive(
  pathName: string,
  section: NavSection,
): boolean {
  const sectionActive =
    section.path !== undefined ? isMenuActive(pathName, section.path) : false;
  const itemsActive = section.items?.some((item) =>
    isMenuActive(pathName, item.path),
  );
  return sectionActive || Boolean(itemsActive);
}
