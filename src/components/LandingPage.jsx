import { motion } from "framer-motion";
import { ArrowRightIcon, KeyIcon, HouseIcon, ConfettiIcon, PinIcon } from "./Icons";
import BrandBackdrop from "./BrandBackdrop";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

// Chip-uri de sticlă care plutesc discret în jurul cardului — umplu spațiul
// gol din jur cu conținut relevant (categoriile reale din aplicație), nu cu
// cifre inventate de tipul "500+ evenimente" (n-are sens pt un MVP proaspăt).
function FloatingBadge({ icon: Icon, label, className, delay = 0, floatY = 10, duration = 5 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-none absolute z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-sans text-[12.5px] font-semibold text-white/70 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md sm:flex ${className}`}
    >
      <motion.div
        className="flex items-center gap-2"
        animate={{ y: [0, -floatY, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <Icon size={14} style={{ color: "#FF6B6B" }} />
        {label}
      </motion.div>
    </motion.div>
  );
}

export default function LandingPage({ onNewUser, onExistingUser }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#09090b] px-6 py-10 md:px-10">
      <BrandBackdrop />

      <FloatingBadge icon={HouseIcon} label="Petreceri homemade" className="left-[6%] top-[14%] md:left-[10%]" delay={0.5} />
      <FloatingBadge icon={ConfettiIcon} label="Cluburi & evenimente" className="right-[6%] top-[20%] md:right-[12%]" delay={0.7} floatY={8} duration={6} />
      <FloatingBadge icon={PinIcon} label="Orașul tău, live" className="bottom-[12%] left-[8%] md:left-[14%]" delay={0.9} floatY={9} duration={5.5} />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-20 flex w-full max-w-[380px] flex-col items-center rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-11 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-md md:px-14 md:py-14"
      >
        <motion.span
          variants={item}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/45"
        >
          Nightlife, reinventat
        </motion.span>

        <motion.div
          variants={item}
          className="relative mb-6 flex h-[84px] w-[84px] items-center justify-center md:h-24 md:w-24"
        >
          <div className="absolute inset-0 rounded-full bg-[#FF3366] opacity-40 blur-2xl" />
          <img src="/icon-512.png" alt="NightFeed" className="relative h-full w-full rounded-[24px] object-cover shadow-[0_0_50px_rgba(255,51,102,0.45)]" />
        </motion.div>

        <motion.h1 variants={item} className="mb-3 font-syne text-[30px] font-[900] tracking-tight text-white md:text-5xl">
          Night<span className="text-[#FF3366]">Feed</span>
        </motion.h1>

        <motion.p variants={item} className="mb-9 max-w-[280px] font-sans text-[15px] leading-relaxed text-white/60 md:max-w-sm md:text-lg">
          Evenimente, petreceri homemade și cluburi din orașul tău — într-un feed care se mișcă în ritmul tău.
        </motion.p>

        <motion.div variants={item} className="flex w-full flex-col gap-3">
          <motion.button
            onClick={onNewUser}
            whileHover={{ scale: 1.02, boxShadow: "0 10px 40px rgba(255,51,102,0.55)" }}
            whileTap={{ scale: 0.97 }}
            className="group flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-[#FF3366] to-[#B44FFF] px-6 py-[15px] font-sans text-[15px] font-bold text-white shadow-[0_8px_34px_rgba(255,51,102,0.4)] md:py-4 md:text-base"
          >
            Sunt utilizator nou
            <ArrowRightIcon size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </motion.button>

          <motion.button
            onClick={onExistingUser}
            whileHover={{ scale: 1.015, backgroundColor: "rgba(255,255,255,0.09)" }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-[15px] font-sans text-[15px] font-bold text-white backdrop-blur-md md:py-4 md:text-base"
          >
            <KeyIcon size={16} />
            Am cont
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
