import { useState } from "react";

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export default function PasswordInput({ value, onChange, placeholder, onKeyDown, borderColor }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", padding: "13px 44px 13px 16px",
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${borderColor || "rgba(255,255,255,0.1)"}`,
          borderRadius: 12, color: "#fff", fontSize: 15,
          fontFamily: "'DM Sans', sans-serif", outline: "none",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        style={{
          position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center",
        }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
