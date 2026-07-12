import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import PasswordChecklist from "./PasswordChecklist";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register | verify | forgot | forgot-sent
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "available" | "taken"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const usernameCheckTimer = useRef(null);

  // Verificare live a disponibilității username-ului (cu debounce), doar la înregistrare
  useEffect(() => {
    if (mode !== "register") return;
    clearTimeout(usernameCheckTimer.current);
    if (username.trim().length < 3) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    usernameCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("usernames")
        .select("username_lower")
        .eq("username_lower", username.trim().toLowerCase())
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 500);
    return () => clearTimeout(usernameCheckTimer.current);
  }, [username, mode]);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Completează email și parola!"); return; }
    if (mode === "register" && !username) { setError("Completează username-ul!"); return; }
    if (mode === "register" && usernameStatus === "taken") { setError("Acest username este deja folosit!"); return; }
    if (mode === "register" && usernameStatus === "checking") { setError("Se verifică username-ul, mai așteaptă puțin..."); return; }
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
          return;
        }
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } }
        });
        if (error) {
          if (error.message.includes("already registered")) {
            setError("Există deja un cont cu acest email!");
          } else {
            setError(error.message);
          }
          setLoading(false);
          return;
        }

        // Rezervăm username-ul acum, cât timp încă avem id-ul userului la îndemână
        // (userul nu are sesiune activă până nu confirmă emailul, de-asta trecem
        // prin funcția specială din baza de date, nu print-un insert direct)
        if (data.user) {
          const { error: usernameError } = await supabase.rpc("register_username", {
            p_user_id: data.user.id,
            p_username: username.trim(),
          });
          if (usernameError) {
            // Cursă rară: cineva a apucat username-ul exact în timp ce completai formularul
            setError("Acest username tocmai a fost luat de altcineva. Contul a fost creat, dar te rugăm contactează suportul pentru a schimba username-ul, sau folosește alt email pentru a reîncerca cu un username liber.");
            setLoading(false);
            return;
          }
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
    if (!email) { setError("Completează adresa de email!"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMode("forgot-sent");
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#080808",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 24px",
      animation: "slideUp 0.3s ease-out",
    }}>
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
            <circle cx="12" cy="12" r="5"/>
            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5"/>
          </svg>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
          Night<span style={{ color: "#FF3366" }}>Feed</span>
        </div>
      </div>

      {/* Verify email screen */}
      {mode === "verify" && (
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
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
              fontFamily: "'Syne', sans-serif", cursor: "pointer",
            }}
          >
            Mergi la login →
          </button>
        </div>
      )}

      {/* Forgot password: request screen */}
      {mode === "forgot" && (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Resetează parola 🔑</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              Îți trimitem un link de resetare pe email.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Email</div>
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
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(255,51,102,0.3)",
              marginTop: 4,
            }}
          >
            {loading ? "Se trimite..." : "Trimite link de resetare"}
          </button>

          <button
            onClick={() => { setMode("login"); setError(""); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "8px 0" }}
          >
            ← Înapoi la login
          </button>
        </div>
      )}

      {/* Forgot password: confirmation screen */}
      {mode === "forgot-sent" && (
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📬</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
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
              fontFamily: "'Syne', sans-serif", cursor: "pointer",
            }}
          >
            Mergi la login →
          </button>
        </div>
      )}

      {/* Login / Register form */}
      {(mode === "login" || mode === "register") && (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
              {mode === "login" ? "Bine ai revenit 👋" : "Cont nou 🚀"}
            </div>
          </div>

          {mode === "register" && (
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Username</div>
              <input
                type="text" placeholder="ex: razvan_nightfeed"
                value={username} onChange={e => setUsername(e.target.value)}
                style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: `1px solid ${usernameStatus === "taken" ? "rgba(255,51,102,0.5)" : usernameStatus === "available" ? "rgba(0,200,100,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
              {usernameStatus === "checking" && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>Se verifică...</div>
              )}
              {usernameStatus === "available" && (
                <div style={{ fontSize: 11, color: "#00C864", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>✓ Disponibil</div>
              )}
              {usernameStatus === "taken" && (
                <div style={{ fontSize: 11, color: "#FF3366", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>✕ Deja folosit, alege altul</div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Email</div>
            <input
              type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parolă</div>
            <input
              type="password" placeholder={mode === "register" ? "creează o parolă puternică" : "parola ta"}
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
            {mode === "register" && <PasswordChecklist password={password} />}
          </div>

          {mode === "login" && (
            <button
              onClick={() => { setMode("forgot"); setError(""); }}
              style={{ background: "none", border: "none", color: "#FF3366", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: 0, textAlign: "right", alignSelf: "flex-end" }}
            >
              Am uitat parola?
            </button>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (mode === "register" && (usernameStatus === "checking" || usernameStatus === "taken"))}
            style={{
              width: "100%", padding: "14px",
              background: loading ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)",
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'Syne', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(255,51,102,0.3)",
              marginTop: 4,
              opacity: (mode === "register" && (usernameStatus === "checking" || usernameStatus === "taken")) ? 0.6 : 1,
            }}
          >
            {loading ? "Se procesează..." : mode === "login" ? "Intră în cont" : "Creează contul"}
          </button>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>
              {mode === "login" ? "Nu ai cont? " : "Ai deja cont? "}
            </span>
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ background: "none", border: "none", color: "#FF3366", fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
              {mode === "login" ? "Înregistrează-te" : "Autentifică-te"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
