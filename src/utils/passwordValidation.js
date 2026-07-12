// Reguli de parolă puternică, folosite la înregistrare și la resetarea parolei
export const passwordRequirements = [
  { id: "length", label: "Minim 8 caractere", test: (pw) => pw.length >= 8 },
  { id: "upper", label: "Cel puțin o literă mare (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "Cel puțin o literă mică (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "Cel puțin o cifră (0-9)", test: (pw) => /[0-9]/.test(pw) },
];

export const validatePassword = (pw) => passwordRequirements.every((r) => r.test(pw));

export const getPasswordStrength = (pw) => {
  if (!pw) return { label: "", color: "rgba(255,255,255,0.3)", percent: 0 };
  const passed = passwordRequirements.filter((r) => r.test(pw)).length;
  if (passed <= 1) return { label: "Slabă", color: "#FF3366", percent: 33 };
  if (passed <= 3) return { label: "Medie", color: "#FFB800", percent: 66 };
  return { label: "Puternică", color: "#00C864", percent: 100 };
};
