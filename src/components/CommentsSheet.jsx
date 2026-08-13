import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { SpeechBubbleIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";

const HeartIcon = ({ filled, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#FF3366" : "none"} stroke={filled ? "#FF3366" : "rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const formatTime = (ts) => new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

// Definit în afara CommentsSheet (nu inline în render) — altfel ar fi un tip
// de componentă nou la fiecare re-render al părintelui, iar React ar
// demonta/remonta toate rândurile de fiecare dată (rulau din nou animația de
// intrare simultan, arătând ca un glitch la fiecare actualizare de state).
const CommentRow = ({ c, isReply, color, avatarUrl, likeCount, isLiked, onToggleLike, onReply }) => (
  <div style={{ marginBottom: isReply ? 10 : 14, display: "flex", gap: 10, alignItems: "flex-start", animation: "slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
    <div style={{
      width: isReply ? 26 : 32, height: isReply ? 26 : 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: avatarUrl ? "transparent" : `${color}30`, border: `1px solid ${color}50`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: isReply ? 11 : 13, fontWeight: 700, color, fontFamily: "'DM Mono', monospace",
    }}>
      {avatarUrl ? <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.username || "U")[0].toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans', sans-serif" }}>{c.username || "User"}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>{formatTime(c.created_at)}</span>
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>{c.text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
        <button onClick={onToggleLike} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <HeartIcon filled={isLiked} size={13} />
          {likeCount > 0 && (
            <span style={{ fontSize: 11, color: isLiked ? "#FF3366" : "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>{likeCount}</span>
          )}
        </button>
        <button onClick={onReply} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
          Răspunde
        </button>
      </div>
    </div>
  </div>
);

export default function CommentsSheet({ event, user, open, onClose }) {
  // Ținem ultimul event valid și cât timp se închide sheet-ul (event devine
  // null în același render în care open devine false) — altfel componenta
  // s-ar demonta instant, fără să apuce să joace tranziția de translateY.
  const [displayEvent, setDisplayEvent] = useState(event);
  useEffect(() => { if (event) setDisplayEvent(event); }, [event]);

  const [comments, setComments] = useState([]);
  const [avatars, setAvatars] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [myLikes, setMyLikes] = useState(new Set());
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // { id, username }
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const listRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false); // adevărat cât timp sheet-ul urmărește efectiv degetul
  const dragYRef = useRef(0);
  const setDragYValue = (v) => { dragYRef.current = v; setDragY(v); };

  useEffect(() => {
    if (!open || !event) return;
    loadComments();

    const channel = supabase
      .channel(`comments:${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `event_id=eq.${event.id}` },
        (payload) => setComments(prev => [...prev, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [open, event?.id]);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [comments, open]);

  // Swipe în jos ca să închizi — poți începe atingerea oriunde (chiar și
  // scrolat jos în listă): lași scroll-ul normal să se întâmple până lista
  // ajunge sus, iar din acel moment tragerea în jos convertește automat
  // gestul într-un drag-to-close, fără să trebuiască să ridici degetul.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !open) return;

    let touchY = null;
    let dragging = false;

    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
      dragging = false;
      draggingRef.current = false;
    };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      const currentY = e.touches[0].clientY;
      const delta = currentY - touchY;

      if (!dragging) {
        const atTop = !listRef.current || listRef.current.scrollTop <= 0;
        if (delta > 6 && atTop) {
          dragging = true;
          draggingRef.current = true;
        } else {
          return; // scroll normal al listei, nu tragem sheet-ul încă
        }
      }

      if (delta < 0) {
        dragging = false;
        draggingRef.current = false;
        touchY = null;
        setDragYValue(0);
        return;
      }

      e.preventDefault();
      setDragYValue(delta);
    };
    const onTouchEnd = () => {
      if (dragging && dragYRef.current > 90) {
        onClose();
      }
      touchY = null;
      dragging = false;
      draggingRef.current = false;
      setDragYValue(0);
    };

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, onClose]);

  const loadComments = async () => {
    setLoading(true);
    const { data } = await supabase.from("comments").select("*").eq("event_id", event.id).order("created_at", { ascending: true });
    setComments(data || []);
    setLoading(false);

    const userIds = [...new Set((data || []).map(c => c.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, avatar_url").in("user_id", userIds);
      setAvatars(Object.fromEntries((profiles || []).map(p => [p.user_id, p.avatar_url])));
    } else {
      setAvatars({});
    }

    const ids = (data || []).map(c => c.id);
    if (!ids.length) { setLikeCounts({}); setMyLikes(new Set()); return; }
    const { data: likes } = await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", ids);
    const counts = {};
    const mine = new Set();
    (likes || []).forEach(l => {
      counts[l.comment_id] = (counts[l.comment_id] || 0) + 1;
      if (l.user_id === user?.id) mine.add(l.comment_id);
    });
    setLikeCounts(counts);
    setMyLikes(mine);
  };

  const toggleLike = async (comment) => {
    if (!user) { alert("Trebuie să fii autentificat pentru a aprecia!"); return; }
    const isLiked = myLikes.has(comment.id);
    setMyLikes(prev => { const s = new Set(prev); isLiked ? s.delete(comment.id) : s.add(comment.id); return s; });
    setLikeCounts(prev => ({ ...prev, [comment.id]: Math.max(0, (prev[comment.id] || 0) + (isLiked ? -1 : 1)) }));
    if (isLiked) {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", user.id);
    } else {
      await supabase.from("comment_likes").insert([{ comment_id: comment.id, user_id: user.id }]);
      if (comment.user_id && comment.user_id !== user.id) {
        const likerName = user.user_metadata?.username || user.email?.split("@")[0] || "Cineva";
        notifyUser({
          targetUserId: comment.user_id,
          title: "Apreciere nouă",
          body: `${likerName} ți-a apreciat comentariul la ${event.title}`,
          type: "like",
          actorId: user.id,
        });
      }
    }
  };

  const startReply = (comment) => {
    setReplyingTo({ id: comment.parent_id || comment.id, username: comment.username || "User" });
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (!user) { alert("Trebuie să fii autentificat pentru a comenta!"); return; }
    setSending(true);
    const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";
    const parent_id = replyingTo?.id || null;
    const { error } = await supabase.from("comments").insert([{
      event_id: event.id, user_id: user.id, username, text: text.trim(), parent_id,
    }]);
    if (!error) {
      setText("");
      if (event.organizer_id && event.organizer_id !== user.id) {
        notifyUser({
          targetUserId: event.organizer_id,
          title: parent_id ? "Răspuns nou" : "Comentariu nou",
          body: `${username} a comentat la ${event.title}: „${text.trim().slice(0, 80)}”`,
          type: "comment",
          actorId: user.id,
        });
      }
      if (parent_id) {
        const parentComment = comments.find(c => c.id === parent_id);
        if (parentComment?.user_id && parentComment.user_id !== user.id && parentComment.user_id !== event.organizer_id) {
          notifyUser({
            targetUserId: parentComment.user_id,
            title: "Răspuns nou",
            body: `${username} ți-a răspuns la ${event.title}: „${text.trim().slice(0, 80)}”`,
            type: "comment",
            actorId: user.id,
          });
        }
      }
      setReplyingTo(null);
    }
    setSending(false);
  };

  if (!displayEvent) return null;

  const topLevel = comments.filter(c => !c.parent_id);
  const repliesOf = (id) => comments.filter(c => c.parent_id === id);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: open ? "blur(4px)" : "none",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s",
          zIndex: 200,
        }}
      />

      {/* Sheet — se ridică deasupra navbar-ului */}
      <div ref={sheetRef} style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "72vh",
        background: "rgba(10,10,12,0.98)",
        borderTop: `2px solid ${displayEvent.color}40`,
        borderRadius: "24px 24px 0 0",
        transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
        transition: draggingRef.current ? "none" : "transform 0.35s cubic-bezier(0.32, 0, 0.15, 1)",
        zIndex: 201,
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "10px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Comentarii</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>{displayEvent.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Comments list */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Se încarcă...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}><SpeechBubbleIcon size={28} /></div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Fii primul care comentează!</div>
            </div>
          ) : (
            topLevel.map(c => (
              <div key={c.id}>
                <CommentRow
                  c={c} isReply={false} color={displayEvent.color} avatarUrl={avatars[c.user_id]}
                  likeCount={likeCounts[c.id] || 0} isLiked={myLikes.has(c.id)}
                  onToggleLike={() => toggleLike(c)} onReply={() => startReply(c)}
                />
                {repliesOf(c.id).length > 0 && (
                  <div style={{ marginLeft: 16, paddingLeft: 16, borderLeft: "2px solid rgba(255,255,255,0.08)", marginTop: -2 }}>
                    {repliesOf(c.id).map(r => (
                      <CommentRow
                        key={r.id} c={r} isReply={true} color={displayEvent.color} avatarUrl={avatars[r.user_id]}
                        likeCount={likeCounts[r.id] || 0} isLiked={myLikes.has(r.id)}
                        onToggleLike={() => toggleLike(r)} onReply={() => startReply(r)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Banner de răspuns */}
        {replyingTo && (
          <div style={{ padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace" }}>Răspunzi lui @{replyingTo.username}</span>
            <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}

        {/* Input — cu padding pentru navbar */}
        <div style={{ padding: "10px 16px 78px", borderTop: replyingTo ? "none" : "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            ref={inputRef}
            placeholder={user ? (replyingTo ? `Răspunde lui @${replyingTo.username}...` : "Scrie un comentariu...") : "Autentifică-te pentru a comenta"}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            disabled={!user}
            style={{
              flex: 1, padding: "10px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, color: "#fff", fontSize: 14,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || !user}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: text.trim() && user ? displayEvent.color : "rgba(255,255,255,0.08)",
              border: "none", cursor: text.trim() && user ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
