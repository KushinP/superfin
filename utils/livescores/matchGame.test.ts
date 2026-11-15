import recorded from "./__fixtures__/scoreboard-2026-11-15.json";
import type { GameScore } from "./espnScoreboard";
import { parseScoreboard } from "./espnScoreboard";
import { matchGame, type ProgramInfo } from "./matchGame";

// The recorded board: KC @ ATL (CBS, in play), MIN @ GB (Fox, halftime),
// NE vs DET (Fox, final), SEA @ LV (CBS, 4:05 PM ET kickoff).
const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const KC_ATL = "401873058";
const MIN_GB = "401873060";
const NE_DET = "401873053";
const SEA_LV = "401873062";

const earlySlot = {
  StartDate: "2026-11-15T18:00:00Z",
  EndDate: "2026-11-15T21:00:00Z",
};
const lateSlot = {
  StartDate: "2026-11-15T21:00:00Z",
  EndDate: "2026-11-16T00:00:00Z",
};
const program = (fields: Partial<ProgramInfo>): ProgramInfo => ({
  IsSports: true,
  ...earlySlot,
  ...fields,
});
const id = (r: ReturnType<typeof matchGame>) => r?.gameId ?? null;
const withState = (
  games: GameScore[],
  gameId: string,
  state: GameScore["state"],
): GameScore[] => games.map((g) => (g.id === gameId ? { ...g, state } : g));

describe("matchGame: from the guide title", () => {
  test("both nicknames in the title", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs at Falcons" }),
      games: board,
    });
    expect(result).toEqual({ gameId: KC_ATL, via: "title" });
  });

  test("the teams in the episode title, as Schedules Direct lists them", () => {
    const result = matchGame({
      program: program({
        Name: "NFL Football",
        EpisodeTitle: "Kansas City Chiefs at Atlanta Falcons",
      }),
      games: board,
    });
    expect(id(result)).toBe(KC_ATL);
  });

  test("one team named is enough: a team plays once a day", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football", EpisodeTitle: "Vikings" }),
      games: board,
    });
    expect(id(result)).toBe(MIN_GB);
  });

  test("case and punctuation do not matter", () => {
    const result = matchGame({
      program: program({ Name: "NFL FOOTBALL: CHIEFS-FALCONS" }),
      games: board,
    });
    expect(id(result)).toBe(KC_ATL);
  });

  test("a pregame show matches the game it leads into", () => {
    const result = matchGame({
      program: program({
        Name: "NFL Pregame",
        EpisodeTitle: "Seahawks at Raiders",
        ...lateSlot,
        StartDate: "2026-11-15T20:30:00Z",
      }),
      games: board,
    });
    expect(id(result)).toBe(SEA_LV);
  });
});

describe("matchGame: refusing to guess", () => {
  // A3
  test("a program that is not football", () => {
    const result = matchGame({
      program: { Name: "Local News at 6", IsSports: false, ...earlySlot },
      games: board,
    });
    expect(result).toBeNull();
  });

  test("a news show that mentions a team is still not a game", () => {
    const result = matchGame({
      program: {
        Name: "Eyewitness News",
        Overview: "The Chiefs visit Atlanta today.",
        IsSports: false,
        ...earlySlot,
      },
      games: board,
    });
    expect(result).toBeNull();
  });

  // A4
  test("'NFL Football' alone, with two CBS games today", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football", ...lateSlot }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("an overview that names a third team", () => {
    const result = matchGame({
      program: program({
        Name: "NFL Football",
        Overview:
          "The Chiefs and Falcons meet a week after Kansas City beat the Bills.",
      }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("teams from two different games in the title", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs, Vikings" }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("a team that is not playing today", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Bills at Jets" }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("a city alone, which can be two teams", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: New York at Kansas City" }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("a game on another network than the channel's", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs at Falcons" }),
      network: "FOX",
      games: board,
    });
    expect(result).toBeNull();
  });

  test("a game that kicks off outside the program's slot", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Seahawks at Raiders" }),
      games: board,
    });
    expect(result).toBeNull();
  });

  test("no program, or no games", () => {
    expect(matchGame({ program: null, games: board })).toBeNull();
    expect(
      matchGame({ program: program({ Name: "NFL: Chiefs" }), games: [] }),
    ).toBeNull();
  });
});

describe("matchGame: the channel's network", () => {
  test("names the game when the title has no teams and only one fits", () => {
    // Early slot on Fox: MIN @ GB is in play; NE vs DET kicked off at 14:30.
    const result = matchGame({
      program: program({ Name: "NFL Football" }),
      network: "FOX",
      games: board,
    });
    expect(result).toEqual({ gameId: MIN_GB, via: "network" });
  });

  test("agrees with the title, whatever its spelling", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs at Falcons" }),
      network: "cbs",
      games: board,
    });
    expect(id(result)).toBe(KC_ATL);
  });
});

// A5
describe("matchGame: staying on a game", () => {
  test("keeps an overrunning game while the guide shows the next one", () => {
    const result = matchGame({
      program: program({
        Name: "NFL Football: Seahawks at Raiders",
        ...lateSlot,
      }),
      games: board,
      previous: KC_ATL,
    });
    expect(result).toEqual({ gameId: KC_ATL, via: "sticky" });
  });

  test("keeps a final game while the guide is still on it", () => {
    const games = withState(board, KC_ATL, "post");
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs at Falcons" }),
      games,
      previous: KC_ATL,
    });
    expect(id(result)).toBe(KC_ATL);
  });

  test("lets a final game go once the guide moves on", () => {
    const games = withState(board, KC_ATL, "post");
    const result = matchGame({
      program: { Name: "60 Minutes", IsSports: false, ...lateSlot },
      games,
      previous: KC_ATL,
    });
    expect(result).toBeNull();
  });

  test("moves to the next game once the first is final", () => {
    const games = withState(board, KC_ATL, "post");
    const result = matchGame({
      program: program({
        Name: "NFL Football: Seahawks at Raiders",
        ...lateSlot,
      }),
      games,
      previous: KC_ATL,
    });
    expect(id(result)).toBe(SEA_LV);
  });

  test("a game gone from the board is matched afresh", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Chiefs at Falcons" }),
      games: board,
      previous: "999",
    });
    expect(result).toEqual({ gameId: KC_ATL, via: "title" });
  });

  test("a final game the board still lists keeps its bug before the guide moves", () => {
    const result = matchGame({
      program: program({ Name: "NFL Football: Patriots at Lions" }),
      games: board,
      previous: NE_DET,
    });
    expect(id(result)).toBe(NE_DET);
  });
});
