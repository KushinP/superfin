/**
 * Most tiles one multiview screen holds. Four is what Apple's own multiview
 * offers and about what a phone or a Mac can decode at once; it is also more
 * than a dual tuner can feed, so live channels run out before tiles do.
 */
export const MULTIVIEW_MAX_TILES = 4;

/**
 * Share of the screen width the main tile takes in the focus layout. The rest
 * is a column of small tiles on the right, as in Apple TV multiview.
 */
export const MULTIVIEW_FOCUS_MAIN_RATIO = 0.72;

/** Gap, in points, between tiles. */
export const MULTIVIEW_TILE_GAP = 4;

/**
 * How long, in ms, the multiview toolbar stays up after the last touch.
 */
export const MULTIVIEW_TOOLBAR_HIDE_DELAY = 5_000;

/**
 * How long, in ms, the picker waits after the last keystroke before searching
 * the library. The same pause as the Search tab.
 */
export const MULTIVIEW_SEARCH_DEBOUNCE = 200;

/** How many movies and episodes a picker search lists. */
export const MULTIVIEW_SEARCH_LIMIT = 30;

/** How many part-watched items the picker's Continue watching lists. */
export const MULTIVIEW_RESUME_LIMIT = 20;

/**
 * How many episodes around a finished one are asked for to find the next:
 * the one before, itself and the one after.
 */
export const MULTIVIEW_ADJACENT_EPISODES = 3;

/** Width, in points, of the picker panel; it never takes over 70% of the screen. */
export const MULTIVIEW_PICKER_WIDTH = 380;

/** How far, in seconds, a tile's back button goes. */
export const MULTIVIEW_SEEK_BACK_SECONDS = 10;

/** How far, in seconds, a tile's forward button goes. */
export const MULTIVIEW_SEEK_FORWARD_SECONDS = 30;

/**
 * How long, in ms, a playing tile's picture may stand still before its loading
 * wheel comes back. Progress ticks come several times a second, so two seconds
 * without one is a stall, not a slow tick.
 */
export const MULTIVIEW_STALL_DELAY = 2_000;

/**
 * How close, in seconds, to the end of a movie or episode a tile that stops
 * moving has to be for it to count as finished rather than stalled. MPV's last
 * progress tick lands a little short of the duration.
 */
export const MULTIVIEW_END_TOLERANCE = 3;

/**
 * How close, in seconds, a pause has to be to the end to count as MPV holding
 * the last frame rather than the user pausing near the end. Tighter than
 * MULTIVIEW_END_TOLERANCE, which judges a tile whose ticks have stopped.
 */
export const MULTIVIEW_EOF_PAUSE_TOLERANCE = 1;

/**
 * Buffer settings for one tile. Each tile is its own MPV instance, so the
 * single-player defaults (up to 150 MB forward each) would multiply by the
 * tile count. These are the lowest values the native player accepts.
 */
export const MULTIVIEW_TILE_CACHE = {
  enabled: "auto",
  cacheSeconds: 10,
  maxBytes: 50,
  maxBackBytes: 25,
} as const;

/** Size, in points, of a multiview toolbar button on a TV. */
export const MULTIVIEW_TV_TOOLBAR_BUTTON = 56;

/** How often, in ms, an open stats overlay asks its tile's player for numbers. */
export const MULTIVIEW_STATS_INTERVAL = 1_000;

/**
 * Most a tile waits, in ms, for other tiles' stop reports before it opens its
 * own stream: long enough for the server to free a tuner, short enough that a
 * report that never answers cannot hold a tile up.
 */
export const MULTIVIEW_STOP_WAIT_LIMIT = 3_000;

/**
 * How long, in ms, a live tile that was playing may go without new video
 * before it reconnects on its own. Far longer than the live cushion
 * (LIVE_PAUSE_WAIT_SECONDS): at 12 s, Fox dropped four times in 13 minutes on
 * 2026-11-08, each reconnect closing a channel the server was still sending
 * (docs/specs/2026-11-08-live-tile-backoff.md).
 */
export const MULTIVIEW_LIVE_STALL_RECONNECT = 30_000;

/**
 * How long, in ms, a live tile may take to show its first frame before it
 * reconnects. Generous: the server can take ten seconds or more to open a
 * channel, answering the first requests with an error meanwhile.
 */
export const MULTIVIEW_LIVE_START_RECONNECT = 30_000;

/**
 * Automatic reconnects a live tile makes in a row without playing in between,
 * before it stops and waits for the user.
 */
export const MULTIVIEW_AUTO_RECONNECT_LIMIT = 3;

/**
 * How long, in ms, a live channel waits after the last live stop report was
 * sent before it opens a stream. On 2026-11-08 a reconnect asked for Fox 2-3 s
 * after its stop, while Jellyfin was still closing the tuner, and got HTTP 500.
 */
export const MULTIVIEW_LIVE_REOPEN_GAP = 5_000;

/**
 * Delays, in ms, before each new try at a live stream whose playlist the
 * server refused. One try plus one per delay, then the tile shows its error;
 * before, a refused open sat until MULTIVIEW_LIVE_START_RECONNECT.
 */
export const MULTIVIEW_LIVE_OPEN_RETRY_DELAYS = [2_000, 4_000, 8_000] as const;

/**
 * How long, in ms, the live playlist check waits for the server. Opening a
 * channel can take it ten seconds or more; past this the player is left to
 * judge the stream itself.
 */
export const MULTIVIEW_LIVE_PROBE_TIMEOUT = 20_000;
