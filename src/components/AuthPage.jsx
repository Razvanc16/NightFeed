import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import PasswordChecklist from "./PasswordChecklist";
import PasswordInput from "./PasswordInput";
import LegalPage from "./LegalPage";
import BrandBackdrop from "./BrandBackdrop";
import { EnvelopeIcon, KeyIcon, RocketIcon, ArrowLeftIcon, ArrowRightIcon } from "./Icons";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function Field({ label, children }) {
  return (
    <motion.div variants={item}>
      <div className="mb-1.5 font-sans text-[11px] uppercase tracking-[0.08em] text-white/40">{label}</div>
      {children}
    </motion.div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-[13px] font-sans text-[15px] text-white outline-none placeholder:text-white/30 focus:border-[#FF3366]/50 focus:ring-2 focus:ring-[#FF3366]/15";

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[10px] border border-[#FF3366]/30 bg-[#FF3366]/15 px-3.5 py-2.5 font-sans text-[13px] text-[#FF3366]"
    >
      {children}
    </motion.div>
  );
}

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.2 0-9.6-3.3-11.3-8l-6.5 5c3.3 6.4 9.9 10.5 17.8 10.5z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C40.9 36.9 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z" />
  </svg>
);

function SecondaryButton({ children, disabled, ...props }) {
  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.015, backgroundColor: "rgba(255,255,255,0.09)" }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-[15px] font-sans text-[15px] font-bold text-white backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}

function PrimaryButton({ children, disabled, ...props }) {
  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.015, boxShadow: "0 10px 34px rgba(255,51,102,0.5)" }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-[#FF3366] to-[#B44FFF] px-6 py-[15px] font-sans text-[15px] font-bold text-white shadow-[0_8px_34px_rgba(255,51,102,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}

// Card comun pentru toate modurile — AnimatePresence face tranziția între
// ecrane (login/register/forgot/verify) o alunecare orizontală (aceeași
// convenție ca la Landing→Auth): mergi "mai departe" → intri din dreapta,
// te întorci → intri din stânga.
const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40, transition: { duration: 0.2 } }),
};

function Card({ modeKey, dir, children }) {
  return (
    <AnimatePresence custom={dir}>
      <motion.div
        key={modeKey}
        custom={dir}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 flex w-full max-w-[360px] flex-col gap-3 rounded-[32px] border border-white/10 bg-white/[0.03] px-7 py-9 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl md:max-w-md md:px-10"
      >
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-3">
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AuthPage({ onAuth, initialMode, onBack }) {
  const [mode, setMode] = useState(initialMode || "login"); // login | register | verify | forgot | forgot-sent
  const [dir, setDir] = useState(1); // 1 = mergi mai departe, -1 = te întorci
  const goTo = (nextMode, direction) => { setDir(direction); setMode(nextMode); };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Protecție client-side împotriva încercărilor repetate de login/reset — NU
  // înlocuiește rate limiting-ul real (care trebuie configurat în Supabase
  // Dashboard → Authentication → Rate Limits), dar previne spam-ul accidental
  // sau bot-ii simpli care nu execută JavaScript-ul paginii.
  const [loginFails, setLoginFails] = useState(0);
  const [loginCooldown, setLoginCooldown] = useState(0); // secunde rămase
  const [resetCooldown, setResetCooldown] = useState(0); // secunde rămase
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setLoginCooldown(c => (c > 0 ? c - 1 : 0));
      setResetCooldown(c => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (mode === "login" && loginCooldown > 0) return;
    if (!email || !password) { setError("Completează email și parola!"); return; }
    if (mode === "register" && !acceptedTerms) { setError("Trebuie să accepți Termenii și Politica de Confidențialitate!"); return; }
    if (mode === "register" && !confirmedAge) { setError("Trebuie să confirmi că ai cel puțin 16 ani!"); return; }
    if (mode === "register" && !validatePassword(password)) {
      setError("Parola nu îndeplinește toate condițiile de mai jos!");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Mesaj identic pentru "email neconfirmat" și "credențiale greșite" —
          // altfel, un atacator putea deduce dacă un email există în bază
          // (răspunsuri diferite = "enumerare de useri"). Cine chiar are emailul
          // neconfirmat oricum știe deja din ecranul "Verifică emailul!" de la
          // înregistrare, sau poate folosi "Am uitat parola?" ca alternativă.
          if (error.message.includes("Email not confirmed") || error.message.includes("Invalid login credentials")) {
            setError("Email sau parolă incorectă!");
          } else {
            setError(error.message);
          }
          setLoading(false);
          // După 3 eșecuri la rând, blocăm butonul temporar — durata crește la fiecare
          // eșec suplimentar (10s, 20s, 40s, plafonat la 60s).
          const next = loginFails + 1;
          setLoginFails(next);
          if (next >= 3) setLoginCooldown(Math.min(60, 10 * Math.pow(2, next - 3)));
          return;
        }
        setLoginFails(0);
        setLoginCooldown(0);
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          if (error.message.includes("already registered")) {
            setError("Există deja un cont cu acest email!");
          } else {
            setError(error.message);
          }
          setLoading(false);
          return;
        }
        // Cu email confirmations activate, Supabase NU întoarce error pentru un
        // email deja înregistrat (ca să nu poată cineva "ghici" ce email-uri
        // există în bază) — în schimb întoarce un user fals, cu identities: [].
        // E singurul mod de a detecta cazul ăsta din client.
        if (data.user && data.user.identities?.length === 0) {
          setError("Există deja un cont cu acest email!");
          setLoading(false);
          return;
        }

        goTo("verify", 1);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    // Redirecționează la Google — la revenire, Supabase preia sesiunea automat
    // din URL (detectSessionInUrl:true, vezi supabase.js) și declanșează SIGNED_IN,
    // ascultat deja în App.jsx. Nu mai apucăm să resetăm googleLoading aici,
    // fiindcă pagina se schimbă efectiv de tot cât timp userul e pe Google.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleForgotSubmit = async () => {
    setError("");
    if (resetCooldown > 0) return;
    if (!email) { setError("Completează adresa de email!"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Blocăm retrimiterea 45s — Supabase oricum limitează emailurile de auth la
    // 2/oră, dar asta previne spam-ul accidental din interfață.
    setResetCooldown(45);
    goTo("forgot-sent", 1);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#09090b] px-6 py-10 md:px-10">
      <BrandBackdrop />

      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-6 top-[calc(env(safe-area-inset-top,0px)+20px)] z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-sans text-[13px] font-semibold text-white/70 backdrop-blur-md md:left-10"
        >
          <ArrowLeftIcon size={14} /> Înapoi
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 mb-7 flex flex-col items-center"
      >
        <div className="relative mb-3 flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#FF3366] opacity-40 blur-xl" />
          <img src="/icon-512.png" alt="NightFeed" className="relative h-full w-full rounded-2xl object-cover shadow-[0_0_40px_rgba(255,51,102,0.4)]" />
        </div>
        <div className="font-syne text-2xl font-[900] tracking-tight text-white">
          Night<span className="text-[#FF3366]">Feed</span>
        </div>
      </motion.div>

      {mode === "verify" && (
        <Card modeKey="verify" dir={dir}>
          <motion.div variants={item} className="mx-auto flex text-white/60"><EnvelopeIcon size={48} /></motion.div>
          <motion.div variants={item} className="font-syne text-xl font-extrabold text-white">Verifică emailul!</motion.div>
          <motion.div variants={item} className="mb-2 font-sans text-[14px] leading-relaxed text-white/50">
            Am trimis un link de confirmare la <span className="text-[#FF3366]">{email}</span>. Dă click pe link și revino aici să te loghezi.
          </motion.div>
          <motion.div variants={item}>
            <PrimaryButton onClick={() => goTo("login", -1)}>
              Mergi la login <ArrowRightIcon size={16} />
            </PrimaryButton>
          </motion.div>
        </Card>
      )}

      {mode === "forgot" && (
        <Card modeKey="forgot" dir={dir}>
          <motion.div variants={item} className="mb-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 font-syne text-base font-bold text-white">
              Resetează parola <KeyIcon size={16} />
            </div>
            <div className="font-sans text-xs text-white/40">Îți trimitem un link de resetare pe email.</div>
          </motion.div>

          <Field label="Email">
            <input
              type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleForgotSubmit()}
              className={inputClass}
            />
          </Field>

          <motion.div variants={item}><ErrorBox>{error}</ErrorBox></motion.div>

          <motion.div variants={item}>
            <PrimaryButton onClick={handleForgotSubmit} disabled={loading || resetCooldown > 0}>
              {loading ? "Se trimite..." : resetCooldown > 0 ? `Mai poți retrimite în ${resetCooldown}s` : "Trimite link de resetare"}
            </PrimaryButton>
          </motion.div>

          <motion.button
            variants={item}
            onClick={() => { goTo("login", -1); setError(""); }}
            className="border-0 bg-transparent font-sans text-[13px] text-white/35"
          >
            ← Înapoi la login
          </motion.button>
        </Card>
      )}

      {mode === "forgot-sent" && (
        <Card modeKey="forgot-sent" dir={dir}>
          <motion.div variants={item} className="mx-auto flex text-white/60"><EnvelopeIcon size={48} /></motion.div>
          <motion.div variants={item} className="font-syne text-xl font-extrabold text-white">Verifică emailul!</motion.div>
          <motion.div variants={item} className="mb-2 font-sans text-[14px] leading-relaxed text-white/50">
            Ți-am trimis un link de resetare la <span className="text-[#FF3366]">{email}</span>. Dă click pe el și vei putea seta o parolă nouă.
          </motion.div>
          <motion.div variants={item}>
            <PrimaryButton onClick={() => goTo("login", -1)}>
              Mergi la login <ArrowRightIcon size={16} />
            </PrimaryButton>
          </motion.div>
        </Card>
      )}

      {(mode === "login" || mode === "register") && (
        <Card modeKey={mode} dir={dir}>
          <motion.div variants={item} className="mb-1 flex items-center justify-center gap-2 font-syne text-base font-bold text-white">
            {mode === "login" ? "Bine ai revenit" : <>Cont nou <RocketIcon size={15} /></>}
          </motion.div>

          <motion.div variants={item}>
            <SecondaryButton onClick={handleGoogleSignIn} disabled={googleLoading}>
              <GoogleLogo /> {googleLoading ? "Se redirecționează..." : "Continuă cu Google"}
            </SecondaryButton>
          </motion.div>

          <motion.div variants={item} className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-sans text-[11px] uppercase tracking-[0.08em] text-white/30">sau</span>
            <div className="h-px flex-1 bg-white/10" />
          </motion.div>

          <Field label="Email">
            <input
              type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Parolă">
            <PasswordInput
              placeholder={mode === "register" ? "creează o parolă puternică" : "parola ta"}
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            {mode === "register" && <PasswordChecklist password={password} />}
          </Field>

          {mode === "login" && (
            <motion.button
              variants={item}
              onClick={() => { goTo("forgot", 1); setError(""); }}
              className="self-end border-0 bg-transparent font-sans text-xs text-[#FF3366]"
            >
              Am uitat parola?
            </motion.button>
          )}

          {mode === "register" && (
            <>
              <motion.label variants={item} className="flex items-start gap-2.5 text-left">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF3366]"
                />
                <span className="font-sans text-[12px] leading-relaxed text-white/50">
                  Am citit și accept{" "}
                  <span onClick={(e) => { e.preventDefault(); setShowLegal(true); }} className="cursor-pointer text-[#FF3366] underline">
                    Termenii și Politica de Confidențialitate
                  </span>
                </span>
              </motion.label>
              <motion.label variants={item} className="flex items-start gap-2.5 text-left">
                <input
                  type="checkbox"
                  checked={confirmedAge}
                  onChange={e => setConfirmedAge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF3366]"
                />
                <span className="font-sans text-[12px] leading-relaxed text-white/50">
                  Confirm că am cel puțin 16 ani
                </span>
              </motion.label>
            </>
          )}

          <motion.div variants={item}><ErrorBox>{error}</ErrorBox></motion.div>

          <motion.div variants={item}>
            <PrimaryButton
              onClick={handleSubmit}
              disabled={loading || (mode === "login" && loginCooldown > 0) || (mode === "register" && !acceptedTerms)}
            >
              {loading
                ? "Se procesează..."
                : mode === "login" && loginCooldown > 0
                  ? `Prea multe încercări — mai încearcă în ${loginCooldown}s`
                  : mode === "login" ? "Intră în cont" : "Creează contul"}
            </PrimaryButton>
          </motion.div>

          <motion.div variants={item} className="mt-1 text-center">
            <span className="font-sans text-[13px] text-white/35">
              {mode === "login" ? "Nu ai cont? " : "Ai deja cont? "}
            </span>
            <button
              onClick={() => { goTo(mode === "login" ? "register" : "login", mode === "login" ? 1 : -1); setError(""); }}
              className="border-0 bg-transparent font-sans text-[13px] font-bold text-[#FF3366]"
            >
              {mode === "login" ? "Înregistrează-te" : "Autentifică-te"}
            </button>
          </motion.div>
        </Card>
      )}

      {showLegal && <LegalPage onClose={() => setShowLegal(false)} />}
    </div>
  );
}
