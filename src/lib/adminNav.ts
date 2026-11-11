/**
 * Visibility rules for Admin navigation menus (desktop Sidebar + mobile bottom bar).
 * Kept dependency-free so Node tests verify the exact filtering logic used by UI shells.
 */
export const AI_MENU_PATHS = ["/agent-inbox", "/agent-config"] as const;

export interface NavVisibilityContext {
  isManager: boolean;
  aiNavEnabled: boolean;
}

export function isAiMenuPath(href: string): boolean {
  return (AI_MENU_PATHS as readonly string[]).includes(href);
}

export function filterSidebarManagerItems<T extends { href: string }>(
  items: readonly T[],
  ctx: NavVisibilityContext,
): T[] {
  if (!ctx.isManager) return [];
  return items.filter((item) => !isAiMenuPath(item.href) || ctx.aiNavEnabled);
}

export function showMobileAiNavButton(ctx: NavVisibilityContext): boolean {
  return ctx.isManager && ctx.aiNavEnabled;
}

