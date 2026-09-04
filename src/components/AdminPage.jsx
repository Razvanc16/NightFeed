import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import {
  ChartIcon, WarningIcon, PersonIcon, TargetIcon, TrashIcon, CheckCircleIcon,
  NoEntryIcon, RefreshIcon, ShieldIcon, SearchIcon,
} from "./Icons";

const TABS = [
  { key: "stats", label: "Statistici", icon: ChartIcon },
  { key: "reports", label: "Raportări", icon: WarningIcon },
  { key: "users", label: "Utilizatori", icon: PersonIcon },
  { key: "events", label: "Evenimente", icon: TargetIcon },
];

const PERIOD_PRESETS = [
  { value: "day", label: "Ultima zi" },
  { value: "week", label: "Ultima săptămână" },
  { value: "3months", label: "Ultimele 3 luni" },
  { value: "year", label: "Ultimul an" },
  { value: "all", label: "Tot timpul" },
];

const bucketLabel = (bucket, unit) => {
  const d = new Date(bucket);
  if (unit === "hour") return d.toLocaleTimeString("ro-RO", { hour: "2-digit" });
  if (unit === "week") return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
  if (unit === "month") return d.toLocaleDateString("ro-RO", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

// Fiecare rând intră cu un mic fade+slide în cascadă (nu instant) — cerință
// standard pentru orice element nou din UI-ul ăsta, nu doar un detaliu opțional.
const rowStyle = (i) => ({ animation: "fadeIn 0.3s cubic-bezier(0.16,1,0.3,1) backwards", animationDelay: `${Math.min(i * 0.04, 0.4)}s` });

const StatCard = ({ label, value, sub, accent, i, onClick }) => (
  <div
    onClick={onClick}
    style={{ ...rowStyle(i), background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 18px", cursor: onClick ? "pointer" : "default", transition: "background 0.15s" }}
  >
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: accent || "#fff", fontFamily: "'Syne', sans-serif" }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{sub}</div>}
  </div>
);

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>
    <RefreshIcon size={22} style={{ animation: "ptrSpin 0.8s linear infinite" }} />
  </div>
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", marginBottom: 14 }}>
    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }}><SearchIcon size={15} /></span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "11px 14px 11px 36px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }}
    />
  </div>
);

const FilterChips = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{ padding: "7px 13px", borderRadius: 20, background: value === opt.value ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${value === opt.value ? "rgba(255,51,102,0.35)" : "rgba(255,255,255,0.1)"}`, color: value === opt.value ? "#FF3366" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const MiniChart = ({ title, color, data, bucket, i }) => {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ ...rowStyle(i), background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 16px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: data.length > 30 ? 2 : 4, height: 80, overflowX: data.length > 30 ? "auto" : "visible" }}>
        {data.map((d) => (
          <div key={d.bucket} style={{ flex: 1, minWidth: data.length > 30 ? 6 : undefined, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", maxWidth: 16, height: Math.max(2, (d.count / maxCount) * 56), background: `linear-gradient(180deg, ${color}, ${color}80)`, borderRadius: 3 }} title={`${bucketLabel(d.bucket, bucket)}: ${d.count}`} />
          </div>
        ))}
        {data.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Nimic în perioada asta.</div>}
      </div>
    </div>
  );
};

function StatsTab({ onNavigate }) {
  const [preset, setPreset] = useState("week");
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [statsRes, seriesRes] = await Promise.all([
      supabase.rpc("admin_get_stats"),
      supabase.rpc("admin_get_series", { preset }),
    ]);
    if (statsRes.error) setError(statsRes.error.message);
    else setStats(statsRes.data);
    if (!seriesRes.error) setSeries(seriesRes.data);
  }, [preset]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ padding: 20, color: "#FF6B6B", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>Eroare: {error}</div>;
  if (!stats) return <Spinner />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <StatCard i={0} label="Total useri" value={stats.total_users} sub={`+${stats.new_users_7d} în 7 zile — vezi toți`} accent="#FF3366" onClick={() => onNavigate("users", { filter: "all" })} />
        <StatCard i={1} label="Useri noi (30z)" value={stats.new_users_30d} sub="vezi grafic mai jos" />
        <StatCard i={2} label="Evenimente active" value={stats.active_events} sub={`${stats.total_events} total, ${stats.archived_events} arhivate — vezi`} accent="#00C864" onClick={() => onNavigate("events", { status: "active" })} />
        <StatCard i={3} label="Evenimente oficiale" value={stats.official_events} />
        <StatCard i={4} label="Raportări nerezolvate" value={stats.unresolved_reports} sub={`${stats.total_reports} total — vezi`} accent={stats.unresolved_reports > 0 ? "#FFB800" : "#fff"} onClick={() => onNavigate("reports")} />
        <StatCard i={5} label="Check-in-uri" value={stats.total_checkins} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>Evoluție</div>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
        >
          {PERIOD_PRESETS.map((p) => <option key={p.value} value={p.value} style={{ background: "#15151a" }}>{p.label}</option>)}
        </select>
      </div>

      {!series ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniChart i={6} title="Conturi noi" color="#FF3366" data={series.signups || []} bucket={series.bucket} />
          <MiniChart i={7} title="Evenimente postate" color="#00C864" data={series.events || []} bucket={series.bucket} />
          <MiniChart i={8} title="Raportări" color="#FFB800" data={series.reports || []} bucket={series.bucket} />
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState(null);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setReports(null);
    setError("");
    const { data, error } = await supabase.rpc("admin_list_reports", { unresolved_only: unresolvedOnly });
    if (error) setError(error.message);
    else setReports(data || []);
  }, [unresolvedOnly]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id) => {
    setBusyId(id);
    const { error } = await supabase.rpc("admin_resolve_report", { report_id: id });
    if (!error) setReports((prev) => prev.map((r) => r.id === id ? { ...r, resolved: true } : r));
    setBusyId(null);
  };

  const deletePost = async (r) => {
    if (!window.confirm(`Ștergi definitiv evenimentul "${r.event_title || "necunoscut"}"? Organizatorul va primi un email că postarea i-a fost eliminată.`)) return;
    setBusyId(r.id);
    const { error } = await supabase.rpc("admin_delete_event_notify", { target_report_id: r.id });
    if (error) alert("Eroare: " + error.message);
    else setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, resolved: true } : x));
    setBusyId(null);
  };

  const banReportedUser = async (r) => {
    setBusyId(r.id);
    const { error } = await supabase.functions.invoke("admin-action", { body: { action: "ban_user", targetUserId: r.reported_user_id } });
    if (error) { alert("Eroare: " + error.message); setBusyId(null); return; }
    await dismiss(r.id);
  };

  const deleteReportedUser = async (r) => {
    if (!window.confirm(`Ștergi definitiv contul ${r.reported_user_email || "raportat"}? Nu poate fi anulat.`)) return;
    setBusyId(r.id);
    const { error } = await supabase.functions.invoke("admin-action", { body: { action: "delete_user", targetUserId: r.reported_user_id } });
    if (error) { alert("Eroare: " + error.message); setBusyId(null); return; }
    await dismiss(r.id);
  };

  return (
    <div>
      <button
        onClick={() => setUnresolvedOnly((v) => !v)}
        style={{ marginBottom: 14, padding: "8px 14px", borderRadius: 20, background: unresolvedOnly ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${unresolvedOnly ? "rgba(255,184,0,0.35)" : "rgba(255,255,255,0.1)"}`, color: unresolvedOnly ? "#FFB800" : "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer" }}
      >
        {unresolvedOnly ? "Doar nerezolvate" : "Toate raportările"}
      </button>

      {error && <div style={{ color: "#FF6B6B", fontSize: 13 }}>Eroare: {error}</div>}
      {!reports && !error && <Spinner />}
      {reports && reports.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "20px 0", textAlign: "center" }}>Nimic aici.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(reports || []).map((r, i) => (
          <div key={r.id} style={{ ...rowStyle(i), background: "rgba(255,255,255,0.03)", border: `1px solid ${r.resolved ? "rgba(255,255,255,0.07)" : "rgba(255,184,0,0.25)"}`, borderRadius: 14, padding: 16, opacity: r.resolved ? 0.55 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#FFB800", fontFamily: "'DM Sans', sans-serif" }}>{r.reason}</div>
                  {r.reported_user_id && <span style={{ fontSize: 9, fontWeight: 700, color: "#B44FFF", background: "rgba(180,79,255,0.12)", padding: "2px 6px", borderRadius: 6 }}>CONT</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                  {r.reported_user_id
                    ? (r.reported_user_name || r.reported_user_email || "cont necunoscut / șters")
                    : (r.event_title || "eveniment necunoscut / deja șters")}
                  {r.event_venue ? ` · ${r.event_venue}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</div>
            </div>
            {r.details && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>{r.details}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>de la {r.reporter_email || "necunoscut"}</div>
              {!r.resolved && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => dismiss(r.id)} disabled={busyId === r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(0,200,100,0.1)", border: "1px solid rgba(0,200,100,0.3)", borderRadius: 10, color: "#00C864", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    <CheckCircleIcon size={13} /> OK
                  </button>
                  {r.reported_user_id ? (
                    <>
                      <button onClick={() => banReportedUser(r)} disabled={busyId === r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.3)", borderRadius: 10, color: "#FFB800", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                        Blochează contul
                      </button>
                      <button onClick={() => deleteReportedUser(r)} disabled={busyId === r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                        <TrashIcon size={12} /> Șterge contul
                      </button>
                    </>
                  ) : r.event_title && (
                    <button onClick={() => deletePost(r)} disabled={busyId === r.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 10, color: "#FF3366", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                      <TrashIcon size={12} /> Șterge postarea
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab({ initialFilter }) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState(initialFilter || "all");
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_users", { search: search || null, limit_n: 60, filter_mode: filterMode });
    if (error) setError(error.message);
    else { setUsers(data || []); setError(""); }
  }, [search, filterMode]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const callAdminAction = async (action, targetUserId) => {
    setBusyId(targetUserId);
    const { error } = await supabase.functions.invoke("admin-action", { body: { action, targetUserId } });
    if (error) alert("Eroare: " + error.message);
    else load();
    setBusyId(null);
  };

  const isBanned = (u) => u.banned_until && new Date(u.banned_until) > new Date();

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Caută după email, nume..." />
      <FilterChips
        value={filterMode}
        onChange={setFilterMode}
        options={[
          { value: "all", label: "Toți" },
          { value: "banned", label: "Blocați" },
          { value: "reported", label: "Raportați" },
          { value: "with_events", label: "Cu evenimente" },
        ]}
      />
      {error && <div style={{ color: "#FF6B6B", fontSize: 13 }}>Eroare: {error}</div>}
      {!users && !error && <Spinner />}
      {users && users.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "20px 0", textAlign: "center" }}>Niciun rezultat.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(users || []).map((u, i) => (
          <div key={u.id} style={{ ...rowStyle(i), background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            {u.avatar_url
              ? <img src={u.avatar_url} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{(u.prenume || u.email || "?")[0].toUpperCase()}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[u.prenume, u.nume].filter(Boolean).join(" ") || "(fără profil)"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                înscris {fmtDate(u.created_at)} · {u.events_count} evenimente
                {u.reports_against_count > 0 && <span style={{ color: "#FFB800" }}> · {u.reports_against_count} raportări</span>}
                {isBanned(u) && <span style={{ color: "#FF3366" }}> · blocat</span>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <button
                disabled={busyId === u.id}
                onClick={() => callAdminAction(isBanned(u) ? "unban_user" : "ban_user", u.id)}
                style={{ padding: "6px 10px", background: isBanned(u) ? "rgba(0,200,100,0.1)" : "rgba(255,184,0,0.1)", border: `1px solid ${isBanned(u) ? "rgba(0,200,100,0.3)" : "rgba(255,184,0,0.3)"}`, borderRadius: 9, color: isBanned(u) ? "#00C864" : "#FFB800", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {isBanned(u) ? "Deblochează" : "Blochează"}
              </button>
              <button
                disabled={busyId === u.id}
                onClick={() => { if (window.confirm(`Ștergi definitiv contul ${u.email}? Nu poate fi anulat.`)) callAdminAction("delete_user", u.id); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 10px", background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 9, color: "#FF3366", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
              >
                <TrashIcon size={11} /> Șterge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsTab({ initialStatus }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus || "all");
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_events", { search: search || null, limit_n: 60, status_filter: status });
    if (error) setError(error.message);
    else { setEvents(data || []); setError(""); }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const deleteEvent = async (id, title) => {
    if (!window.confirm(`Ștergi definitiv evenimentul "${title}"? Nu poate fi anulat.`)) return;
    setBusyId(id);
    const { error } = await supabase.rpc("admin_delete_event", { target_event_id: id });
    if (error) alert("Eroare: " + error.message);
    else setEvents((prev) => prev.filter((e) => e.id !== id));
    setBusyId(null);
  };

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Caută după titlu, organizator..." />
      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Toate" },
          { value: "active", label: "Active" },
          { value: "archived", label: "Arhivate" },
        ]}
      />
      {error && <div style={{ color: "#FF6B6B", fontSize: 13 }}>Eroare: {error}</div>}
      {!events && !error && <Spinner />}
      {events && events.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", padding: "20px 0", textAlign: "center" }}>Niciun rezultat.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(events || []).map((e, i) => (
          <div key={e.id} style={{ ...rowStyle(i), background: "rgba(255,255,255,0.03)", border: `1px solid ${e.reports_count > 0 ? "rgba(255,184,0,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                  {e.verified && <span style={{ fontSize: 9, fontWeight: 700, color: "#00C864", background: "rgba(0,200,100,0.12)", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>OFICIAL</span>}
                  {e.archived && <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>ARHIVAT</span>}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Sans', sans-serif", marginTop: 3 }}>{e.venue || "fără locație"} · {fmtDateTime(e.event_date)}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                  {e.organizer_email || "organizator necunoscut"}
                  {e.reports_count > 0 && <span style={{ color: "#FFB800" }}> · {e.reports_count} raportări</span>}
                </div>
              </div>
              <button
                disabled={busyId === e.id}
                onClick={() => deleteEvent(e.id, e.title)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.3)", borderRadius: 9, color: "#FF3366", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", flexShrink: 0 }}
              >
                <TrashIcon size={11} /> Șterge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage({ onClose }) {
  const [tab, setTab] = useState("stats");
  const [navState, setNavState] = useState({});
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    // Verificare reală (nu doar UI) — dacă cineva ajunge aici fără să fie pe
    // lista de admini din is_admin(), RPC-ul eșuează și blocăm ecranul.
    supabase.rpc("admin_get_stats", { period_days: 14 }).then(({ error }) => {
      if (error) setDenied(true);
    });
  }, []);

  const navigate = (nextTab, opts = {}) => {
    setNavState(opts);
    setTab(nextTab);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10200, background: "#080808", overflowY: "auto", animation: "pageSlideInRight 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ padding: "calc(50px + env(safe-area-inset-top, 0px)) 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldIcon size={18} style={{ color: "#FF3366" }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>Admin</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>
          Închide
        </button>
      </div>

      {denied ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <NoEntryIcon size={32} style={{ color: "#FF3366", marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif" }}>Nu ai acces la panoul de admin.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", overflowX: "auto" }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setNavState({}); setTab(key); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 20, background: tab === key ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${tab === key ? "rgba(255,51,102,0.35)" : "rgba(255,255,255,0.08)"}`, color: tab === key ? "#FF3366" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div key={tab} style={{ padding: "18px 16px 60px", animation: "fadeIn 0.25s ease" }}>
            {tab === "stats" && <StatsTab onNavigate={navigate} />}
            {tab === "reports" && <ReportsTab />}
            {tab === "users" && <UsersTab initialFilter={navState.filter} />}
            {tab === "events" && <EventsTab initialStatus={navState.status} />}
          </div>
        </>
      )}
    </div>
  );
}
