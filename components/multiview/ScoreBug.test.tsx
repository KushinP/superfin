import { render, screen } from "@testing-library/react-native";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import {
  type GameScore,
  parseScoreboard,
} from "@/utils/livescores/espnScoreboard";
import { ScoreBug } from "./ScoreBug";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const byAway = (abbr: string) => board.find((g) => g.away.abbr === abbr)!;

describe("ScoreBug", () => {
  // A1
  test("a game in play: both teams, scores, quarter, clock and the down", async () => {
    await render(<ScoreBug game={byAway("KC")} />);
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("ATL")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(
      screen.getByText("livescores.quarter_clock:livescores.q3,14:55"),
    ).toBeTruthy();
    expect(screen.getByText("2nd & 9")).toBeTruthy();
    // KC has the ball.
    expect(screen.getByTestId("score-bug-possession-away")).toBeTruthy();
    expect(screen.queryByTestId("score-bug-possession-home")).toBeNull();
  });

  test("halftime has no down", async () => {
    await render(<ScoreBug game={byAway("MIN")} />);
    expect(screen.getByText("livescores.half")).toBeTruthy();
    expect(screen.queryByText(/&/)).toBeNull();
  });

  test("a final", async () => {
    await render(<ScoreBug game={byAway("NE")} />);
    expect(screen.getByText("livescores.final")).toBeTruthy();
    expect(screen.getByText("35")).toBeTruthy();
  });

  test("before kickoff, the kickoff time", async () => {
    await render(<ScoreBug game={byAway("SEA")} />);
    expect(screen.getByText("4:05 PM EST")).toBeTruthy();
  });

  test("overtime and the end of a quarter", async () => {
    const ot: GameScore = { ...byAway("KC"), period: 5, clock: "7:12" };
    await render(<ScoreBug game={ot} />);
    expect(screen.getByText("livescores.overtime:7:12")).toBeTruthy();

    const end: GameScore = {
      ...byAway("KC"),
      statusName: "STATUS_END_PERIOD",
      period: 1,
      down: undefined,
    };
    await render(<ScoreBug game={end} />);
    expect(
      screen.getByText("livescores.end_of_quarter:livescores.q1"),
    ).toBeTruthy();
  });

  test("a postponed game draws nothing", async () => {
    const off: GameScore = {
      ...byAway("SEA"),
      statusName: "STATUS_POSTPONED",
      state: "post",
    };
    await render(<ScoreBug game={off} />);
    expect(screen.queryByTestId("score-bug")).toBeNull();
  });
});
