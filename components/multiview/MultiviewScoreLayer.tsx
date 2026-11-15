import { StyleSheet, View } from "react-native";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import { placeRail } from "@/utils/livescores/railLayout";
import type { TileFrame } from "@/utils/multiview/multiview";
import { ScoresRail } from "./ScoresRail";

/** How tall a pinned tile's colour tag is, along its top edge. */
const TAG_HEIGHT = 3;

interface Props {
  tiles: { key: string; frame: TileFrame }[];
  /** The multiview area the frames are laid out in. */
  area: { width: number; height: number };
  view: LiveScoresView | null;
}

/**
 * Live scores over multiview: the rail, in the black band below the tiles
 * when there is one, and a colour tag along the top of each tile whose game
 * is pinned in it. Its own layer over the tiles, not inside them, so a score
 * changing never re-renders a tile or touches its player; it takes no
 * touches or remote presses.
 */
export function MultiviewScoreLayer({ tiles, area, view }: Props) {
  if (!view) return null;
  const rail = placeRail(
    tiles.map((t) => t.frame),
    area,
  );

  return (
    <View
      testID='score-layer'
      pointerEvents='none'
      style={StyleSheet.absoluteFill}
    >
      {view.pinned.map((pinned) => {
        const frame = tiles.find((t) => t.key === pinned.tileKey)?.frame;
        if (!frame) return null;
        return (
          <View
            key={pinned.tileKey}
            testID={`tile-tag-${pinned.tileKey}`}
            style={{
              position: "absolute",
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: TAG_HEIGHT,
              backgroundColor: pinned.color,
            }}
          />
        );
      })}
      {rail && (
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
      )}
    </View>
  );
}
