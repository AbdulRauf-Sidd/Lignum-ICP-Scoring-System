export const APP_MODULES = ["prospects", "oversight", "accounts", "admin"] as const;
export type AppModule = (typeof APP_MODULES)[number];

export const DEFAULT_USER_MODULES: AppModule[] = ["prospects"];

export const MODULE_LABELS: Record<AppModule, string> = {
  prospects: "Prospects",
  oversight: "Oversight",
  accounts: "Accounts",
  admin: "Admin",
};

export const MODULE_DESCRIPTIONS: Record<AppModule, string> = {
  prospects: "Triage, target list, contacts, import and queue",
  oversight: "Usage and audit, analytics",
  accounts: "Accounts",
  admin: "Model config, users",
};

export const MODULE_PATHS: Record<AppModule, string[]> = {
  prospects: ["/import", "/triage", "/target-list", "/contacts"],
  oversight: ["/usage", "/analytics"],
  accounts: ["/accounts"],
  admin: ["/admin"],
};

export function normalizeModules(value: unknown, legacyRole?: unknown): AppModule[] {
  if (!Array.isArray(value)) return legacyRole === "admin" ? [...APP_MODULES] : [...DEFAULT_USER_MODULES];
  const selected = APP_MODULES.filter((module) => value.includes(module));
  return selected.includes("prospects") ? selected : [...DEFAULT_USER_MODULES, ...selected];
}

export function hasModuleAccess(user: { modules: AppModule[] }, module: AppModule): boolean {
  return user.modules.includes(module);
}

export function getModuleForPath(pathname: string): AppModule | null {
  return APP_MODULES.find((module) => MODULE_PATHS[module].some((path) => pathname === path || pathname.startsWith(`${path}/`))) ?? null;
}
