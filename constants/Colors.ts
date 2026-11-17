import type { SeerrStatusTone } from "@/utils/seerr/statusBadge";

// SuperFin's accent, the 500 and 300 steps of the brand scale in
// tailwind.config.js. Colors.test.ts keeps the two files in step.
const PRIMARY = "#10b981";
const PRIMARY_LIGHT = "#6ee7b7";

export const Colors = {
  primary: PRIMARY,
  primaryRGB: "rgb(16 185 129)",
  /** The accent on a dark fill, where the primary would sink in. */
  primaryLight: PRIMARY_LIGHT,
  primaryLightRGB: "rgb(110 231 183)",
  text: "#ECEDEE",
  background: "#151718",
  tint: "#fff",
  icon: "#9BA1A6",
  tabIconDefault: "#9BA1A6",
  tabIconSelected: PRIMARY,
  // The LIVE badge of a Live TV program, on the cards and in the TV guide.
  live: "#EF4444",
};

/**
 * Behind the content of a TV sheet or panel drawn over a page. Android TV does
 * not blur what is behind a BlurView, it only tints it: without a backing of
 * its own, the page shows through the sheet.
 */
export const TV_PANEL_BACKING = "rgba(18, 18, 20, 0.96)";

/** The placeholders a TV row or page draws in the shape of its content while it loads. */
export const TV_SKELETON = "#262626";

/**
 * What a Seerr status reads as wherever it is spelled out: available in
 * green, pending in amber, requested (approved and on its way) in indigo.
 */
export const SeerrStatusColors = {
  available: "#22c55e",
  pending: "#f59e0b",
  requested: "#818cf8",
} as const;

/** Seerr's badges (its Badge): each tone's fill, edge and text. */
export const SeerrBadgeColors = {
  primary: {
    background: "rgba(99, 102, 241, 0.8)",
    border: "#6366f1",
    text: "#e0e7ff",
  },
  success: {
    background: "rgba(34, 197, 94, 0.8)",
    border: "#22c55e",
    text: "#dcfce7",
  },
  warning: {
    background: "rgba(234, 179, 8, 0.8)",
    border: "#eab308",
    text: "#fef9c3",
  },
  danger: {
    background: "rgba(220, 38, 38, 0.8)",
    border: "#ef4444",
    text: "#fee2e2",
  },
} as const;

/** Seerr's request card: its surface, the fade over its backdrop, its text. */
export const SeerrCardColors = {
  surface: "#374151",
  fadeFrom: "rgba(31, 41, 55, 0.47)",
  fadeTo: "rgba(31, 41, 55, 1)",
  clear: "rgba(31, 41, 55, 0)",
  requester: "#d1d5db",
  label: "#9ca3af",
} as const;

/** The report issue button of a Seerr page, Seerr's warning yellow. */
export const SeerrIssueColors = {
  background: "rgba(234, 179, 8, 0.5)",
  border: "#facc15",
  /** The TV button with the focus on it. */
  focused: "rgba(234, 179, 8, 0.8)",
} as const;

/** The surfaces of a sheet: its background, a group of rows, their lines. */
export const SheetColors = {
  background: "#171717",
  group: "#212121",
  separator: "#303030",
  secondaryText: "#9ba1a6",
  idle: "#5a5a5a",
} as const;

/**
 * The wash a movie or show page takes from its artwork (utils/ambientTint):
 * how much of the colour is kept on its way to black, and how saturated a
 * colour has to be to count as one rather than a grey.
 */
export const AmbientTint = {
  strength: 0.32,
  minSaturation: 0.15,
} as const;

/** A channel in the phone's Live TV Channels list (ChannelNowNextRow). */
export const ChannelRowColors = {
  tile: "rgba(255, 255, 255, 0.06)",
  tileEdge: "rgba(255, 255, 255, 0.12)",
  separator: "rgba(255, 255, 255, 0.08)",
  pressed: "rgba(255, 255, 255, 0.06)",
  track: "rgba(255, 255, 255, 0.12)",
  /** The far end of the progress bar, the lime of the logo. */
  progressEnd: "#bef264",
  primaryText: "#e5e5ea",
  secondary: "#8e8e93",
  glyph: "rgba(255, 255, 255, 0.5)",
  /** The filter chip that is on (All, Favorites). */
  selectedChip: "#ffffff",
  selectedChipText: "#000000",
} as const;

/** The phone's Live TV guide (LiveTVGuideRow, HourHeader, the guide page). */
export const GuideColors = {
  header: "rgba(255, 255, 255, 0.06)",
  hourLabel: "#8e8e93",
  cellEdge: "rgba(255, 255, 255, 0.08)",
  /** The program on now. */
  liveCell: "rgba(16, 185, 129, 0.16)",
  liveEdge: "rgba(16, 185, 129, 0.45)",
  title: "#e5e5ea",
  time: "#8e8e93",
  /** The line at the current time, the accent. */
  nowLine: PRIMARY_LIGHT,
} as const;

/** The Live TV tab bar on the phone, a glass segmented control. */
export const LiveTvTabBarColors = {
  track: "rgba(255, 255, 255, 0.08)",
  edge: "rgba(255, 255, 255, 0.14)",
  pill: "rgba(255, 255, 255, 0.16)",
  activeLabel: "#ffffff",
  inactiveLabel: "rgba(255, 255, 255, 0.65)",
} as const;

/** The fade over the Home backdrop (HomeAmbientBackdrop), halfway down. */
export const HomeAmbientColors = {
  scrim: "rgba(0, 0, 0, 0.45)",
} as const;

/** Multiview with a TV remote: what has focus. */
export const MultiviewColors = {
  focused: "rgba(255, 255, 255, 0.16)",
  focusRing: "#FFFFFF",
} as const;

/** The Mac's own sidebar beside the tabs (components/MacSidebar.tsx). */
export const MacSidebarColors = {
  background: "#0c0c0d",
  border: "rgba(255, 255, 255, 0.07)",
  itemActive: "rgba(16, 185, 129, 0.16)",
  itemHovered: "rgba(255, 255, 255, 0.06)",
  text: "#f5f5f5",
  textMuted: "#a1a1aa",
  heading: "#71717a",
} as const;

/** A library tile on the wide-window Library page. */
export const LibraryTileColors = {
  background: "#171717",
  border: "rgba(255, 255, 255, 0.06)",
  borderHovered: "rgba(255, 255, 255, 0.35)",
  clear: "rgba(0, 0, 0, 0)",
  scrim: "rgba(0, 0, 0, 0.85)",
  text: "#ffffff",
  subtext: "#d4d4d4",
  placeholderIcon: "#525252",
  badge: "rgba(0, 0, 0, 0.6)",
} as const;

/** The background of a page drawn under a parallax header (ParallaxPage). */
export const ParallaxPageColors = {
  background: "black",
  /** The background, see-through, for a fade into it. */
  clear: "rgba(0, 0, 0, 0)",
} as const;

/**
 * Seerr's status badge colours per tone (StatusBadgeMini), for the TV, which
 * draws with styles: the phone's badge (SeerrStatusIcon) has the same ones as
 * classes.
 */
export const SeerrStatusBadgeColors: Record<SeerrStatusTone, string> = {
  pending: "#eab308",
  processing: "#6366f1",
  partial: "#22c55e",
  available: "#a855f7",
  blocklisted: "#ef4444",
  request: "#16a34a",
};

/** Seerr's type badge over a poster: a film in blue, a series in purple. */
export const SeerrMediaBadgeColors = {
  movie: {
    background: "rgba(37, 99, 235, 0.9)",
    border: "rgba(96, 165, 250, 0.4)",
  },
  tv: {
    background: "rgba(147, 51, 234, 0.9)",
    border: "rgba(192, 132, 252, 0.4)",
  },
} as const;
