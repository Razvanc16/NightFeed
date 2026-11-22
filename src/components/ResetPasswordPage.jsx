import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import { EASE, fadeUp, PasswordField, PasswordRules, PrimaryButton, TextButton, ErrorNote, Collapse } from "./AuthUI";
import { WarningIcon } from "./Icons";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };

export default function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!validatePassword(password)) { setError("Parola nu îndeplinește toate condițiile."); return; }
    if (password !== confirmPassword) { setError("Parolele nu coincid."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }

    setSuccess(true);
    // Delogăm sesiunea de recovery — userul intră curat cu parola nouă.
    await supabase.auth.signOut();
    setTimeout(() => onDone(), 2200);
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    onDone();
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-[#09090b]">
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full opacity-50 blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.3), transparent 70%)" }}
      />
      <header className="relative z-10 flex items-center justify-center gap-2 px-5 pb-2 pt-[calc(env(safe-area-inset-top,0px)+24px)]">
        <img src="/icon-512.png" alt="" className="h-7 w-7 rounded-[8px]" />
        <span className="font-syne text-[16px] font-extrabold tracking-tight text-white">NightFeed</span>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[380px]">
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.1 }}
                  className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#00C864]"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <motion.path d="M5 12.5 10 17l9-10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.35 }} />
                  </svg>
                </motion.div>
                <h1 className="m-0 font-syne text-[28px] font-extrabold tracking-[-0.02em] text-white">Parola e schimbată.</h1>
                <p className="m-0 mt-2 font-sans text-[15px] text-white/50">Te ducem la login…</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} noValidate variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <motion.div variants={fadeUp} className="mb-4">
                  <h1 className="m-0 font-syne text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">Setează o parolă nouă.</h1>
                  <p className="m-0 mt-2 font-sans text-[15px] leading-relaxed text-white/50">Alege ceva ce nu mai folosești în altă parte.</p>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <PasswordField
                    id="reset-password"
                    label="Parolă nouă"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  />
                  <PasswordRules password={password} show={password.length > 0} />
                </motion.div>

                <motion.div variants={fadeUp}>
                  <PasswordField
                    id="reset-password-confirm"
                    label="Repetă parola"
                    autoComplete="new-password"
                    value={confirmPassword}
                    invalid={mismatch}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  />
                  <Collapse show={mismatch}>
                    <div className="flex items-center gap-1.5 pl-1 pt-2 font-sans text-[12px] text-[#FF6B8A]">
                      <WarningIcon size={13} /> Parolele nu coincid
                    </div>
                  </Collapse>
                </motion.div>

                <ErrorNote>{error}</ErrorNote>

                <motion.div variants={fadeUp} className="mt-2">
                  <PrimaryButton type="submit" loading={loading}>Salvează parola</PrimaryButton>
                </motion.div>
                <motion.div variants={fadeUp} className="mt-3 flex justify-center">
                  <TextButton onClick={handleCancel}>Anulează și mergi la login</TextButton>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
