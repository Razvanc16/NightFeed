// Doar pt. UI (arată/ascunde butonul "Admin") — NU e mecanismul real de
// securitate. Verificarea care contează e server-side, în is_admin() (SQL,
// vezi supabase/2026-09-04_admin_panel.sql) și în admin-action (Edge
// Function) — ambele verifică din nou emailul la fiecare cerere, deci un
// user care ar reuși să vadă butonul fără să fie admin tot n-ar putea face
// nimic. Ține lista sincronizată manual cu cele două locuri de mai sus.
export const ADMIN_EMAILS = ["rchiceanu@gmail.com", "ivictorcebuc@gmail.com"];

export const isAdminUser = (user) => !!user?.email && ADMIN_EMAILS.includes(user.email);
