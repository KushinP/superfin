import type { GameScore } from "./espnScoreboard";

/**
 * What the bug's status corner says, as data. The words ("3rd", "Half",
 * "Final") are the component's, through translations.
 */
export type GameStatus =
  | { kind: "kickoff"; time: string }
  | { kind: "quarter"; period: number; clock: string }
  | { kind: "overtime"; clock: string }
  | { kind: "endOfQuarter"; period: number }
  | { kind: "half" }
  | { kind: "final"; overtime: boolean }
  | { kind: "none" };

/** Regulation is four quarters; ESPN numbers overtime as period 5 and on. */
const REGULATION_PERIODS = 4;

/** A game called off has nothing worth a bug on the tile. */
const OFF_STATUSES = ["STATUS_POSTPONED", "STATUS_CANCELED"];

/** The status corner of the score bug for one game. */
export const gameStatus = (game: GameScore): GameStatus => {
  if (OFF_STATUSES.includes(game.statusName)) return { kind: "none" };
  if (game.statusName === "STATUS_HALFTIME") return { kind: "half" };
  if (game.statusName === "STATUS_END_PERIOD") {
    return { kind: "endOfQuarter", period: game.period };
  }
  if (game.state === "pre") {
    // "11/15 - 4:05 PM EST": the bug is only up on game day, so the time
    // alone. ESPN's own text, so no time zone guessing on the TV.
    const parts = game.detail.split(" - ");
    return { kind: "kickoff", time: parts[parts.length - 1] };
  }
  if (game.state === "post") {
    return { kind: "final", overtime: game.period > REGULATION_PERIODS };
  }
  if (game.period > REGULATION_PERIODS) {
    return { kind: "overtime", clock: game.clock };
  }
  return { kind: "quarter", period: game.period, clock: game.clock };
};
