import { TV_TRICKPLAY_SCREEN_FRACTION } from "@/constants/Playback";
import { CONTROLS_CONSTANTS } from "../constants";

/** TrickplayBubble's own base scale for the preview image. */
const BUBBLE_BASE_IMAGE_SCALE = 1.6;
/** Apple TV's scale, kept when the screen's width isn't known yet. */
const FALLBACK_SCALE = 1.8;

/**
 * The TV seek preview's scale for a screen this many layout units wide, so it
 * covers the same share of any TV's screen. A Fire TV lays out half the units
 * an Apple TV does, and a fixed scale drew its preview twice as large.
 */
export const tvTrickplayScale = (screenWidth: number): number =>
  screenWidth > 0
    ? (screenWidth * TV_TRICKPLAY_SCREEN_FRACTION) /
      (CONTROLS_CONSTANTS.TILE_WIDTH * BUBBLE_BASE_IMAGE_SCALE)
    : FALLBACK_SCALE;
