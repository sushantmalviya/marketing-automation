import { ROLES, type UserRole } from "@/constants/roles";

export type ModuleKey = "dashboard" | "admins" | "users" | "analytics" | "audiences" | "automations" | "campaigns" | "channels" | "communications" | "content" | "customers" | "forms" | "tasks" | "templates" | "ads";
export type Action = "view" | "create" | "update" | "delete" | "approve" | "publish" | "execute" | "send";

const matrix: Record<UserRole, Partial<Record<ModuleKey, readonly Action[]>>> = {
  [ROLES.SUPER_ADMIN]: {
    dashboard: ["view"], admins: ["view", "create", "delete"], analytics: ["view"],
    audiences: ["view", "create"], automations: ["view", "create", "update", "delete", "execute"], campaigns: ["view", "approve"],
    channels: ["view"], communications: ["view", "create"], content: ["view", "approve", "publish"], customers: ["view"], templates: ["view", "create", "update"],
  },
  [ROLES.ADMIN]: {
    dashboard: ["view"], users: ["view", "create", "delete"], analytics: ["view"], audiences: ["view", "create"],
    automations: ["view", "create", "update", "delete", "execute"], campaigns: ["view", "create", "approve"], channels: ["view"],
    communications: ["view", "create"], content: ["view", "create", "update", "approve", "publish"], customers: ["view", "create"], forms: ["view", "create", "update", "delete", "publish"], tasks: ["view", "create", "approve"], templates: ["view", "create", "update"], ads: ["view", "create", "update"],
  },
  [ROLES.USER]: {
    dashboard: ["view"], automations: ["view", "create", "update", "delete", "execute"], campaigns: ["view", "create", "update", "send"],
    channels: ["view"], content: ["view", "create", "update"], customers: ["view", "create"], forms: ["view", "create", "update", "delete", "publish"], tasks: ["view"], templates: ["view", "create", "update"],
  },
};

export function canAccessModule(role: UserRole, module: ModuleKey) { return Boolean(matrix[role][module]?.includes("view")); }
export function canPerformAction(role: UserRole, module: ModuleKey, action: Action) { return Boolean(matrix[role][module]?.includes(action)); }
export function getAllowedNavigation(role: UserRole) { return (Object.keys(matrix[role]) as ModuleKey[]).filter((item) => canAccessModule(role, item)); }
export function getDashboardPath(role: UserRole) { return role === ROLES.SUPER_ADMIN ? "/super-admin/dashboard" : role === ROLES.ADMIN ? "/admin/dashboard" : "/user/dashboard"; }
export function roleFromPath(value: string): UserRole | null { return value === "super-admin" ? ROLES.SUPER_ADMIN : value === "admin" ? ROLES.ADMIN : value === "user" ? ROLES.USER : null; }
