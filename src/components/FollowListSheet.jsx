import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { MoonIcon } from "./Icons";

// Listă de utilizatori (urmăritori sau urmăriri) pentru un profil — deschisă
// prin apăsare pe numărul de "Urmăritori" / "Urmărește" din ProfilePage / PublicProfilePage.
export default function FollowListSheet({ userId, mode, onClose, onViewProfile }) {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);

  useEffect(() => {
    if (!userId || !mode) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  const load = async () => {
    setLoading(true);
    // "followers" = cine mă urmărește pe mine → caut rândurile unde following_id = userId, iau follower_id
    // "following" = pe cine urmăresc eu → caut rândurile unde follower_id = userId, iau following_id
    const col = mode === "followers" ? "following_id" : "follower_id";
    const otherCol = mode === "followers" ? "follower_id" : "following_id";
    const { data: rels } = await supabase.from("follows").select(otherCol).eq(col, userId);
    const ids = [...new Set((rels || []).map(r => r[otherCol]))];

    if (ids.length === 0) { setPeople([]); setLoading(false); return; }

    const [{ data: profiles }, { data: usernames }] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", ids),
      supabase.from("usernames").select("*").in("user_id", ids),
    ]);
    const unameMap = Object.fromEntries((usernames || []).map(u => [u.user_id, u.username]));
    const merged = ids
      .map(id => {
        const p = (profiles || []).find(pr => pr.user_id === id);
        return {
          user_id: id,
          displayName: p ? [p.prenume, p.nume].filter(Boolean).join(" ") : "",
          username: unameMap[id] || "",
          avatar_url: p?.avatar_url || null,
        };
      })
      .filter(p => p.displayName || p.username);
    setPeople(merged);
    setLoading(false);
  };

  const title = mode === "followers" ? "Urmăritori" : "Urmărește";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10050, background: "#080808", animation: "tabEnter 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "50px 20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>← Înapoi</button>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{title}</div>
      </div>

      <div style={{ height: "calc(100% - 76px)", overflowY: "auto", padding: "12px 16px 40px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.5)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={28} /></div>
          </div>
        ) : people.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(255,255,255,0.4)" }}>
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}><MoonIcon size={32} /></div>
            <div style={{ fontSize: 14 }}>{mode === "followers" ? "Niciun urmăritor încă." : "Nu urmărește pe nimeni încă."}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {people.map(p => (
              <button
                key={p.user_id}
                onClick={() => { onViewProfile && onViewProfile(p.user_id); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: p.avatar_url ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>
                  {p.avatar_url ? <img src={p.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.displayName || p.username || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.displayName || p.username || "Utilizator"}</div>
                  {p.username && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>@{p.username}</div>}
                </div>
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 16 }}>›</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
