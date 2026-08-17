import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";
import { events as staticEvents } from "../data/events";
import PostPage from "./PostPage";
import RequestsPage from "./RequestsPage";
import FollowListSheet from "./FollowListSheet";
import LegalPage from "./LegalPage";
import SettingsPage from "./SettingsPage";
import NotificationsPage from "./NotificationsPage";
import AvatarCropSheet from "./AvatarCropSheet";
import PhotoViewerModal from "./PhotoViewerModal";
import MyTicketsPage, { TicketQR } from "./MyTicketsPage";
import CheckinScannerSheet from "./CheckinScannerSheet";
import EventInsightsModal from "./EventInsightsModal";
import MyHistoryPage from "./MyHistoryPage";
import { filterActiveEvents, cleanupOwnExpiredEvents } from "../utils/eventTime";
import { getPushStatus, subscribeToPush, unsubscribeFromPush } from "../utils/pushNotifications";
import {
  CheckCircleIcon, HeartOutlineIcon, OutboxIcon, MoonIcon, CameraIcon, RocketIcon,
  TargetIcon, EnvelopeIcon, ClockIcon, KeyIcon, ConfettiIcon, LightningIcon, HouseIcon,
  WarningIcon, GearIcon, BellIcon, PencilIcon, ScanIcon, InfoIcon, QrCodeIcon, CrossCircleIcon, MoreIcon,
} from "./Icons";

// Acceptă "ȘTERGE"/"ŞTERGE" scris cu sau fără diacritice, orice combinație de
// majuscule/minuscule (ex: "sterge", "STERGE", "șterge" trec toate la fel).
const ROMANIAN_DIACRITICS = { "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ş": "S", "Ț": "T", "Ţ": "T" };
const normalizeConfirmText = (s) =>
  s.trim().toUpperCase().split("").map(ch => ROMANIAN_DIACRITICS[ch] || ch).join("");

// Extrage din URL-ul public Supabase Storage doar calea fișierului (ex: "abc.jpg"),
// ca să-l putem șterge cu storage.remove([path]).
const extractStoragePath = (url, bucket) => {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
};

// Format minimal pentru evenimentele postate, ca să apară în listele "Particip" / "Apreciate"
const convertPostedEventMinimal = (e) => ({
  id: `posted_${e.id}`,
  type: e.type || "homemade",
  title: e.title,
  date: e.date || "Data necunoscută",
  event_date: e.event_date || null,
  price: e.price || "Gratuit",
  color: e.type === "official" ? "#FF3366" : "#FFB800",
  bgColor: e.type === "official" ? "#1a0010" : "#110d00",
});

// Meniu "⋮" pentru acțiunile pe un card (Postate / Particip) — înainte erau
// 3 butoane înghesuite unul sub altul pe fiecare card, acum o singură
// iconiță care deschide lista de acțiuni.
const ActionMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDocClick);
    return () => document.removeEventListener("pointerdown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
        <MoreIcon size={16} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#15151a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden", zIndex: 50, minWidth: 170, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          {items.map((it, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              style={{ width: "100%", padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", color: it.color || "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", textAlign: "left" }}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ProfilePage({ user, onLogout, onViewProfile, onOpenEvent }) {
  const [view, setView] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("attending");
  const [attendingEvents, setAttendingEvents] = useState([]);
  const [likedEvents, setLikedEvents] = useState([]);
  const [myCheckins, setMyCheckins] = useState({}); // { [eventId]: { token, checked_in } }
  const [ticketFor, setTicketFor] = useState(null); // token string | null
  const [myPostedEvents, setMyPostedEvents] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [postedView, setPostedView] = useState("active"); // "active" | "archived"
  const [editingEvent, setEditingEvent] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const loadFollowCounts = async () => {
    if (!user) return;
    const { count: f } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id);
    setFollowerCount(f || 0);
    const { count: g } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id);
    setFollowingCount(g || 0);
  };

  const loadPendingRequestsCount = async () => {
    if (!user) return;
    const { count } = await supabase.from("attendance_requests").select("*", { count: "exact", head: true }).eq("host_id", user.id).eq("status", "pending");
    setPendingRequestsCount(count || 0);
  };

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const loadUnreadNotifCount = async () => {
    if (!user) return;
    const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);
    setUnreadNotifCount(count || 0);
  };

  const [showRequests, setShowRequests] = useState(false);
  const [followSheet, setFollowSheet] = useState(null); // "followers" | "following" | null
  const [showLegal, setShowLegal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTickets, setShowTickets] = useState(false);
  const [scannerEvent, setScannerEvent] = useState(null);
  const [showOwnPhoto, setShowOwnPhoto] = useState(false);
  const [infoEvent, setInfoEvent] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const isDeleteConfirmMatch = normalizeConfirmText(deleteConfirmText) === "STERGE";
  const [pushStatus, setPushStatus] = useState("checking"); // unsupported | denied | not-subscribed | subscribed
  const [pushBusy, setPushBusy] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({ nume: "", prenume: "", varsta: "", gen: "", hobby: "", avatar_url: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [cropSource, setCropSource] = useState(null); // { file } sau { url } — vezi handleAvatarChange

  useEffect(() => {
    getPushStatus().then(setPushStatus);
  }, []);

  const toggleNotifPref = async (key) => {
    if (!profile) return;
    const next = !(profile[key] ?? true);
    setProfile(p => ({ ...p, [key]: next })); // optimist
    const { error } = await supabase.from("profiles").update({ [key]: next }).eq("id", profile.id);
    if (error) setProfile(p => ({ ...p, [key]: !next })); // revert dacă a eșuat
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    if (pushStatus === "subscribed") {
      await unsubscribeFromPush();
      setPushStatus("not-subscribed");
    } else {
      const { error } = await subscribeToPush(user.id);
      setPushStatus(await getPushStatus());
      if (error) alert(error);
    }
    setPushBusy(false);
  };

  // Arhiva se încarcă abia când o deschizi (majoritatea userilor n-o ating
  // niciodată) — nu are rost un query în plus la fiecare vizită pe profil.
  useEffect(() => {
    if (postedView === "archived") loadArchivedEvents();
  }, [postedView]);

  useEffect(() => {
    if (!user) return;
    loadProfileByUserId();
    loadAttendingAndLiked();
    loadMyPostedEvents();
    loadFollowCounts();
    loadPendingRequestsCount();
    loadUnreadNotifCount();

    // Realtime: actualizează numărul de urmăritori/urmăriri, cereri și
    // notificări necitite instant
    const channel = supabase
      .channel(`my_follows_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => loadFollowCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_requests", filter: `host_id=eq.${user.id}` }, () => loadPendingRequestsCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => loadUnreadNotifCount())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  // Scoate live evenimentele care expiră cât timp userul stă pe profil (Particip /
  // Apreciate / Evenimentele mele).
  useEffect(() => {
    const interval = setInterval(() => {
      setAttendingEvents(prev => filterActiveEvents(prev));
      setLikedEvents(prev => filterActiveEvents(prev));
      setMyPostedEvents(prev => filterActiveEvents(prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadProfileByUserId = async () => {
    if (!user?.id) { setView("setup"); return; }
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setProfile(data);
      setForm({ nume: data.nume || "", prenume: data.prenume || "", varsta: data.varsta || "", gen: data.gen || "", hobby: data.hobby || "", avatar_url: data.avatar_url || "" });
      setView("profile");
    } else {
      setView("setup");
    }
  };

  // Particip / Apreciate — acum din Supabase (tabelele "attendances" și "likes"),
  // valabil pentru evenimente statice ȘI postate de alți useri, sincronizat cross-device.
  const loadAttendingAndLiked = async () => {
    const { data: postedRaw } = await supabase.from("posted_events_feed").select("*").eq("archived", false).or("type.neq.official,verified.eq.true");
    const posted = filterActiveEvents(postedRaw).map(convertPostedEventMinimal);
    const allEvents = [...staticEvents, ...posted];

    const { data: myAttendances } = await supabase.from("attendances").select("event_id").eq("user_id", user.id);
    const { data: myLikes } = await supabase.from("likes").select("event_id").eq("user_id", user.id);
    // Evenimentele neoficiale cu locație ascunsă merg prin cerere de aprobare
    // (attendance_requests), nu prin attendances — fără asta, cele acceptate
    // nu apăreau niciodată la "Particip". event_id de-acolo e uuid-ul brut.
    const { data: myAcceptedRequests } = await supabase.from("attendance_requests").select("event_id").eq("requester_id", user.id).eq("status", "accepted");

    const attendingIds = new Set([
      ...(myAttendances || []).map(r => r.event_id),
      ...(myAcceptedRequests || []).map(r => `posted_${r.event_id}`),
    ]);
    const likedIds = new Set((myLikes || []).map(r => r.event_id));

    const attending = allEvents.filter(e => attendingIds.has(String(e.id)));
    setAttendingEvents(attending);
    setLikedEvents(allEvents.filter(e => likedIds.has(String(e.id))));
    loadMyCheckins(attending);
  };

  // Biletul QR (dacă există) pentru fiecare eveniment la care participi —
  // afișat direct în lista "Particip", ca să nu mai fie nevoie să cauți
  // separat prin Bilete/Cereri.
  const loadMyCheckins = async (attendingList) => {
    const postedIds = attendingList.map(e => String(e.id)).filter(id => id.startsWith("posted_"));
    if (!postedIds.length) { setMyCheckins({}); return; }
    const { data } = await supabase.from("event_checkins").select("event_id, token, checked_in").eq("user_id", user.id).in("event_id", postedIds);
    const map = {};
    (data || []).forEach(c => { map[c.event_id] = c; });
    setMyCheckins(map);
  };

  const loadMyPostedEvents = async () => {
    if (!user) return;
    const { data } = await supabase.from("posted_events_feed").select("*").eq("user_id", user.id).eq("archived", false).order("created_at", { ascending: false });
    const active = filterActiveEvents(data);
    setMyPostedEvents(active);
    // Curăță din Supabase evenimentele mele expirate (best-effort, în fundal) —
    // așa dispar efectiv din bază, nu doar din ce afișează ecranul.
    cleanupOwnExpiredEvents(supabase, data);
  };

  const loadArchivedEvents = async () => {
    if (!user) return;
    const { data } = await supabase.from("posted_events_feed").select("*").eq("user_id", user.id).eq("archived", true).order("created_at", { ascending: false });
    setArchivedEvents(data || []);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // altfel re-selectarea aceluiași fișier nu mai declanșează onChange
    if (!file) return;
    setCropSource({ file });
  };

  const handleCropConfirm = (blob) => {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(blob));
    setCropSource(null);
  };

  const uploadAvatar = async (profileId) => {
    if (!avatarFile) return form.avatar_url;
    const ext = avatarFile.name.split(".").pop();
    const path = `${profileId}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
    if (error) return form.avatar_url;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.nume || !form.prenume) { alert("Completează cel puțin numele și prenumele!"); return; }
    setSaving(true);
    try {
      // Check if profile already exists for this user
      const { data: existing } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();

      let profileId = existing?.id;
      let avatarUrl = form.avatar_url;

      if (profileId) {
        // Update existing
        avatarUrl = await uploadAvatar(profileId);
        const { data, error } = await supabase.from("profiles").update({ ...form, varsta: Number(form.varsta) || null, avatar_url: avatarUrl, user_id: user.id }).eq("id", profileId).select().single();
        if (error) throw error;
        setProfile(data);
      } else {
        // Create new
        const { data, error } = await supabase.from("profiles").insert([{ ...form, varsta: Number(form.varsta) || null, user_id: user.id }]).select().single();
        if (error) throw error;
        profileId = data.id;
        avatarUrl = await uploadAvatar(profileId);
        if (avatarUrl !== form.avatar_url) {
          await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profileId);
          data.avatar_url = avatarUrl;
        }
        setProfile(data);
      }

      // Sincronizăm numele și în user_metadata (nu doar în profiles) — mai
      // multe locuri din aplicație (texte de notificare etc.) au nevoie de un
      // nume afișabil sincron, fără un query separat către profiles.
      supabase.auth.updateUser({ data: { prenume: form.prenume, nume: form.nume } }).catch(() => {});

      setEditing(false);
      setView("profile");
    } catch (err) {
      alert("Eroare la salvare: " + err.message);
    }
    setSaving(false);
  };

  const handleRemoveAttending = async (eventId) => {
    await supabase.from("attendances").delete().eq("event_id", String(eventId)).eq("user_id", user.id);
    setAttendingEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // "Șterge" arhivează, nu mai șterge definitiv — evenimentul dispare din
  // feed/căutare/hartă, dar rămâne recuperabil din Arhivă.
  const handleArchivePosted = async (id) => {
    const event = myPostedEvents.find(e => e.id === id);
    await supabase.from("posted_events").update({ archived: true }).eq("id", id);
    setMyPostedEvents(prev => prev.filter(e => e.id !== id));
    if (event) setArchivedEvents(prev => [{ ...event, archived: true }, ...prev]);
  };

  const handleRestorePosted = async (id) => {
    const event = archivedEvents.find(e => e.id === id);
    await supabase.from("posted_events").update({ archived: false }).eq("id", id);
    setArchivedEvents(prev => prev.filter(e => e.id !== id));
    if (event) setMyPostedEvents(prev => [{ ...event, archived: false }, ...prev]);
  };

  const handlePermanentDeletePosted = async (id) => {
    if (!window.confirm("Ștergi definitiv acest eveniment? Nu mai poate fi recuperat.")) return;
    await supabase.from("posted_events").delete().eq("id", id);
    setArchivedEvents(prev => prev.filter(e => e.id !== id));
  };

  // Șterge definitiv contul. ORDINEA CONTEAZĂ: ștergem întâi datele proprii
  // (storage + tabele), cât timp sesiunea curentă e încă validă. Abia la final
  // apelăm Edge Function-ul care șterge rândul din auth.users — asta invalidează
  // sesiunea, deci orice cerere ulterioară cu ea ar eșua (silențios, fiindcă
  // .delete() din Supabase nu aruncă eroare, doar o returnează necitit — dacă
  // ștergeam contul de autentificare primul, tot ce urma mai jos părea că merge,
  // dar nu ștergea de fapt nimic).
  const handleDeleteAccount = async () => {
    if (normalizeConfirmText(deleteConfirmText) !== "STERGE") return;
    setDeletingAccount(true);
    try {
      const avatarPath = extractStoragePath(profile?.avatar_url, "avatars");
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);

      const coverPaths = myPostedEvents.map(e => extractStoragePath(e.cover_url, "covers")).filter(Boolean);
      if (coverPaths.length) await supabase.storage.from("covers").remove(coverPaths);

      const results = await Promise.all([
        supabase.from("posted_events").delete().eq("user_id", user.id),
        supabase.from("attendances").delete().eq("user_id", user.id),
        supabase.from("likes").delete().eq("user_id", user.id),
        supabase.from("follows").delete().eq("follower_id", user.id),
        supabase.from("follows").delete().eq("following_id", user.id),
        supabase.from("profiles").delete().eq("user_id", user.id),
      ]);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;

      try {
        await supabase.functions.invoke("delete-account");
      } catch {
        // Edge Function nu e încă deployuită sau a eșuat — datele tot au fost
        // șterse mai sus; doar contul de autentificare rămâne pentru moment.
      }

      await supabase.auth.signOut();
      onLogout && onLogout();
    } catch (err) {
      alert("Eroare la ștergerea contului: " + err.message);
      setDeletingAccount(false);
    }
  };

  const avatarSrc = avatarPreview || profile?.avatar_url;

  if (view === "loading") return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#080808" }}>
      <div style={{ color: "rgba(255,255,255,0.6)", animation: "pulse 1.5s ease-in-out infinite" }}><MoonIcon size={32} /></div>
    </div>
  );

  const isSetup = view === "setup" || editing;

  return (
    <div style={{ width: "100%", height: "100%", background: "#080808", overflowY: "auto", paddingBottom: 80 }}>

      {isSetup && (
        <div style={{ padding: "50px 20px 20px", animation: "slideUp 0.3s ease-out" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
            {editing ? "Editează profilul" : "Creează-ți profilul"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginBottom: 28 }}>Apare pe NightFeed</div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <div style={{ position: "relative" }}>
              <div onClick={() => fileRef.current?.click()} style={{ width: 90, height: 90, borderRadius: "50%", background: avatarSrc ? "transparent" : "rgba(255,51,102,0.15)", border: "2px dashed rgba(255,51,102,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
                {avatarSrc ? <img src={avatarSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "rgba(255,51,102,0.6)" }}><CameraIcon size={30} /></span>}
              </div>
              {avatarSrc && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCropSource({ url: avatarSrc }); }}
                  title="Ajustează poza actuală"
                  style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%", background: "#FF3366", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                >
                  <PencilIcon size={13} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginTop: 8 }}>Apasă pentru poză</div>
          </div>

          {[
            { key: "prenume", label: "Prenume", placeholder: "ex: Ion", type: "text" },
            { key: "nume", label: "Nume", placeholder: "ex: Popescu", type: "text" },
            { key: "varsta", label: "Vârstă", placeholder: "ex: 22", type: "number" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{field.label}</div>
              <input type={field.type} placeholder={field.placeholder} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Bio</div>
            <textarea
              rows={3} placeholder="Câteva cuvinte despre tine" value={form.hobby}
              onChange={e => setForm(f => ({ ...f, hobby: e.target.value }))}
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "none" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Gen</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Masculin", "Feminin", "Altul"].map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, gen: g }))} style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: form.gen === g ? "rgba(255,51,102,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.gen === g ? "rgba(255,51,102,0.5)" : "rgba(255,255,255,0.1)"}`, color: form.gen === g ? "#FF3366" : "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: form.gen === g ? 700 : 400, cursor: "pointer" }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "14px", background: saving ? "rgba(255,51,102,0.4)" : "linear-gradient(135deg, #FF3366, #FF6B35)", border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 4px 20px rgba(255,51,102,0.3)" }}>
            {saving ? "Se salvează..." : editing ? "Salvează modificările" : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Creează profilul <RocketIcon size={16} /></span>}
          </button>
          {editing && (
            <button onClick={() => { setEditing(false); setAvatarPreview(null); }} style={{ width: "100%", padding: "12px", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", marginTop: 10 }}>Anulează</button>
          )}
        </div>
      )}

      {!isSetup && profile && (
        <div style={{ position: "relative", animation: "slideUp 0.3s ease-out" }}>
          <div style={{ position: "absolute", top: 14, right: 16, zIndex: 6, display: "flex", gap: 8 }}>
            <button onClick={() => setShowNotifications(true)} style={{ position: "relative", width: 32, height: 32, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <BellIcon size={15} />
              {unreadNotifCount > 0 && (
                <div style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 3px", borderRadius: 8, background: "#FF3366", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace" }}>
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </div>
              )}
            </button>
            <button onClick={() => setShowSettings(true)} style={{ width: 32, height: 32, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <GearIcon size={15} />
            </button>
          </div>
          <div style={{ padding: "50px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 16 }}>
            <div
              onClick={() => profile.avatar_url && setShowOwnPhoto(true)}
              style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg, #FF3366, #FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, overflow: "hidden", flexShrink: 0, border: "2px solid rgba(255,51,102,0.4)", cursor: profile.avatar_url ? "pointer" : "default" }}
            >
              {profile.avatar_url ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <MoonIcon size={26} style={{ color: "#fff" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{profile.prenume} {profile.nume}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                <button onClick={() => setFollowSheet("followers")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{followerCount}</span>
                  <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>urmăritori</span>
                </button>
                <button onClick={() => setFollowSheet("following")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{followingCount}</span>
                  <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>urmărește</span>
                </button>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>
                {profile.varsta ? `${profile.varsta} ani` : ""}{profile.gen ? ` · ${profile.gen}` : ""}
              </div>
              {profile.hobby && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}><TargetIcon size={12} /> {profile.hobby}</div>}
              {user?.email && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", marginTop: 4 }}><EnvelopeIcon size={11} /> {user.email}</div>}
            </div>
          </div>

          <div style={{ display: "flex", padding: "16px 20px", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { id: "attending", label: "Particip", value: attendingEvents.length, icon: <CheckCircleIcon size={18} /> },
              { id: "requests", label: "Cereri", value: pendingRequestsCount, icon: <EnvelopeIcon size={18} /> },
              { id: "posted", label: "Postate", value: myPostedEvents.length, icon: <OutboxIcon size={18} /> },
            ].map(stat => {
              const isActive = stat.id !== "requests" && activeTab === stat.id;
              return (
                <button key={stat.id} onClick={() => stat.id === "requests" ? setShowRequests(true) : setActiveTab(stat.id)} style={{ flex: 1, background: isActive ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${isActive ? "rgba(255,51,102,0.4)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "10px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 3, color: isActive ? "#FF3366" : "rgba(255,255,255,0.5)" }}>{stat.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: isActive ? "#FF3366" : "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>{stat.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {activeTab === "posted" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                {[{ id: "active", label: "Active" }, { id: "archived", label: `Arhivă${archivedEvents.length ? ` (${archivedEvents.length})` : ""}` }].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setPostedView(v.id)}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                      background: postedView === v.id ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${postedView === v.id ? "rgba(255,51,102,0.35)" : "rgba(255,255,255,0.07)"}`,
                      color: postedView === v.id ? "#FF3366" : "rgba(255,255,255,0.5)",
                      fontSize: 12, fontWeight: postedView === v.id ? 700 : 500, fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            {activeTab === "posted" ? (
              postedView === "active" ? (
              myPostedEvents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}><OutboxIcon size={28} /></div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Niciun eveniment postat</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Creează primul tău eveniment din butonul + de jos.</div>
                </div>
              ) : myPostedEvents.map(event => (
                <div key={event.id} style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: event.type === "official" ? "rgba(255,51,102,0.2)" : "rgba(255,184,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: event.type === "official" ? "#FF3366" : "#FFB800", flexShrink: 0 }}>
                      {event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{event.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{event.date} · {event.price || "Gratuit"}</div>
                      <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 10, background: event.verified ? "rgba(0,200,100,0.15)" : "rgba(255,184,0,0.15)", border: `1px solid ${event.verified ? "rgba(0,200,100,0.3)" : "rgba(255,184,0,0.3)"}`, fontSize: 10, color: event.verified ? "#00C864" : "#FFB800", fontFamily: "'DM Mono', monospace" }}>
                          {event.verified ? <><CheckCircleIcon size={11} /> Verificat</> : <><ClockIcon size={11} /> În așteptare</>}
                        </span>
                        {event.code && (
                          <button
                            onClick={() => copyCode(event.code)}
                            style={{ padding: "2px 8px", borderRadius: 10, background: copiedCode === event.code ? "rgba(0,200,100,0.15)" : "rgba(255,51,102,0.12)", border: `1px solid ${copiedCode === event.code ? "rgba(0,200,100,0.3)" : "rgba(255,51,102,0.25)"}`, fontSize: 10, color: copiedCode === event.code ? "#00C864" : "#FF3366", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                          >
                            {copiedCode === event.code ? <><CheckCircleIcon size={11} /> Copiat!</> : <><KeyIcon size={11} /> {event.code}</>}
                          </button>
                        )}
                      </div>
                    </div>
                    <ActionMenu items={[
                      { label: "Scanează", icon: <ScanIcon size={14} />, onClick: () => setScannerEvent(event), color: "#00C864" },
                      { label: "Editează", icon: <PencilIcon size={14} />, onClick: () => setEditingEvent(event) },
                      { label: "Arhivează", icon: <OutboxIcon size={14} />, onClick: () => handleArchivePosted(event.id), color: "#FF3366" },
                    ]} />
                  </div>
                </div>
              ))
              ) : (
                archivedEvents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}><OutboxIcon size={28} /></div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>Arhiva e goală</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Evenimentele pe care le arhivezi apar aici.</div>
                  </div>
                ) : archivedEvents.map(event => (
                  <div key={event.id} style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px", opacity: 0.75 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: event.type === "official" ? "rgba(255,51,102,0.2)" : "rgba(255,184,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: event.type === "official" ? "#FF3366" : "#FFB800", flexShrink: 0 }}>
                        {event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif" }}>{event.title}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{event.date} · {event.price || "Gratuit"}</div>
                      </div>
                      <ActionMenu items={[
                        { label: "Info", icon: <InfoIcon size={14} />, onClick: () => setInfoEvent(event) },
                        { label: "Restaurează", icon: <CheckCircleIcon size={14} />, onClick: () => handleRestorePosted(event.id), color: "#00C864" },
                        { label: "Șterge definitiv", icon: <WarningIcon size={14} />, onClick: () => handlePermanentDeletePosted(event.id), color: "#FF3366" },
                      ]} />
                    </div>
                  </div>
                ))
              )
            ) : (
              (activeTab === "attending" ? attendingEvents : likedEvents).length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 24px", color: "rgba(255,255,255,0.4)" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>{activeTab === "attending" ? <ConfettiIcon size={28} /> : <HeartOutlineIcon size={28} />}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>
                    {activeTab === "attending" ? "Încă nu participi nicăieri" : "Nimic apreciat încă"}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                    {activeTab === "attending" ? "Explorează feed-ul și înscrie-te la ce-ți place." : "Dă like la evenimentele care te atrag din feed."}
                  </div>
                </div>
              ) : (activeTab === "attending" ? attendingEvents : likedEvents).map(event => (
                <div
                  key={event.id}
                  onClick={() => onOpenEvent && onOpenEvent(event.id)}
                  style={{ borderRadius: 14, background: event.bgColor, border: `1px solid ${event.color}30`, padding: "14px", position: "relative", overflow: "hidden", cursor: onOpenEvent ? "pointer" : "default" }}
                >
                  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at top left, ${event.color}15 0%, transparent 60%)`, pointerEvents: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${event.color}20`, border: `1px solid ${event.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: event.color, flexShrink: 0 }}>
                      {event.type === "official" ? <LightningIcon size={18} /> : <HouseIcon size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{event.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{event.date} · {event.price}</div>
                    </div>
                    {activeTab === "attending" && (
                      <ActionMenu items={[
                        ...(myCheckins[event.id] ? [{ label: "Biletul meu", icon: <QrCodeIcon size={14} />, onClick: () => setTicketFor(myCheckins[event.id].token) }] : []),
                        { label: "Renunț", icon: <CrossCircleIcon size={14} />, onClick: () => handleRemoveAttending(event.id), color: "#FF3366" },
                      ]} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {showSettings && createPortal(
        <SettingsPage
          onClose={() => setShowSettings(false)}
          onEditProfile={() => { setShowSettings(false); setEditing(true); }}
          onShowLiked={() => { setShowSettings(false); setActiveTab("liked"); }}
          onShowLegal={() => setShowLegal(true)}
          onShowTickets={() => { setShowSettings(false); setShowTickets(true); }}
          onShowHistory={() => { setShowSettings(false); setShowHistory(true); }}
          onDeleteAccount={() => setShowDeleteConfirm(true)}
          onLogout={onLogout}
          profile={profile}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          onTogglePush={handleTogglePush}
          onToggleNotifPref={toggleNotifPref}
        />,
        document.body
      )}

      {showNotifications && createPortal(<NotificationsPage user={user} onClose={() => { setShowNotifications(false); loadUnreadNotifCount(); }} onViewProfile={onViewProfile} onOpenEvent={onOpenEvent} />, document.body)}

      {showLegal && createPortal(<LegalPage onClose={() => setShowLegal(false)} />, document.body)}

      {showTickets && createPortal(<MyTicketsPage user={user} onClose={() => setShowTickets(false)} />, document.body)}

      {showHistory && createPortal(<MyHistoryPage user={user} onClose={() => setShowHistory(false)} onOpenEvent={onOpenEvent} />, document.body)}

      {showOwnPhoto && createPortal(<PhotoViewerModal src={profile?.avatar_url} onClose={() => setShowOwnPhoto(false)} />, document.body)}

      {scannerEvent && createPortal(<CheckinScannerSheet event={scannerEvent} onClose={() => setScannerEvent(null)} />, document.body)}

      {infoEvent && createPortal(
        <EventInsightsModal
          event={infoEvent}
          rawId={infoEvent.id}
          onClose={() => setInfoEvent(null)}
          onViewProfile={onViewProfile}
        />,
        document.body
      )}

      {ticketFor && createPortal(
        <div onClick={() => setTicketFor(null)} style={{ position: "fixed", inset: 0, zIndex: 10350, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f12", borderRadius: 24, padding: "24px", width: "100%", maxWidth: 320, textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <TicketQR token={ticketFor} />
            </div>
            <button onClick={() => setTicketFor(null)} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <CrossCircleIcon size={13} /> Închide
            </button>
          </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10250, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }} onClick={() => !deletingAccount && setShowDeleteConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "85vh", overflowY: "auto", background: "#0f0f12", borderRadius: "24px 24px 0 0", padding: "22px 20px 32px", borderTop: "1px solid rgba(255,51,102,0.2)", animation: "slideUp 0.25s ease-out" }}>
            <div style={{ marginBottom: 12, color: "#FFB800" }}><WarningIcon size={36} /></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Ștergi contul definitiv?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 18, fontFamily: "'DM Sans', sans-serif" }}>
              Se șterg permanent profilul, evenimentele postate, like-urile, participările și urmăritorii tăi. Acțiunea nu poate fi anulată. Scrie <strong style={{ color: "#FF3366" }}>STERGE</strong> ca să confirmi.
            </div>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="ȘTERGE"
              style={{ width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", outline: "none", marginBottom: 14, textTransform: "uppercase" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} disabled={deletingAccount} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Anulează</button>
              <button
                onClick={handleDeleteAccount}
                disabled={!isDeleteConfirmMatch || deletingAccount}
                style={{
                  flex: 1, padding: "13px", borderRadius: 14, border: "none",
                  background: isDeleteConfirmMatch ? "linear-gradient(135deg, #FF3366, #B44FFF)" : "rgba(255,51,102,0.25)",
                  color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                  cursor: (isDeleteConfirmMatch && !deletingAccount) ? "pointer" : "not-allowed",
                }}
              >
                {deletingAccount ? "Se șterge..." : "Șterge definitiv"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showRequests && createPortal(<RequestsPage user={user} onClose={() => setShowRequests(false)} />, document.body)}

      {followSheet && createPortal(
        <FollowListSheet
          userId={user.id}
          mode={followSheet}
          onClose={() => setFollowSheet(null)}
          onViewProfile={(uid) => onViewProfile && onViewProfile(uid)}
        />,
        document.body
      )}

      {cropSource && createPortal(
        <AvatarCropSheet file={cropSource.file} imageUrl={cropSource.url} onCancel={() => setCropSource(null)} onConfirm={handleCropConfirm} />,
        document.body
      )}

      {editingEvent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#080808" }}>
          <PostPage user={user} editEvent={editingEvent} onClose={() => { setEditingEvent(null); loadMyPostedEvents(); }} />
        </div>
      )}
    </div>
  );
}
