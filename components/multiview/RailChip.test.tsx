import { render, screen } from "@testing-library/react-native";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "@/utils/livescores/espnScoreboard";
import { FollowedChip, GameChip } from "./RailChip";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));

const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const byAway = (abbr: string) => board.find((g) => g.away.abbr === abbr)!;

describe("FollowedChip", () => {
  test("a game in play: both scores, quarter and clock, the ball", async () => {
    await render(<FollowedChip game={byAway("KC")} />);
    expect(
      screen.getByTestId(`rail-chip-followed-${byAway("KC").id}`),
    ).toBeTruthy();
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("ATL")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(
      screen.getByText("livescores.quarter_clock:livescores.q3,14:55"),
    ).toBeTruthy();
    expect(screen.getByTestId("rail-ball-away")).toBeTruthy();
    expect(screen.queryByTestId("rail-ball-home")).toBeNull();
  });

  test("a game still to come: the teams, no score", async () => {
    await render(<FollowedChip game={byAway("SEA")} />);
    expect(screen.getByText("SEA")).toBeTruthy();
    expect(screen.getByText("LV")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("GameChip", () => {
  test("another game: teams, scores and a short status", async () => {
    await render(<GameChip game={byAway("MIN")} />);
    expect(screen.getByText("MIN")).toBeTruthy();
    expect(screen.getByText("17")).toBeTruthy();
    expect(screen.getByText("GB")).toBeTruthy();
    expect(screen.getByText("livescores.half")).toBeTruthy();
  });

  test("before kickoff, the kickoff time and no scores", async () => {
    await render(<GameChip game={byAway("SEA")} />);
    expect(screen.getByText("4:05 PM EST")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  test("a final, in overtime", async () => {
    await render(<GameChip game={{ ...byAway("NE"), period: 5 }} />);
    expect(screen.getByText("livescores.final_ot")).toBeTruthy();
  });

  test("a postponed game draws nothing", async () => {
    await render(
      <GameChip
        game={{
          ...byAway("SEA"),
          statusName: "STATUS_POSTPONED",
          state: "post",
        }}
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });
});
