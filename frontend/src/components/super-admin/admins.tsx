"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
  ToggleLeft,
  ToggleRight,
  Mail,
  Phone,
  Shield,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { accountService } from "@/services/account.service";
import { apiClient, parseApiError } from "@/services/api-client";
import { superAdminService, type AdminRecord } from "@/services/super-admin.service";

type Kind = "admins" | "users";
type Row = {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  mobile_no?: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
};
const emptyForm = { first_name: "", last_name: "", email: "", mobile_no: "", password: "" };

export function SuperAdminAdmins({ kind = "admins" }: { kind?: Kind }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [viewAdmin, setViewAdmin] = useState<AdminRecord | null>(null);

  const query = useQuery({
    queryKey: ["sa-accounts", kind, page, search],
    queryFn: () =>
      kind === "admins"
        ? superAdminService.admins({ page, search })
        : apiClient.get("/api/users/", { params: { page, search } }).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () =>
      kind === "admins" ? accountService.createAdmin(form) : accountService.createUser(form),
    onSuccess: () => {
      toast.success("User created successfully");
      setOpen(false);
      setShowPassword(false);
      setForm(emptyForm);
      void client.invalidateQueries({ queryKey: ["sa-accounts", kind] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      kind === "admins" ? accountService.deleteAdmin(id) : accountService.deleteUser(id),
    onSuccess: () => {
      toast.success("Account removed");
      void client.invalidateQueries({ queryKey: ["sa-accounts", kind] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      superAdminService.toggleAdminStatus(id, is_active),
    onSuccess: (updated) => {
      toast.success(`User ${updated.is_active ? "activated" : "deactivated"} successfully`);
      void client.invalidateQueries({ queryKey: ["sa-accounts", kind] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const data = query.data as { count?: number; results?: Row[] } | undefined;
  const rows = data?.results ?? [];
  const personLabel = "User";

  function getDisplayName(row: Row) {
    return (
      row.full_name ||
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      "Name not set"
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          {kind !== "users" && <h1 className="sa-title">MANAGE USERS</h1>}
          <p className={kind === "users" ? "text-sm text-slate-500" : "sa-subtitle"}>
            {data?.count ?? 0} database-backed accounts
          </p>
        </div>
        <button className="primary-button px-5" onClick={() => setOpen(true)}>
          <Plus size={19} />
          Add {personLabel}
        </button>
      </div>

      <section className="sa-card overflow-hidden p-5">
        <label className="relative block max-w-md">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={19} />
          <input
            aria-label="Search accounts"
            className="h-12 w-full rounded-xl border border-slate-200 pl-12 pr-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>

        {query.isLoading ? (
          <div className="mt-5 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div className="h-16 animate-pulse rounded-xl bg-slate-50" key={i} />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-12 text-center text-red-600">{parseApiError(query.error)}</div>
        ) : rows.length ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50/50 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Mobile</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const name = getDisplayName(row);
                  const isToggling =
                    toggleStatus.isPending &&
                    (toggleStatus.variables as { id: number } | undefined)?.id === row.id;
                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035 }}
                      className="border-t border-slate-100 text-sm hover:bg-blue-50/35"
                      key={row.id}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 font-bold text-blue-600">
                            {(name !== "Name not set" ? name : row.email).slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-semibold text-slate-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{row.email}</td>
                      <td className="px-4 py-3.5 text-slate-600">{row.mobile_no || "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {row.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          ● {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          {/* View button */}
                          <button
                            title="View account"
                            className="icon-button text-slate-500"
                            onClick={() => setViewAdmin(row as AdminRecord)}
                          >
                            <Eye size={18} />
                          </button>

                          {/* Toggle status button — only for admins */}
                          {kind === "admins" && (
                            <button
                              title={row.is_active ? "Deactivate account" : "Activate account"}
                              disabled={isToggling}
                              className={`icon-button ${
                                row.is_active ? "text-emerald-600" : "text-amber-500"
                              } disabled:opacity-50`}
                              onClick={() =>
                                toggleStatus.mutate({ id: row.id, is_active: !row.is_active })
                              }
                            >
                              {row.is_active ? (
                                <ToggleRight size={18} />
                              ) : (
                                <ToggleLeft size={18} />
                              )}
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            title="Delete account"
                            className="icon-button text-red-500"
                            onClick={() => {
                              if (confirm(`Delete ${row.email}?`)) remove.mutate(row.id);
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <UserRound className="mx-auto text-slate-300" size={42} />
            <h2 className="mt-3 font-bold">No accounts found</h2>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="secondary-button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="px-3 py-2 text-sm">Page {page}</span>
          <button
            className="secondary-button"
            disabled={!data?.count || page * 10 >= data.count}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>

      {/* ── Create account modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <motion.form
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
                <div>
                  <h2 className="text-xl font-black">
                    Create {personLabel.toLowerCase()} account
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Add a secure account to your workspace
                  </p>
                </div>
                <button
                  aria-label="Close"
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    <span>
                      First name <b className="text-red-500">*</b>
                    </span>
                    <input
                      required
                      autoComplete="given-name"
                      placeholder="Enter first name"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>
                      Last name <b className="text-red-500">*</b>
                    </span>
                    <input
                      required
                      autoComplete="family-name"
                      placeholder="Enter last name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>
                    Email <b className="text-red-500">*</b>
                  </span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="Enter email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>
                    Mobile number <b className="text-red-500">*</b>
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    pattern="[0-9+() -]{7,20}"
                    placeholder="Enter mobile number"
                    value={form.mobile_no}
                    onChange={(e) => setForm({ ...form, mobile_no: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>
                    Temporary password <b className="text-red-500">*</b>
                  </span>
                  <div className="relative">
                    <input
                      required
                      minLength={8}
                      className="!pr-12"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter temporary password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      type="button"
                      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
                  The account is created immediately with the {personLabel.toLowerCase()} role.
                </p>
                <button disabled={create.isPending} className="primary-button w-full">
                  <LockKeyhole size={17} />
                  {create.isPending ? "Creating account…" : "Create securely"}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* ── View admin detail modal ───────────────────────────────────── */}
      <AnimatePresence>
        {viewAdmin && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <h2 className="text-xl font-black">Account Details</h2>
                <button
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
                  onClick={() => setViewAdmin(null)}
                >
                  <X size={19} />
                </button>
              </div>

              {/* Avatar + name */}
              <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-2">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-blue-100 text-2xl font-black text-blue-600">
                  {(
                    viewAdmin.full_name ||
                    [viewAdmin.first_name, viewAdmin.last_name].filter(Boolean).join(" ") ||
                    viewAdmin.email
                  )
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <p className="text-lg font-bold text-slate-900">
                  {viewAdmin.full_name ||
                    [viewAdmin.first_name, viewAdmin.last_name].filter(Boolean).join(" ") ||
                    "Name not set"}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    viewAdmin.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  ● {viewAdmin.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-3 px-6 py-4">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <Mail size={16} className="shrink-0 text-slate-400" />
                  <span className="text-slate-600">{viewAdmin.email}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <Phone size={16} className="shrink-0 text-slate-400" />
                  <span className="text-slate-600">{viewAdmin.mobile_no || "No mobile number"}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <Shield size={16} className="shrink-0 text-slate-400" />
                  <span className="text-slate-600">{viewAdmin.role}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <Calendar size={16} className="shrink-0 text-slate-400" />
                  <span className="text-slate-600">
                    Joined{" "}
                    {viewAdmin.created_at
                      ? new Date(viewAdmin.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {kind === "admins" && (
                <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                  <button
                    disabled={
                      toggleStatus.isPending &&
                      (toggleStatus.variables as { id: number } | undefined)?.id === viewAdmin.id
                    }
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      viewAdmin.is_active
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                    onClick={() => {
                      const next = !viewAdmin.is_active;
                      toggleStatus.mutate(
                        { id: viewAdmin.id, is_active: next },
                        {
                          onSuccess: (updated) => {
                            setViewAdmin(updated as AdminRecord);
                          },
                        }
                      );
                    }}
                  >
                    {viewAdmin.is_active ? (
                      <>
                        <ToggleLeft size={15} className="mr-1 inline" /> Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleRight size={15} className="mr-1 inline" /> Activate
                      </>
                    )}
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                    onClick={() => {
                      if (confirm(`Delete ${viewAdmin.email}?`)) {
                        remove.mutate(viewAdmin.id);
                        setViewAdmin(null);
                      }
                    }}
                  >
                    <Trash2 size={15} className="mr-1 inline" /> Delete
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
