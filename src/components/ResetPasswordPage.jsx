import { useState } from "react";
import { supabase } from "../supabase";
import { validatePassword } from "../utils/passwordValidation";
import PasswordChecklist from "./PasswordChecklist";

export default function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!validatePassword(password)) {
      setError("Parola nu îndeplinește toate condițiile de mai jos!");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolele nu coincid!");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    // Delogăm sesiunea de recovery din siguranță — userul se loghează curat cu noua parolă
    await supabase.auth.signOut();
    setTimeout(() => onDone(), 2200);
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    onDone();
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
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: "linear-gradient(135deg, #FF3366, #FF6B35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: "0 0 40px rgba(255,51,102,0.4)",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3z"/>
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "'Syne', sans-serif" }}>
          Setează o parolă nouă
        </div>
      </div>

      {success ? (
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
            Parola a fost schimbată!
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif" }}>
            Te redirecționăm spre login...
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parolă nouă</div>
            <input
              type="password" placeholder="parolă nouă"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
            <PasswordChecklist password={password} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Confirmă parola</div>
            <input
              type="password" placeholder="repetă parola"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{ width: "100%", padding: "13px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
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
            {loading ? "Se salvează..." : "Salvează parola nouă"}
          </button>

          <button
            onClick={handleCancel}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "8px 0" }}
          >
            Anulează și mergi la login
          </button>
        </div>
      )}
    </div>
  );
}
