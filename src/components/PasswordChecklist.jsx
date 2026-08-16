import { passwordRequirements, getPasswordStrength } from "../utils/passwordValidation";
import { CheckCircleIcon } from "./Icons";

export default function PasswordChecklist({ password }) {
  const strength = getPasswordStrength(password);

  return (
    <div style={{ marginTop: 8 }}>
      {password.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${strength.percent}%`, background: strength.color, transition: "width 0.25s, background 0.25s" }} />
          </div>
          <div style={{ fontSize: 11, color: strength.color, fontFamily: "'DM Mono', monospace", marginTop: 4, fontWeight: 700 }}>
            {strength.label && `Parolă ${strength.label.toLowerCase()}`}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {passwordRequirements.map((req) => {
          const ok = req.test(password);
          return (
            <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: ok ? "#00C864" : "rgba(255,255,255,0.3)", width: 14 }}>
                {ok ? <CheckCircleIcon size={12} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid currentColor" }} />}
              </span>
              <span style={{ fontSize: 11, color: ok ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
