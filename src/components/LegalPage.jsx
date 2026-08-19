// Politică de Confidențialitate + Termeni de Utilizare — DRAFT.
// Conținutul de mai jos e un punct de plecare rezonabil, nu consultanță juridică.
// Trebuie revizuit de un avocat înainte de lansarea publică, mai ales după ce
// NightFeed SRL este efectiv înregistrată (CUI, sediu social, date complete).

import { WarningIcon } from "./Icons";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>{children}</div>
  </div>
);

export default function LegalPage({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10200, background: "#080808", animation: "pageSlideInRight 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "50px 20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>← Înapoi</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Confidențialitate & Termeni</div>
      </div>

      <div style={{ height: "calc(100% - 76px)", overflowY: "auto", padding: "20px 20px 60px" }}>
        <div style={{ padding: "10px 14px", background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)", borderRadius: 12, fontSize: 12, color: "#FFB800", fontFamily: "'DM Sans', sans-serif", marginBottom: 24, lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <WarningIcon size={16} style={{ flexShrink: 0, marginTop: 1 }} /> Document draft, generat ca punct de plecare. Nu înlocuiește sfatul unui avocat — recomandăm revizuire juridică înainte de lansarea publică a aplicației.
        </div>

        <Section title="1. Cine suntem">
          NightFeed este operat de <strong style={{ color: "#fff" }}>NightFeed SRL</strong> (societate în curs de înființare), asociați Chiceanu Armand Răzvan și Ionescu Victor Mihai. Până la finalizarea înregistrării firmei, operatorul de date este persoana fizică Chiceanu Armand Răzvan. Pentru orice solicitare legată de datele tale personale, ne poți scrie la <a href="mailto:contact@nightfeed.ro" style={{ color: "#FF3366" }}>contact@nightfeed.ro</a>.
        </Section>

        <Section title="2. Ce date colectăm">
          Email și parolă (parola nu e stocată în clar, ci criptată de furnizorul nostru de autentificare); prenume, nume, vârstă, gen, bio, poză de profil — dacă le completezi; evenimentele pe care le postezi (titlu, descriere, locație și coordonate, dată/oră, poză de copertă); like-uri, participări, urmăritori/urmăriri; și date tehnice minime necesare funcționării (sesiune de autentificare, iar dacă activezi notificările push, un identificator tehnic al dispozitivului folosit strict pentru a-ți trimite acele notificări).
        </Section>

        <Section title="3. De ce le colectăm și temeiul legal">
          Folosim aceste date ca să putem oferi serviciul pe care ți l-ai creat cont să-l folosești: afișarea profilului tău, a evenimentelor postate de tine sau de alți useri, funcția de hartă, follow/followers. Temeiul legal e, în principal, executarea contractului dintre tine și noi (ai creat un cont ca să folosești aplicația) și interesul legitim de a face aplicația funcțională ca rețea socială.
        </Section>

        <Section title="4. Cui le împărtășim">
          Datele sunt găzduite și procesate de furnizori terți pe care îi folosim ca infrastructură: Supabase (bază de date, autentificare, stocare fișiere) și Vercel (găzduire aplicație). Nu vindem și nu împărtășim datele tale cu terți în scop de marketing.
        </Section>

        <Section title="5. Cât timp le păstrăm">
          Cât timp contul tău e activ. Dacă îți ștergi contul din aplicație, datele tale personale și conținutul postat sunt șterse; păstrarea unor date minime (ex. în scop de evidență contabilă/legală) se face doar dacă legea o cere explicit.
        </Section>

        <Section title="6. Drepturile tale">
          Ai dreptul de acces, rectificare, ștergere, portabilitate și opoziție cu privire la datele tale. Poți să-ți ștergi contul direct din aplicație (Profil → Șterge contul) sau să ne ceri asta prin email. Îți poți retrage oricând consimțământul acolo unde procesarea se bazează pe consimțământ.
        </Section>

        <Section title="7. Securitate">
          Parolele sunt criptate (hash), conexiunea cu aplicația e criptată (HTTPS), iar accesul la datele din baza de date e restricționat prin reguli de tip Row Level Security — fiecare user poate modifica/șterge direct doar propriile date.
        </Section>

        <Section title="8. Sesiune și stocare locală">
          Folosim `localStorage` din browser/telefon pentru a păstra sesiunea de autentificare activă, ca să nu fii nevoit să te loghezi la fiecare deschidere a aplicației. Această stocare e strict necesară funcționării contului și nu e folosită pentru marketing sau urmărire.
        </Section>

        <Section title="9. Vârstă minimă">
          Aplicația e destinată persoanelor de minim 16 ani — confirmi asta explicit la crearea contului. Unele evenimente postate de useri pot fi marcate suplimentar ca fiind destinate exclusiv persoanelor de 18+ ani — acest marcaj e informativ, stabilit de hostul evenimentului, și nu implică o verificare automată de vârstă.
        </Section>

        <Section title="10. Termeni de utilizare — reguli de conduită">
          Prin folosirea aplicației, te angajezi să nu postezi conținut ilegal, înșelător sau care încalcă drepturile altor persoane, să nu folosești aplicația pentru hărțuire sau spam, și să respecți regulile evenimentelor la care participi. Ne rezervăm dreptul de a suspenda conturi care încalcă aceste reguli.
        </Section>

        <Section title="11. Modificări">
          Putem actualiza acest document pe măsură ce aplicația evoluează. Modificările importante vor fi comunicate în aplicație.
        </Section>

        <Section title="12. Răspundere pentru evenimente">
          NightFeed este o platformă care conectează oameni și evenimente — nu organizăm, nu supraveghem și nu suntem parte la niciun eveniment postat de useri. Fiecare eveniment e organizat pe propria răspundere a hostului, iar participarea e pe propria răspundere a fiecărui participant. NightFeed nu răspunde pentru incidente, vătămări, pierderi, conduită necorespunzătoare, activități ilegale, anulări sau orice altă situație neplăcută petrecută înainte, în timpul sau după un eveniment postat prin aplicație. Prin postarea sau participarea la un eveniment, confirmi că înțelegi și accepți acest lucru.
        </Section>
      </div>
    </div>
  );
}
