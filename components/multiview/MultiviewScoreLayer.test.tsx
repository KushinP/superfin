import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { TileScore } from "@/hooks/useLiveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";
import { MultiviewScoreLayer } from "./MultiviewScoreLayer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

const kcAtl = parseScoreboard(JSON.parse(JSON.stringify(recorded)))![0];

const tiles = [
  { key: "tile-0", frame: { left: 0, top: 0, width: 640, height: 360 } },
  { key: "tile-1", frame: { left: 640, top: 0, width: 640, height: 360 } },
  { key: "tile-2", frame: { left: 0, top: 360, width: 640, height: 360 } },
];

describe("MultiviewScoreLayer", () => {
  // A1: the layer has no toolbar or label input at all, so hiding the
  // toolbar cannot hide the bug.
  test("draws a tile's bug over that tile's frame", async () => {
    const scores = new Map<string, TileScore>([
      ["tile-1", { kind: "game", game: kcAtl, via: "title" }],
    ]);
    await render(
      <MultiviewScoreLayer
        tiles={tiles}
        scores={scores}
        statsTiles={new Set()}
      />,
    );
    const slot = screen.getByTestId("score-slot-tile-1");
    expect(StyleSheet.flatten(slot.props.style)).toMatchObject({
      left: 640,
      top: 0,
      width: 640,
      height: 360,
    });
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.queryByTestId("score-slot-tile-0")).toBeNull();
  });

  test("never takes a touch or a remote press from the tiles", async () => {
    const scores = new Map<string, TileScore>([
      ["tile-0", { kind: "game", game: kcAtl, via: "title" }],
    ]);
    await render(
      <MultiviewScoreLayer
        tiles={tiles}
        scores={scores}
        statsTiles={new Set()}
      />,
    );
    expect(screen.getByTestId("score-layer").props.pointerEvents).toBe("none");
  });

  // A8
  test("unavailable scores show nothing, unless the tile's stats are on", async () => {
    const scores = new Map<string, TileScore>([
      ["tile-0", { kind: "unavailable", reason: "network" }],
      ["tile-2", { kind: "unavailable", reason: "format" }],
    ]);
    await render(
      <MultiviewScoreLayer
        tiles={tiles}
        scores={scores}
        statsTiles={new Set(["tile-2"])}
      />,
    );
    expect(screen.queryByTestId("score-slot-tile-0")).toBeNull();
    expect(screen.getByText("livescores.unavailable_format")).toBeTruthy();
    expect(screen.queryByText("livescores.unavailable_network")).toBeNull();
  });

  test("nothing at all with no scores", async () => {
    await render(
      <MultiviewScoreLayer
        tiles={tiles}
        scores={new Map()}
        statsTiles={new Set(["tile-0"])}
      />,
    );
    expect(screen.queryByTestId("score-layer")).toBeNull();
  });
});
