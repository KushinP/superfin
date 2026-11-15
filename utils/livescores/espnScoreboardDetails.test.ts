import recorded from "./__fixtures__/scoreboard-details-2026-11-15.json";
import { parseScoreboard } from "./espnScoreboard";

// SEA @ LV in play, PIT @ CIN before kickoff, NE vs DET final, recorded
// with the fields the scores screen shows.
const fixture = (): any => JSON.parse(JSON.stringify(recorded));
const game = (raw: unknown, away: string) =>
  parseScoreboard(raw)?.find((g) => g.away.abbr === away);

describe("parseScoreboard: game details for the scores screen", () => {
  test("a game in play has its last play, win probability, drive, timeouts and leaders", () => {
    expect(game(fixture(), "SEA")?.details).toEqual({
      lastPlay:
        "(Shotgun) M.Washington up the middle to SEA 46 for no gain (D.Fowler).",
      winProbability: { home: 0.3173, away: 0.6827 },
      drive: "3 plays, 19 yards, 1:20",
      timeouts: { home: 3, away: 3 },
      leaders: [
        {
          category: "passing",
          name: "D. Lock",
          line: "2/2, 43 YDS, 1 TD",
          teamAbbr: "SEA",
        },
        {
          category: "rushing",
          name: "Z. Charbonnet",
          line: "6 CAR, 37 YDS",
          teamAbbr: "SEA",
        },
        {
          category: "receiving",
          name: "C. Kupp",
          line: "1 REC, 34 YDS, 1 TD",
          teamAbbr: "SEA",
        },
      ],
    });
  });

  // Before kickoff ESPN's "leaders" are season totals (Burrow, 2,386 yards);
  // shown beside a 0-0 score they would read as this game's.
  test("before kickoff there are no leaders, and no other details", () => {
    expect(game(fixture(), "PIT")?.details).toEqual({});
  });

  test("a final keeps its leaders", () => {
    expect(game(fixture(), "NE")?.details?.leaders?.[0]).toEqual({
      category: "passing",
      name: "J. Goff",
      line: "20/31, 303 YDS, 3 TD, 2 INT",
      teamAbbr: "DET",
    });
  });

  test("details from a board recorded without them are empty, not a failure", () => {
    const raw = fixture();
    for (const event of raw.events) {
      delete event.competitions[0].leaders;
      delete event.competitions[0].situation;
    }
    const games = parseScoreboard(raw);
    expect(games).toHaveLength(3);
    expect(games?.every((g) => Object.keys(g.details).length === 0)).toBe(true);
  });

  // R6: an odd detail is left out; the score, which the rail needs, stays.
  test("each broken detail is dropped on its own, and the board is kept", () => {
    const raw = fixture();
    const situation = raw.events[0].competitions[0].situation;
    situation.lastPlay.text = 42;
    situation.lastPlay.probability.homeWinPercentage = "high";
    situation.lastPlay.drive = null;
    situation.homeTimeouts = -1;
    raw.events[0].competitions[0].leaders = [
      { name: "passingYards", leaders: [] },
      { name: "kickingPoints", leaders: [{ displayValue: "9 PTS" }] },
      {
        name: "rushingYards",
        leaders: [
          {
            displayValue: "6 CAR, 37 YDS",
            athlete: { shortName: "Z. Charbonnet" },
            team: { id: "999" },
          },
        ],
      },
    ];
    const recordedScore = Number(
      fixture().events[0].competitions[0].competitors[0].score,
    );
    const sea = game(raw, "SEA");
    expect(sea?.home.score).toBe(recordedScore);
    // A leader whose team is not in the game keeps its line, without a team.
    expect(sea?.details).toEqual({
      leaders: [
        { category: "rushing", name: "Z. Charbonnet", line: "6 CAR, 37 YDS" },
      ],
    });
  });
});
