import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import type { GameScore } from "@/utils/livescores/espnScoreboard";
import { gameStatusText } from "./gameStatusText";

const Ball = ({ side }: { side: "home" | "away" }) => (
  <View testID={`rail-ball-${side}`} style={styles.ball} />
);

/**
 * A followed game, first in the rail: both teams and scores, the clock and
 * the ball.
 */
export function FollowedChip({ game }: { game: GameScore }) {
  const { t } = useTranslation();
  const status = gameStatusText(t, game);
  const scores = game.state !== "pre";
  const ball = game.down?.possessionAbbr;
  return (
    <View
      testID={`rail-chip-followed-${game.id}`}
      style={[styles.chip, styles.followed]}
    >
      {ball === game.away.abbr && <Ball side='away' />}
      <Text className='text-xs text-neutral-300 font-semibold'>
        {game.away.abbr}
      </Text>
      {scores && (
        <Text className='text-sm text-white font-bold'>
          {String(game.away.score)}
        </Text>
      )}
      {ball === game.home.abbr && <Ball side='home' />}
      <Text className='text-xs text-neutral-300 font-semibold'>
        {game.home.abbr}
      </Text>
      {scores && (
        <Text className='text-sm text-white font-bold'>
          {String(game.home.score)}
        </Text>
      )}
      <Text className='text-xs text-white' numberOfLines={1}>
        {status ?? "–"}
      </Text>
    </View>
  );
}

/** One of the other games: teams, scores once it has started, a status. */
export function GameChip({ game }: { game: GameScore }) {
  const { t } = useTranslation();
  const status = gameStatusText(t, game);
  if (status === null) return null;
  const scores = game.state !== "pre";
  return (
    <View testID={`rail-chip-${game.id}`} style={styles.chip}>
      <Text className='text-xs text-neutral-300'>{game.away.abbr}</Text>
      {scores && (
        <Text className='text-xs text-white'>{String(game.away.score)}</Text>
      )}
      <Text className='text-xs text-neutral-300'>{game.home.abbr}</Text>
      {scores && (
        <Text className='text-xs text-white'>{String(game.home.score)}</Text>
      )}
      <Text className='text-xs text-neutral-400' numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  followed: {
    backgroundColor: "rgba(255,255,255,0.12)",
    gap: 5,
  },
  ball: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#facc15",
  },
});
