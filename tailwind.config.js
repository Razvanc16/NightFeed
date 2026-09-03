/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // "sans" (font-sans) e utilitarul implicit de text din tot restul
        // Landing/Auth — DM Sans, ca să fie identic cu textul de corp din
        // restul aplicației (inline styles). "syne" (font-syne) e pentru
        // titluri/accente, la fel ca fontFamily: "'Syne'" din componentele
        // cu inline styles.
        sans: ["'DM Sans'", "sans-serif"],
        syne: ["'Syne'", "sans-serif"],
        dm: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      colors: {
        nf: {
          bg: "#09090b",
          pink: "#FF3366",
          purple: "#B44FFF",
          coral: "#FF6B35",
        },
      },
      boxShadow: {
        glow: "0 0 60px rgba(255,51,102,0.35)",
      },
    },
  },
  // Scoped la componenta de landing nouă — restul aplicației folosește inline
  // styles, deci preflight-ul Tailwind nu trebuie să lupte cu ele.
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
