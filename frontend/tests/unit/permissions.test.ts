import { describe, expect, it } from "vitest";
import { ROLES } from "@/constants/roles";
import { canAccessModule, canPerformAction, getDashboardPath } from "@/permissions/permission-matrix";

describe("verified role permissions", () => {
  it("centralizes dashboard redirects", () => {
    expect(getDashboardPath(ROLES.ADMIN)).toBe("/admin/dashboard");
    expect(getDashboardPath(ROLES.USER)).toBe("/user/dashboard");
  });
  it("does not allow standard users to access admin management", () => {
    expect(canAccessModule(ROLES.USER, "admins")).toBe(false);
    expect(canPerformAction(ROLES.USER, "admins", "delete")).toBe(false);
  });
});
