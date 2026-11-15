import {
  LIVE_SCORES_RAIL_HEIGHT,
  LIVE_SCORES_RAIL_MARGIN,
} from "@/constants/LiveScores";
import type { TileFrame } from "@/utils/multiview/multiview";

export interface RailPlacement {
  left: number;
  top: number;
  width: number;
  /** True when there was no black band and the rail lies over the pictures. */
  overlay: boolean;
}

/**
 * Where the scores rail goes, in the same coordinates as the tile frames:
 * centred in the black band below the lowest tile when it fits there, so it
 * covers no picture; otherwise along the bottom edge, over the pictures, as
 * with one tile filling the screen or four filling it in a grid.
 */
export const placeRail = (
  frames: readonly TileFrame[],
  area: { width: number; height: number },
): RailPlacement | null => {
  const room = LIVE_SCORES_RAIL_HEIGHT + 2 * LIVE_SCORES_RAIL_MARGIN;
  if (frames.length === 0 || area.height < room) return null;

  const tilesBottom = Math.max(...frames.map((f) => f.top + f.height));
  const band = area.height - tilesBottom;
  const left = LIVE_SCORES_RAIL_MARGIN;
  const width = area.width - 2 * LIVE_SCORES_RAIL_MARGIN;

  if (band >= room) {
    return {
      left,
      top: tilesBottom + (band - LIVE_SCORES_RAIL_HEIGHT) / 2,
      width,
      overlay: false,
    };
  }
  return {
    left,
    top: area.height - LIVE_SCORES_RAIL_HEIGHT - LIVE_SCORES_RAIL_MARGIN,
    width,
    overlay: true,
  };
};
