import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";
import FollowListSheet from "./FollowListSheet";
import PhotoViewerModal from "./PhotoViewerModal";
import { filterActiveEvents, formatEventDateTime } from "../utils/eventTime";
import { MoonIcon, LightningIcon, HouseIcon, CheckCircleIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";
import { useSwipeBack } from "../utils/useSwipeBack";

const convertPostedEvent = (e) => ({
  id: `posted_${e.id}`,
  rawId: e.id,
  code: e.code,
  type: e.type || "homemade",
  title: e.title,
  venue: e.venue || "Locație necunoscută",
  location_visible: !!e.location_visible,
  date: (e.event_date && formatEventDateTime(e.event_date)) || e.date || "",
  event_date: e.event_date || null,
  price: e.price || "Gratuit",
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  cover_url: e.cover_url,
});

export default function PublicProfilePage({ profileUserId, currentUser, onBack, onOpenEvent, onViewProfile }) {
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [followSheet, setFollowSheet] = useState(null); // "followers" | "following" | null
  const [showPhoto, setShowPhoto] = useState(false);

  const isSelf = currentUser?.id === profileUserId;
  const containerRef = useRef(null);
  const swipeBack = useSwipeBack(containerRef, onBack);
  const followNotifyTimer = useRef(null);

  useEffect(() => {
    loadEverything();
    const channel = supabase
      .channel(`follows_${profileUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${profileUserId}` }, loadCounts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profileUserId]);

  // Scoate live evenimentele care expiră cât timp userul stă pe profil.
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => filterActiveEvents(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadEverything = async () => {
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", profileUserId).single();
    setProfile(prof);
    const { data: evs } = await supabase.from("posted_events_feed").select("*").eq("user_id", profileUserId).eq("archived", false).or("type.neq.official,verified.eq.true").order("created_at", { ascending: false });
    setEvents(filterActiveEvents(evs).map(convertPostedEvent));
    await loadCounts();
    if (currentUser) {
      const { data: rel } = await supabase.from("follows").select("id").eq("follower_id", currentUser.id).eq("following_id", profileUserId).maybeSingle();
      setIsFollowing(!!rel);
      const { data: relBack } = await supabase.from("follows").select("id").eq("follower_id", profileUserId).eq("following_id", currentUser.id).maybeSingle();
      setFollowsMe(!!relBack);
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
      clearTimeout(followNotifyTimer.current); // te-ai răzgândit înainte să apuce să trimită
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profileUserId);
      setIsFollowing(false);
      setFollowers(f => Math.max(0, f - 1));
    } else {
      await supabase.from("follows").upsert([{ follower_id: currentUser.id, following_id: profileUserId }], { onConflict: "follower_id,following_id" });
      setIsFollowing(true);
      setFollowers(f => f + 1);
      // Debounce, ca la like — follow/unfollow rapid repetat trimitea o
      // notificare la fiecare apăsare.
      const followerName = [currentUser.user_metadata?.prenume, currentUser.user_metadata?.nume].filter(Boolean).join(" ") || currentUser.email?.split("@")[0] || "Cineva";
      clearTimeout(followNotifyTimer.current);
      followNotifyTimer.current = setTimeout(() => {
        notifyUser({
          targetUserId: profileUserId,
          title: "Urmăritor nou",
          body: `${followerName} a început să te urmărească.`,
          type: "follower",
          actorId: currentUser.id,
        });
      }, 2000);
    }
    setBusy(false);
  };

  const displayName = profile ? [profile.prenume, profile.nume].filter(Boolean).join(" ") || "Utilizator" : "Utilizator";

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.6)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={32} /></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80, ...swipeBack.style }}>
      {/* Header cu back */}
      <div style={{ padding: "50px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "8px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>← Înapoi</button>
      </div>

      {/* Avatar + nume */}
      <div style={{ padding: "24px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          onClick={() => profile?.avatar_url && setShowPhoto(true)}
          style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,51,102,0.4)", background: profile?.avatar_url ? "transparent" : "linear-gradient(135deg, #FF3366, #B44FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800, color: "#fff", marginBottom: 14, cursor: profile?.avatar_url ? "pointer" : "default" }}
        >
          {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : displayName.charAt(0).toUpperCase()}
        </div>
        {showPhoto && createPortal(<PhotoViewerModal src={profile.avatar_url} onClose={() => setShowPhoto(false)} />, document.body)}
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{displayName}</div>
        {profile?.hobby && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8, maxWidth: 300 }}>{profile.hobby}</div>}

        {/* Statistici */}
        <div style={{ display: "flex", gap: 28, marginTop: 20, marginBottom: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{events.length}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Evenimente</div>
          </div>
          <button onClick={() => setFollowSheet("followers")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center", padding: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{followers}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Urmăritori</div>
          </button>
          <button onClick={() => setFollowSheet("following")} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center", padding: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{following}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>Urmărește</div>
          </button>
        </div>

        {/* Buton Follow */}
        {!isSelf && currentUser && (
          <button onClick={toggleFollow} disabled={busy} style={{
            width: "100%", maxWidth: 300, padding: "13px", borderRadius: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            border: isFollowing ? "1px solid rgba(255,255,255,0.2)" : "none",
            background: isFollowing ? "rgba(255,255,255,0.06)" : "linear-gradient(120deg, #FF3366, #B44FFF)",
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
            boxShadow: isFollowing ? "none" : "0 6px 24px rgba(255,51,102,0.35)",
          }}>
            {isFollowing ? <><CheckCircleIcon size={15} /> Urmărești</> : (followsMe ? "Urmărește înapoi" : "+ Urmărește")}
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
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><MoonIcon size={32} /></div>
            <div style={{ fontSize: 13 }}>Niciun eveniment încă</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {events.map(event => (
              <button key={event.id} onClick={() => onOpenEvent && onOpenEvent(event)} style={{ textAlign: "left", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: event.cover_url ? "transparent" : `${event.color}20`, border: `1px solid ${event.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: event.color, flexShrink: 0, overflow: "hidden" }}>
                  {event.cover_url ? <img src={event.cover_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    {event.location_visible ? event.venue : "Zonă aproximativă"} · {event.date}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {followSheet && (
        <FollowListSheet
          userId={profileUserId}
          mode={followSheet}
          onClose={() => setFollowSheet(null)}
          onViewProfile={(uid) => onViewProfile && onViewProfile(uid)}
        />
      )}
    </div>
  );
}
