"use client";

import { motion } from "framer-motion";
import { BarChart3, Mail, MessageCircle, MessageSquareText, Settings2, Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

/* Particle positions: [left%, top%, scale] */
const particles = [
  [6,10,.9],[14,26,.65],[22,14,.5],[30,38,.8],[40,11,.55],[46,29,.75],
  [54,16,.45],[62,37,.75],[70,9,.6],[79,26,.5],[88,15,.8],[93,46,.5],
  [10,68,.45],[22,80,.7],[36,64,.5],[50,86,.8],[67,71,.55],[82,89,.65],
  [18,50,.4],[74,54,.6],[44,60,.5],[58,44,.7],[3,33,.55],[96,62,.45],
] as const;

// Connection path data — SVG coords in a 100×100 viewBox
// Node centres: email(8,13) sms(66,8) wa(42,31) analytics(18,68) automation(80,65)
const PATHS = [
  {d:"M 8 13 Q 37 5  66 8",   cls:"",  dot:""},
  {d:"M 8 13 Q 22 21 42 31",  cls:"g", dot:"g"},
  {d:"M 66 8 Q 57 17 42 31",  cls:"b", dot:"b"},
  {d:"M 42 31 Q 28 51 18 68", cls:"c", dot:"c"},
  {d:"M 42 31 Q 63 49 80 65", cls:"d", dot:"d"},
  {d:"M 18 68 Q 50 75 80 65", cls:"e", dot:"e"},
];

const NODES = [
  {cls:"l-node-email",     label:"Email",      Icon:Mail,              sz:33, delay:.44},
  {cls:"l-node-sms",       label:"SMS",        Icon:MessageSquareText, sz:29, delay:.56},
  {cls:"l-node-wa",        label:"WhatsApp",   Icon:MessageCircle,     sz:48, delay:.50},
  {cls:"l-node-analytics", label:"Analytics",  Icon:BarChart3,         sz:33, delay:.62},
  {cls:"l-node-automation",label:"Automation", Icon:Settings2,         sz:33, delay:.68},
] as const;

export default function LoginPage() {
  return (
    <main className="login-scene">

      {/* ── Atmosphere ── */}
      <div aria-hidden className="login-aurora login-aurora-one" />
      <div aria-hidden className="login-aurora login-aurora-two" />
      <div aria-hidden className="login-city" />
      <div aria-hidden className="login-grid" />

      {/* Floating particles */}
      <div aria-hidden className="login-particles">
        {particles.map(([l,t,s],i)=>(
          <i key={i} style={{left:`${l}%`,top:`${t}%`,transform:`scale(${s})`,animationDelay:`-${i*.38}s`}}/>
        ))}
      </div>

      {/* Background wave lines */}
      <svg aria-hidden className="login-waves" preserveAspectRatio="none" viewBox="0 0 1000 520">
        <defs>
          <linearGradient id="wg" x1="0" x2="1">
            <stop stopColor="#0ea5e9"/><stop offset=".48" stopColor="#2563eb"/><stop offset="1" stopColor="#7c3aed"/>
          </linearGradient>
          <filter id="wgf"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {[0,1,2,3,4,5].map(i=>(
          <path key={i} className={`lw lw-${i}`}
            d={`M -80 ${278+i*22} C 120 ${168+i*16},230 ${388-i*7},430 ${258+i*11} S 720 ${163+i*21},1080 ${283+i*14}`}
            fill="none" stroke="url(#wg)" strokeWidth={i===2?2.4:1.2}/>
        ))}
        <path className="lr"
          d="M 90 295 C 200 200,255 345,385 265 S 585 205,755 300"
          fill="none" filter="url(#wgf)" stroke="#38bdf8"
          strokeDasharray="4 13" strokeLinecap="round" strokeWidth="3.5"/>
      </svg>

      {/* ── Main two-column layout ── */}
      <div className="login-layout">

        {/* ─ Left panel ─ */}
        <section className="login-story">

          {/* Brand */}
          <motion.div className="login-brand flex items-center gap-3"
            initial={{opacity:0,x:-18}} animate={{opacity:1,x:0}} transition={{duration:.6}}>
            <div className="h-24 w-24 flex items-center justify-center drop-shadow-md">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <strong className="text-[32px]">MARKETING-AUTOMATION</strong>
          </motion.div>

          {/* Heading — own flex item, cannot overlap canvas */}
          <motion.div className="login-heading"
            initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.65,delay:.1}}>
            <h1>All in One<br/><em>Marketing Automation</em></h1>
            <p>Streamline your marketing, engage your audience,<br className="hidden xl:block"/>
               and grow your business effortlessly.</p>
          </motion.div>

          {/* Canvas — dedicated flex:1 zone for nodes */}
          <div className="login-canvas">

            {/* Animated dashed connection lines + traveling dots */}
            <svg aria-hidden className="login-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
              {PATHS.map(({d,cls,dot},i)=>(
                <g key={i}>
                  <path className={`lc ${cls}`} d={d} vectorEffect="non-scaling-stroke"/>
                  {/* traveling dot using animateMotion */}
                  <circle r="1.2" className={`lc-dot ${dot}`}
                    fill={dot==="g"?"#4ade80":"#38bdf8"}
                    style={{filter:dot==="g"?"drop-shadow(0 0 3px #4ade80)":"drop-shadow(0 0 3px #38bdf8)"}}>
                    <animateMotion dur={dot==="g"?"4.5s":dot==="b"?"4.2s":dot==="c"?"3s":dot==="d"?"5s":dot==="e"?"3.8s":"3.5s"}
                      repeatCount="indefinite"
                      begin={dot==="b"?"-1.2s":dot==="c"?"-.5s":dot==="d"?"-2s":dot==="e"?"-.4s":"0s"}>
                      <mpath href={`#lp${i}`}/>
                    </animateMotion>
                  </circle>
                  {/* named path for mpath reference */}
                  <path id={`lp${i}`} d={d} fill="none" stroke="none" vectorEffect="non-scaling-stroke"/>
                </g>
              ))}
            </svg>

            {/* Channel nodes */}
            <div aria-hidden className="login-nodes">
              {NODES.map(({cls,label,Icon,sz,delay})=>(
                <motion.div key={label} className={`l-node ${cls}`}
                  initial={{opacity:0,scale:.35}} animate={{opacity:1,scale:1}}
                  transition={{delay,type:"spring",stiffness:200,damping:14}}>
                  <span className="l-orb"><Icon size={sz}/></span>
                  <span className="l-lbl">{label}</span>
                </motion.div>
              ))}
            </div>

            {/* Portal rings */}
            <div aria-hidden className="login-portal"><i/><i/><i/></div>
          </div>
        </section>

        {/* ─ Right login card ─ */}
        <motion.section className="login-card"
          initial={{opacity:0,x:28,scale:.97}} animate={{opacity:1,x:0,scale:1}}
          transition={{duration:.72,ease:[.2,.8,.2,1]}}>
          <div className="login-card-shine"/>
          <div className="relative z-10">
            <header>
              <h2>Welcome Back</h2>
              <p>Sign in to continue to your account</p>
            </header>
            <LoginForm/>
          </div>
        </motion.section>

      </div>
    </main>
  );
}
