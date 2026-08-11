"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bot, ChevronLeft, ContactRound, CreditCard,
  FolderOpen, Gauge, ListChecks, LogOut, Megaphone,
  Menu, Settings, Share2, SquarePen, Tags, TrendingUp, Users, Workflow, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getAllowedNavigation, roleFromPath, type ModuleKey } from "@/permissions/permission-matrix";

/* ── nav data ── */
const labels: Record<ModuleKey, string> = {
  dashboard:"Dashboard", admins:"Administrators", users:"Users",
  analytics:"Analytics", audiences:"Segmentation", automations:"Automations",
  campaigns:"Campaigns", channels:"Channels", communications:"Communications",
  content:"Content Studio", customers:"Customers", forms:"Forms",
  tasks:"Tasks", templates:"Templates",
};
const superNavigation = [
  {group:"Overview",   items:[{key:"dashboard",  label:"Dashboard",      icon:Gauge}]},
  {group:"Management", items:[{key:"admins",      label:"Manage Admins",  icon:Users},
                              {key:"billing",     label:"Billing & Usage",icon:CreditCard}]},
  {group:"Insights",   items:[{key:"analytics",   label:"Analytics",      icon:BarChart3},
                              {key:"ai-credits",  label:"AI Credits",     icon:Bot}]},
  {group:"System",     items:[{key:"account",     label:"Account",        icon:Settings}]},
];
const adminNavigation = [
  {key:"dashboard",   label:"Dashboard",           icon:Gauge},
  {key:"users",       label:"Team Management",     icon:Users},
  {key:"contacts",    label:"Contacts",            icon:ContactRound},
  {key:"audiences",   label:"Segmentation",        icon:Tags},
  {key:"tasks",       label:"Task Management",     icon:ListChecks},
  {key:"forms",       label:"Forms",               icon:ListChecks},
  {key:"campaigns",   label:"Campaigns",           icon:Megaphone},
  {key:"automations", label:"Workflow Automation", icon:Workflow},
  {key:"channels",    label:"Social Publisher",    icon:Share2},
  {key:"analytics",   label:"Analytics",           icon:BarChart3},
  {key:"account",     label:"Account",             icon:Settings},
];
const userNavigation = [
  {key:"dashboard",   label:"Dashboard",      icon:Gauge},
  {key:"tasks",       label:"My Tasks",       icon:ListChecks},
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

/* ─────────────────────────────────────────────
   PREMIUM ANIMATED SIDEBAR BACKGROUND
   ───────────────────────────────────────────── */
function SidebarBg() {
  /* particles: [leftPct, bottomPct, delayS, size] */
  const particles: [number, number, number, number][] = [
    [8,  18, 0.0, 2], [18, 32, 0.6, 3], [5,  45, 1.3, 2],
    [35, 22, 1.9, 2], [24, 55, 2.7, 3], [48, 16, 0.9, 2],
    [14, 68, 3.4, 2], [38, 40, 2.2, 3], [55, 28, 0.4, 2],
    [10, 78, 1.8, 2], [42, 62, 3.1, 3], [28, 82, 0.2, 2],
    [62, 50, 1.1, 2], [70, 35, 2.5, 3], [6,  90, 3.8, 2],
    [52, 75, 0.7, 2], [80, 20, 1.6, 2], [20, 92, 2.9, 3],
  ];

  const streaks: [number, number, number, number][] = [
    [5,  12, 0.0, 55], [12, 20, 1.2, 42], [3,  30, 2.4, 68],
    [18, 8,  0.8, 35], [8,  38, 3.1, 50],
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* ── 1. Deep navy base ── */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(160deg,#050d1f 0%,#070f22 40%,#060c1c 70%,#04091a 100%)"
      }}/>

      {/* ── 2. Subtle dot-grid texture ── */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, rgba(96,165,250,0.06) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}/>

      {/* ── 3. Large deep aurora — bottom-left ── */}
      <motion.div className="absolute rounded-full" style={{
        bottom: "-30%", left: "-30%",
        width: "120%", height: "80%",
        background: "radial-gradient(ellipse at 25% 75%, #1e40af 0%, #1d4ed8 25%, #1e3a8a 50%, transparent 72%)",
        filter: "blur(55px)",
      }}
        animate={{ scale:[1,1.1,1], opacity:[0.55,0.78,0.55] }}
        transition={{ duration:7, repeat:Infinity, ease:"easeInOut" }}
      />

      {/* ── 4. Bright electric core ── */}
      <motion.div className="absolute rounded-full" style={{
        bottom: "-8%", left: "-12%",
        width: "70%", height: "48%",
        background: "radial-gradient(ellipse at 35% 65%, #3b82f6 0%, #2563eb 30%, transparent 65%)",
        filter: "blur(36px)",
      }}
        animate={{ scale:[1,1.22,1], opacity:[0.5,0.75,0.5] }}
        transition={{ duration:9, repeat:Infinity, ease:"easeInOut", delay:1.8 }}
      />

      {/* ── 5. Cyan mid accent ── */}
      <motion.div className="absolute rounded-full" style={{
        bottom: "30%", left: "-20%",
        width: "60%", height: "35%",
        background: "radial-gradient(ellipse, #0ea5e9 0%, #0284c7 38%, transparent 70%)",
        filter: "blur(50px)",
      }}
        animate={{ scale:[1,1.15,1], opacity:[0.12,0.22,0.12] }}
        transition={{ duration:11, repeat:Infinity, ease:"easeInOut", delay:3.5 }}
      />

      {/* ── 6. Indigo upper-right accent ── */}
      <motion.div className="absolute rounded-full" style={{
        top: "-15%", right: "-25%",
        width: "55%", height: "45%",
        background: "radial-gradient(ellipse, #4f46e5 0%, #3730a3 40%, transparent 70%)",
        filter: "blur(60px)",
      }}
        animate={{ scale:[1,1.08,1], opacity:[0.08,0.16,0.08] }}
        transition={{ duration:13, repeat:Infinity, ease:"easeInOut", delay:2 }}
      />

      {/* ── 7. Animated wave SVG — three layered waves ── */}
      <svg aria-hidden className="absolute bottom-0 left-0 w-full" style={{height:200}}
        viewBox="0 0 300 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1d4ed8" stopOpacity="0.9"/>
            <stop offset="50%"  stopColor="#1e3a8a" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0"/>
          </linearGradient>
          <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0"/>
          </linearGradient>
          <linearGradient id="wg3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.0"/>
          </linearGradient>
          <linearGradient id="wg4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#bfdbfe" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.0"/>
          </linearGradient>
          {/* Glow filter for wave crests */}
          <filter id="wglow" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Wave 1 — deep back */}
        <motion.path fill="url(#wg1)" animate={{d:[
          "M-5 110 C30 75, 80 55, 130 80 C180 105, 240 95, 305 70 L305 200 L-5 200 Z",
          "M-5 125 C30 90, 80 70, 130 95 C180 120, 240 108, 305 85 L305 200 L-5 200 Z",
          "M-5 110 C30 75, 80 55, 130 80 C180 105, 240 95, 305 70 L305 200 L-5 200 Z",
        ]}} transition={{duration:8, repeat:Infinity, ease:"easeInOut"}}/>

        {/* Wave 2 — mid */}
        <motion.path fill="url(#wg2)" filter="url(#wglow)" animate={{d:[
          "M-5 130 C40 100, 95 88, 150 108 C205 128, 260 115, 305 100 L305 200 L-5 200 Z",
          "M-5 142 C40 114, 95 102, 150 120 C205 140, 260 126, 305 113 L305 200 L-5 200 Z",
          "M-5 130 C40 100, 95 88, 150 108 C205 128, 260 115, 305 100 L305 200 L-5 200 Z",
        ]}} transition={{duration:10, repeat:Infinity, ease:"easeInOut", delay:1.5}}/>

        {/* Wave 3 — front bright */}
        <motion.path fill="url(#wg3)" filter="url(#wglow)" animate={{d:[
          "M-5 152 C50 132, 110 122, 165 138 C220 154, 270 142, 305 130 L305 200 L-5 200 Z",
          "M-5 162 C50 144, 110 134, 165 148 C220 164, 270 152, 305 142 L305 200 L-5 200 Z",
          "M-5 152 C50 132, 110 122, 165 138 C220 154, 270 142, 305 130 L305 200 L-5 200 Z",
        ]}} transition={{duration:7, repeat:Infinity, ease:"easeInOut", delay:0.8}}/>

        {/* Wave 4 — shimmer crest */}
        <motion.path fill="url(#wg4)" animate={{d:[
          "M-5 170 C60 158, 120 150, 180 162 C238 174, 278 165, 305 158 L305 200 L-5 200 Z",
          "M-5 178 C60 166, 120 160, 180 170 C238 182, 278 173, 305 166 L305 200 L-5 200 Z",
          "M-5 170 C60 158, 120 150, 180 162 C238 174, 278 165, 305 158 L305 200 L-5 200 Z",
        ]}} transition={{duration:6, repeat:Infinity, ease:"easeInOut", delay:2.2}}/>
      </svg>

      {/* ── 8. Light streaks near bottom ── */}
      {streaks.map(([l, b, delay, w], i) => (
        <motion.div key={`streak-${i}`} className="absolute rounded-full" style={{
          left: `${l}%`, bottom: `${b}%`,
          width: `${w}px`, height: "1.5px",
          background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.7), transparent)",
          filter: "blur(1px)",
        }}
          animate={{ opacity:[0, 0.8, 0], scaleX:[0.3, 1, 0.3], x:[0, 20, 40] }}
          transition={{ duration:2.8+i*0.4, repeat:Infinity, ease:"easeInOut", delay }}
        />
      ))}

      {/* ── 9. Floating glow particles / stars ── */}
      {particles.map(([l, b, delay, sz], i) => (
        <motion.div key={`p-${i}`} className="absolute rounded-full" style={{
          left: `${l}%`, bottom: `${b}%`,
          width: `${sz}px`, height: `${sz}px`,
          background: i % 5 === 0 ? "#bfdbfe"
                    : i % 3 === 0 ? "#93c5fd"
                    : "#60a5fa",
          boxShadow: i % 5 === 0
            ? `0 0 ${sz*3}px ${sz}px #bfdbfe, 0 0 ${sz*6}px #93c5fd`
            : i % 3 === 0
            ? `0 0 ${sz*3}px ${sz}px #93c5fd, 0 0 ${sz*6}px #3b82f6`
            : `0 0 ${sz*2}px ${sz}px #60a5fa, 0 0 ${sz*5}px #2563eb`,
        }}
          animate={{
            y: [0, -(14 + i % 8), 0],
            opacity: [0.08, i % 4 === 0 ? 1 : 0.85, 0.08],
            scale: [1, 1.5, 1],
          }}
          transition={{ duration: 3.0 + i * 0.22, repeat:Infinity, ease:"easeInOut", delay }}
        />
      ))}

      {/* ── 10. Horizontal scan line ── */}
      <motion.div className="absolute left-0 right-0" style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.15) 20%, rgba(96,165,250,0.4) 50%, rgba(96,165,250,0.15) 80%, transparent 100%)",
      }}
        animate={{ bottom:["0%","100%"], opacity:[0,0.6,0] }}
        transition={{ duration:14, repeat:Infinity, ease:"linear", delay:4 }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   PREMIUM ANIMATED MAIN BACKGROUND (DARK MODE)
   ───────────────────────────────────────────── */
function MainBg() {
  /* Random scattered particles */
  const particles: [number, number, number, number][] = [
    [12, 85, 0.2, 2], [28, 45, 1.5, 3], [45, 75, 0.8, 2],
    [65, 35, 2.2, 3], [82, 60, 1.1, 2], [90, 20, 2.8, 2],
    [55, 90, 3.4, 3], [15, 25, 0.5, 2], [38, 15, 1.8, 2],
    [75, 80, 2.5, 3], [5,  55, 3.1, 2], [88, 92, 0.9, 2],
  ];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden dark:block">
      {/* 1. Deep navy to abyss base */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(135deg, #050d1f 0%, #061026 50%, #030814 100%)"
      }}/>

      {/* 2. Expansive subtle dot-grid texture */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, rgba(96,165,250,0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}/>

      {/* 3. Massive ambient blue aurora (Top Right) */}
      <motion.div className="absolute rounded-full" style={{
        top: "-20%", right: "-10%",
        width: "60vw", height: "60vw",
        background: "radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, rgba(29,78,216,0.03) 40%, transparent 70%)",
        filter: "blur(60px)",
      }}
        animate={{ scale:[1, 1.1, 1], opacity:[0.6, 0.9, 0.6] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 4. Deep Indigo aurora (Bottom Left) */}
      <motion.div className="absolute rounded-full" style={{
        bottom: "-10%", left: "-15%",
        width: "50vw", height: "50vw",
        background: "radial-gradient(ellipse, rgba(79,70,229,0.06) 0%, rgba(67,56,202,0.02) 50%, transparent 70%)",
        filter: "blur(60px)",
      }}
        animate={{ scale:[1, 1.15, 1], opacity:[0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* 5. Electric Cyan glow (Center subtle) */}
      <motion.div className="absolute rounded-full" style={{
        top: "40%", left: "30%",
        width: "40vw", height: "30vw",
        background: "radial-gradient(ellipse, rgba(14,165,233,0.03) 0%, transparent 60%)",
        filter: "blur(50px)",
      }}
        animate={{ scale:[1, 1.2, 1], opacity:[0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* 6. Floating Particles */}
      {particles.map(([l, t, delay, sz], i) => (
        <motion.div key={`mp-${i}`} className="absolute rounded-full" style={{
          left: `${l}%`, top: `${t}%`,
          width: `${sz}px`, height: `${sz}px`,
          background: i % 2 === 0 ? "#bfdbfe" : "#60a5fa",
          boxShadow: i % 2 === 0 
            ? `0 0 ${sz*3}px ${sz}px #bfdbfe, 0 0 ${sz*6}px #93c5fd` 
            : `0 0 ${sz*2}px ${sz}px #60a5fa, 0 0 ${sz*5}px #2563eb`,
        }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
            scale: [0.8, 1.5, 0.8],
          }}
          transition={{ duration: 6 + (i % 4), repeat: Infinity, ease: "easeInOut", delay }}
        />
      ))}

      {/* 7. Animated perspective grid on the floor */}
      <div className="absolute inset-x-0 bottom-0 h-[40vh] opacity-20" style={{
        background: "linear-gradient(to top, rgba(37,99,235,0.05) 0%, transparent 100%)",
        maskImage: "linear-gradient(to top, black 0%, transparent 100%)",
      }}>
        <motion.div className="absolute inset-0" style={{
          transform: "perspective(500px) rotateX(60deg) scale(2)",
          transformOrigin: "bottom center",
          backgroundImage: "linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
          animate={{ backgroundPosition: ["0px 0px", "0px 40px"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}

/* ── PortalShell ── */
export function PortalShell({ rolePath, children }: { rolePath: string; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const expected = roleFromPath(rolePath);
  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user && user.role !== expected) router.replace("/forbidden");
  }, [loading, user, expected, router]);

  const standardNav = useMemo(() => user ? getAllowedNavigation(user.role) : [], [user]);

  if (loading || !user || user.role !== expected)
    return (
      <div className="grid min-h-screen place-items-center bg-[#06101f] text-white">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <motion.span className="h-2.5 w-2.5 rounded-full bg-blue-500"
            animate={{opacity:[1,.3,1]}} transition={{duration:1.2,repeat:Infinity}}/>
          Verifying session…
        </div>
      </div>
    );

  /* ── nav link renderer ── */
  const link = (key: string, label: string, Icon: typeof Gauge) => {
    const href   = `/${rolePath}/${key}`;
    const active = pathname === href;
    return (
      <Link
        title={collapsed ? label : undefined}
        key={key}
        href={href}
        onClick={() => setOpen(false)}
        className={`sb-nav-link${active ? " sb-nav-active" : ""}`}
      >
        {/* active left-bar accent */}
        {active && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-blue-400"
            style={{boxShadow:"0 0 8px 2px #60a5fa, 0 0 20px #3b82f6"}}/>
        )}
        {/* icon wrapper */}
        <span className="sb-nav-icon">
          <Icon size={19}/>
        </span>
        {!collapsed && <span className="truncate leading-none">{label}</span>}
      </Link>
    );
  };

  /* ── sidebar JSX ── */
  const sidebar = (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.30, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full flex-col overflow-hidden text-white"
      style={{ contain:"layout", borderRight:"1px solid rgba(255,255,255,0.07)" }}
    >
      {/* animated background — z-0 */}
      <SidebarBg />

      {/* ── Brand header ── */}
      <div className="relative z-10 flex h-[72px] shrink-0 items-center gap-3 px-4"
        style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <motion.div
          whileHover={{ rotate:-8, scale:1.1 }}
          transition={{ type:"spring", stiffness:300, damping:18 }}
          className="grid shrink-0 place-items-center rounded-xl bg-blue-600"
          style={{width:40,height:40,boxShadow:"0 0 18px rgba(37,99,235,0.7), 0 4px 12px rgba(0,0,0,0.3)"}}
        >
          <BarChart3 size={21}/>
        </motion.div>
        {!collapsed && (
          <motion.div initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{duration:0.22}}>
            <span className="block text-[10px] font-bold tracking-[.2em] text-blue-400/80">
              {rolePath.replace("-"," ").toUpperCase()}
            </span>
            <strong className="block whitespace-nowrap text-[15px] font-black tracking-tight text-white">
              MARKETING AUTO.
            </strong>
          </motion.div>
        )}
        <button aria-label="Close navigation" className="ml-auto text-slate-400 hover:text-white md:hidden"
          onClick={() => setOpen(false)}>
          <X size={20}/>
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-2.5 py-4
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rolePath === "super-admin"
          ? superNavigation.map(group => (
              <div className="mb-5" key={group.group}>
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[9.5px] font-bold uppercase tracking-[.16em] text-slate-500/80">
                    {group.group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map(i => link(i.key, i.label, i.icon))}
                </div>
              </div>
            ))
          : (
            <div className="space-y-0.5">
              {(rolePath === "admin"  ? adminNavigation
               : rolePath === "user" ? userNavigation
               : standardNav.map(item => ({ key:item, label:labels[item], icon:Gauge }))
              ).map(item => link(item.key, item.label, item.icon))}
            </div>
          )
        }
      </nav>

      {/* ── User footer — glassmorphism card ── */}
      <div className="relative z-10 shrink-0 p-2.5"
        style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="sb-user-card flex items-center gap-2.5 rounded-xl p-2.5">
          {/* avatar */}
          <div className="grid shrink-0 place-items-center rounded-xl bg-blue-600 font-black text-sm"
            style={{
              width:38, height:38,
              boxShadow:"0 0 14px rgba(37,99,235,0.55), 0 2px 8px rgba(0,0,0,0.3)"
            }}>
            {initials(user.email, user.first_name, user.last_name)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
              </p>
              <p className="mt-0.5 text-[11px] font-medium capitalize text-blue-300/80">
                {user.role.replaceAll("_"," ")}
              </p>
            </div>
          )}
          <button aria-label="Log out" onClick={() => void logout()}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-200
              hover:bg-white/10 hover:text-white">
            <LogOut size={16}/>
          </button>
        </div>

        {/* collapse toggle */}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-1.5 hidden w-full items-center justify-center rounded-lg py-1.5
            text-slate-500 transition-all duration-200
            hover:bg-white/[.06] hover:text-slate-300 md:flex"
          onClick={() => setCollapsed(v => !v)}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{duration:0.28}}>
            <ChevronLeft size={16}/>
          </motion.span>
        </button>
      </div>
    </motion.aside>
  );

  /* ── Shell layout ── */
  return (
    <div className={`min-h-screen bg-[#f5f7fb] dark:bg-[#050d1f] md:grid
      ${collapsed ? "md:grid-cols-[72px_1fr]" : "md:grid-cols-[260px_1fr]"}
      transition-[grid-template-columns,background-color] duration-300`}>

      {/* desktop sidebar — sticky full height */}
      <div className="sticky top-0 hidden h-screen md:block">{sidebar}</div>

      {/* mobile sidebar overlay */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 md:hidden"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <button className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}/>
            <motion.div className="relative h-full w-[260px]"
              initial={{x:-260}} animate={{x:0}} exit={{x:-260}}
              transition={{duration:0.28, ease:[0.4,0,0.2,1]}}>
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* main content */}
      <main className="min-w-0 relative">
        <MainBg />
        {/* mobile-only top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center
          border-b border-slate-200/80 dark:border-white/[.06]
          bg-white/90 dark:bg-[#060d1e]/90 px-4
          shadow-[0_1px_18px_rgba(15,23,42,.04)] dark:shadow-[0_1px_24px_rgba(0,0,0,.35)]
          backdrop-blur-xl md:hidden">
          <button aria-label="Open navigation"
            className="group grid h-9 w-9 place-items-center rounded-xl border
              border-slate-200 dark:border-white/10
              bg-white dark:bg-white/[.05]
              text-slate-700 dark:text-slate-300 shadow-sm transition
              hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            onClick={() => setOpen(true)}>
            <Menu size={20}/>
          </button>
        </header>
        <div className="p-4 sm:p-7 lg:p-9">{children}</div>
      </main>
    </div>
  );
}
