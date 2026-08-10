import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { SpeechBubbleIcon } from "./Icons";
import { notifyUser } from "../utils/pushNotifications";

export default function CommentsSheet({ event, user, open, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

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

  const loadComments = async () => {
    setLoading(true);
    const { data } = await supabase.from("comments").select("*").eq("event_id", event.id).order("created_at", { ascending: true });
    setComments(data || []);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    if (!user) { alert("Trebuie să fii autentificat pentru a comenta!"); return; }
    setSending(true);
    const username = user.user_metadata?.username || user.email?.split("@")[0] || "User";
    const { error } = await supabase.from("comments").insert([{
      event_id: event.id, user_id: user.id, username, text: text.trim(),
    }]);
    if (!error) {
      setText("");
      if (event.organizer_id && event.organizer_id !== user.id) {
        notifyUser({
          targetUserId: event.organizer_id,
          title: "Comentariu nou",
          body: `${username} a comentat la ${event.title}: „${text.trim().slice(0, 80)}”`,
          type: "comment",
        });
      }
    }
    setSending(false);
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });

  if (!event) return null;

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
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "72vh",
        background: "rgba(10,10,12,0.98)",
        borderTop: `2px solid ${event.color}40`,
        borderRadius: "24px 24px 0 0",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.35s cubic-bezier(0.32, 0, 0.15, 1)",
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
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>{event.title}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Se încarcă...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}><SpeechBubbleIcon size={28} /></div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>Fii primul care comentează!</div>
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: `${event.color}30`, border: `1px solid ${event.color}50`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: event.color, fontFamily: "'DM Mono', monospace",
                }}>
                  {(c.username || "U")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans', sans-serif" }}>{c.username || "User"}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>{formatTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>{c.text}</div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — cu padding pentru navbar */}
        <div style={{ padding: "10px 16px 78px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder={user ? "Scrie un comentariu..." : "Autentifică-te pentru a comenta"}
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
              background: text.trim() && user ? event.color : "rgba(255,255,255,0.08)",
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
