import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const convertPostedEvent = (e) => ({
  id: `posted_${e.id}`,
  rawId: e.id,
  code: e.code,
  type: e.type || "homemade",
  title: e.title,
  venue: e.venue || "Locație necunoscută",
  date: e.date || "",
  price: e.price || "Gratuit",
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  cover_url: e.cover_url,
});

export default function PublicProfilePage({ profileUserId, currentUser, onBack, onOpenEvent }) {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [events, setEvents] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isSelf = currentUser?.id === profileUserId;

  useEffect(() => {
    loadEverything();
    const channel = supabase
      .channel(`follows_${profileUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${profileUserId}` }, loadCounts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profileUserId]);

  const loadEverything = async () => {
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", profileUserId).single();
    setProfile(prof);
    const { data: uname } = await supabase.from("usernames").select("username").eq("user_id", profileUserId).single();
    setUsername(uname?.username || "");
    const { data: evs } = await supabase.from("posted_events").select("*").eq("user_id", profileUserId).order("created_at", { ascending: false });
    setEvents((evs || []).map(convertPostedEvent));
    await loadCounts();
    if (currentUser) {
      const { data: rel } = await supabase.from("follows").select("id").eq("follower_id", currentUser.id).eq("following_id", profileUserId).maybeSingle();
      setIsFollowing(!!rel);
    }
    setLoading(false);
  };

  const loadCounts = async () => {
    const { count: fCount } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileUserId);
    setFollowers(fCount || 0);
    const { count: gCount } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileUserId);
    setFollowing(gCount || 0);
  };

  const toggleFollow = async () => {
    if (!currentUser || isSelf || busy) return;
    setBusy(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profileUserId);
      setIsFollowing(false);
      setFollowers(f => Math.max(0, f - 1));
    } else {
      await supabase.from("follows").insert([{ follower_id: currentUser.id, following_id: profileUserId }]);
      setIsFollowing(true);
      setFollowers(f => f + 1);
    }
    setBusy(false);
  };

  const displayName = profile ? [profile.prenume, profile.nume].filter(Boolean).join(" ") || username || "Utilizator" : "Utilizator";

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 32, animation: "pulse 1.5s ease-in-out infinite" }}>🌙</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80 }}>
      {/* Header cu back */}
      <div style={{ padding: "50px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>← Înapoi</button>
      </div>

      {/* Avatar + nume */}
      <div style={{ padding: "24px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,51,102,0.4)", background: profile?.avatar_url ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800, color: "#fff", marginBottom: 14 }}>
          {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{displayName}</div>
        {username && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>@{username}</div>}
        {profile?.hobby && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8, maxWidth: 300 }}>{profile.hobby}</div>}

        {/* Statistici */}
        <div style={{ display: "flex", gap: 28, marginTop: 20, marginBottom: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{events.length}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Evenimente</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{followers}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Urmăritori</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{following}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Urmărește</div>
          </div>
        </div>

        {/* Buton Follow */}
        {!isSelf && currentUser && (
          <button onClick={toggleFollow} disabled={busy} style={{
            width: "100%", maxWidth: 300, padding: "13px", borderRadius: 30, cursor: "pointer",
            border: isFollowing ? "1px solid rgba(255,255,255,0.2)" : "none",
            background: isFollowing ? "rgba(255,255,255,0.06)" : "linear-gradient(120deg, #FF3366, #B44FFF)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
            boxShadow: isFollowing ? "none" : "0 6px 24px rgba(255,51,102,0.35)",
          }}>
            {isFollowing ? "✓ Urmărești" : "+ Urmărește"}
          </button>
        )}
      </div>

      {/* Evenimentele organizatorului */}
      <div style={{ padding: "30px 20px 0" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          Evenimentele lui {profile?.prenume || displayName}
        </div>
        {events.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.35)" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🌙</div>
            <div style={{ fontSize: 13 }}>Niciun eveniment încă</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {events.map(event => (
              <button key={event.id} onClick={() => onOpenEvent && onOpenEvent(event)} style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: event.cover_url ? "transparent" : `${event.color}20`, border: `1px solid ${event.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, overflow: "hidden" }}>
                  {event.cover_url ? <img src={event.cover_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (event.type === "official" ? "⚡" : "🏠")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    {event.type === "homemade" ? "Zonă aproximativă" : event.venue} · {event.date}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
