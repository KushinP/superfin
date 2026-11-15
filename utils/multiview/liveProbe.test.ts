import { probeLivePlaylist } from "./liveProbe";

const MASTER =
  "https://jf.example.com/videos/chan-1/master.m3u8?PlaySessionId=play-1";
const MASTER_BODY = [
  "#EXTM3U",
  '#EXT-X-STREAM-INF:BANDWIDTH=4000000,CODECS="avc1.640028,mp4a.40.2"',
  "live.m3u8?PlaySessionId=play-1&MediaSourceId=ms-1",
  "",
].join("\n");

type FakeResponse = { ok: boolean; status: number; text?: string };
const respond = ({ ok, status, text = "" }: FakeResponse) =>
  Promise.resolve({ ok, status, text: () => Promise.resolve(text) });

const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("probeLivePlaylist", () => {
  test("a channel whose live playlist answers is ok", async () => {
    mockFetch
      .mockReturnValueOnce(
        respond({ ok: true, status: 200, text: MASTER_BODY }),
      )
      .mockReturnValueOnce(respond({ ok: true, status: 200, text: "#EXTM3U" }));
    await expect(
      probeLivePlaylist(MASTER, { Authorization: "MediaBrowser Token=x" }),
    ).resolves.toBe("ok");
    // The variant is relative to the master playlist, and asked for with the
    // same headers MPV will send.
    expect(mockFetch.mock.calls[1][0]).toBe(
      "https://jf.example.com/videos/chan-1/live.m3u8?PlaySessionId=play-1&MediaSourceId=ms-1",
    );
    expect(mockFetch.mock.calls[1][1].headers).toEqual({
      Authorization: "MediaBrowser Token=x",
    });
  });

  test("a live playlist the server refuses is a failed open", async () => {
    // Seen on 2026-11-08: reopened 2-3 s after its stop, Fox's live.m3u8
    // answered 500 because Jellyfin had just closed the tuner.
    mockFetch
      .mockReturnValueOnce(
        respond({ ok: true, status: 200, text: MASTER_BODY }),
      )
      .mockReturnValueOnce(respond({ ok: false, status: 500 }));
    await expect(probeLivePlaylist(MASTER)).resolves.toBe("failed");
  });

  test("a refused master playlist is a failed open too", async () => {
    mockFetch.mockReturnValueOnce(respond({ ok: false, status: 500 }));
    await expect(probeLivePlaylist(MASTER)).resolves.toBe("failed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("a network error is a failed open", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(probeLivePlaylist(MASTER)).resolves.toBe("failed");
  });

  test("a master playlist with no variant cannot tell", async () => {
    mockFetch.mockReturnValueOnce(
      respond({ ok: true, status: 200, text: "#EXTM3U\n" }),
    );
    await expect(probeLivePlaylist(MASTER)).resolves.toBe("unknown");
  });

  test("a stream that is not a playlist is never fetched", async () => {
    // A direct stream never ends: fetching it would download the channel.
    await expect(
      probeLivePlaylist("https://jf.example.com/videos/chan-1/stream.ts"),
    ).resolves.toBe("unknown");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("a server that takes too long cannot tell, so the player decides", async () => {
    // Opening a channel can take the server over ten seconds; a slow but
    // working channel must not be held back by the probe.
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          ),
        ),
    );
    const result = probeLivePlaylist(MASTER, {}, 20_000);
    jest.advanceTimersByTime(20_000);
    await expect(result).resolves.toBe("unknown");
    jest.useRealTimers();
  });
});
