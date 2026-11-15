import {
  LIVE_SCORES_RAIL_HEIGHT,
  LIVE_SCORES_RAIL_MARGIN,
} from "@/constants/LiveScores";
import { tileFrames } from "@/utils/multiview/multiview";
import { placeRail } from "./railLayout";

// A 1080p Fire TV draws at 960 x 540 screen units.
const area = { width: 960, height: 540 };
const bottomOf = (frames: ReturnType<typeof tileFrames>) =>
  Math.max(...frames.map((f) => f.top + f.height));

describe("placeRail", () => {
  // R1
  test("two tiles side by side: centered in the black band below, over no picture", () => {
    const frames = tileFrames("grid", 2, area.width, area.height);
    const rail = placeRail(frames, area)!;
    expect(rail.overlay).toBe(false);
    expect(rail.top).toBeGreaterThanOrEqual(bottomOf(frames));
    expect(rail.top + LIVE_SCORES_RAIL_HEIGHT).toBeLessThanOrEqual(area.height);
    // Centered in the band: as much black above it as below.
    const above = rail.top - bottomOf(frames);
    const below = area.height - (rail.top + LIVE_SCORES_RAIL_HEIGHT);
    expect(Math.abs(above - below)).toBeLessThan(1);
  });

  // R2
  test("one tile enlarged: in the band under the big picture, over no picture", () => {
    const frames = tileFrames("focus", 2, area.width, area.height);
    const rail = placeRail(frames, area)!;
    expect(rail.overlay).toBe(false);
    expect(rail.top).toBeGreaterThanOrEqual(bottomOf(frames));
    expect(rail.top + LIVE_SCORES_RAIL_HEIGHT).toBeLessThanOrEqual(area.height);
  });

  test("spans the screen's width inside the margins", () => {
    const rail = placeRail(tileFrames("grid", 2, 960, 540), area)!;
    expect(rail.left).toBe(LIVE_SCORES_RAIL_MARGIN);
    expect(rail.width).toBe(area.width - 2 * LIVE_SCORES_RAIL_MARGIN);
  });

  // One picture fills the screen and four fill it in a grid: there is no
  // black band, so the rail lies over the bottom edge, still on screen.
  test.each([
    ["one tile", "grid", 1],
    ["three tiles", "grid", 3],
    ["four tiles", "grid", 4],
    ["four tiles, one enlarged", "focus", 4],
  ] as const)(
    "%s: over the bottom edge, inside the screen",
    (_name, layout, count) => {
      const rail = placeRail(tileFrames(layout, count, 960, 540), area)!;
      expect(rail.overlay).toBe(true);
      expect(rail.top + LIVE_SCORES_RAIL_HEIGHT).toBe(
        area.height - LIVE_SCORES_RAIL_MARGIN,
      );
      expect(rail.top).toBeGreaterThan(0);
    },
  );

  test("a phone's shorter, wider screen still fits two tiles' band", () => {
    const phone = { width: 760, height: 360 };
    const frames = tileFrames("grid", 2, phone.width, phone.height);
    const rail = placeRail(frames, phone)!;
    expect(rail.overlay).toBe(false);
    expect(rail.top).toBeGreaterThanOrEqual(bottomOf(frames));
  });

  test("no tiles, or no room at all, places nothing", () => {
    expect(placeRail([], area)).toBeNull();
    expect(
      placeRail(tileFrames("grid", 1, 960, 540), { width: 960, height: 0 }),
    ).toBeNull();
  });
});
