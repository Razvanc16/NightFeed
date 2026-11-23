import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import { suggestEmail, isValidEmail, mailProviderFor, getLastAuth, setLastAuth } from "../utils/authHelpers";
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, createNonce } from "../utils/googleIdentity";
import LegalPage from "./LegalPage";
import { ArrowLeftIcon, ArrowRightIcon } from "./Icons";
import {
  EASE, fadeUp, Collapse, TextField, PasswordField, PasswordRules,
  PrimaryButton, OutlineButton, TextButton, LastUsedTag, ErrorNote, Checkbox, OtpInput,
} from "./AuthUI";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.2 0-9.6-3.3-11.3-8l-6.5 5c3.3 6.4 9.9 10.5 17.8 10.5z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C40.9 36.9 44 31.4 44 24c0-1.3-.1-2.7-.4-3.5z" />
  </svg>
);

// Tranziția între ecrane: înainte → intră din dreapta, înapoi → din stânga
// (aceeași convenție ca Landing→Auth din App.jsx).
const screenVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE, staggerChildren: 0.045, delayChildren: 0.05 } },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -24 : 24, transition: { duration: 0.18, ease: "easeIn" } }),
};

function Screen({ id, dir, children }) {
  return (
    <motion.div key={id} custom={dir} variants={screenVariants} initial="enter" animate="center" exit="exit" className="flex flex-col">
      {children}
    </motion.div>
  );
}

const Item = ({ children, className = "" }) => (
  <motion.div variants={fadeUp} className={className}>{children}</motion.div>
);

function Heading({ title, sub }) {
  return (
    <Item className="mb-7">
      <h1 className="m-0 font-syne text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">{title}</h1>
      {sub && <p className="m-0 mt-2 font-sans text-[15px] leading-relaxed text-white/50">{sub}</p>}
    </Item>
  );
}

// Comutator Intră / Cont nou — pastila albă glisează între cele două opțiuni.
function ModeTabs({ mode, onChange }) {
  const tabs = [{ id: "login", label: "Intră în cont" }, { id: "register", label: "Cont nou" }];
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
      <div role="tablist" className="relative grid grid-cols-2 rounded-[14px] border border-solid border-white/[0.08] bg-white/[0.03] p-1">
        {tabs.map((t) => {
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`relative z-10 h-10 cursor-pointer rounded-[10px] border-0 bg-transparent font-sans text-[14px] font-semibold transition-colors duration-200 ${active ? "text-black" : "text-white/50 hover:text-white/80"}`}
            >
              {active && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="absolute inset-0 -z-10 rounded-[10px] bg-white"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {t.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function Divider() {
  return (
    <Item className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/[0.08]" />
      <span className="font-sans text-[12px] text-white/30">sau cu email</span>
      <div className="h-px flex-1 bg-white/[0.08]" />
    </Item>
  );
}

// Iconiță mare (plic) pentru ecranele de "verifică emailul", cu un punct
// care pulsează — semn că așteptăm o acțiune din inbox.
function MailBadge() {
  return (
    <Item className="mb-6">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-[16px] border border-solid border-white/10 bg-white/[0.04] text-white">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-[#FF3366]"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF3366]" />
        </span>
      </div>
    </Item>
  );
}

function OpenMailButton({ email }) {
  const provider = mailProviderFor(email);
  if (!provider) return null;
  return (
    <Item className="mb-3">
      <OutlineButton type="button" onClick={() => window.open(provider.url, "_blank", "noopener")}>
        Deschide {provider.name} <ArrowRightIcon size={15} />
      </OutlineButton>
    </Item>
  );
}

// Panoul din stânga, doar pe desktop — tipografie mare + ce găsești în app.
function BrandPanel() {
  const points = [
    ["01", "Petreceri homemade, cluburi și evenimente din orașul tău, într-un singur feed."],
    ["02", "Ceri să participi direct de la organizator — fără grupuri de WhatsApp."],
    ["03", "Intri pe bază de cod QR. Simplu, la ușă."],
  ];
  const tags = ["Techno", "House", "Hip-hop", "Rooftop", "Homemade", "Afterparty", "Live", "Open air"];

  return (
    <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden border-0 border-r border-solid border-white/[0.06] bg-[#0c0c0f] p-12 lg:flex xl:p-16">
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-60 blur-[110px]"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.28), transparent 70%)" }}
      />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="relative flex items-center gap-2.5">
        <img src="/icon-512.png" alt="" className="h-8 w-8 rounded-[9px]" />
        <span className="font-syne text-[18px] font-extrabold tracking-tight text-white">NightFeed</span>
      </motion.div>

      <div className="relative">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="m-0 font-syne text-[40px] font-extrabold leading-[1] tracking-[-0.035em] text-white xl:text-[54px] 2xl:text-[64px]"
        >
          Orașul nu doarme.<br />
          <span className="text-white/35">Nici feed-ul tău.</span>
        </motion.h2>

        <div className="mt-12 flex flex-col gap-5">
          {points.map(([n, text], i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }}
              className="flex max-w-[420px] gap-5 border-0 border-t border-solid border-white/[0.07] pt-5"
            >
              <span className="font-mono text-[12px] text-[#FF3366]">{n}</span>
              <span className="font-sans text-[15px] leading-relaxed text-white/60">{text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative -mx-12 overflow-hidden xl:-mx-16" style={{ maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)" }}>
        <motion.div
          className="flex w-max gap-3"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          {[...tags, ...tags].map((t, i) => (
            <span key={i} className="whitespace-nowrap rounded-full border border-solid border-white/[0.08] px-4 py-2 font-sans text-[13px] text-white/45">
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </aside>
  );
}

// Butonul oficial Google (Google Identity Services). Fereastra Google arată
// "nightfeed.ro" în loc de domeniul Supabase. Pornește și One Tap (propunerea
// automată de cont din colțul ecranului). Dacă scriptul nu se încarcă,
// cheamă onUnavailable și AuthPage revine la butonul cu redirect.
function GoogleIdentityButton({ onCredential, onUnavailable }) {
  const ref = useRef(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const google = await loadGoogleIdentity();
        const nonce = await createNonce();
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          callback: (res) => cbRef.current(res.credential, nonce.raw),
          context: "signin",
          ux_mode: "popup",
          itp_support: true,
          use_fedcm_for_prompt: true,
        });
        google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          logo_alignment: "center",
          locale: "ro",
          width: Math.min(400, Math.round(ref.current.offsetWidth)),
        });
        setReady(true);
        google.accounts.id.prompt();
      } catch {
        if (!cancelled) onUnavailable?.();
      }
    })();
    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel?.();
    };
  }, []);

  return (
    <div className="relative h-[44px]">
      <AnimatePresence>
        {!ready && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-0 rounded-[6px] border border-solid border-white/[0.12] bg-white/[0.03]" />
        )}
      </AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="flex h-full w-full items-center justify-center overflow-hidden"
      />
    </div>
  );
}

export default function AuthPage({ onAuth, initialMode, onBack }) {
  const lastAuth = useRef(getLastAuth()).current;

  // login | register | code | verify | forgot | forgot-sent
  const [mode, setMode] = useState(initialMode || "login");
  const [dir, setDir] = useState(1);
  const goTo = (next, direction = 1) => { setError(""); setDir(direction); setMode(next); };

  const [email, setEmail] = useState(lastAuth?.email && (initialMode || "login") === "login" ? lastAuth.email : "");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gisAvailable, setGisAvailable] = useState(!!GOOGLE_CLIENT_ID);
  const [error, setError] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  // Login cu cod pe email
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);

  // Protecție client-side la încercări repetate — NU înlocuiește rate limiting-ul
  // real din Supabase (Authentication → Rate Limits), doar previne spam-ul din UI.
  const [loginFails, setLoginFails] = useState(0);
  const [loginCooldown, setLoginCooldown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0); // confirmare cont / cod / reset

  useEffect(() => {
    const t = setInterval(() => {
      setLoginCooldown((c) => (c > 0 ? c - 1 : 0));
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const emailSuggestion = suggestEmail(email);
  const emailInvalid = emailTouched && email.length > 0 && !isValidEmail(email);
  const trimmedEmail = email.trim().toLowerCase();

  // --- Email + parolă ------------------------------------------------------
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (mode === "login" && loginCooldown > 0) return;
    if (!isValidEmail(email)) { setEmailTouched(true); setError("Introdu o adresă de email validă."); return; }
    if (!password) { setError("Introdu parola."); return; }
    if (mode === "register") {
      if (!validatePassword(password)) { setPasswordFocused(true); setError("Parola nu îndeplinește toate condițiile."); return; }
      if (!acceptedTerms || !confirmedAge) { setError("Bifează ambele confirmări ca să continui."); return; }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) {
          // Mesaj identic pentru "email neconfirmat" și "credențiale greșite" — altfel
          // un atacator ar putea deduce ce email-uri există în bază (enumerare).
          if (error.message.includes("Email not confirmed") || error.message.includes("Invalid login credentials")) {
            setError("Email sau parolă incorectă.");
          } else {
            setError(error.message);
          }
          // După 3 eșecuri la rând blocăm temporar: 10s, 20s, 40s, max 60s.
          const next = loginFails + 1;
          setLoginFails(next);
          if (next >= 3) setLoginCooldown(Math.min(60, 10 * Math.pow(2, next - 3)));
          setLoading(false);
          return;
        }
        setLoginFails(0);
        setLastAuth("password", trimmedEmail);
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          setError(error.message.includes("already registered") ? "Există deja un cont cu acest email." : error.message);
          setLoading(false);
          return;
        }
        // Cu confirmarea pe email activă, Supabase nu dă eroare pentru un email deja
        // folosit — întoarce un user fals cu identities: []. Singurul semnal din client.
        if (data.user && data.user.identities?.length === 0) {
          setError("Există deja un cont cu acest email.");
          setLoading(false);
          return;
        }
        setLastAuth("password", trimmedEmail);
        setResendCooldown(RESEND_SECONDS);
        goTo("verify", 1);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // --- Google ----------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    setLastAuth("google", null);
    // Redirect la Google — la întoarcere Supabase preia sesiunea din URL
    // (detectSessionInUrl) și declanșează SIGNED_IN, ascultat în App.jsx.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  // Token-ul primit de la butonul GIS → sesiune Supabase, fără redirect.
  const handleGoogleCredential = async (token, nonce) => {
    setError("");
    setGoogleLoading(true);
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce });
    setGoogleLoading(false);
    if (error) { setError("Nu am putut intra cu Google. Încearcă din nou."); return; }
    setLastAuth("google", null);
    onAuth(data.user);
  };

  // --- Login cu cod pe email (fără parolă) -----------------------------------
  const sendCode = async (e) => {
    e?.preventDefault();
    setError("");
    if (!isValidEmail(email)) { setEmailTouched(true); setError("Introdu o adresă de email validă."); return; }
    if (resendCooldown > 0 && codeSent) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    // Pentru un email fără cont Supabase răspunde cu eroare ("Signups not allowed
    // for otp") — o ignorăm și mergem mai departe la fel, ca să nu dezvăluim
    // dacă adresa are sau nu cont.
    if (error && !/signups not allowed|user not found/i.test(error.message)) {
      setError(/rate|too many|security purposes/i.test(error.message)
        ? "Prea multe cereri. Mai așteaptă puțin și încearcă din nou."
        : error.message);
      return;
    }
    setCode("");
    setCodeInvalid(false);
    setCodeSent(true);
    setResendCooldown(RESEND_SECONDS);
  };

  const verifyCode = async (token) => {
    if (token.length !== OTP_LENGTH || loading) return;
    setError("");
    setCodeInvalid(false);
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: trimmedEmail, token, type: "email" });
    setLoading(false);
    if (error) {
      setCodeInvalid(true);
      setError("Cod greșit sau expirat. Verifică emailul sau cere unul nou.");
      setCode("");
      return;
    }
    setLastAuth("code", trimmedEmail);
    onAuth(data.user);
  };

  // --- Retrimitere email de confirmare ----------------------------------------
  const resendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResendCooldown(RESEND_SECONDS);
  };

  // --- Resetare parolă -----------------------------------------------------
  const handleForgotSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    if (resendCooldown > 0) return;
    if (!isValidEmail(email)) { setEmailTouched(true); setError("Introdu o adresă de email validă."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResendCooldown(RESEND_SECONDS);
    if (mode !== "forgot-sent") goTo("forgot-sent", 1);
  };

  // --- Bucăți reutilizate ------------------------------------------------------
  const emailField = (autoFocus = false) => (
    <Item>
      <TextField
        id="auth-email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        value={email}
        invalid={emailInvalid}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        onBlur={() => setEmailTouched(true)}
      />
      <Collapse show={!!emailSuggestion}>
        <div className="pl-1 pt-2 font-sans text-[12.5px] text-white/50">
          Ai vrut să scrii{" "}
          <button
            type="button"
            onClick={() => setEmail(emailSuggestion)}
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[12.5px] font-semibold text-white underline decoration-[#FF3366] underline-offset-4"
          >
            {emailSuggestion}
          </button>
          ?
        </div>
      </Collapse>
    </Item>
  );

  const resendLabel = (idle) => (resendCooldown > 0 ? `Retrimite în ${resendCooldown}s` : idle);

  const isAuthTab = mode === "login" || mode === "register";

  return (
    <div className="flex h-full w-full bg-[#09090b]">
      <BrandPanel />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Glow discret doar pe mobil, unde nu avem panoul din stânga */}
        <div
          className="pointer-events-none absolute -top-48 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full opacity-50 blur-[100px] lg:hidden"
          style={{ background: "radial-gradient(circle, rgba(255,51,102,0.3), transparent 70%)" }}
        />

        <header className="relative z-10 flex items-center justify-between px-5 pb-2 pt-[calc(env(safe-area-inset-top,0px)+18px)] md:px-8">
          {onBack ? (
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={{ scale: 0.92 }}
              aria-label="Înapoi"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-solid border-white/10 bg-transparent text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeftIcon size={16} />
            </motion.button>
          ) : <span />}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/icon-512.png" alt="" className="h-7 w-7 rounded-[8px]" />
            <span className="font-syne text-[16px] font-extrabold tracking-tight text-white">NightFeed</span>
          </div>
          <span className="h-10 w-10" />
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 md:px-10">
          <div className="w-full max-w-[380px]">
            {isAuthTab && <ModeTabs mode={mode} onChange={(m) => m !== mode && goTo(m, m === "register" ? 1 : -1)} />}

            <AnimatePresence mode="wait" custom={dir} initial={false}>
              {/* ---------------- LOGIN / REGISTER ---------------- */}
              {isAuthTab && (
                <Screen key={mode} id={mode} dir={dir}>
                  <Heading
                    title={mode === "login" ? "Bine ai revenit." : "Hai în feed."}
                    sub={mode === "login" ? "Intră ca să vezi ce se întâmplă diseară." : "Îți faci cont în mai puțin de un minut."}
                  />

                  <Item className="relative">
                    {gisAvailable ? (
                      <GoogleIdentityButton onCredential={handleGoogleCredential} onUnavailable={() => setGisAvailable(false)} />
                    ) : (
                      <OutlineButton type="button" onClick={handleGoogleSignIn} disabled={googleLoading}>
                        <GoogleLogo /> {googleLoading ? "Te redirecționăm…" : "Continuă cu Google"}
                      </OutlineButton>
                    )}
                    {mode === "login" && lastAuth?.method === "google" && <LastUsedTag />}
                  </Item>

                  <Divider />

                  <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
                    {emailField()}

                    <Item>
                      <PasswordField
                        id="auth-password"
                        label="Parolă"
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        onFocus={() => setPasswordFocused(true)}
                      />
                      {mode === "register" && <PasswordRules password={password} show={passwordFocused || password.length > 0} />}
                    </Item>

                    {mode === "login" && (
                      <Item className="-mt-0.5 flex justify-end">
                        <TextButton onClick={() => goTo("forgot", 1)}>Ai uitat parola?</TextButton>
                      </Item>
                    )}

                    {mode === "register" && (
                      <Item className="mt-2 flex flex-col gap-3">
                        <Checkbox checked={confirmedAge} onChange={setConfirmedAge}>Am cel puțin 16 ani.</Checkbox>
                        <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
                          Accept{" "}
                          <span
                            onClick={(e) => { e.preventDefault(); setShowLegal(true); }}
                            className="cursor-pointer text-white underline decoration-white/30 underline-offset-[3px] hover:decoration-white"
                          >
                            Termenii și Politica de Confidențialitate
                          </span>
                          .
                        </Checkbox>
                      </Item>
                    )}

                    <ErrorNote>{error}</ErrorNote>

                    <Item className="relative mt-2">
                      <PrimaryButton type="submit" loading={loading} disabled={mode === "login" && loginCooldown > 0}>
                        {mode === "login" && loginCooldown > 0
                          ? `Prea multe încercări · ${loginCooldown}s`
                          : mode === "login" ? "Intră" : "Creează contul"}
                      </PrimaryButton>
                      {mode === "login" && lastAuth?.method === "password" && <LastUsedTag />}
                    </Item>
                  </form>

                  {mode === "login" && (
                    <Item className="relative mt-4 flex justify-center">
                      <TextButton onClick={() => { setCodeSent(false); goTo("code", 1); }}>
                        Intră fără parolă — primește un cod pe email
                      </TextButton>
                      {lastAuth?.method === "code" && (
                        <span className="ml-2 self-center rounded-full bg-[#FF3366] px-2 py-[2px] font-sans text-[10px] font-semibold text-white">Ultima dată</span>
                      )}
                    </Item>
                  )}
                </Screen>
              )}

              {/* ---------------- COD PE EMAIL ---------------- */}
              {mode === "code" && !codeSent && (
                <Screen key="code-request" id="code-request" dir={dir}>
                  <Heading title="Intră cu un cod." sub="Îți trimitem un cod de 6 cifre pe email. Fără parolă de ținut minte." />
                  <form onSubmit={sendCode} noValidate className="flex flex-col gap-3">
                    {emailField(true)}
                    <ErrorNote>{error}</ErrorNote>
                    <Item className="mt-2">
                      <PrimaryButton type="submit" loading={loading}>Trimite codul</PrimaryButton>
                    </Item>
                  </form>
                  <Item className="mt-5 flex justify-center">
                    <TextButton onClick={() => goTo("login", -1)}>← Înapoi la login cu parolă</TextButton>
                  </Item>
                </Screen>
              )}

              {mode === "code" && codeSent && (
                <Screen key="code-verify" id="code-verify" dir={dir}>
                  <MailBadge />
                  <Heading
                    title="Verifică emailul."
                    sub={<>Dacă există un cont pentru <span className="text-white">{trimmedEmail}</span>, ți-am trimis un cod. Îl poți scrie aici sau poți apăsa direct linkul din email.</>}
                  />
                  <Item>
                    <OtpInput
                      length={OTP_LENGTH}
                      value={code}
                      onChange={(v) => { setCode(v); setCodeInvalid(false); setError(""); }}
                      onComplete={verifyCode}
                      invalid={codeInvalid}
                      disabled={loading}
                    />
                  </Item>
                  <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
                  <Item className="mt-3">
                    <PrimaryButton type="button" loading={loading} disabled={code.length !== OTP_LENGTH} onClick={() => verifyCode(code)}>
                      Confirmă codul
                    </PrimaryButton>
                  </Item>
                  <div className="mt-3"><OpenMailButton email={trimmedEmail} /></div>
                  <Item className="mt-2 flex items-center justify-between">
                    <TextButton onClick={() => { setCodeSent(false); setError(""); }}>Schimbă emailul</TextButton>
                    <TextButton onClick={() => sendCode()} disabled={resendCooldown > 0 || loading}>{resendLabel("Retrimite codul")}</TextButton>
                  </Item>
                </Screen>
              )}

              {/* ---------------- CONFIRMARE CONT NOU ---------------- */}
              {mode === "verify" && (
                <Screen key="verify" id="verify" dir={dir}>
                  <MailBadge />
                  <Heading
                    title="Mai ai un pas."
                    sub={<>Am trimis un link de confirmare la <span className="text-white">{trimmedEmail}</span>. Apasă-l și revino aici ca să intri.</>}
                  />
                  <OpenMailButton email={trimmedEmail} />
                  <Item>
                    <PrimaryButton type="button" onClick={() => { setPassword(""); goTo("login", -1); }}>
                      Am confirmat, mergi la login <ArrowRightIcon size={15} />
                    </PrimaryButton>
                  </Item>
                  <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
                  <Item className="mt-5 flex flex-col items-center gap-1.5 text-center">
                    <span className="font-sans text-[13px] text-white/35">Nu ai primit nimic? Verifică și Spam.</span>
                    <TextButton onClick={resendConfirmation} disabled={resendCooldown > 0 || loading} className="text-white/70">
                      {resendLabel("Retrimite emailul de confirmare")}
                    </TextButton>
                  </Item>
                </Screen>
              )}

              {/* ---------------- AM UITAT PAROLA ---------------- */}
              {mode === "forgot" && (
                <Screen key="forgot" id="forgot" dir={dir}>
                  <Heading title="Resetează parola." sub="Scrie emailul contului și îți trimitem un link pentru o parolă nouă." />
                  <form onSubmit={handleForgotSubmit} noValidate className="flex flex-col gap-3">
                    {emailField(true)}
                    <ErrorNote>{error}</ErrorNote>
                    <Item className="mt-2">
                      <PrimaryButton type="submit" loading={loading} disabled={resendCooldown > 0}>
                        {resendCooldown > 0 ? `Poți retrimite în ${resendCooldown}s` : "Trimite linkul"}
                      </PrimaryButton>
                    </Item>
                  </form>
                  <Item className="mt-5 flex justify-center">
                    <TextButton onClick={() => goTo("login", -1)}>← Înapoi la login</TextButton>
                  </Item>
                </Screen>
              )}

              {mode === "forgot-sent" && (
                <Screen key="forgot-sent" id="forgot-sent" dir={dir}>
                  <MailBadge />
                  <Heading
                    title="Verifică emailul."
                    sub={<>Dacă există un cont pentru <span className="text-white">{trimmedEmail}</span>, ți-am trimis un link de resetare.</>}
                  />
                  <OpenMailButton email={trimmedEmail} />
                  <Item>
                    <PrimaryButton type="button" onClick={() => goTo("login", -1)}>
                      Înapoi la login <ArrowRightIcon size={15} />
                    </PrimaryButton>
                  </Item>
                  <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
                  <Item className="mt-5 flex justify-center">
                    <TextButton onClick={() => handleForgotSubmit()} disabled={resendCooldown > 0 || loading}>
                      {resendLabel("Retrimite linkul")}
                    </TextButton>
                  </Item>
                </Screen>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="relative z-10 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowLegal(true)}
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[12px] text-white/30 transition-colors hover:text-white/60"
          >
            Termeni · Confidențialitate
          </button>
        </footer>
      </main>

      {showLegal && <LegalPage onClose={() => setShowLegal(false)} />}
    </div>
  );
}
