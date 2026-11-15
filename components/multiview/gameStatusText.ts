import type { TFunction } from "i18next";
import type { GameScore } from "@/utils/livescores/espnScoreboard";
import { type GameStatus, gameStatus } from "@/utils/livescores/scoreBugText";

/** Quarters with their own word; overtime has its own status. */
const QUARTER_KEYS = [
  "livescores.q1",
  "livescores.q2",
  "livescores.q3",
  "livescores.q4",
] as const;

const quarter = (t: TFunction, period: number) =>
  t(QUARTER_KEYS[Math.min(Math.max(period, 1), 4) - 1]);

const text = (t: TFunction, status: GameStatus): string | null => {
  switch (status.kind) {
    case "kickoff":
      return status.time;
    case "quarter":
      return t("livescores.quarter_clock", {
        quarter: quarter(t, status.period),
        clock: status.clock,
      });
    case "overtime":
      return t("livescores.overtime", { clock: status.clock });
    case "endOfQuarter":
      return t("livescores.end_of_quarter", {
        quarter: quarter(t, status.period),
      });
    case "half":
      return t("livescores.half");
    case "final":
      return status.overtime ? t("livescores.final_ot") : t("livescores.final");
    case "none":
      return null;
  }
};

/**
 * A game's status as words: "3rd 14:55", "Half", "Final", a kickoff time.
 * Null for a game called off, which gets no chip at all.
 */
export const gameStatusText = (t: TFunction, game: GameScore): string | null =>
  text(t, gameStatus(game));
