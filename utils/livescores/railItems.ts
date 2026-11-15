import {
  LIVE_SCORES_RAIL_CHIP_WIDTH,
  LIVE_SCORES_RAIL_PINNED_WIDTH,
  LIVE_SCORES_RAIL_SEPARATOR_WIDTH,
} from "@/constants/LiveScores";
import type { GameScore } from "./espnScoreboard";

const STATE_ORDER: Record<GameScore["state"], number> = {
  in: 0,
  pre: 1,
  post: 2,
};

/**
 * Games in the order the rail and the scores screen list them: those in
 * progress, then those still to come by kickoff, then the finals.
 */
export const orderGames = (games: readonly GameScore[]): GameScore[] =>
  [...games].sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      Date.parse(a.start) - Date.parse(b.start) ||
      a.id.localeCompare(b.id),
  );

/**
 * The games for the rail's unpinned part: every game except those on the
 * tiles, in rail order. Only matched games are left out, so a tile whose
 * listing named no game leaves its game (if any) in the list.
 */
export const otherGames = (
  games: readonly GameScore[],
  onScreen: ReadonlySet<string>,
): GameScore[] => orderGames(games.filter((g) => !onScreen.has(g.id)));

/** How many of the other games fit beside the pinned ones; at least one. */
export const chipsPerPage = (
  railWidth: number,
  pinnedCount: number,
): number => {
  const pinned =
    pinnedCount > 0
      ? pinnedCount * LIVE_SCORES_RAIL_PINNED_WIDTH +
        LIVE_SCORES_RAIL_SEPARATOR_WIDTH
      : 0;
  return Math.max(
    1,
    Math.floor((railWidth - pinned) / LIVE_SCORES_RAIL_CHIP_WIDTH),
  );
};

/**
 * One page of the other games. Pages rather than a scroll: a moving strip is
 * costlier on a Fire TV and harder to read at a glance. Wraps after the last.
 */
export const railPage = (
  games: readonly GameScore[],
  perPage: number,
  page: number,
): GameScore[] => {
  if (games.length === 0) return [];
  const pages = Math.ceil(games.length / perPage);
  const start = (page % pages) * perPage;
  return games.slice(start, start + perPage);
};
