import {
  LIVE_SCORES_MAX_FOLLOWED,
  LIVE_SCORES_RAIL_CHIP_WIDTH,
  LIVE_SCORES_RAIL_FOLLOWED_WIDTH,
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
 * The followed games, in the order followed, and every other game in rail
 * order. A followed game missing from these games is left out.
 */
export const splitFollowed = (
  games: readonly GameScore[],
  followedIds: readonly string[],
): { followed: GameScore[]; others: GameScore[] } => ({
  followed: followedIds.flatMap((id) => games.filter((g) => g.id === id)),
  others: orderGames(games.filter((g) => !followedIds.includes(g.id))),
});

/**
 * The follows still worth keeping: a game that's over, or gone from the
 * feed (the next week's board), is unfollowed, so it stops leading the rail.
 */
export const activeFollows = (
  followedIds: readonly string[],
  games: readonly GameScore[],
): string[] =>
  followedIds.filter((id) => {
    const game = games.find((g) => g.id === id);
    return game !== undefined && game.state !== "post";
  });

/** Follows or unfollows a game; a game past the limit isn't added. */
export const toggleFollow = (
  followedIds: readonly string[],
  gameId: string,
): string[] => {
  if (followedIds.includes(gameId)) {
    return followedIds.filter((id) => id !== gameId);
  }
  if (followedIds.length >= LIVE_SCORES_MAX_FOLLOWED) return [...followedIds];
  return [...followedIds, gameId];
};

/** Whether any game is being played: the rail only shows then. */
export const hasLiveGame = (games: readonly GameScore[]): boolean =>
  games.some((g) => g.state === "in");

/** How many of the other games fit beside the followed ones; at least one. */
export const chipsPerPage = (
  railWidth: number,
  followedCount: number,
): number => {
  const followed =
    followedCount > 0
      ? followedCount * LIVE_SCORES_RAIL_FOLLOWED_WIDTH +
        LIVE_SCORES_RAIL_SEPARATOR_WIDTH
      : 0;
  return Math.max(
    1,
    Math.floor((railWidth - followed) / LIVE_SCORES_RAIL_CHIP_WIDTH),
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
