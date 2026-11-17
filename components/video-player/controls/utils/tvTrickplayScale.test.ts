import { TV_TRICKPLAY_SCREEN_FRACTION } from "@/constants/Playback";
import { CONTROLS_CONSTANTS } from "../constants";
import { tvTrickplayScale } from "./tvTrickplayScale";

/** How wide the preview image is drawn for a scale (see TrickplayBubble). */
const previewWidth = (scale: number) =>
  CONTROLS_CONSTANTS.TILE_WIDTH * 1.6 * scale;

// Fire TV, 2026-11-16: "When scrubbing and skipping ahead the mini window it
// shows is HUGE". The scale was a fixed 1.8, about 432 units wide: under a
// quarter of an Apple TV's 1920-unit screen, but nearly half of a Fire TV's,
// which lays out 960 units at twice the density.
describe("tvTrickplayScale", () => {
  test("keeps Apple TV's preview as it was", () => {
    expect(tvTrickplayScale(1920)).toBeCloseTo(1.8);
  });

  test("a Fire TV's preview takes the same share of the screen, not double", () => {
    const width = previewWidth(tvTrickplayScale(960));
    expect(width / 960).toBeCloseTo(TV_TRICKPLAY_SCREEN_FRACTION);
    expect(width / 960).toBeLessThan(0.25);
  });

  test("an unknown width falls back to Apple TV's scale", () => {
    expect(tvTrickplayScale(0)).toBeCloseTo(1.8);
  });
});
