import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";
import { placeRail } from "@/utils/livescores/railLayout";
import { tileFrames } from "@/utils/multiview/multiview";
import { MultiviewScoreLayer } from "./MultiviewScoreLayer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const area = { width: 960, height: 540 };
const frames = tileFrames("grid", 2, area.width, area.height);
const view: LiveScoresView = {
  status: "ok",
  waiting: false,
  followed: [board[0]],
  others: board.slice(1),
  delaySeconds: 30,
};
const flat = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe("MultiviewScoreLayer", () => {
  // R1: the rail sits where placeRail puts it, in the band below the tiles.
  test("puts the rail in the black band below the tiles", async () => {
    await render(
      <MultiviewScoreLayer frames={frames} area={area} view={view} />,
    );
    const placed = placeRail(frames, area)!;
    expect(placed.overlay).toBe(false);
    expect(flat("rail-slot")).toMatchObject({
      left: placed.left,
      top: placed.top,
      width: placed.width,
    });
  });

  // v3: no tile is tied to a game, so no tile gets a colour tag.
  test("tags no tile", async () => {
    await render(
      <MultiviewScoreLayer frames={frames} area={area} view={view} />,
    );
    expect(screen.queryAllByTestId(/^tile-tag-/)).toHaveLength(0);
  });

  test("takes no touches or remote presses from the tiles", async () => {
    await render(
      <MultiviewScoreLayer frames={frames} area={area} view={view} />,
    );
    expect(screen.getByTestId("score-layer").props.pointerEvents).toBe("none");
  });

  // The v1 corner bug is gone: nothing is drawn over a picture's corner.
  test("draws no score over the tiles themselves", async () => {
    await render(
      <MultiviewScoreLayer frames={frames} area={area} view={view} />,
    );
    expect(screen.queryByTestId("score-bug")).toBeNull();
  });

  // S9
  test("nothing at all with no view", async () => {
    await render(
      <MultiviewScoreLayer frames={frames} area={area} view={null} />,
    );
    expect(screen.queryByTestId("score-layer")).toBeNull();
  });
});
