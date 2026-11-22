// Componente de UI comune pentru ecranele de autentificare (AuthPage,
// ResetPasswordPage). Stil sobru: fără glassmorphism / gradient pe butoane —
// un singur accent (roz) folosit cu reținere, buton principal alb plin.
//
// Atenție: Tailwind rulează fără preflight (vezi tailwind.config.js), deci
// butoanele/inputurile au nevoie explicit de border-0 / border-solid / font-sans.

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { passwordRequirements, getPasswordStrength } from "../utils/passwordValidation";
import { WarningIcon } from "./Icons";

export const EASE = [0.16, 1, 0.3, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

// Wrapper care animează apariția/dispariția pe înălțime (erori, avertismente,
// sugestii) — elementele de sub el alunecă lin în loc să sară.
export function Collapse({ show, children, className = "" }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ dark }) {
  return (
    <motion.span
      aria-hidden
      className={`inline-block h-4 w-4 rounded-full border-2 border-solid ${dark ? "border-black/20 border-t-black" : "border-white/20 border-t-white"}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}

// --- Câmp text cu etichetă flotantă ----------------------------------------
export function TextField({ label, id, invalid, right, className = "", inputRef, ...props }) {
  const [focused, setFocused] = useState(false);
  const filled = props.value != null && String(props.value).length > 0;
  const raised = focused || filled;

  return (
    <div
      className={`relative h-[58px] rounded-[14px] border border-solid transition-colors duration-200 ${
        invalid
          ? "border-[#FF3366]/60 bg-[#FF3366]/[0.04]"
          : focused
            ? "border-white/35 bg-white/[0.05]"
            : "border-white/[0.09] bg-white/[0.03] hover:border-white/20"
      } ${className}`}
    >
      <label
        htmlFor={id}
        className={`pointer-events-none absolute left-4 font-sans transition-all duration-200 ${
          raised ? "top-[9px] text-[11px] tracking-[0.02em] text-white/45" : "top-[19px] text-[15px] text-white/40"
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        className={`absolute inset-0 h-full w-full border-0 bg-transparent pb-[7px] pl-4 pt-[25px] font-sans text-[15px] text-white outline-none ${right ? "pr-12" : "pr-4"}`}
      />
      {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

// Parolă cu buton de afișare + avertisment de Caps Lock.
export function PasswordField({ onKeyUp, onKeyDown, ...props }) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e) => {
    if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock"));
  };

  return (
    <div>
      <TextField
        {...props}
        type={visible ? "text" : "password"}
        onKeyUp={(e) => { checkCaps(e); onKeyUp?.(e); }}
        onKeyDown={(e) => { checkCaps(e); onKeyDown?.(e); }}
        onBlur={(e) => { setCaps(false); props.onBlur?.(e); }}
        right={
          <motion.button
            type="button"
            onClick={() => setVisible((v) => !v)}
            whileTap={{ scale: 0.88 }}
            aria-label={visible ? "Ascunde parola" : "Arată parola"}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
          >
            <EyeIcon off={visible} />
          </motion.button>
        }
      />
      <Collapse show={caps}>
        <div className="flex items-center gap-1.5 pl-1 pt-2 font-sans text-[12px] text-[#FFB800]">
          <WarningIcon size={13} /> Caps Lock e activat
        </div>
      </Collapse>
    </div>
  );
}

// --- Cerințe parolă: bară segmentată + listă compactă în 2 coloane ---------
export function PasswordRules({ password, show }) {
  const strength = getPasswordStrength(password);
  const passed = passwordRequirements.filter((r) => r.test(password)).length;
  const shortLabels = { length: "8+ caractere", upper: "O literă mare", lower: "O literă mică", number: "O cifră" };

  return (
    <Collapse show={show}>
      <div className="pt-3">
        <div className="flex gap-1">
          {passwordRequirements.map((r, i) => (
            <div key={r.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className="h-full rounded-full"
                initial={false}
                animate={{ width: i < passed ? "100%" : "0%", backgroundColor: strength.color }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {passwordRequirements.map((r) => {
            const ok = r.test(password);
            return (
              <div key={r.id} className={`flex items-center gap-1.5 font-sans text-[12px] transition-colors duration-200 ${ok ? "text-white/80" : "text-white/35"}`}>
                <span className={`relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-solid transition-colors duration-200 ${ok ? "border-[#00C864] bg-[#00C864]" : "border-white/25"}`}>
                  <AnimatePresence>
                    {ok && (
                      <motion.svg
                        width="8" height="8" viewBox="0 0 12 12"
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </span>
                {shortLabels[r.id] || r.label}
              </div>
            );
          })}
        </div>
      </div>
    </Collapse>
  );
}

// --- Butoane -----------------------------------------------------------------
export function PrimaryButton({ children, loading, disabled, className = "", ...props }) {
  const off = disabled || loading;
  return (
    <motion.button
      {...props}
      disabled={off}
      whileTap={off ? {} : { scale: 0.98 }}
      className={`relative flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-0 bg-white px-5 font-sans text-[15px] font-semibold text-black transition-[background-color,opacity] duration-200 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {loading ? <Spinner dark /> : children}
    </motion.button>
  );
}

export function OutlineButton({ children, disabled, className = "", ...props }) {
  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={`relative flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border border-solid border-white/[0.12] bg-transparent px-5 font-sans text-[15px] font-medium text-white transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function TextButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline ${className}`}
    >
      {children}
    </button>
  );
}

// Eticheta mică "Ultima dată" lipită pe butonul folosit la login-ul anterior.
export function LastUsedTag() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4, duration: 0.3, ease: EASE }}
      className="absolute -top-2 right-3 rounded-full bg-[#FF3366] px-2 py-[2px] font-sans text-[10px] font-semibold tracking-[0.02em] text-white"
    >
      Ultima dată
    </motion.span>
  );
}

// --- Mesaj de eroare inline ------------------------------------------------
export function ErrorNote({ children }) {
  return (
    <Collapse show={!!children}>
      <div role="alert" className="flex items-start gap-2 rounded-[12px] border border-solid border-[#FF3366]/25 bg-[#FF3366]/[0.08] px-3.5 py-2.5 text-left font-sans text-[13px] leading-snug text-[#FF6B8A]">
        <WarningIcon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{children}</span>
      </div>
    </Collapse>
  );
}

// --- Checkbox custom ---------------------------------------------------------
export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-left">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={`mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border border-solid transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 ${
          checked ? "border-white bg-white" : "border-white/25 bg-transparent"
        }`}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              width="11" height="11" viewBox="0 0 12 12"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.path
                d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.2 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      <span className="font-sans text-[13px] leading-[1.45] text-white/55">{children}</span>
    </label>
  );
}

// --- Input cod OTP (6 căsuțe) ----------------------------------------------
// Avansează automat, suportă paste al codului întreg și backspace înapoi.
export function OtpInput({ length = 6, value, onChange, onComplete, invalid, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  const setAt = (i, ch) => {
    const next = digits.slice();
    next[i] = ch;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (joined.length === length && !joined.includes("")) onComplete?.(joined);
  };

  const handleChange = (i, raw) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    if (clean.length > 1) {
      // paste sau autofill din SMS/email — distribuim pe căsuțe
      const merged = (digits.slice(0, i).join("") + clean).slice(0, length);
      onChange(merged);
      refs.current[Math.min(merged.length, length - 1)]?.focus();
      if (merged.length === length) onComplete?.(merged);
      return;
    }
    setAt(i, clean);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        onChange(digits.slice(0, i).join(""));
      } else if (i > 0) {
        onChange(digits.slice(0, i - 1).join(""));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <motion.div
      className="flex justify-between gap-2"
      animate={invalid ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {digits.map((d, i) => (
        <motion.input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Cifra ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.35, ease: EASE }}
          className={`h-[58px] w-full min-w-0 rounded-[14px] border border-solid bg-white/[0.03] text-center font-mono text-[22px] font-medium text-white outline-none transition-colors duration-200 focus:border-white/40 focus:bg-white/[0.06] disabled:opacity-50 ${
            invalid ? "border-[#FF3366]/60" : d ? "border-white/25" : "border-white/[0.09]"
          }`}
        />
      ))}
    </motion.div>
  );
}
