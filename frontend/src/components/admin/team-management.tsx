"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { accountService } from "@/services/account.service";
import { apiClient, parseApiError } from "@/services/api-client";

type UserRow={id:number;first_name:string;last_name:string;email:string;mobile_no:string|null;role:string;is_active:boolean;created_at:string|null};
type Form={first_name:string;last_name:string;email:string;mobile_no:string;password:string;is_active:boolean};
const empty:Form={first_name:"",last_name:"",email:"",mobile_no:"",password:"",is_active:true};

export function TeamManagement(){
  const client=useQueryClient(); const [search,setSearch]=useState(""); const [page,setPage]=useState(1); const [mode,setMode]=useState<"create"|"view"|"edit"|null>(null); const [selected,setSelected]=useState<UserRow|null>(null); const [showPassword,setShowPassword]=useState(false); const [form,setForm]=useState<Form>(empty);
  const query=useQuery({queryKey:["team-users",page,search],queryFn:async()=>(await apiClient.get<{count:number;results:UserRow[]}>("/api/users/",{params:{page,search}})).data});
  const refresh=()=>client.invalidateQueries({queryKey:["team-users"]});
  const create=useMutation({mutationFn:()=>accountService.createUser(form),onSuccess:()=>{toast.success("User created");close();void refresh()},onError:e=>toast.error(parseApiError(e))});
  const update=useMutation({mutationFn:()=>apiClient.patch(`/api/auth/users/${selected?.id}/`,{first_name:form.first_name,last_name:form.last_name,email:form.email,mobile_no:form.mobile_no,is_active:form.is_active}),onSuccess:()=>{toast.success("User updated");close();void refresh()},onError:e=>toast.error(parseApiError(e))});
  const remove=useMutation({mutationFn:(id:number)=>accountService.deleteUser(id),onSuccess:()=>{toast.success("User deleted");void refresh()},onError:e=>toast.error(parseApiError(e))});
  const close=()=>{setMode(null);setSelected(null);setForm(empty);setShowPassword(false)};
  const openRow=(row:UserRow,next:"view"|"edit")=>{setSelected(row);setForm({first_name:row.first_name,last_name:row.last_name,email:row.email,mobile_no:row.mobile_no??"",password:"",is_active:row.is_active});setMode(next)};
  const rows=query.data?.results??[];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            TEAM WORKSPACE
          </span>
          <h1 className="page-title mt-2">Team Management</h1>
          <p className="page-subtitle">{query.data?.count??0} operational user accounts</p>
        </div>
        <button className="primary-button text-[14px]" onClick={()=>setMode("create")}>
          <Plus size={18}/>Create user
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] dark:bg-[#0c1222] dark:border-white/5 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#0c1222]/50 p-5">
          <label className="relative block">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18}/>
            <input className="h-12 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-11 pr-4 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 text-slate-900 dark:text-white" placeholder="Search users…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
          </label>
        </div>
        
        {query.isLoading ? (
          <div className="space-y-3 p-5">
            {[1,2,3].map(i=><div className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" key={i}/>)}
          </div>
        ) : query.isError ? (
          <div className="p-12 text-center text-red-600">{parseApiError(query.error)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-white/5 text-[11px] uppercase tracking-[.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">First name</th>
                  <th>Last name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row=> (
                  <tr className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors" key={row.id}>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{row.first_name||"—"}</td>
                    <td className="text-slate-700 dark:text-slate-300">{row.last_name||"—"}</td>
                    <td className="text-slate-700 dark:text-slate-300">{row.email}</td>
                    <td className="text-slate-700 dark:text-slate-300">{row.mobile_no||"—"}</td>
                    <td><span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">{row.role}</span></td>
                    <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.is_active?"bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400":"bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"}`}>{row.is_active?"Active":"Inactive"}</span></td>
                    <td className="text-slate-500 dark:text-slate-400">{row.created_at?new Date(row.created_at).toLocaleDateString():"—"}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="icon-button text-indigo-600 dark:text-indigo-400" title="View user" onClick={()=>openRow(row,"view")}><Eye size={17}/></button>
                        <button className="icon-button text-amber-600 dark:text-amber-400" title="Edit user" onClick={()=>openRow(row,"edit")}><Pencil size={17}/></button>
                        <button className="icon-button text-red-500 dark:text-red-400" title="Delete user" onClick={()=>{if(confirm(`Delete ${row.email}? This cannot be undone.`))remove.mutate(row.id)}}><Trash2 size={17}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length&&<div className="p-12 text-center text-slate-500">No users found.</div>}
          </div>
        )}
        
        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-white/5 p-4 bg-slate-50/50 dark:bg-[#0c1222]/50">
          <button className="secondary-button text-[13px]" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
          <span className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 font-medium">Page {page}</span>
          <button className="secondary-button text-[13px]" disabled={!query.data?.count||page*10>=query.data.count} onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>
      </section>

      {mode && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <form className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-[#0c1222] dark:border dark:border-white/10" onSubmit={e=>{e.preventDefault();if(mode==="create")create.mutate();else if(mode==="edit")update.mutate()}}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white dark:bg-[#0c1222] px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">{mode==="create"?"Create user":mode==="edit"?"Edit user":"User details"}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{mode==="view"?"Review account information":"Manage the user account securely"}</p>
              </div>
              <button type="button" className="icon-button" onClick={close}><X/></button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="field">
                <span className="text-slate-700 dark:text-slate-300">First name *</span>
                <input required disabled={mode==="view"} value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})} className="dark:bg-white/5 dark:border-white/10 dark:text-white"/>
              </label>
              <label className="field">
                <span className="text-slate-700 dark:text-slate-300">Last name *</span>
                <input required disabled={mode==="view"} value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})} className="dark:bg-white/5 dark:border-white/10 dark:text-white"/>
              </label>
              <label className="field sm:col-span-2">
                <span className="text-slate-700 dark:text-slate-300">Email *</span>
                <input required disabled={mode==="view"} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="dark:bg-white/5 dark:border-white/10 dark:text-white"/>
              </label>
              <label className="field sm:col-span-2">
                <span className="text-slate-700 dark:text-slate-300">Mobile number *</span>
                <input required disabled={mode==="view"} type="tel" pattern="[0-9+() -]{7,20}" value={form.mobile_no} onChange={e=>setForm({...form,mobile_no:e.target.value})} className="dark:bg-white/5 dark:border-white/10 dark:text-white"/>
              </label>
              {mode==="create"&& (
                <label className="field sm:col-span-2">
                  <span className="text-slate-700 dark:text-slate-300">Temporary password *</span>
                  <div className="relative">
                    <input required minLength={8} className="!pr-12 dark:bg-white/5 dark:border-white/10 dark:text-white" type={showPassword?"text":"password"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
                    <button aria-label="Toggle password visibility" type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" onClick={()=>setShowPassword(v=>!v)}>
                      {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
                    </button>
                  </div>
                </label>
              )}
              {mode!=="create"&& (
                <label className="field sm:col-span-2">
                  <span className="text-slate-700 dark:text-slate-300">Status</span>
                  <select disabled={mode==="view"} value={form.is_active?"active":"inactive"} onChange={e=>setForm({...form,is_active:e.target.value==="active"})} className="dark:bg-white/5 dark:border-white/10 dark:text-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              )}
              {mode!=="view"&& (
                <button className="primary-button sm:col-span-2 mt-2" disabled={create.isPending||update.isPending}>
                  {create.isPending||update.isPending?"Saving…":mode==="create"?"Create securely":"Save changes"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
