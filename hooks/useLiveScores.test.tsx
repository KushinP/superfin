import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { act, renderHook } from "@testing-library/react-native";
import { QueryWrapper } from "@/test-utils/queryWrapper";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { type LiveScoreTile, useLiveScores } from "./useLiveScores";

let mockSettings: Record<string, unknown> = {};
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: mockSettings }),
}));

let mockPrograms = new Map<string, BaseItemDto>();
const mockChannelsNow = jest.fn();
jest.mock("@/hooks/useChannelsNow", () => ({
  useChannelsNow: (ids: string[]) => {
    mockChannelsNow(ids);
    return mockPrograms;
  },
}));
jest.mock("@/utils/log", () => ({ writeDebugLog: jest.fn() }));

const KC_ATL = "401873058";
const board = (): any => JSON.parse(JSON.stringify(recorded));
/** The recorded board with KC's score changed, as a later fetch. */
const boardWithKc = (score: number): any => {
  const raw = board();
  raw.events[0].competitions[0].competitors[1].score = String(score);
  return raw;
};
const respond = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const program = (title: string): BaseItemDto => ({
  Name: "NFL Football",
  EpisodeTitle: title,
  StartDate: "2026-11-15T18:00:00Z",
  EndDate: "2026-11-15T21:00:00Z",
});
const tiles: LiveScoreTile[] = [{ key: "tile-0", itemId: "ch-cbs" }];

// A second at a time, letting React render in between, as on a real TV: the
// hook schedules its next wake from an effect, and one long act() would hold
// those renders back until the very end.
const advance = async (seconds: number) => {
  for (let s = 0; s < seconds; s++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  }
};

const render = async (forTiles: LiveScoreTile[] = tiles) =>
  renderHook(() => useLiveScores(forTiles), { wrapper: QueryWrapper });

const kcScore = (result: { current: ReturnType<typeof useLiveScores> }) => {
  const tile = result.current.tiles.get("tile-0");
  return tile?.kind === "game" ? tile.game.away.score : tile?.kind;
};

describe("useLiveScores", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date("2026-11-15T19:30:00Z"),
      doNotFake: ["nextTick", "setImmediate"],
    });
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockPrograms = new Map([["ch-cbs", program("Chiefs at Falcons")]]);
    mockChannelsNow.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond(board()));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // A2
  test("a tile shows nothing until the first fetch is a delay old", async () => {
    const { result } = await render();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.tiles.has("tile-0")).toBe(false);

    await advance(29);
    const tile = result.current.tiles.get("tile-0");
    expect(tile?.kind === "game" && tile.game.id).toBe(KC_ATL);
  });

  test("a score changes on screen a delay after it was fetched", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(board()))
      .mockImplementation(() => respond(boardWithKc(21)));
    const { result } = await render();
    await advance(30);
    expect(kcScore(result)).toBe(14);
    // KC's touchdown was fetched at 0:15; it shows at 0:45, not before.
    await advance(14);
    expect(kcScore(result)).toBe(14);
    await advance(1);
    expect(kcScore(result)).toBe(21);
  });

  test("follows a shorter delay setting", async () => {
    mockSettings.liveScoresDelaySeconds = 0;
    const { result } = await render();
    await advance(1);
    expect(kcScore(result)).toBe(14);
  });

  // A3
  test("asks ESPN nothing when no tile shows football", async () => {
    mockPrograms = new Map([
      ["ch-cbs", { Name: "Local News at 6", EpisodeTitle: "" }],
    ]);
    const { result } = await render();
    await advance(120);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.tiles.size).toBe(0);
  });

  // A11
  test("with the setting off, asks neither ESPN nor the guide", async () => {
    mockSettings.liveScoresEnabled = false;
    const { result } = await render();
    await advance(120);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockChannelsNow).toHaveBeenLastCalledWith([]);
    expect(result.current.tiles.size).toBe(0);
  });

  // A7
  test("four tiles on four games share one poll", async () => {
    mockPrograms = new Map([
      ["a", program("Chiefs at Falcons")],
      ["b", program("Vikings at Packers")],
      ["c", program("Patriots at Lions")],
      ["d", program("Seahawks at Raiders")],
    ]);
    const four = ["a", "b", "c", "d"].map((itemId, i) => ({
      key: `tile-${i}`,
      itemId,
    }));
    await render(four);
    await advance(120);
    // At 0:00, then every 15 s while a game is in play: 9, not 4 x 9.
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  test("polls slowly while no game on screen is in play", async () => {
    mockPrograms = new Map([
      [
        "ch-cbs",
        {
          ...program("Seahawks at Raiders"),
          StartDate: "2026-11-15T19:00:00Z",
          EndDate: "2026-11-15T22:00:00Z",
        },
      ],
    ]);
    await render();
    await advance(120);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // A8
  test("a failed fetch hides the bug, and the next good one brings it back", async () => {
    const { result } = await render();
    await advance(30);
    expect(kcScore(result)).toBe(14);

    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("Network request failed")),
    );
    await advance(20);
    expect(result.current.tiles.get("tile-0")).toEqual({
      kind: "unavailable",
      reason: "network",
    });

    fetchMock.mockImplementation(() => respond(board()));
    await advance(15);
    expect(kcScore(result)).toBe(14);
  });

  test("a feed in a shape we do not know hides the bug", async () => {
    fetchMock.mockImplementation(() => respond({ events: "changed" }));
    const { result } = await render();
    await advance(5);
    expect(result.current.tiles.get("tile-0")).toEqual({
      kind: "unavailable",
      reason: "format",
    });
  });

  test("an HTTP error from ESPN hides the bug", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 503, json: () => respond({}) }),
    );
    const { result } = await render();
    await advance(5);
    expect(result.current.tiles.get("tile-0")).toEqual({
      kind: "unavailable",
      reason: "network",
    });
  });

  test("scores fetched over two minutes ago are not shown", async () => {
    const { result } = await render();
    await advance(30);
    expect(kcScore(result)).toBe(14);
    // The next fetches never answer, as when the network hangs. The last
    // one that did arrived at 0:30, so at 2:31 it is over two minutes old.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await advance(120);
    expect(kcScore(result)).toBe(14);
    await advance(1);
    expect(result.current.tiles.get("tile-0")).toEqual({
      kind: "unavailable",
      reason: "stale",
    });
  });
});
