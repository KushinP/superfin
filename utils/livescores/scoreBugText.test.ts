import recorded from "./__fixtures__/scoreboard-2026-11-15.json";
import type { GameScore } from "./espnScoreboard";
import { parseScoreboard } from "./espnScoreboard";
import { gameStatus } from "./scoreBugText";

const games = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const byAway = (abbr: string) => games.find((g) => g.away.abbr === abbr)!;
const withStatus = (
  game: GameScore,
  statusName: string,
  state: GameScore["state"],
  period: number,
  clock = "0:00",
): GameScore => ({ ...game, statusName, state, period, clock });

describe("gameStatus", () => {
  test("a game in play is its quarter and clock", () => {
    expect(gameStatus(byAway("KC"))).toEqual({
      kind: "quarter",
      period: 3,
      clock: "14:55",
    });
  });

  test("halftime", () => {
    expect(gameStatus(byAway("MIN"))).toEqual({ kind: "half" });
  });

  test("a final in regulation", () => {
    expect(gameStatus(byAway("NE"))).toEqual({
      kind: "final",
      overtime: false,
    });
  });

  test("a final after overtime", () => {
    const game = withStatus(byAway("NE"), "STATUS_FINAL", "post", 5);
    expect(gameStatus(game)).toEqual({ kind: "final", overtime: true });
  });

  test("overtime in play", () => {
    const game = withStatus(
      byAway("KC"),
      "STATUS_IN_PROGRESS",
      "in",
      5,
      "7:12",
    );
    expect(gameStatus(game)).toEqual({ kind: "overtime", clock: "7:12" });
  });

  test("the end of a quarter", () => {
    const game = withStatus(byAway("KC"), "STATUS_END_PERIOD", "in", 1);
    expect(gameStatus(game)).toEqual({ kind: "endOfQuarter", period: 1 });
  });

  test("before kickoff is ESPN's kickoff time, without the date", () => {
    expect(gameStatus(byAway("SEA"))).toEqual({
      kind: "kickoff",
      time: "4:05 PM EST",
    });
  });

  test("a postponed or canceled game shows nothing", () => {
    for (const name of ["STATUS_POSTPONED", "STATUS_CANCELED"]) {
      const game = withStatus(byAway("SEA"), name, "post", 0);
      expect(gameStatus(game)).toEqual({ kind: "none" });
    }
  });

  test("an unknown status falls back on the game's state", () => {
    const delayed = withStatus(byAway("KC"), "STATUS_DELAYED", "in", 2, "3:00");
    expect(gameStatus(delayed)).toEqual({
      kind: "quarter",
      period: 2,
      clock: "3:00",
    });
  });
});
