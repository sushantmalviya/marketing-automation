"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bot, ChevronLeft, ContactRound, CreditCard, FileText,
  FolderOpen, Gauge, ListChecks, LogOut, Megaphone,
  Menu, Settings, Share2, SquarePen, Tags, TrendingUp, Users, Workflow, X,
  Search, Bell, Moon, Sun
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getAllowedNavigation, roleFromPath, type ModuleKey } from "@/permissions/permission-matrix";
import { useTheme } from "@/providers/theme-provider";

/* ── nav data ── */
const labels: Record<ModuleKey, string> = {
  dashboard:"Dashboard", admins:"Administrators", users:"Users",
  analytics:"Analytics", audiences:"Segmentation", automations:"Automations",
  campaigns:"Campaigns", channels:"Channels", communications:"Communications",
  content:"Content Studio", customers:"Customers", forms:"Forms",
  tasks:"Tasks", templates:"Templates", assets:"Asset Library",
};

const superNavigation = [
  {group:"Overview",   items:[{key:"dashboard",  label:"Dashboard",      icon:Gauge}]},
  {group:"MANAGEMENT", items:[{key:"admins",      label:"Manage Admins",  icon:Users},
                              {key:"billing",     label:"Billing & Usage",icon:CreditCard}]},
  {group:"INSIGHTS",   items:[{key:"analytics",   label:"Analytics",      icon:BarChart3},
                              {key:"ai-credits",  label:"AI Credits",     icon:Bot}]},
  {group:"SYSTEM",     items:[{key:"account",     label:"Settings",       icon:Settings}]},
];

const adminNavigation = [
  {key:"dashboard",   label:"Dashboard",           icon:Gauge},
  {key:"users",       label:"Team Management",     icon:Users},
  {key:"contacts",    label:"Contacts",            icon:ContactRound},
  {key:"audiences",   label:"Segmentation",        icon:Tags},
  {key:"tasks",       label:"Task Management",     icon:ListChecks},
  {key:"forms",       label:"Forms",               icon:ListChecks},
  {key:"templates",   label:"Templates",           icon:FileText},
  {key:"campaigns",   label:"Campaigns",           icon:Megaphone},
  {key:"ads",         label:"Ads",                 icon:Megaphone},
  {key:"automations", label:"Workflow Automation", icon:Workflow},
  {key:"channels",    label:"Social Publisher",    icon:Share2},
  {key:"assets",      label:"Asset Library",       icon:FolderOpen},
  {key:"analytics",   label:"Analytics",           icon:BarChart3},
  {key:"account",     label:"Account",             icon:Settings},
];

const userNavigation = [
  {key:"dashboard",   label:"Dashboard",      icon:Gauge},
  {key:"tasks",       label:"My Tasks",       icon:ListChecks},
  {key:"templates",   label:"Templates",      icon:FileText},
  {key:"campaigns",   label:"Campaigns",      icon:Megaphone},
  {key:"content",     label:"Content Studio", icon:SquarePen},
  {key:"assets",      label:"Asset Library",  icon:FolderOpen},
  {key:"performance", label:"My Performance", icon:TrendingUp},
  {key:"account",     label:"Account",        icon:Settings},
];

function initials(email: string, first?: string, last?: string) {
  return first || last
    ? `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase()
    : email.slice(0, 2).toUpperCase();
}

/* ── PortalShell ── */
export function PortalShell({ rolePath, children }: { rolePath: string; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const expected = roleFromPath(rolePath);
  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  
  // Theme toggler
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== expected) router.replace("/forbidden");
  }, [loading, user, expected, router]);

  const standardNav = useMemo(() => user ? getAllowedNavigation(user.role) : [], [user]);

  if (loading || !user || user.role !== expected)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-[#050d1f] text-slate-500">
        <div className="flex items-center gap-3 text-sm">
          <motion.span className="h-2.5 w-2.5 rounded-full bg-blue-500"
            animate={{opacity:[1,.3,1]}} transition={{duration:1.2,repeat:Infinity}}/>
          Verifying session…
        </div>
      </div>
    );

  /* ── nav link renderer ── */
  const renderLink = (key: string, label: string, Icon: any) => {
    const actualHref = `/${rolePath}/${key}`;
    const active = pathname === actualHref;
    
    return (
      <Link
        title={collapsed ? label : undefined}
        key={key}
        href={actualHref}
        onClick={() => setOpen(false)}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200 ${
          active 
            ? "bg-[#5b52d6] text-white shadow-sm" 
            : "text-[#a0a8be] hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2 : 1.5} className={active ? "text-white" : "text-[#a0a8be] group-hover:text-white"} />
        {!collapsed && <span className="text-[13px] font-medium tracking-wide">{label}</span>}
      </Link>
    );
  };

  const navGroups = rolePath === "super-admin" 
    ? superNavigation 
    : [{ items: rolePath === "admin" ? adminNavigation : userNavigation }];

  /* ── sidebar JSX ── */
  const sidebar = (
    <motion.aside
      animate={{ width: collapsed ? 76 : 280 }}
      transition={{ duration: 0.30, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full flex-col bg-[#1a1d2d] text-white"
      style={{ contain:"layout" }}
    >
      {/* ── Brand header ── */}
      <div className="flex h-[76px] shrink-0 items-center gap-3 px-5 border-b border-[#2d3348]">
        <div className="shrink-0 flex items-center justify-center" style={{width: 36, height: 36}}>
          <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <motion.div className="min-w-0" initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{duration:0.22}}>
            <strong className="block truncate text-[13px] font-bold tracking-tight text-white mt-0.5">
              MARKETING-AUTOMATION
            </strong>
          </motion.div>
        )}
        <button aria-label="Close navigation" className="ml-auto text-slate-400 hover:text-white md:hidden"
          onClick={() => setOpen(false)}>
          <X size={20}/>
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-5">
        {navGroups.map((group, idx) => (
          <div key={idx} className="relative">
            {group.group && !collapsed && (
              <div className="mb-2.5 mt-1 px-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6a7592]">
                  {group.group}
                </p>
              </div>
            )}
            <div className="space-y-0.5 relative z-10">
              {group.items.map(i => renderLink(i.key, i.label, i.icon))}
            </div>
            {/* Dotted line after group if not the last one */}
            {idx < navGroups.length - 1 && !collapsed && (
              <div className="absolute -bottom-3 left-3 right-3 border-b border-dashed border-[#2d3348]" />
            )}
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className="shrink-0 p-4 border-t border-[#2d3348]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid shrink-0 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-md"
              style={{ width:40, height:40 }}>
              {initials(user.email, user.first_name, user.last_name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">
                  {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email.split('@')[0]}
                </p>
                <p className="truncate text-[11px] font-medium text-[#a0a8be] uppercase tracking-wider mt-0.5">
                  {user.role.replaceAll("_"," ")}
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button aria-label="Collapse" onClick={() => setCollapsed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition">
              <ChevronLeft size={18}/>
            </button>
          )}
          {collapsed && (
            <button aria-label="Expand" onClick={() => setCollapsed(false)}
              className="mx-auto mt-2 text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition">
              <ChevronLeft size={18} className="rotate-180"/>
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );

  /* ── Shell layout ── */
  return (
    <div className="admin-motion-shell min-h-screen bg-slate-50 dark:bg-[#050d1f] flex flex-col md:flex-row">

      {/* desktop sidebar placeholder for layout spacing */}
      <div className={`hidden md:block shrink-0 transition-[width] duration-300 ${collapsed ? "w-[76px]" : "w-[280px]"}`} />

      {/* fixed desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 bottom-0 shadow-2xl z-20 bg-[#1a1d2d]" style={{ width: collapsed ? 76 : 280 }}>
        {sidebar}
      </div>

      {/* mobile sidebar overlay */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 md:hidden"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <button className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}/>
            <motion.div className="relative h-full w-[280px] bg-[#161b2a]"
              initial={{x:-280}} animate={{x:0}} exit={{x:-280}}
              transition={{duration:0.28, ease:[0.4,0,0.2,1]}}>
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* main content */}
      <main className="min-w-0 relative flex flex-col min-h-screen bg-[#f9fafb] dark:bg-[#050d1f] flex-1">
        
        {/* Top Header */}
        <header className="sticky top-0 z-10 flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm transition-colors dark:border-white/5 dark:bg-[#0c1222]">
          <div className="flex items-center gap-4 flex-1">
            <button aria-label="Open navigation"
              className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={() => setOpen(true)}>
              <Menu size={24}/>
            </button>
            <div className="hidden md:flex relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full bg-slate-100 dark:bg-white/5 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm rounded-full pl-10 pr-4 py-2.5 outline-none transition-all dark:text-slate-200"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-5">
            <button 
              onClick={toggle}
              className="relative p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <Sun size={20} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon size={20} className="absolute top-2 left-2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
            
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-[#060d1e] rounded-full"></span>
            </button>

            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden sm:block"></div>
            
            <div className="flex items-center gap-3">
              <div className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-sm">
                {initials(user.email, user.first_name, user.last_name)}
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email.split('@')[0]}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {user.role.replaceAll("_"," ")}
                </p>
              </div>
              <button aria-label="Log out" onClick={() => void logout()} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-1">
                <LogOut size={16}/>
              </button>
            </div>
          </div>
        </header>

        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="admin-page-transition p-4 sm:p-6 lg:p-8 flex-1"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
