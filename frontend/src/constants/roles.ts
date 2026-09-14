export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export function isUserRole(value: unknown): value is UserRole {
  return Object.values(ROLES).includes(value as UserRole);
}
