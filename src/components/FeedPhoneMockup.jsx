import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PinIcon, ClockIcon, HouseIcon, MapIcon, BellIcon, PersonIcon } from "./Icons";

// Mockup de telefon pentru landing — reproduce aspectul real al feed-ului
// (card pe tot ecranul, organizator + titlu + locație jos, acțiuni pe dreapta,
// bara plutitoare jos) și "derulează" singur între câteva evenimente demo.
// Evenimentele sunt exemple ilustrative, nu date reale.

const EASE = [0.16, 1, 0.3, 1];
const MONO = "font-mono";

const DEMO = [
  {
    organizer: "andrei.house", tag: "Homemade", title: "House party pe acoperiș",
    venue: "Floreasca", date: "Vin · 23:00", desc: "Adu-ți prietenii, noi avem boxele.",
    price: "Gratuit", likes: 128, color: "#FF3366",
    bg: "radial-gradient(90% 60% at 30% 20%, rgba(255,51,102,0.85), transparent 70%), radial-gradient(70% 50% at 85% 45%, rgba(255,140,60,0.55), transparent 70%), linear-gradient(180deg, #2a0710 0%, #0b0205 100%)",
  },
  {
    organizer: "subsol.techno", tag: "Club", title: "Techno până dimineața",
    venue: "Centrul Vechi", date: "Sâm · 00:00", desc: "Line-up local, sistem de sunet nou.",
    price: "50 lei", likes: 342, color: "#8B7BFF",
    bg: "conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(139,123,255,0.7) 20deg, transparent 45deg, rgba(80,200,255,0.45) 70deg, transparent 100deg), linear-gradient(180deg, #120c2e 0%, #050310 100%)",
  },
  {
    organizer: "sky.sessions", tag: "Rooftop", title: "Sunset session",
    venue: "Dorobanți", date: "Dum · 19:00", desc: "Deep house și apus peste oraș.",
    price: "30 lei", likes: 96, color: "#FF8A3D",
    bg: "radial-gradient(120% 55% at 50% 100%, rgba(255,138,61,0.9), transparent 70%), radial-gradient(60% 40% at 50% 62%, rgba(255,220,140,0.6), transparent 70%), linear-gradient(180deg, #1d1030 0%, #3a1420 100%)",
  },
];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const Heart = ({ filled }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "#FF3366" : "none"} stroke={filled ? "#FF3366" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const Comment = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const Plus = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const Share = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
);

function FeedCard({ e }) {
  const [liked, setLiked] = useState(false);
  // "Like"-ul apare la scurt timp după ce cardul intră — arată interacțiunea.
  useEffect(() => {
    const t = setTimeout(() => setLiked(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: e.bg }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      <div className="absolute inset-x-0 bottom-0 h-[62%]" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6) 50%, transparent)" }} />

      {/* Acțiuni dreapta */}
      <div className="absolute bottom-[86px] right-2.5 flex flex-col items-center gap-3.5">
        <div className="flex flex-col items-center gap-0.5">
          <motion.div animate={liked ? { scale: [1, 1.35, 1] } : {}} transition={{ duration: 0.35 }}>
            <Heart filled={liked} />
          </motion.div>
          <span className="font-sans text-[10px] font-semibold text-white">{e.likes + (liked ? 1 : 0)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5"><Comment /><span className="font-sans text-[10px] font-semibold text-white">24</span></div>
        <Plus />
        <Share />
      </div>

      {/* Info jos */}
      <div className="absolute bottom-[84px] left-0 right-12 px-3.5">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold ${MONO}`}
            style={{ background: `${e.color}30`, border: `1px solid ${e.color}60`, color: e.color }}
          >
            {e.organizer[0].toUpperCase()}
          </span>
          <span className={`truncate text-[9px] font-bold uppercase tracking-[0.1em] ${MONO}`} style={{ color: e.color }}>{e.organizer} ›</span>
        </div>
        <div className="mb-1.5 font-sans text-[17px] font-extrabold leading-[1.15] text-white">{e.title}</div>
        <div className={`mb-1.5 flex items-center gap-1.5 text-[9.5px] text-white/60 ${MONO}`}>
          <span className="flex items-center gap-0.5 whitespace-nowrap"><PinIcon size={10} /> {e.venue}</span>
          <span className="text-white/35">·</span>
          <span className="flex items-center gap-0.5 whitespace-nowrap"><ClockIcon size={10} /> {e.date}</span>
        </div>
        <p className="m-0 mb-2 font-sans text-[10.5px] leading-snug text-white/55">{e.desc}</p>
        <span className={`rounded-[10px] px-2 py-[2px] text-[9px] font-bold ${MONO}`} style={{ background: `${e.color}25`, color: e.color }}>{e.price}</span>
      </div>
    </div>
  );
}

export default function FeedPhoneMockup({ className = "" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DEMO.length), 3600);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      className={`relative ${className}`}
    >
      {/* Glow în culoarea evenimentului curent */}
      {DEMO.map((d, n) => (
        <motion.div
          key={d.color}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[190%] -translate-x-1/2 -translate-y-1/2"
          style={{ background: `radial-gradient(50% 50% at 50% 50%, ${d.color}4d 0%, ${d.color}1a 45%, transparent 100%)` }}
          initial={false}
          animate={{ opacity: n === i ? 1 : 0 }}
          transition={{ duration: 0.9 }}
        />
      ))}

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-[46px] border border-solid border-white/15 bg-[#111] p-[9px] shadow-[0_40px_100px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[38px] bg-black">
          <AnimatePresence initial={false}>
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
            >
              <FeedCard e={DEMO[i]} />
            </motion.div>
          </AnimatePresence>

          {/* Dynamic Island + status bar */}
          <div className="absolute left-1/2 top-2.5 z-20 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
          <div className="absolute left-6 right-6 top-3.5 z-10 flex justify-between font-sans text-[10px] font-semibold text-white">
            <span>23:41</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-[7px] w-[14px] rounded-[2px] border border-solid border-white/80 p-[1px]"><span className="block h-full w-[70%] rounded-[1px] bg-white" /></span>
            </span>
          </div>

          {/* Bara de jos plutitoare, ca în aplicație */}
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-full border border-solid border-white/[0.14] bg-white/[0.1] px-5 py-2.5 text-white backdrop-blur-md">
            <HouseIcon size={17} />
            <MapIcon size={17} style={{ opacity: 0.55 }} />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <BellIcon size={17} style={{ opacity: 0.55 }} />
            <PersonIcon size={17} style={{ opacity: 0.55 }} />
          </div>

          {/* Indicator de progres între evenimente */}
          <div className="absolute left-1.5 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1">
            {DEMO.map((_, n) => (
              <motion.span key={n} className="w-[3px] rounded-full bg-white" animate={{ height: n === i ? 14 : 4, opacity: n === i ? 0.9 : 0.35 }} transition={{ duration: 0.4 }} />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
