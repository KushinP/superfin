import { atom } from "jotai";
import type { GameScore } from "@/utils/livescores/espnScoreboard";

/** What the scores rail and the scores screen show. */
export interface LiveScoresView {
  /**
   * "off": the viewer turned live scores off. The Scores button stays, so
   * they can be turned back on where they were turned off (Kush, 2026-11-16:
   * turning them off left no way back on screen); no rail, no fetch.
   */
  status: "ok" | "unavailable" | "off";
  reason?: "network" | "format" | "stale";
  /**
   * The first fetch isn't a spoiler delay old yet, so there's nothing to
   * show: a score fetched now could be ahead of the picture.
   */
  waiting: boolean;
  /** The games the viewer follows, as of the delay, in the order followed. */
  followed: GameScore[];
  /** Every other game, as of the delay, in rail order. */
  others: GameScore[];
  delaySeconds: number;
}

/**
 * The scores multiview or the player is showing, written by its
 * useLiveScores and read by the scores screen, which on TV is a route of
 * its own. Null when neither screen is open; "off" when scores are turned off.
 */
export const liveScoresViewAtom = atom<LiveScoresView | null>(null);

/**
 * The games the viewer follows, by ESPN id, at most LIVE_SCORES_MAX_FOLLOWED.
 * In memory only: a follow is for one game, ends when it does, and a restart
 * forgets it. Shared by multiview and the player.
 */
export const followedGameIdsAtom = atom<string[]>([]);
