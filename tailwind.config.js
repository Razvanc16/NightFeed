/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Fontul de sistem peste tot (San Francisco pe iPhone, Segoe UI pe
        // Windows) — aceeași stivă ca în inline styles din restul aplicației.
        // "syne"/"dm" rămân ca alias-uri, ca să nu rupem clasele existente.
        sans: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        syne: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        dm: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "'SF Mono'", "Menlo", "Monaco", "monospace"],
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
