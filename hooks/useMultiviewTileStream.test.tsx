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
jest.mock("@/utils/customHeaders", () =>
  jest.requireActual("@/test-utils/customHeaders").customHeadersModule(),
);

import { PROGRESS_REPORT_INTERVAL } from "@/constants/Playback";
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
  });

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
    await waitFor(() => expect(mockGetStreamUrl).toHaveBeenCalledTimes(1));
    await second.unmount();
  });
});
