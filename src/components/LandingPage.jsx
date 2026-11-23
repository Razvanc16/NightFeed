import { motion } from "framer-motion";
import { ArrowRightIcon } from "./Icons";
import FeedPhoneMockup from "./FeedPhoneMockup";
import { formatEventDateTime } from "../utils/eventTime";

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

// Cardul evenimentului primit printr-un link nightfeed.ro/e/<id>, afișat
// în locul mockup-ului de telefon pentru cine încă nu are cont.
function SharedEventCard({ event }) {
  const when = event.event_date ? formatEventDateTime(event.event_date) : "";
  const where = event.location_visible ? event.venue : "Locația se află după ce ești acceptat";
  const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(event.cover_url || "");
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
      className="relative w-full max-w-[340px] overflow-hidden rounded-[24px] border border-solid border-white/10 bg-[#141418] shadow-[0_30px_80px_rgba(0,0,0,0.6)] lg:max-w-[400px]"
    >
      <div className="relative aspect-[4/3] w-full bg-[#1b1b20] max-lg:[@media(max-height:739px)]:aspect-[16/7]">
        {event.cover_url && !isVideo && (
          <img src={event.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {event.cover_url && isVideo && (
          <video src={event.cover_url} muted autoPlay loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, #141418, transparent)" }} />
      </div>
      <div className="relative -mt-10 px-5 pb-5">
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-sans text-[11px] font-semibold text-white/80">
          {event.type === "official" ? "Eveniment" : "Petrecere homemade"}
        </span>
        <div className="mt-2.5 font-sans text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">{event.title}</div>
        {when && <div className="mt-1.5 font-sans text-[14px] text-white/60">{when}</div>}
        {where && <div className="mt-0.5 truncate font-sans text-[13px] text-white/40">{where}</div>}
      </div>
    </motion.div>
  );
}

export default function LandingPage({ onNewUser, onExistingUser, sharedEvent }) {
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
      <main className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-stretch justify-center gap-4 px-6 py-4 md:px-10 lg:py-6 lg:flex-row lg:items-center lg:gap-16">
        {/* Mockup-ul de telefon — pe mobil deasupra textului, pe desktop în dreapta */}
        <div className={`flex items-center justify-center py-2 lg:flex-1 lg:order-2 ${sharedEvent ? "" : "max-lg:[@media(max-height:739px)]:hidden"}`}>
          {/* Telefonul e desenat la 270px și scalat proporțional — așa textul din
              ecran rămâne în proporții corecte la orice mărime. */}
          {sharedEvent ? <SharedEventCard event={sharedEvent} /> : (
          <div className="relative h-[250px] w-[120px] max-sm:[@media(min-height:860px)]:h-[332px] max-sm:[@media(min-height:860px)]:w-[159px] sm:h-[480px] sm:w-[230px] lg:h-[564px] lg:w-[270px]">
            <div className="absolute left-0 top-0 w-[270px] origin-top-left scale-[0.443] max-sm:[@media(min-height:860px)]:scale-[0.59] sm:scale-[0.852] lg:scale-100">
              <FeedPhoneMockup className="w-[270px]" />
            </div>
          </div>
          )}
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
            {sharedEvent ? "Ai primit o invitație pe NightFeed" : "Ce se întâmplă diseară în orașul tău"}
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="m-0 font-sans text-[44px] font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-[56px] lg:text-[64px] xl:text-[76px]"
          >
            {sharedEvent ? (
              <>Hai și tu.<br /><span className="text-white/35">Intră ca să participi.</span></>
            ) : (
              <>Orașul nu doarme.<br /><span className="text-white/35">Nici feed-ul tău.</span></>
            )}
          </motion.h1>

          <motion.p variants={fadeUp} className="m-0 mt-5 max-w-[440px] font-sans text-[16px] leading-relaxed text-white/55 lg:text-[18px]">
            Petreceri homemade, cluburi și evenimente într-un singur feed. Ceri să participi direct de la organizator și intri cu QR la ușă.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-row">
            <motion.button
              type="button"
              onClick={onNewUser}
              whileTap={{ scale: 0.98 }}
              className="group flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-white px-4 font-sans text-[15px] font-semibold text-black sm:px-7 transition-colors hover:bg-white/90 sm:w-auto"
            >
              Creează cont
              <ArrowRightIcon size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </motion.button>
            <motion.button
              type="button"
              onClick={onExistingUser}
              whileTap={{ scale: 0.98 }}
              className="flex h-[54px] cursor-pointer items-center justify-center rounded-[14px] border border-solid border-white/[0.12] bg-transparent px-4 font-sans sm:px-7 text-[15px] font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.04] sm:w-auto"
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
        className="relative z-10 hidden border-0 border-t border-solid lg:block border-white/[0.06] py-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
      >
        <Marquee />
      </motion.div>
    </div>
  );
}
