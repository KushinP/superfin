import recorded from "./__fixtures__/scoreboard-2026-11-15.json";
import { type GameScore, parseScoreboard } from "./espnScoreboard";
import {
  activeFollows,
  chipsPerPage,
  hasLiveGame,
  orderGames,
  railPage,
  splitFollowed,
  toggleFollow,
} from "./railItems";

// KC @ ATL in play, MIN @ GB at halftime, NE vs DET final, SEA @ LV at 4:05.
const board = parseScoreboard(JSON.parse(JSON.stringify(recorded)))!;
const away = (games: GameScore[]) => games.map((g) => g.away.abbr);

/** A game like the recorded one, with its own teams, state and kickoff. */
const fake = (
  abbr: string,
  state: GameScore["state"],
  start: string,
): GameScore => ({
  ...board[0],
  id: abbr,
  state,
  start,
  away: { ...board[0].away, abbr },
});

describe("orderGames", () => {
  // R1: in progress first, then upcoming by kickoff, then final.
  test("in progress, then upcoming by kickoff, then final", () => {
    const games = [
      fake("FIN", "post", "2026-11-15T14:30Z"),
      fake("LATE", "pre", "2026-11-16T01:20Z"),
      fake("LIVE2", "in", "2026-11-15T18:00Z"),
      fake("SOON", "pre", "2026-11-15T21:05Z"),
      fake("LIVE1", "in", "2026-11-15T17:00Z"),
    ];
    expect(away(orderGames(games))).toEqual([
      "LIVE1",
      "LIVE2",
      "SOON",
      "LATE",
      "FIN",
    ]);
  });

  test("does not change the list it was given", () => {
    const games = [...board];
    orderGames(games);
    expect(games).toEqual(board);
  });
});

describe("splitFollowed", () => {
  const kcAtl = board[0].id;
  const seaLv = board[3].id;

  test("followed games in the order followed, the rest in rail order", () => {
    const { followed, others } = splitFollowed(board, [seaLv, kcAtl]);
    expect(away(followed)).toEqual(["SEA", "KC"]);
    expect(away(others)).toEqual(["MIN", "NE"]);
  });

  test("with nothing followed, every game is among the others", () => {
    expect(splitFollowed(board, []).others).toHaveLength(board.length);
  });

  test("a followed game missing from the board is left out", () => {
    expect(splitFollowed(board, ["gone"]).followed).toEqual([]);
  });
});

describe("activeFollows", () => {
  // S4
  test("drops a game that's over, or gone from the board", () => {
    const ne = board.find((g) => g.away.abbr === "NE")!.id;
    expect(activeFollows([board[0].id, ne, "gone"], board)).toEqual([
      board[0].id,
    ]);
  });
});

describe("toggleFollow", () => {
  test("follows, then unfollows", () => {
    expect(toggleFollow([], "a")).toEqual(["a"]);
    expect(toggleFollow(["a"], "a")).toEqual([]);
  });

  // S8
  test("adds nothing past two", () => {
    expect(toggleFollow(["a", "b"], "c")).toEqual(["a", "b"]);
  });
});

describe("hasLiveGame", () => {
  test("only a game being played counts", () => {
    expect(hasLiveGame(board)).toBe(true);
    expect(hasLiveGame(board.filter((g) => g.state !== "in"))).toBe(false);
  });
});

describe("chipsPerPage", () => {
  test("fits fewer games beside more followed ones", () => {
    expect(chipsPerPage(944, 0)).toBeGreaterThan(chipsPerPage(944, 2));
  });

  test("always at least one, even on a narrow rail", () => {
    expect(chipsPerPage(100, 2)).toBe(1);
  });
});

describe("railPage", () => {
  const twelve = Array.from({ length: 12 }, (_, i) =>
    fake(`G${i}`, "pre", "2026-11-15T21:05Z"),
  );

  // R3
  test("cuts the others into pages and wraps after the last", () => {
    expect(away(railPage(twelve, 5, 0))).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
    ]);
    expect(away(railPage(twelve, 5, 1))).toEqual([
      "G5",
      "G6",
      "G7",
      "G8",
      "G9",
    ]);
    expect(away(railPage(twelve, 5, 2))).toEqual(["G10", "G11"]);
    expect(away(railPage(twelve, 5, 3))).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
    ]);
  });

  test("one page when they all fit, and none when there are none", () => {
    expect(railPage(twelve, 20, 7)).toHaveLength(12);
    expect(railPage([], 5, 2)).toEqual([]);
  });
});
