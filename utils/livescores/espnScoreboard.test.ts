import recorded from "./__fixtures__/scoreboard-2026-11-15.json";
import { parseScoreboard } from "./espnScoreboard";

// A deep copy, so a test can break one field without touching the others.
const fixture = (): any => JSON.parse(JSON.stringify(recorded));

describe("parseScoreboard", () => {
  test("reads a game in play: teams, score, clock and the down", () => {
    const games = parseScoreboard(fixture());
    const game = games?.find((g) => g.id === "401873058");
    expect(game).toEqual({
      id: "401873058",
      start: "2026-11-15T18:00Z",
      state: "in",
      statusName: "STATUS_IN_PROGRESS",
      detail: "14:55 - 3rd",
      period: 3,
      clock: "14:55",
      home: {
        id: "1",
        abbr: "ATL",
        score: 3,
        nickname: "Falcons",
        location: "Atlanta",
        displayName: "Atlanta Falcons",
      },
      away: {
        id: "12",
        abbr: "KC",
        score: 14,
        nickname: "Chiefs",
        location: "Kansas City",
        displayName: "Kansas City Chiefs",
      },
      down: { text: "2nd & 9", possessionAbbr: "KC", redZone: false },
      networks: ["CBS"],
    });
  });

  test("keeps every game on the board, whatever its state", () => {
    const games = parseScoreboard(fixture());
    expect(games?.map((g) => [g.away.abbr, g.state])).toEqual([
      ["KC", "in"],
      ["MIN", "in"],
      ["NE", "post"],
      ["SEA", "pre"],
    ]);
  });

  test("has no down at halftime, though ESPN still sends the old one", () => {
    const games = parseScoreboard(fixture());
    expect(games?.find((g) => g.away.abbr === "MIN")?.down).toBeUndefined();
  });

  test("has no down before kickoff or after the final", () => {
    const games = parseScoreboard(fixture());
    expect(games?.find((g) => g.away.abbr === "NE")?.down).toBeUndefined();
    expect(games?.find((g) => g.away.abbr === "SEA")?.down).toBeUndefined();
  });

  test("shows the down without a team when ESPN has no possession yet", () => {
    // Seen live: a 3rd quarter kickoff arrives with the down but no possession.
    const raw = fixture();
    delete raw.events[0].competitions[0].situation.possession;
    const game = parseScoreboard(raw)?.[0];
    expect(game?.down).toEqual({ text: "2nd & 9", redZone: false });
  });

  test("an empty board is no games, not a failure", () => {
    expect(parseScoreboard({ events: [] })).toEqual([]);
  });

  // A8: anything unexpected is no data at all, never a half-read score.
  test.each([
    ["not an object", () => "oops"],
    ["no events list", () => ({ leagues: [] })],
    [
      "a score that is not a number",
      () => {
        const raw = fixture();
        raw.events[0].competitions[0].competitors[0].score = "three";
        return raw;
      },
    ],
    [
      "a game without competitors",
      () => {
        const raw = fixture();
        raw.events[1].competitions[0].competitors = [];
        return raw;
      },
    ],
    [
      "a game without a status",
      () => {
        const raw = fixture();
        delete raw.events[2].status;
        return raw;
      },
    ],
    [
      "an unknown game state",
      () => {
        const raw = fixture();
        raw.events[3].status.type.state = "paused";
        return raw;
      },
    ],
  ])("returns null for %s", (_name, make) => {
    expect(parseScoreboard(make())).toBeNull();
  });
});
