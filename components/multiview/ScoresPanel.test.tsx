import { fireEvent, render, screen } from "@testing-library/react-native";
import type { LiveScoresView } from "@/utils/atoms/liveScores";
import details from "@/utils/livescores/__fixtures__/scoreboard-details-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";
import { ScoresPanel } from "./ScoresPanel";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

let mockSettings: Record<string, unknown> = {};
const mockUpdateSettings = jest.fn();
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}));

// SEA @ LV in play with every detail, PIT @ CIN before kickoff, NE vs DET
// final.
const board = parseScoreboard(JSON.parse(JSON.stringify(details)))!;
const byAway = (abbr: string) => board.find((g) => g.away.abbr === abbr)!;
const view = (more: Partial<LiveScoresView> = {}): LiveScoresView => ({
  status: "ok",
  waiting: false,
  followed: [byAway("SEA")],
  others: [byAway("PIT"), byAway("NE")],
  delaySeconds: 30,
  ...more,
});

describe("ScoresPanel", () => {
  beforeEach(() => {
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockUpdateSettings.mockReset();
  });

  // R6
  test("a followed game in full: score, clock, down, last play, odds, drive, timeouts, leaders", async () => {
    await render(<ScoresPanel view={view()} />);
    // 7-7: both scores show.
    expect(screen.getAllByText("7")).toHaveLength(2);
    expect(screen.getByText(/^livescores\.quarter_clock:/)).toBeTruthy();
    expect(
      screen.getByText(
        "livescores.last_play:(Shotgun) M.Washington up the middle to SEA 46 for no gain (D.Fowler).",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("livescores.win_probability:SEA,68,LV,32"),
    ).toBeTruthy();
    expect(
      screen.getByText("livescores.drive:3 plays, 19 yards, 1:20"),
    ).toBeTruthy();
    expect(screen.getByText("livescores.timeouts:SEA,3,LV,3")).toBeTruthy();
    expect(
      screen.getByText(
        "livescores.leader_passing:D. Lock (SEA),2/2, 43 YDS, 1 TD",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/^livescores\.leader_rushing:/)).toBeTruthy();
    expect(screen.getByText(/^livescores\.leader_receiving:/)).toBeTruthy();
  });

  // R6: a detail ESPN didn't give is left out, the rest stays.
  test("a missing detail is just left out", async () => {
    const sea = byAway("SEA");
    const bare = { ...sea, details: { timeouts: sea.details.timeouts } };
    await render(<ScoresPanel view={view({ followed: [bare] })} />);
    expect(screen.getByText("livescores.timeouts:SEA,3,LV,3")).toBeTruthy();
    expect(screen.queryByText(/^livescores\.last_play:/)).toBeNull();
    expect(screen.queryByText(/^livescores\.win_probability:/)).toBeNull();
    expect(screen.queryByText(/^livescores\.leader_/)).toBeNull();
  });

  // S5: before the delay has passed, a note and never a score.
  test("before the delay, says scores are coming and shows none", async () => {
    await render(
      <ScoresPanel view={view({ waiting: true, followed: [], others: [] })} />,
    );
    expect(screen.getByText("livescores.waiting:30")).toBeTruthy();
    expect(screen.queryAllByText("7")).toHaveLength(0);
    expect(screen.queryByText(/^livescores\.last_play:/)).toBeNull();
  });

  test("lists every other game", async () => {
    await render(<ScoresPanel view={view()} />);
    expect(screen.getByTestId(`rail-chip-${byAway("PIT").id}`)).toBeTruthy();
    expect(screen.getByTestId(`rail-chip-${byAway("NE").id}`)).toBeTruthy();
  });

  // R7
  test("5 s later makes the delay 35 s", async () => {
    await render(<ScoresPanel view={view()} />);
    await fireEvent.press(screen.getByText("livescores.delay_more"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresDelaySeconds: 35,
    });
  });

  test("5 s sooner, and the delay stays within 0 to 90 s", async () => {
    mockSettings.liveScoresDelaySeconds = 0;
    await render(<ScoresPanel view={view({ delaySeconds: 0 })} />);
    await fireEvent.press(screen.getByText("livescores.delay_less"));
    expect(mockUpdateSettings).toHaveBeenLastCalledWith({
      liveScoresDelaySeconds: 0,
    });
  });

  test("says how far behind the scores are, and turns scores off", async () => {
    await render(<ScoresPanel view={view()} />);
    expect(screen.getByText("livescores.delay_status:30")).toBeTruthy();
    await fireEvent.press(screen.getByText("livescores.turn_off"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      liveScoresEnabled: false,
    });
  });

  // R8
  test("with no trustworthy scores, says why and still offers the controls", async () => {
    await render(
      <ScoresPanel
        view={view({
          status: "unavailable",
          reason: "format",
          followed: [],
          others: [],
        })}
      />,
    );
    expect(screen.getByText("livescores.unavailable_format")).toBeTruthy();
    expect(screen.getByText("livescores.turn_off")).toBeTruthy();
    expect(screen.queryAllByTestId(/^rail-chip-/)).toHaveLength(0);
  });

  test("its buttons are the same size, as neighbours on a TV must be", async () => {
    await render(<ScoresPanel view={view()} />);
    const widths = screen
      .getAllByRole("button")
      .map((b) => b.props.style.width ?? b.props.style.minWidth);
    expect(new Set(widths).size).toBe(1);
  });
});
