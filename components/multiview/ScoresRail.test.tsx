import { act, render, screen } from "@testing-library/react-native";
import { LIVE_SCORES_RAIL_PAGE_MS } from "@/constants/LiveScores";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import {
  type GameScore,
  parseScoreboard,
} from "@/utils/livescores/espnScoreboard";
import { ScoresRail } from "./ScoresRail";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const kcAtl = board[0];
/** Other games with their own teams, all before kickoff. */
const others = (count: number): GameScore[] =>
  Array.from({ length: count }, (_, i) => ({
    ...board[3],
    id: `g${i}`,
    away: { ...board[3].away, abbr: `A${i}` },
  }));
const view = (more: Partial<LiveScoresView> = {}): LiveScoresView => ({
  status: "ok",
  pinned: [
    {
      tileKey: "tile-0",
      color: "#60a5fa",
      gameId: kcAtl.id,
      teams: { away: "KC", home: "ATL" },
      game: kcAtl,
    },
  ],
  others: others(3),
  delaySeconds: 30,
  ...more,
});
const shownOthers = () =>
  screen.queryAllByText(/^A\d+$/).map((t) => t.props.children);

describe("ScoresRail", () => {
  // R1
  test("your game first, then the others in the order given", async () => {
    await render(<ScoresRail view={view()} width={944} />);
    const chips = screen
      .getAllByTestId(/^rail-chip-/)
      .map((c) => c.props.testID);
    expect(chips).toEqual([
      "rail-chip-pinned-tile-0",
      "rail-chip-g0",
      "rail-chip-g1",
      "rail-chip-g2",
    ]);
  });

  // R3
  test("pages the others every 8 s when they don't fit; your game stays", async () => {
    jest.useFakeTimers();
    try {
      // 944 wide with one pinned game fits 6 of the others.
      await render(
        <ScoresRail view={view({ others: others(14) })} width={944} />,
      );
      expect(shownOthers()).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(LIVE_SCORES_RAIL_PAGE_MS);
      });
      expect(shownOthers()).toEqual(["A6", "A7", "A8", "A9", "A10", "A11"]);
      expect(screen.getByText("KC")).toBeTruthy();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2 * LIVE_SCORES_RAIL_PAGE_MS);
      });
      expect(shownOthers()).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
    } finally {
      jest.useRealTimers();
    }
  });

  // R8
  test("unavailable: says so, and shows no scores", async () => {
    await render(
      <ScoresRail
        view={view({
          status: "unavailable",
          reason: "network",
          pinned: [],
          others: [],
        })}
        width={944}
      />,
    );
    expect(screen.getByText("livescores.unavailable_network")).toBeTruthy();
    expect(screen.queryAllByTestId(/^rail-chip-/)).toHaveLength(0);
  });

  // R11: the rail is for reading; the remote's focus never lands on it.
  test("takes no touches and offers nothing to focus", async () => {
    await render(<ScoresRail view={view()} width={944} />);
    const rail = screen.getByTestId("scores-rail");
    expect(rail.props.pointerEvents).toBe("none");
    expect(rail.props.focusable).toBe(false);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("with nothing to show, draws nothing", async () => {
    await render(
      <ScoresRail view={view({ pinned: [], others: [] })} width={944} />,
    );
    expect(screen.queryByTestId("scores-rail")).toBeNull();
  });
});
