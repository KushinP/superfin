import { act, renderHook, waitFor } from "@testing-library/react-native";

const mockApi = {
  basePath: "https://jf.example.com",
  accessToken: "tok",
};
const mockUser = { Id: "user-1" };
const mockGetItem = jest.fn();
const mockStart = jest.fn(() => Promise.resolve());
const mockStopped = jest.fn((_args: unknown) => Promise.resolve());
const mockGetStreamUrl = jest.fn();

jest.mock("@/utils/atoms/api", () => ({
  apiAtom: "apiAtom",
  userAtom: "userAtom",
}));
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: (atom: unknown) => (atom === "apiAtom" ? mockApi : mockUser),
}));
const mockProgress = jest.fn((_args: unknown) => Promise.resolve());
let mockSettings: Record<string, unknown> = { audioTranscodeMode: "auto" };
jest.mock("@/utils/atoms/settings", () => ({
  useSettings: () => ({ settings: mockSettings }),
}));
jest.mock("@jellyfin/sdk/lib/utils/api", () => ({
  getLibraryApi: () => ({ getItem: mockGetItem }),
  getSessionApi: () => ({
    reportPlaybackStart: mockStart,
    reportPlaybackProgress: mockProgress,
    reportPlaybackStopped: mockStopped,
  }),
}));
jest.mock("@/utils/jellyfin/media/getStreamUrl", () => ({
  getStreamUrl: (...args: unknown[]) => mockGetStreamUrl(...args),
}));
jest.mock("@/utils/profiles/native", () => ({
  generateDeviceProfile: () => ({}),
}));
jest.mock("@/utils/log", () => ({ writeToLog: jest.fn() }));
// The playlist check is its own module with its own spec; here it answers
// whatever a test needs, "ok" unless told otherwise.
const mockProbe = jest.fn((_url: string, _headers?: object) =>
  Promise.resolve("ok"),
);
jest.mock("@/utils/multiview/liveProbe", () => ({
  probeLivePlaylist: (url: string, headers?: object) => mockProbe(url, headers),
}));
jest.mock("@/utils/customHeaders", () =>
  jest.requireActual("@/test-utils/customHeaders").customHeadersModule(),
);

import { PROGRESS_REPORT_INTERVAL } from "@/constants/Playback";
import { writeToLog } from "@/utils/log";
import { resetLiveReopenGap } from "@/utils/multiview/liveReopenGap";
import { useMultiviewTileStream } from "./useMultiviewTileStream";

const channel = { Id: "chan-1", Type: "TvChannel" };
const liveStream = {
  url: "https://jf.example.com/Videos/chan-1/stream",
  sessionId: "play-1",
  mediaSource: { Id: "ms-1", LiveStreamId: "live-1" },
};

const stopInfo = () =>
  (mockStopped.mock.calls[0]?.[0] as { playbackStopInfo: object })
    ?.playbackStopInfo;

describe("useMultiviewTileStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = { audioTranscodeMode: "auto" };
    mockGetItem.mockResolvedValue({ data: channel });
    mockProbe.mockResolvedValue("ok");
    // The gap after a live stop is shared by every tile; one test's closed
    // channel must not hold up the next test's open.
    resetLiveReopenGap();
  });
  afterEach(() => jest.useRealTimers());

  test("reports progress while open, and stops reporting once closed", async () => {
    // Reported in review: only start and stop went out, so resume points and
    // the dashboard were stale, and a crash left a live session open.
    mockGetStreamUrl.mockResolvedValue(liveStream);
    jest.useFakeTimers();
    try {
      const { result, unmount } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      await act(async () => result.current.onPosition(42));
      await act(async () => jest.advanceTimersByTime(PROGRESS_REPORT_INTERVAL));
      expect(mockProgress).toHaveBeenCalledTimes(1);
      const [progressArgs] = mockProgress.mock.calls[0] as [
        { playbackProgressInfo: object },
      ];
      expect(progressArgs.playbackProgressInfo).toMatchObject({
        ItemId: "chan-1",
        PlaySessionId: "play-1",
        LiveStreamId: "live-1",
        PositionTicks: 420_000_000,
      });

      await unmount();
      await act(async () =>
        jest.advanceTimersByTime(PROGRESS_REPORT_INTERVAL * 3),
      );
      expect(mockProgress).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("a paused or finished tile reports itself paused", async () => {
    // Reported in review: progress always said playing, so the dashboard
    // showed a stopped tile as watching.
    mockGetStreamUrl.mockResolvedValue(liveStream);
    jest.useFakeTimers();
    try {
      const { result } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      await act(async () => result.current.onPaused(true));
      await act(async () => jest.advanceTimersByTime(PROGRESS_REPORT_INTERVAL));
      const [args] = mockProgress.mock.calls[0] as [
        { playbackProgressInfo: { IsPaused?: boolean } },
      ];
      expect(args.playbackProgressInfo.IsPaused).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test("asks for the user's default bitrate, as the full player does", async () => {
    mockSettings = {
      audioTranscodeMode: "auto",
      defaultBitrate: { key: "8 Mb/s", value: 8_000_000 },
    };
    mockGetStreamUrl.mockResolvedValue(liveStream);
    const { result } = await renderHook(() => useMultiviewTileStream("chan-1"));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(mockGetStreamUrl).toHaveBeenCalledWith(
      expect.objectContaining({ maxStreamingBitrate: 8_000_000 }),
    );
  });

  test("a live stream opened without a URL is still closed, releasing its tuner", async () => {
    mockGetStreamUrl.mockResolvedValue({ ...liveStream, url: null });
    const { result } = await renderHook(() => useMultiviewTileStream("chan-1"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(stopInfo()).toMatchObject({
      ItemId: "chan-1",
      LiveStreamId: "live-1",
    });
  });

  test("closing a live tile releases its tuner with the LiveStreamId", async () => {
    mockGetStreamUrl.mockResolvedValue(liveStream);
    const { result, unmount } = await renderHook(() =>
      useMultiviewTileStream("chan-1"),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await unmount();

    expect(mockStopped).toHaveBeenCalledTimes(1);
    expect(stopInfo()).toMatchObject({
      ItemId: "chan-1",
      PlaySessionId: "play-1",
      LiveStreamId: "live-1",
    });
  });

  test("hands the tile the stream's media source, which lists its subtitles", async () => {
    mockGetStreamUrl.mockResolvedValue(liveStream);
    const { result } = await renderHook(() => useMultiviewTileStream("chan-1"));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const state = result.current.state;
    expect(state.status === "ready" && state.mediaSource).toEqual(
      liveStream.mediaSource,
    );
  });

  test("a tile removed while its stream is still opening still releases it", async () => {
    let resolveStream: (value: unknown) => void = () => {};
    mockGetStreamUrl.mockReturnValue(
      new Promise((resolve) => {
        resolveStream = resolve;
      }),
    );
    const { unmount } = await renderHook(() =>
      useMultiviewTileStream("chan-1"),
    );
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalled());

    await unmount();
    expect(mockStopped).not.toHaveBeenCalled();

    await act(async () => {
      resolveStream(liveStream);
    });
    expect(stopInfo()).toMatchObject({ LiveStreamId: "live-1" });
    // It never played, so the server was never told it started.
    expect(mockStart).not.toHaveBeenCalled();
  });

  test("a library item resumes where it was left and saves the new position on close", async () => {
    mockGetItem.mockResolvedValue({
      data: {
        Id: "ep-1",
        Type: "Episode",
        UserData: { PlaybackPositionTicks: 600_000_000 },
      },
    });
    mockGetStreamUrl.mockResolvedValue({
      url: "https://jf.example.com/Videos/ep-1/stream",
      sessionId: "play-2",
      mediaSource: { Id: "ep-1" },
    });
    const { result, unmount } = await renderHook(() =>
      useMultiviewTileStream("ep-1"),
    );
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const ready = result.current.state as { source: { startPosition: number } };
    expect(ready.source.startPosition).toBe(60);

    await act(async () => result.current.onPosition(90));
    await unmount();
    expect(stopInfo()).toMatchObject({ PositionTicks: 900_000_000 });
  });

  test("a stream the server refuses shows as an error", async () => {
    mockGetStreamUrl.mockRejectedValue(new Error("NoCompatibleStream"));
    const { result } = await renderHook(() => useMultiviewTileStream("chan-1"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });

  test("a reopened tile waits for the old stream to give its tuner back", async () => {
    // A quality change restarts every tile at once. Two live tiles on a dual
    // tuner asked for new tuners while the old streams still held both, and
    // spun.
    jest.useFakeTimers();
    let releaseTuner: () => void = () => {};
    mockGetStreamUrl.mockResolvedValue(liveStream);
    const first = await renderHook(() => useMultiviewTileStream("chan-1"));
    await waitFor(() =>
      expect(first.result.current.state.status).toBe("ready"),
    );
    mockStopped.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseTuner = resolve;
      }),
    );
    await first.unmount();
    mockGetStreamUrl.mockClear();

    const second = await renderHook(() => useMultiviewTileStream("chan-1"));
    await act(async () => {});
    expect(mockGetStreamUrl).not.toHaveBeenCalled();

    await act(async () => releaseTuner());
    // Then the tuner's grace period after a live stop (spec 2026-11-08).
    await act(async () => jest.advanceTimersByTime(5_000));
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledTimes(1));
    await second.unmount();
  });

  describe("reopening a live channel", () => {
    beforeEach(() => jest.useFakeTimers());

    const openThenClose = async () => {
      mockGetStreamUrl.mockResolvedValue(liveStream);
      const first = await renderHook(() => useMultiviewTileStream("chan-1"));
      await waitFor(() =>
        expect(first.result.current.state.status).toBe("ready"),
      );
      await first.unmount();
      mockGetStreamUrl.mockClear();
      mockProbe.mockClear();
      mockStopped.mockClear();
    };
    const advance = async (ms: number) => {
      await act(async () => jest.advanceTimersByTime(ms));
    };

    test("waits 5 s after the last live stop before asking for a stream", async () => {
      // On 2026-11-08 a reopen right after a stop got HTTP 500: Jellyfin had
      // closed the tuner 2-3 s before and was not done with it.
      await openThenClose();
      const second = await renderHook(() => useMultiviewTileStream("chan-1"));
      await advance(4_900);
      expect(mockGetStreamUrl).not.toHaveBeenCalled();
      await advance(100);
      await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledTimes(1));
      await second.unmount();
    });

    test("a refused open is tried again after 2 s and 4 s, then plays", async () => {
      mockGetStreamUrl.mockResolvedValue(liveStream);
      mockProbe
        .mockResolvedValueOnce("failed")
        .mockResolvedValueOnce("failed")
        .mockResolvedValueOnce("ok");
      const { result, unmount } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(mockProbe).toHaveBeenCalledTimes(1));
      expect(result.current.state.status).toBe("loading");
      await advance(1_900);
      expect(mockProbe).toHaveBeenCalledTimes(1);
      await advance(100);
      expect(mockProbe).toHaveBeenCalledTimes(2);
      await advance(4_000);
      expect(mockProbe).toHaveBeenCalledTimes(3);
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      // The playlist checked is the one the player is handed, with its headers.
      expect(mockProbe.mock.calls[0][0]).toBe(liveStream.url);
      expect(mockProbe.mock.calls[0][1]).toMatchObject({
        Authorization: 'MediaBrowser Token="tok"',
      });
      // Each refusal is in the log, and the server hears a start only once.
      expect(writeToLog).toHaveBeenCalledWith(
        "WARN",
        expect.stringMatching(/not ready/),
        expect.objectContaining({ itemId: "chan-1" }),
      );
      expect(mockStart).toHaveBeenCalledTimes(1);
      await unmount();
    });

    test("a channel refused every time gives up after the 8 s try and frees its tuner", async () => {
      mockGetStreamUrl.mockResolvedValue(liveStream);
      mockProbe.mockResolvedValue("failed");
      const { result, unmount } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(mockProbe).toHaveBeenCalledTimes(1));
      await advance(2_000);
      await advance(4_000);
      await advance(8_000);
      await waitFor(() => expect(result.current.state.status).toBe("error"));
      expect(mockProbe).toHaveBeenCalledTimes(4);
      expect(stopInfo()).toMatchObject({ LiveStreamId: "live-1" });
      expect(mockStart).not.toHaveBeenCalled();
      // It stays given up: no more tries, and closing it stops nothing twice.
      await advance(60_000);
      expect(mockProbe).toHaveBeenCalledTimes(4);
      await unmount();
      expect(mockStopped).toHaveBeenCalledTimes(1);
    });

    test("a tile removed between tries still frees its tuner", async () => {
      mockGetStreamUrl.mockResolvedValue(liveStream);
      mockProbe.mockResolvedValue("failed");
      const { unmount } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(mockProbe).toHaveBeenCalledTimes(1));
      await unmount();
      expect(stopInfo()).toMatchObject({ LiveStreamId: "live-1" });
      await advance(20_000);
      expect(mockProbe).toHaveBeenCalledTimes(1);
    });

    test("a probe that cannot tell leaves it to the player", async () => {
      mockGetStreamUrl.mockResolvedValue(liveStream);
      mockProbe.mockResolvedValue("unknown");
      const { result, unmount } = await renderHook(() =>
        useMultiviewTileStream("chan-1"),
      );
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      expect(mockProbe).toHaveBeenCalledTimes(1);
      await unmount();
    });

    test("a movie neither waits for the tuner nor checks a playlist", async () => {
      await openThenClose();
      mockGetItem.mockResolvedValue({
        data: { Id: "movie-1", Type: "Movie" },
      });
      mockGetStreamUrl.mockResolvedValue({
        url: "https://jf.example.com/Videos/movie-1/stream",
        sessionId: "play-3",
        mediaSource: { Id: "movie-1" },
      });
      const { result, unmount } = await renderHook(() =>
        useMultiviewTileStream("movie-1"),
      );
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      expect(mockProbe).not.toHaveBeenCalled();
      await unmount();
    });
  });
});
