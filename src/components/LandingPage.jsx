import { motion } from "framer-motion";
import { ArrowRightIcon } from "./Icons";

// Landing-ul — același limbaj vizual ca AuthPage: fundal aproape negru, un
// singur glow discret, tipografie mare, buton principal alb plin. Fără card de
// sticlă, fără gradient pe butoane, fără chip-uri plutitoare.

const EASE = [0.16, 1, 0.3, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// "Afișe" ilustrative de eveniment — doar compoziție grafică (gradient +
// tipografie), fără date inventate de tip "500 participanți".
const POSTERS = [
  { tag: "Homemade", title: "House party", meta: "Vineri · 22:00", bg: "radial-gradient(120% 90% at 20% 10%, #FF3366 0%, #7a1033 45%, #140509 100%)" },
  { tag: "Club", title: "Techno all night", meta: "Sâmbătă · 23:30", bg: "radial-gradient(120% 90% at 80% 0%, #6b5cff 0%, #2a1f6b 45%, #08061a 100%)" },
  { tag: "Rooftop", title: "Sunset session", meta: "Duminică · 19:00", bg: "radial-gradient(120% 90% at 50% 0%, #FF8A3D 0%, #8a2d12 50%, #160804 100%)" },
];

function Poster({ p, className, style, delay, float }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: style.rotate }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      className={`absolute ${className}`}
      style={{ zIndex: style.z }}
    >
      <motion.div
        animate={{ y: [0, -float, 0] }}
        transition={{ duration: 6 + float / 4, repeat: Infinity, ease: "easeInOut", delay }}
        className="relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-[22px] border border-solid border-white/10 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        style={{ background: p.bg }}
      >
        {/* granulație fină, ca de afiș printat */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        <span className="relative self-start rounded-full bg-black/30 px-2.5 py-1 font-sans text-[11px] font-semibold text-white/90 backdrop-blur-sm">
          {p.tag}
        </span>
        <div className="relative">
          <div className="font-sans text-[26px] font-extrabold leading-[1] tracking-[-0.03em] text-white">{p.title}</div>
          <div className="mt-2 font-mono text-[11px] text-white/70">{p.meta}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PosterStack({ className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Poster p={POSTERS[2]} className="right-0 top-[6%] w-[58%]" style={{ rotate: 8, z: 1 }} delay={0.35} float={8} />
      <Poster p={POSTERS[1]} className="left-0 top-[10%] w-[58%]" style={{ rotate: -9, z: 2 }} delay={0.25} float={10} />
      <Poster p={POSTERS[0]} className="left-[21%] top-0 w-[58%]" style={{ rotate: -1, z: 3 }} delay={0.15} float={6} />
    </div>
  );
}

function Marquee() {
  const tags = ["Petreceri homemade", "Cluburi", "Rooftop", "Techno", "House", "Hip-hop", "Afterparty", "Open air", "Live"];
  return (
    <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
      <motion.div
        className="flex w-max items-center gap-8"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      >
        {[...tags, ...tags].map((t, i) => (
          <span key={i} className="flex items-center gap-8 whitespace-nowrap font-sans text-[13px] text-white/35">
            {t}
            <span className="h-1 w-1 rounded-full bg-[#FF3366]/70" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function LandingPage({ onNewUser, onExistingUser }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-[#09090b]">
      <div
        className="pointer-events-none absolute -top-60 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full opacity-50 blur-[120px] lg:left-[72%]"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.35), transparent 70%)" }}
      />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 pb-2 pt-[calc(env(safe-area-inset-top,0px)+20px)] md:px-10"
      >
        <div className="flex items-center gap-2.5">
          <img src="/icon-512.png" alt="" className="h-8 w-8 rounded-[9px]" />
          <span className="font-sans text-[17px] font-extrabold tracking-tight text-white">NightFeed</span>
        </div>
        <motion.button
          type="button"
          onClick={onExistingUser}
          whileTap={{ scale: 0.96 }}
          className="h-10 cursor-pointer rounded-full border border-solid border-white/[0.12] bg-transparent px-4 font-sans text-[14px] font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.05]"
        >
          Intră în cont
        </motion.button>
      </motion.header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-stretch gap-6 px-6 py-6 md:px-10 lg:flex-row lg:items-center lg:gap-16">
        {/* Afișele — pe mobil deasupra textului, pe desktop în dreapta */}
        <div className="flex flex-1 items-center justify-center lg:order-2">
          <PosterStack className="aspect-[10/9] w-full max-w-[280px] sm:max-w-[360px] lg:aspect-[5/4] lg:max-w-[480px]" />
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col lg:order-1 lg:max-w-[620px] lg:flex-[1.2]">
          <motion.div variants={fadeUp} className="mb-5 flex items-center gap-2 font-sans text-[13px] text-white/50">
            <span className="relative flex h-2 w-2">
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-[#FF3366]"
                animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3366]" />
            </span>
            Ce se întâmplă diseară în orașul tău
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="m-0 font-sans text-[44px] font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-[56px] lg:text-[64px] xl:text-[76px]"
          >
            Orașul nu doarme.<br />
            <span className="text-white/35">Nici feed-ul tău.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="m-0 mt-5 max-w-[440px] font-sans text-[16px] leading-relaxed text-white/55 lg:text-[18px]">
            Petreceri homemade, cluburi și evenimente într-un singur feed. Ceri să participi direct de la organizator și intri cu QR la ușă.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              onClick={onNewUser}
              whileTap={{ scale: 0.98 }}
              className="group flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-white px-7 font-sans text-[15px] font-semibold text-black transition-colors hover:bg-white/90 sm:w-auto"
            >
              Creează cont
              <ArrowRightIcon size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </motion.button>
            <motion.button
              type="button"
              onClick={onExistingUser}
              whileTap={{ scale: 0.98 }}
              className="flex h-[54px] cursor-pointer items-center justify-center rounded-[14px] border border-solid border-white/[0.12] bg-transparent px-7 font-sans text-[15px] font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.04] sm:w-auto"
            >
              Am deja cont
            </motion.button>
          </motion.div>
        </motion.div>
      </main>

      {/* Bandă cu genuri */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10 border-0 border-t border-solid border-white/[0.06] py-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
      >
        <Marquee />
      </motion.div>
    </div>
  );
}
