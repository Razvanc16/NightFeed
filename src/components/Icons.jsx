// Set unitar de iconițe-contur (stroke, fără culoare/emoji), ca să înlocuiască
// emoji-urile colorate din toată aplicația. Aceeași convenție ca iconițele deja
// existente în EventCard: viewBox 24x24, stroke="currentColor" (moștenește
// culoarea din context prin CSS `color`), strokeWidth 2, capete rotunjite.
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const LightningIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>
);

export const HouseIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M3 11 12 4l9 7" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /><path d="M9 20v-6h6v6" /></svg>
);

export const PinIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
);

export const LockIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);

export const ClockIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 3" /></svg>
);

export const KeyIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="7.5" cy="15.5" r="4" /><path d="M10.5 12.5 20 3" /><path d="M17 6l2.5 2.5" /><path d="M14 9l2 2" /></svg>
);

export const CheckCircleIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></svg>
);

export const CrossCircleIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
);

export const MoonIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z" /></svg>
);

export const SparkleIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>
);

export const FireIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 21c3.5 0 6-2.5 6-6 0-2.5-1.5-4-2.5-5.5 0 1.5-1 2.5-1.5 2.5 0-2.5-1-4-3-5.5.5 2.5-1 4-2.5 5.5C7.5 13 7 14 7 15.5 7 18.5 9 21 12 21z" /></svg>
);

export const ConfettiIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M4 20l3.5-1M20 4l-1 3.5M6 6.5l1.5 1.5M17.5 16.5 16 18" /><circle cx="12" cy="12" r="2.2" /></svg>
);

export const TagIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M3 12 12 3h6a3 3 0 0 1 3 3v6l-9 9a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8z" /><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" /></svg>
);

export const MapIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>
);

export const EnvelopeIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);

export const RocketIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 2c3 2 5 6 5 10 0 2-1 4-2 5l-1-3-2 2-2-2-1 3c-1-1-2-3-2-5 0-4 2-8 5-10z" /><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none" /><path d="M8.5 17 6 21M15.5 17 18 21" /></svg>
);

export const CameraIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M4 8a1 1 0 0 1 1-1h2.5l1.3-2h6.4l1.3 2H19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><circle cx="12" cy="13" r="3.6" /></svg>
);

export const TargetIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" /></svg>
);

export const OutboxIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 3v11" /><path d="M8 7l4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
);

export const DocumentIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /><path d="M9 13h6M9 17h6" /></svg>
);

export const TrashIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>
);

export const WarningIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M12 3 2 20h20z" /><path d="M12 9.5v4.5" /><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" /></svg>
);

export const NoEntryIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="12" r="9" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
);

export const SpeechBubbleIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);

export const PersonIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></svg>
);

export const SearchIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

export const HeartOutlineIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
);

export const PlusIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

// String SVG (nu componentă React) — pentru markere Leaflet, care primesc HTML brut, nu JSX.
export const houseIconSvg = (color = "#fff") => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/><path d="M9 20v-6h6v6"/></svg>`;
export const lightningIconSvg = (color = "#fff") => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>`;

export const BellIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);

export const BellOffIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M8.7 3.7A6 6 0 0 1 18 8c0 3.4.8 5.6 1.5 7" /><path d="M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h13" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
);

export const InboxIcon = ({ size = 16, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}><path d="M4 12h4l2 3h4l2-3h4" /><path d="M6 5h12l2 7v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z" /></svg>
);
