import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/Text";
import type { TileScore } from "@/hooks/useLiveScores";
import type { TileFrame } from "@/utils/multiview/multiview";
import { ScoreBug } from "./ScoreBug";

const UNAVAILABLE_KEYS = {
  network: "livescores.unavailable_network",
  format: "livescores.unavailable_format",
  stale: "livescores.unavailable_stale",
} as const;

interface Props {
  tiles: { key: string; frame: TileFrame }[];
  scores: ReadonlyMap<string, TileScore>;
  /** Tiles with their stats on: only there is "Scores unavailable" shown. */
  statsTiles: ReadonlySet<string>;
}

/**
 * The score bugs, drawn over the multiview tiles rather than inside them, so
 * a score changing never re-renders a tile or touches its player. It takes
 * no touches or remote presses, and does not hide with the toolbar.
 */
export function MultiviewScoreLayer({ tiles, scores, statsTiles }: Props) {
  const { t } = useTranslation();
  const slots = tiles.flatMap(({ key, frame }) => {
    const score = scores.get(key);
    if (!score) return [];
    // An outage is said only where Kush looks into a tile on purpose; over
    // a game it would just be noise.
    if (score.kind === "unavailable" && !statsTiles.has(key)) return [];
    return [{ key, frame, score }];
  });
  if (slots.length === 0) return null;

  return (
    <View
      testID='score-layer'
      pointerEvents='none'
      style={StyleSheet.absoluteFill}
    >
      {slots.map(({ key, frame, score }) => (
        <View
          key={key}
          testID={`score-slot-${key}`}
          style={{
            position: "absolute",
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          }}
        >
          <View style={styles.corner}>
            {score.kind === "game" ? (
              <ScoreBug game={score.game} />
            ) : (
              <View style={styles.unavailable}>
                <Text className='text-xs text-neutral-300'>
                  {t(UNAVAILABLE_KEYS[score.reason])}
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Top left: the name label is bottom left and the ••• button top right.
  corner: {
    position: "absolute",
    left: 6,
    top: 6,
    maxWidth: "80%",
  },
  unavailable: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
