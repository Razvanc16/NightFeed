import { motion } from "framer-motion";

// Fundalul comun (glow-uri animate + textură de grid) pentru landing și auth —
// extras aici ca să nu se dubleze identic în ambele componente.
export default function BrandBackdrop() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full blur-[90px] md:h-[560px] md:w-[560px]"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.35), transparent 70%)" }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -right-28 h-[460px] w-[460px] rounded-full blur-[90px] md:h-[600px] md:w-[600px]"
        style={{ background: "radial-gradient(circle, rgba(180,79,255,0.32), transparent 70%)" }}
        animate={{ x: [0, -30, 0], y: [0, 35, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[320px] w-[320px] -translate-x-1/2 rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(255,107,53,0.16), transparent 70%)" }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 90%)",
        }}
      />
    </>
  );
}
