import { atom } from "jotai";
import type { GameScore } from "@/utils/livescores/espnScoreboard";

/** A game on a tile, pinned at the start of the rail. */
export interface PinnedGame {
  tileKey: string;
  /** The tag colour shared by the rail and the tile's top edge. */
  color: string;
  gameId: string;
  /** Known as soon as the game is matched, before its score may be shown. */
  teams: { away: string; home: string };
  /** The game as of the spoiler delay; null until a fetch is that old. */
  game: GameScore | null;
}

/** What the scores rail and the scores screen show. */
export interface LiveScoresView {
  status: "ok" | "unavailable";
  reason?: "network" | "format" | "stale";
  pinned: PinnedGame[];
  /** Every other game, live, in rail order. */
  others: GameScore[];
  delaySeconds: number;
}

/**
 * The scores multiview is showing, written by its useLiveScores and read by
 * the scores screen, which on TV is a route of its own. Null when scores
 * are off or no tile shows football.
 */
export const liveScoresViewAtom = atom<LiveScoresView | null>(null);
