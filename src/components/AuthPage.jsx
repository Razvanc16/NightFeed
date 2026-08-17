import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import PasswordChecklist from "./PasswordChecklist";
import PasswordInput from "./PasswordInput";
import LegalPage from "./LegalPage";
import { EnvelopeIcon, KeyIcon, RocketIcon } from "./Icons";

export default function AuthPage({ onAuth, initialMode, onBack }) {
  const [mode, setMode] = useState(initialMode || "login"); // login | register | verify | forgot | forgot-sent
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
    if (mode === "register" && !validatePassword(password)) {
      setError("Parola nu îndeplinește toate condițiile de mai jos!");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setError("Emailul nu e confirmat. Verifică inbox-ul!");
          } else if (error.message.includes("Invalid login credentials")) {
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
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          if (error.message.includes("already registered")) {
            setError("Există deja un cont cu acest email!");
          } else {
            setError(error.message);
          }
          setLoading(false);
          return;
        }

        setMode("verify");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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
    setMode("forgot-sent");
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#060608",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 24px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Fundal cinematic — orbi neon care plutesc lent (doar CSS, ușor pe telefon) */}
      <style>{`
        @keyframes floatOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.1); } }
        @keyframes floatOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,40px) scale(1.05); } }
        @keyframes floatOrb3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,30px) scale(1.12); } }
        @keyframes authGrain { 0%,100% { opacity: 0.03; } 50% { opacity: 0.05; } }
        .auth-card input[type="text"]:focus, .auth-card input[type="email"]:focus {
          border-color: rgba(255,51,102,0.5) !important;
          box-shadow: 0 0 0 3px rgba(255,51,102,0.12);
        }
      `}</style>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", top: "-120px", left: "-100px", background: "radial-gradient(circle, rgba(255,51,102,0.35), transparent 70%)", filter: "blur(70px)", animation: "floatOrb1 14s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: "-140px", right: "-120px", background: "radial-gradient(circle, rgba(180,79,255,0.30), transparent 70%)", filter: "blur(70px)", animation: "floatOrb2 18s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", top: "45%", left: "55%", background: "radial-gradient(circle, rgba(0,229,255,0.16), transparent 70%)", filter: "blur(80px)", animation: "floatOrb3 16s ease-in-out infinite", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", animation: "slideUp 0.3s ease-out" }}>
      {/* Buton înapoi la landing */}
      {onBack && (
        <button onClick={onBack} style={{
          position: "absolute", top: -20, left: 0, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 16px",
          color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "'Instrument Sans', sans-serif",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          ← Înapoi
        </button>
      )}
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: "linear-gradient(135deg, #FF3366, #FF6B35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: "0 0 40px rgba(255,51,102,0.4)",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z" />
          </svg>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
          Night<span style={{ color: "#FF3366" }}>Feed</span>
        </div>
      </div>

      {/* Verify email screen */}
      {mode === "verify" && (
        <div className="auth-card" style={{ width: "100%", maxWidth: 340, textAlign: "center", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "30px 24px", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ marginBottom: 16, color: "rgba(255,255,255,0.6)", display: "flex", justifyContent: "center" }}><EnvelopeIcon size={56} /></div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
            Verifică emailul!
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
            Am trimis un link de confirmare la <span style={{ color: "#FF3366" }}>{email}</span>. Dă click pe link și revino aici să te loghezi.
          </div>
          <button
            onClick={() => setMode("login")}
            style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}
          >
            Mergi la login →
          </button>
        </div>
      )}

      {/* Forgot password: request screen */}
      {mode === "forgot" && (
        <div className="auth-card" style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "26px 24px", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Inter', sans-serif", display: "inline-flex", alignItems: "center", gap: 6 }}>Resetează parola <KeyIcon size={15} /></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              Îți trimitem un link de resetare pe email.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Email</div>
            <input
              type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleForgotSubmit()}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleForgotSubmit}
            disabled={loading || resetCooldown > 0}
            style={{
              width: "100%", padding: "14px",
              background: (loading || resetCooldown > 0) ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              cursor: (loading || resetCooldown > 0) ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(255,51,102,0.3)",
              marginTop: 4,
            }}
          >
            {loading ? "Se trimite..." : resetCooldown > 0 ? `Mai poți retrimite în ${resetCooldown}s` : "Trimite link de resetare"}
          </button>

          <button
            onClick={() => { setMode("login"); setError(""); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", padding: "8px 0" }}
          >
            ← Înapoi la login
          </button>
        </div>
      )}

      {/* Forgot password: confirmation screen */}
      {mode === "forgot-sent" && (
        <div className="auth-card" style={{ width: "100%", maxWidth: 340, textAlign: "center", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "30px 24px", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ marginBottom: 16, color: "rgba(255,255,255,0.6)", display: "flex", justifyContent: "center" }}><EnvelopeIcon size={56} /></div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
            Verifică emailul!
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
            Ți-am trimis un link de resetare la <span style={{ color: "#FF3366" }}>{email}</span>. Dă click pe el și vei putea seta o parolă nouă.
          </div>
          <button
            onClick={() => setMode("login")}
            style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Inter', sans-serif", cursor: "pointer",
            }}
          >
            Mergi la login →
          </button>
        </div>
      )}

      {/* Login / Register form */}
      {(mode === "login" || mode === "register") && (
        <div className="auth-card" style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "26px 24px", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Inter', sans-serif", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {mode === "login" ? "Bine ai revenit" : <>Cont nou <RocketIcon size={15} /></>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Email</div>
            <input
              type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parolă</div>
            <PasswordInput
              placeholder={mode === "register" ? "creează o parolă puternică" : "parola ta"}
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
            {mode === "register" && <PasswordChecklist password={password} />}
          </div>

          {mode === "login" && (
            <button
              onClick={() => { setMode("forgot"); setError(""); }}
              style={{ background: "none", border: "none", color: "#FF3366", fontSize: 12, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer", padding: 0, textAlign: "right", alignSelf: "flex-end" }}
            >
              Am uitat parola?
            </button>
          )}

          {mode === "register" && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "2px 0" }}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#FF3366", flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'Instrument Sans', sans-serif", lineHeight: 1.5 }}>
                Am citit și accept{" "}
                <span onClick={(e) => { e.preventDefault(); setShowLegal(true); }} style={{ color: "#FF3366", textDecoration: "underline", cursor: "pointer" }}>
                  Termenii și Politica de Confidențialitate
                </span>
              </span>
            </label>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 13, fontFamily: "'Instrument Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (mode === "login" && loginCooldown > 0) || (mode === "register" && !acceptedTerms)}
            style={{
              width: "100%", padding: "14px",
              background: (loading || (mode === "login" && loginCooldown > 0)) ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              cursor: (loading || (mode === "login" && loginCooldown > 0)) ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(255,51,102,0.3)",
              marginTop: 4,
              opacity: (mode === "register" && !acceptedTerms) ? 0.6 : 1,
            }}
          >
            {loading
              ? "Se procesează..."
              : mode === "login" && loginCooldown > 0
                ? `Prea multe încercări — mai încearcă în ${loginCooldown}s`
                : mode === "login" ? "Intră în cont" : "Creează contul"}
          </button>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'Instrument Sans', sans-serif" }}>
              {mode === "login" ? "Nu ai cont? " : "Ai deja cont? "}
            </span>
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ background: "none", border: "none", color: "#FF3366", fontSize: 13, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif", cursor: "pointer" }}
            >
              {mode === "login" ? "Înregistrează-te" : "Autentifică-te"}
            </button>
          </div>
        </div>
      )}
      </div>

      {showLegal && <LegalPage onClose={() => setShowLegal(false)} />}
    </div>
  );
}
