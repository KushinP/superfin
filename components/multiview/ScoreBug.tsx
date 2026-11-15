import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import type { GameScore, TeamScore } from "@/utils/livescores/espnScoreboard";
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

const statusText = (t: TFunction, status: GameStatus): string | null => {
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

const Team = ({
  team,
  side,
  hasBall,
}: {
  team: TeamScore;
  side: "home" | "away";
  hasBall: boolean;
}) => (
  <View style={styles.team}>
    {hasBall && (
      <View testID={`score-bug-possession-${side}`} style={styles.possession} />
    )}
    <Text className='text-xs text-neutral-300 font-semibold'>{team.abbr}</Text>
    <Text className='text-sm text-white font-bold'>{String(team.score)}</Text>
  </View>
);

/**
 * The small strip on a multiview tile with one game's score, as the bug in
 * the corner of a broadcast: both teams, the quarter and clock, and the down
 * while the ball is live. It shows whatever game it is given; holding back
 * spoilers is useLiveScores' job.
 */
export function ScoreBug({ game }: { game: GameScore }) {
  const { t } = useTranslation();
  const status = statusText(t, gameStatus(game));
  if (status === null) return null;
  const ball = game.down?.possessionAbbr;
  return (
    <View testID='score-bug' style={styles.bug}>
      <Team team={game.away} side='away' hasBall={ball === game.away.abbr} />
      <Team team={game.home} side='home' hasBall={ball === game.home.abbr} />
      <Text className='text-xs text-white' numberOfLines={1}>
        {status}
      </Text>
      {game.down && (
        <Text
          className={
            game.down.redZone
              ? "text-xs text-red-400 font-semibold"
              : "text-xs text-neutral-300"
          }
          numberOfLines={1}
        >
          {game.down.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bug: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  team: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  possession: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#facc15",
  },
});
