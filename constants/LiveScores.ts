/**
 * ESPN's public NFL scoreboard. Unofficial: no key, no contract, and it can
 * change without notice, so everything read from it goes through
 * parseScoreboard, which refuses what it does not recognise.
 */
export const LIVE_SCORES_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

/**
 * How often the scoreboard is fetched while a matched game is on. The board
 * is about 190 KB, so this is roughly 45 MB an hour of football.
 */
export const LIVE_SCORES_POLL_LIVE_MS = 15 * 1000;

/** How often it is fetched before kickoff, to notice the start. */
export const LIVE_SCORES_POLL_IDLE_MS = 5 * 60 * 1000;

/**
 * How far behind real time scores are shown, in seconds. Over the air plus
 * the server's transcode runs 15 to 45 s behind ESPN, so 30 errs on the side
 * of no spoilers; Kush adjusts it from a tile's menu.
 */
export const LIVE_SCORES_DELAY_DEFAULT_S = 30;
export const LIVE_SCORES_DELAY_MIN_S = 0;
export const LIVE_SCORES_DELAY_MAX_S = 90;
export const LIVE_SCORES_DELAY_STEP_S = 5;

/**
 * Scores fetched longer ago than this are not shown: a bug frozen on an old
 * score after polling stopped would be worse than no bug.
 */
export const LIVE_SCORES_STALE_MS = 120 * 1000;

/**
 * The most snapshots the delay buffer holds. The longest delay over the
 * fastest poll is 90 / 15 = 6, so 20 is room to spare, not a limit in use.
 */
export const LIVE_SCORES_BUFFER_MAX = 20;
