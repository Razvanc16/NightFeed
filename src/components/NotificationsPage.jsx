import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { HeartOutlineIcon, SpeechBubbleIcon, EnvelopeIcon, PersonIcon, BellOffIcon, LightningIcon, CheckCircleIcon } from "./Icons";

const ICONS = { like: HeartOutlineIcon, comment: SpeechBubbleIcon, request: EnvelopeIcon, follower: PersonIcon, official_request: LightningIcon };
const COLORS = { like: "#FF3366", comment: "#4FC3F7", request: "#FFB800", follower: "#B44FFF", official_request: "#FF3366" };

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `acum ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `acum ${h} ${h === 1 ? "oră" : "ore"}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `acum ${d} ${d === 1 ? "zi" : "zile"}`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
};

// Tab propriu în bara de jos (vezi Navbar.jsx / App.jsx) — nu mai e o filă
// ascunsă în Profil, deci are propriul header (ca la Căutare/Hartă) în loc
// de un ecran modal cu buton "Înapoi".
export default function NotificationsPage({ user, onViewProfile, onOpenEvent, onOpenLikes, onOpenAttending, onOpenRequests, onOpenAdminApproval }) {
  const [notifications, setNotifications] = useState([]);
  const [avatars, setAvatars] = useState({});
  const [loading, setLoading] = useState(true);
  // "Necitite" filtrează pe starea locală, "înghețată" la momentul încărcării
  // (vezi load()) — nu pe cea din bază, care se marchează citită imediat ce
  // le vezi. Așa poți totuși distinge, în vizita curentă, ce era nou.
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new, ...prev])
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    setNotifications(data || []);
    setLoading(false);

    const actorIds = [...new Set((data || []).map(n => n.actor_id).filter(Boolean))];
    if (actorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, avatar_url").in("user_id", actorIds);
      setAvatars(Object.fromEntries((profiles || []).map(p => [p.user_id, p.avatar_url])));
    }

    // Le marcăm ca citite după ce le-ai văzut — badge-ul din bara de jos se
    // resetează data viitoare când deschizi lista.
    const unreadIds = (data || []).filter(n => !n.read).map(n => n.id);
    if (unreadIds.length) await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  };

  const handleDismiss = async (id) => {
    // Optimist — dispare imediat din listă, nu așteptăm răspunsul serverului.
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    setNotifications(prev => prev.map(n => n.read ? n : { ...n, read: true }));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  };

  const visible = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80 }}>
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Notificări</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>
            {unreadCount > 0 ? `${unreadCount} necitite` : "Ești la zi"}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{ flexShrink: 0, marginTop: 4, display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <CheckCircleIcon size={13} /> Marchează tot citit
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "14px 20px" }}>
        {[{ id: "all", label: "Toate" }, { id: "unread", label: `Necitite${unreadCount ? ` (${unreadCount})` : ""}` }].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "6px 14px", borderRadius: 20, cursor: "pointer",
              background: filter === f.id ? "rgba(255,51,102,0.9)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${filter === f.id ? "#FF3366" : "rgba(255,255,255,0.14)"}`,
              color: filter === f.id ? "#fff" : "rgba(255,255,255,0.6)",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              transition: "all 0.2s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Se încarcă...</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 24px" }}>
            <div style={{ marginBottom: 12, color: "rgba(255,255,255,0.25)", display: "flex", justifyContent: "center" }}><BellOffIcon size={36} /></div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
              {filter === "unread" ? "Nicio notificare necitită" : "Nicio notificare încă"}
            </div>
          </div>
        ) : visible.map(n => {
          const Icon = ICONS[n.type] || EnvelopeIcon;
          const color = COLORS[n.type] || "#FF3366";
          const avatarUrl = n.actor_id ? avatars[n.actor_id] : null;
          // Atingerea pozei duce mereu la profilul actorului. Atingerea
          // restului rândului duce, pentru aprecieri de EVENIMENT, direct la
          // lista celor care au apreciat (nu doar la eveniment — asta era
          // ideea notificării) — dar o apreciere de COMENTARIU (are comment_id)
          // duce la eveniment cu comentariul respectiv deschis, nu la lista
          // generică, altfel nu ajungi niciodată la comentariul apreciat;
          // pentru "cerere acceptată", la tab-ul Particip (de-acolo poți intra
          // mai departe în petrecerea propriu-zisă — vezi onClick-ul
          // cardurilor din Particip); pentru "cerere nouă" (hostul o
          // primește), direct la Cereri pentru evenimentul respectiv; pentru
          // comentarii, la eveniment cu comentariul respectiv deschis; altfel,
          // ca înainte, la profilul actorului (follower, cerere refuzată
          // etc., care n-au un loc mai specific unde să ducă).
          const rowGoesToLikes = n.type === "like" && !n.comment_id && !!(n.event_id && onOpenLikes);
          const rowGoesToAttending = !rowGoesToLikes && n.type === "request" && n.title === "Cerere acceptată!" && !!onOpenAttending;
          const rowGoesToRequests = !rowGoesToLikes && !rowGoesToAttending && n.type === "request" && n.title === "Cerere nouă de participare" && !!(n.event_id && onOpenRequests);
          // Evenimentul oficial nu e vizibil în feed cât nu e aprobat (nu are
          // rost onOpenEvent, n-ar găsi nimic) — direct la Admin, unde chiar
          // poate fi aprobat/respins.
          const rowGoesToAdmin = !rowGoesToLikes && !rowGoesToAttending && !rowGoesToRequests && n.type === "official_request" && !!onOpenAdminApproval;
          const rowGoesToEvent = !rowGoesToLikes && !rowGoesToAttending && !rowGoesToRequests && !rowGoesToAdmin && !!(n.event_id && onOpenEvent);
          const rowGoesToProfile = !rowGoesToLikes && !rowGoesToAttending && !rowGoesToRequests && !rowGoesToAdmin && !rowGoesToEvent && !!(n.actor_id && onViewProfile);
          const rowClickable = rowGoesToLikes || rowGoesToAttending || rowGoesToRequests || rowGoesToAdmin || rowGoesToEvent || rowGoesToProfile;
          const avatarClickable = !!(n.actor_id && onViewProfile);
          const handleRowClick = () => {
            // Spre eveniment/Particip/Cereri: schimbă tab-ul, n-are sens să
            // rămână deschisă pe sub el. Spre listă de aprecieri/profil: sunt
            // overlay-uri peste tot (zIndex mai mare decât 300 de aici) — le
            // lăsăm deschisă dedesubt, ca "Înapoi"/"Închide" să te aducă
            // înapoi la notificări, nu să te scoată de tot din ele.
            if (rowGoesToLikes) { onOpenLikes(n.event_id); }
            else if (rowGoesToAttending) { onOpenAttending(); }
            else if (rowGoesToRequests) { onOpenRequests(n.event_id.replace("posted_", "")); }
            else if (rowGoesToAdmin) { onOpenAdminApproval(); }
            else if (rowGoesToEvent) { onOpenEvent(n.event_id, n.comment_id); }
            else if (rowGoesToProfile) { onViewProfile(n.actor_id); }
          };
          return (
            <div
              key={n.id}
              onClick={rowClickable ? handleRowClick : undefined}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: n.read ? "rgba(255,255,255,0.03)" : `${color}0d`, border: `1px solid ${n.read ? "rgba(255,255,255,0.07)" : color + "30"}`, cursor: rowClickable ? "pointer" : "default" }}
            >
              <div
                onClick={avatarClickable ? (e) => { e.stopPropagation(); onViewProfile(n.actor_id); } : undefined}
                style={{ position: "relative", flexShrink: 0, cursor: avatarClickable ? "pointer" : "default" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: avatarUrl ? "transparent" : `${color}20`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                  {avatarUrl ? <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon size={16} />}
                </div>
                {avatarUrl && (
                  <div style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%", background: color, border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                    <Icon size={9} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}
                  aria-label="Șterge notificarea"
                  style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 16, lineHeight: 1 }}
                >
                  ×
                </button>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
