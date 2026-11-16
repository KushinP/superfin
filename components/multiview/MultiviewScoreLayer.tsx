import { StyleSheet, View } from "react-native";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import { placeRail } from "@/utils/livescores/railLayout";
import type { TileFrame } from "@/utils/multiview/multiview";
import { ScoresRail } from "./ScoresRail";

interface Props {
  /** The tiles' frames, to find the black band below them. */
  frames: TileFrame[];
  /** The multiview area the frames are laid out in. */
  area: { width: number; height: number };
  view: LiveScoresView | null;
}

/**
 * Live scores over multiview: the rail, in the black band below the tiles
 * when there is one. Its own layer over the tiles, not inside them, so a
 * score changing never re-renders a tile or touches its player; it takes no
 * touches or remote presses.
 */
export function MultiviewScoreLayer({ frames, area, view }: Props) {
  if (!view) return null;
  const rail = placeRail(frames, area);
  if (!rail) return null;

  return (
    <View
      testID='score-layer'
      pointerEvents='none'
      style={StyleSheet.absoluteFill}
    >
      <View
        testID='rail-slot'
        style={{
          position: "absolute",
          left: rail.left,
          top: rail.top,
          width: rail.width,
        }}
      >
        <ScoresRail view={view} width={rail.width} />
      </View>
    </View>
  );
}
