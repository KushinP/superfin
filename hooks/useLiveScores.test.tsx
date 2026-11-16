import { act, renderHook } from "@testing-library/react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { JotaiQueryWrapper } from "@/test-utils/queryWrapper";
import {
  followedGameIdsAtom,
  liveScoresViewAtom,
} from "@/utils/atoms/liveScores";
import recorded from "@/utils/livescores/__fixtures__/scoreboard-2026-11-15.json";
import { useLiveScores } from "./useLiveScores";

let mockSettings: Record<string, unknown> = {};
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: mockSettings }),
}));
const mockWriteDebugLog = jest.fn();
jest.mock("@/utils/log", () => ({
  writeDebugLog: (...args: unknown[]) => mockWriteDebugLog(...args),
}));

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
/** The recorded board with every game over. */
const allFinal = (): any => {
  const raw = board();
  for (const event of raw.events) {
    event.status.type.state = "post";
    event.status.type.completed = true;
  }
  return raw;
};
const respond = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

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

const render = (active = true, follow: string[] = []) =>
  renderHook(
    () => {
      const setFollowed = useSetAtom(followedGameIdsAtom);
      return {
        hook: useLiveScores(active),
        atom: useAtomValue(liveScoresViewAtom),
        followed: useAtomValue(followedGameIdsAtom),
        setFollowed,
      };
    },
    {
      wrapper: JotaiQueryWrapper,
      initialProps: undefined,
    },
  ).then(async (rendered) => {
    if (follow.length > 0) {
      await act(async () => rendered.result.current.setFollowed(follow));
    }
    return rendered;
  });

type Current = {
  current: { hook: ReturnType<typeof useLiveScores>; followed: string[] };
};
const view = (result: Current) => result.current.hook.view;
const ids = (games?: { id: string }[]) => games?.map((g) => g.id);
const awayScore = (result: Current, id: string) =>
  [...(view(result)?.followed ?? []), ...(view(result)?.others ?? [])].find(
    (g) => g.id === id,
  )?.away.score;

describe("useLiveScores", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date("2026-11-15T19:30:00Z"),
      doNotFake: ["nextTick", "setImmediate"],
    });
    mockSettings = { liveScoresEnabled: true, liveScoresDelaySeconds: 30 };
    mockWriteDebugLog.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond(board()));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // S1: no guide, no tiles. On the Fire TV (2026-11-15) 49ers–Cowboys ran
  // into "The OT", matching found nothing, and no score showed.
  test("shows every game on the board, whatever the screen is playing", async () => {
    const { result } = await render();
    await advance(30);
    expect(view(result)?.status).toBe("ok");
    expect(ids(view(result)?.others)).toHaveLength(4);
    expect(ids(view(result)?.others)).toContain(KC_ATL);
  });

  // S5: every game waits, not only the followed ones.
  test("shows nothing until the first fetch is a delay old", async () => {
    const { result } = await render();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view(result)).toMatchObject({
      waiting: true,
      followed: [],
      others: [],
    });

    await advance(29);
    expect(view(result)?.waiting).toBe(false);
  });

  test("an unfollowed game's score changes a delay after it was fetched", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(board()))
      .mockImplementation(() => respond(later(21, 24)));
    const { result } = await render();
    await advance(30);
    expect(awayScore(result, KC_ATL)).toBe(14);
    expect(awayScore(result, MIN_GB)).toBe(17);
    // Both changed in the fetch at 0:15; they show at 0:45, not before.
    await advance(14);
    expect(awayScore(result, MIN_GB)).toBe(17);
    await advance(1);
    expect(awayScore(result, KC_ATL)).toBe(21);
    expect(awayScore(result, MIN_GB)).toBe(24);
  });

  test("follows a shorter delay setting", async () => {
    mockSettings.liveScoresDelaySeconds = 0;
    const { result } = await render();
    await advance(1);
    expect(awayScore(result, KC_ATL)).toBe(14);
  });

  // S3
  test("followed games lead, in the order followed, and leave the others", async () => {
    const { result } = await render(true, [MIN_GB, KC_ATL]);
    await advance(30);
    expect(ids(view(result)?.followed)).toEqual([MIN_GB, KC_ATL]);
    expect(ids(view(result)?.others)).toHaveLength(2);
    expect(ids(view(result)?.others)).not.toContain(KC_ATL);
  });

  // S4
  test("a followed game that's over is unfollowed", async () => {
    fetchMock
      .mockImplementationOnce(() => respond(board()))
      .mockImplementation(() => respond(allFinal()));
    const { result } = await render(true, [KC_ATL]);
    await advance(30);
    expect(ids(view(result)?.followed)).toEqual([KC_ATL]);

    await advance(15);
    expect(result.current.followed).toEqual([]);
    expect(view(result)?.followed).toEqual([]);
  });

  // S9
  test("with the setting off, asks ESPN nothing and has no view", async () => {
    mockSettings.liveScoresEnabled = false;
    const { result } = await render();
    await advance(120);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(view(result)).toBeNull();
  });

  // S9: the player on a movie
  test("while inactive, asks ESPN nothing and has no view", async () => {
    const { result } = await render(false);
    await advance(120);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(view(result)).toBeNull();
  });

  test("polls every 15 s while a game is in play", async () => {
    await render();
    await advance(120);
    // At 0:00, then every 15 s.
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  test("polls slowly while no game is in play", async () => {
    fetchMock.mockImplementation(() => respond(allFinal()));
    await render();
    await advance(120);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // P0-7
  test("logs each fetch's game count, so a device test can read it", async () => {
    await render();
    await advance(1);
    expect(mockWriteDebugLog).toHaveBeenCalledWith(
      "Live scores: fetched the scoreboard",
      { games: 4, inProgress: 2 },
    );
  });

  // S7
  test("a failed fetch leaves no scores and says why; the next good one brings them back", async () => {
    const { result } = await render();
    await advance(30);
    expect(awayScore(result, KC_ATL)).toBe(14);

    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("Network request failed")),
    );
    await advance(20);
    expect(view(result)).toEqual({
      status: "unavailable",
      reason: "network",
      waiting: false,
      followed: [],
      others: [],
      delaySeconds: 30,
    });

    fetchMock.mockImplementation(() => respond(board()));
    await advance(15);
    expect(awayScore(result, KC_ATL)).toBe(14);
  });

  test("a feed in a shape we do not know says so", async () => {
    fetchMock.mockImplementation(() => respond({ events: "changed" }));
    const { result } = await render();
    await advance(5);
    expect(view(result)).toMatchObject({
      status: "unavailable",
      reason: "format",
    });
  });

  test("an HTTP error from ESPN says the network failed", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 503, json: () => respond({}) }),
    );
    const { result } = await render();
    await advance(5);
    expect(view(result)).toMatchObject({
      status: "unavailable",
      reason: "network",
    });
  });

  test("scores fetched over two minutes ago are not shown", async () => {
    const { result } = await render();
    await advance(30);
    expect(awayScore(result, KC_ATL)).toBe(14);
    // The next fetches never answer, as when the network hangs. The last
    // one that did arrived at 0:30, so at 2:31 it is over two minutes old.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    await advance(120);
    expect(awayScore(result, KC_ATL)).toBe(14);
    await advance(1);
    expect(view(result)).toMatchObject({
      status: "unavailable",
      reason: "stale",
    });
  });

  test("writes the view where the scores screen reads it", async () => {
    const { result } = await render();
    await advance(30);
    expect(result.current.atom).toEqual(view(result));
    expect(result.current.atom?.status).toBe("ok");
  });
});
