import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { act, renderHook } from "@testing-library/react-native";
import { useAtomValue } from "jotai";
import { LIVE_SCORES_TAG_COLORS } from "@/constants/LiveScores";
import { JotaiQueryWrapper } from "@/test-utils/queryWrapper";
import { liveScoresViewAtom } from "@/utils/atoms/liveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { type LiveScoreTile, useLiveScores } from "./useLiveScores";

// The rail's view of the scores: the games on the tiles pinned and held back
// by the delay, every other game live, written where the rail and the
// scores screen read it.

let mockSettings: Record<string, unknown> = {};
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: mockSettings }),
}));
let mockPrograms = new Map<string, BaseItemDto>();
jest.mock("@/hooks/useChannelsNow", () => ({
  useChannelsNow: () => mockPrograms,
}));
jest.mock("@/utils/log", () => ({ writeDebugLog: jest.fn() }));

// The recorded board: KC @ ATL (in play, KC 14), MIN @ GB (halftime,
// MIN 17), NE vs DET (final), SEA @ LV (4:05 kickoff).
const KC_ATL = "401873058";
const MIN_GB = "401873060";
const board = (): any => JSON.parse(JSON.stringify(recorded));
/** A later fetch with KC's and MIN's scores changed. */
const later = (kc: number, min: number): any => {
  const raw = board();
  raw.events[0].competitions[0].competitors[1].score = String(kc);
  raw.events[1].competitions[0].competitors[1].score = String(min);
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
const oneTile: LiveScoreTile[] = [{ key: "tile-0", itemId: "ch-cbs" }];

const advance = async (seconds: number) => {
  for (let s = 0; s < seconds; s++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
  }
};

const render = (tiles: LiveScoreTile[] = oneTile) =>
  renderHook(
    () => ({
      hook: useLiveScores(tiles),
      atom: useAtomValue(liveScoresViewAtom),
    }),
    { wrapper: JotaiQueryWrapper },
  );

type Current = { current: { hook: ReturnType<typeof useLiveScores> } };
const view = (result: Current) => result.current.hook.view;
const otherIds = (result: Current) => view(result)?.others.map((g) => g.id);
const otherAway = (result: Current, id: string) =>
  view(result)?.others.find((g) => g.id === id)?.away.score;

describe("useLiveScores: the rail's view", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date("2026-11-15T19:30:00Z"),
      doNotFake: ["nextTick", "setImmediate"],
    });
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockPrograms = new Map([["ch-cbs", program("Chiefs at Falcons")]]);
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond(board()));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // R4: before the delay has passed the pinned game shows its teams only,
  // and it is not among the others either, where its score would be live.
  test("before the delay, the tile's game is pinned without a score and never listed live", async () => {
    const { result } = await render();
    await advance(1);
    expect(view(result)?.pinned).toEqual([
      {
        tileKey: "tile-0",
        color: LIVE_SCORES_TAG_COLORS[0],
        gameId: KC_ATL,
        teams: { away: "KC", home: "ATL" },
        game: null,
      },
    ]);
    expect(otherIds(result)).not.toContain(KC_ATL);
    expect(otherIds(result)).toHaveLength(3);
  });

  // R4
  test("the pinned game follows the delay; the others follow each fetch", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(board()))
      .mockImplementation(() => respond(later(21, 24)));
    const { result } = await render();
    await advance(30);
    expect(view(result)?.pinned[0].game?.away.score).toBe(14);
    // MIN's score changed in the fetch at 0:15 and shows straight away.
    expect(otherAway(result, MIN_GB)).toBe(24);

    // KC's changed in that same fetch; it shows at 0:45, not before.
    await advance(14);
    expect(view(result)?.pinned[0].game?.away.score).toBe(14);
    await advance(1);
    expect(view(result)?.pinned[0].game?.away.score).toBe(21);
  });

  // R9
  test("a tile whose listing names no game is not pinned or tagged", async () => {
    mockPrograms = new Map([
      ["ch-cbs", program("Chiefs at Falcons")],
      ["ch-other", { ...program(""), Name: "NFL Football" }],
    ]);
    const { result } = await render([
      { key: "tile-0", itemId: "ch-other" },
      { key: "tile-1", itemId: "ch-cbs" },
    ]);
    await advance(30);
    const pinned = view(result)?.pinned ?? [];
    expect(pinned.map((p) => p.tileKey)).toEqual(["tile-1"]);
    // Colours go to pinned games in order, so the only one is the first.
    expect(pinned[0].color).toBe(LIVE_SCORES_TAG_COLORS[0]);
    expect(otherIds(result)).toHaveLength(3);
  });

  test("two games on screen are pinned in tile order with their own colours", async () => {
    mockPrograms = new Map([
      ["a", program("Vikings at Packers")],
      ["b", program("Chiefs at Falcons")],
    ]);
    const { result } = await render([
      { key: "tile-0", itemId: "a" },
      { key: "tile-1", itemId: "b" },
    ]);
    await advance(30);
    expect(
      view(result)?.pinned.map((p) => [p.tileKey, p.gameId, p.color]),
    ).toEqual([
      ["tile-0", MIN_GB, LIVE_SCORES_TAG_COLORS[0]],
      ["tile-1", KC_ATL, LIVE_SCORES_TAG_COLORS[1]],
    ]);
    expect(otherIds(result)).toHaveLength(2);
  });

  // R8
  test("a failed fetch leaves the rail no scores at all, and says why", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("Network request failed")),
    );
    const { result } = await render();
    await advance(5);
    expect(view(result)).toEqual({
      status: "unavailable",
      reason: "network",
      pinned: [],
      others: [],
      delaySeconds: 30,
    });
  });

  // R10
  test("with scores off, or no football on any tile, there is no view", async () => {
    mockSettings.liveScoresEnabled = false;
    const off = await render();
    await advance(5);
    expect(view(off.result)).toBeNull();
    await off.unmount();

    mockSettings.liveScoresEnabled = true;
    mockPrograms = new Map([["ch-cbs", { Name: "Local News at 6" }]]);
    const news = await render();
    await advance(5);
    expect(view(news.result)).toBeNull();
    await news.unmount();
  });

  test("writes the view where the scores screen reads it", async () => {
    const { result } = await render();
    await advance(30);
    expect(result.current.atom).toEqual(view(result));
    expect(result.current.atom?.status).toBe("ok");
  });
});
