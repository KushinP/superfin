import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState } from "react-native";
import { Colors, MultiviewColors } from "@/constants/Colors";
import { QueryWrapper } from "@/test-utils/queryWrapper";

type Handler<T> = (e: { nativeEvent: T }) => void;
let mockOnProgress:
  | Handler<{ position: number; duration?: number; cacheSeconds?: number }>
  | undefined;
const mockGetEpisodes = jest.fn();
let mockSources: ({ muted?: boolean } | undefined)[] = [];
let mockOnState:
  | Handler<{ isPaused?: boolean; isLoading?: boolean }>
  | undefined;
let mockItem: { Id: string; Name: string; Type: string };
const mockPlayer = {
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => Promise.resolve()),
  seekBy: jest.fn((_s: number) => Promise.resolve()),
  seekTo: jest.fn((_s: number) => Promise.resolve()),
  setMute: jest.fn(() => Promise.resolve()),
  destroy: jest.fn(() => Promise.resolve()),
  // MPV numbers the file's own track first, then the files loaded with it.
  getSubtitleTracks: jest.fn(() =>
    Promise.resolve([
      { id: 1, lang: "eng", codec: "subrip" },
      {
        id: 2,
        lang: "spa",
        external: true,
        externalFilename:
          "https://jf.example.com/Videos/ep-5/Subtitles/4/Stream.srt",
      },
    ]),
  ),
  getCurrentSubtitleTrack: jest.fn(() => Promise.resolve(0)),
  setSubtitleTrack: jest.fn((_id: number) => Promise.resolve()),
  disableSubtitles: jest.fn(() => Promise.resolve()),
};
const mockShowActionSheet = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(",")}` : key,
  }),
}));
jest.mock("@expo/react-native-action-sheet", () => ({
  useActionSheet: () => ({ showActionSheetWithOptions: mockShowActionSheet }),
}));
// What Jellyfin says the episode carries: one embedded English track, one
// external Spanish file, and an image track the server would burn in.
const mockMediaSource = {
  MediaStreams: [
    {
      Type: "Subtitle",
      Index: 3,
      DeliveryMethod: "Embed",
      Language: "eng",
      DisplayTitle: "English - SUBRIP",
    },
    {
      Type: "Subtitle",
      Index: 4,
      DeliveryMethod: "External",
      IsExternal: true,
      Language: "spa",
      DisplayTitle: "Spanish - SRT - External",
      DeliveryUrl: "/Videos/ep-5/Subtitles/4/Stream.srt",
    },
    {
      Type: "Subtitle",
      Index: 5,
      DeliveryMethod: "Encode",
      Language: "fre",
      DisplayTitle: "French - PGSSUB",
    },
  ],
};
// The real hook keeps its state between renders; so does this stand-in, per
// item, so that object identity in the tile is tested and not the mock's.
let mockStream: { state: { item: unknown } } | undefined;
jest.mock("@/hooks/useMultiviewTileStream", () => ({
  useMultiviewTileStream: () => {
    if (mockStream?.state.item !== mockItem) {
      mockStream = {
        state: {
          status: "ready",
          item: mockItem,
          source: { url: "https://jf.example.com/stream" },
          mediaSource: mockMediaSource,
        },
        onPosition: jest.fn(),
        onPaused: jest.fn(),
      } as typeof mockStream;
    }
    return mockStream;
  },
}));
/** The tile's TV remote key handler, as the TV event hook was given it. */
let mockTVKeys:
  | ((evt: { eventType: string; eventKeyAction?: number }) => void)
  | undefined;
jest.mock("@/hooks/useTVEventHandler", () => ({
  useTVEventHandler: (
    handler: (evt: { eventType: string; eventKeyAction?: number }) => void,
  ) => {
    mockTVKeys = handler;
  },
}));
const mockWriteToLog = jest.fn();
jest.mock("@/utils/log", () => ({
  writeToLog: (...args: unknown[]) => mockWriteToLog(...args),
}));
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: () => ({ basePath: "https://jf.example.com" }),
}));
jest.mock("@/utils/atoms/api", () => ({
  apiAtom: "apiAtom",
  userAtom: "userAtom",
}));
jest.mock("@jellyfin/sdk/lib/utils/api", () => ({
  getShowApi: () => ({ getEpisodes: mockGetEpisodes }),
}));
jest.mock("@/modules", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    MpvPlayerView: forwardRef(
      (
        props: {
          source?: { muted?: boolean };
          onProgress?: Handler<{ position: number }>;
          onPlaybackStateChange?: Handler<{ isPaused?: boolean }>;
        },
        ref: unknown,
      ) => {
        useImperativeHandle(ref, () => mockPlayer);
        mockSources.push(props.source);
        mockOnProgress = props.onProgress;
        mockOnState = props.onPlaybackStateChange;
        return <View />;
      },
    ),
  };
});

import { MultiviewTile } from "./MultiviewTile";

const onPlayNext = jest.fn();
const onRemove = jest.fn();

const renderTile = (showLabel = true) =>
  render(
    <QueryWrapper>
      <MultiviewTile
        itemId={mockItem.Id}
        frame={{ left: 0, top: 0, width: 320, height: 180 }}
        muted
        heard={false}
        showLabel={showLabel}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onPlayNext={onPlayNext}
        onRemove={onRemove}
      />
    </QueryWrapper>,
  );

const tick = async (position: number, duration = 0, cacheSeconds?: number) => {
  await act(async () =>
    mockOnProgress?.({ nativeEvent: { position, duration, cacheSeconds } }),
  );
};
const playerState = async (state: {
  isPaused?: boolean;
  isLoading?: boolean;
}) => {
  await act(async () => mockOnState?.({ nativeEvent: state }));
};
const starting = () => screen.queryByLabelText("multiview.tile_starting");

beforeEach(() => {
  jest.clearAllMocks();
  mockOnProgress = undefined;
  mockOnState = undefined;
  mockTVKeys = undefined;
  mockSources = [];
  mockStream = undefined;
  mockItem = {
    Id: "ep-5",
    Name: "Episode 5",
    Type: "Episode",
    SeriesId: "show-1",
  } as typeof mockItem;
  mockGetEpisodes.mockResolvedValue({
    data: {
      Items: [
        { Id: "ep-4", Name: "Episode 4" },
        { Id: "ep-5", Name: "Episode 5" },
        { Id: "ep-6", Name: "Episode 6" },
      ],
    },
  });
});

describe("the player", () => {
  test("starts muted, before any sound can play", async () => {
    // Reported in review: the mute went out from onLoad, after an autoplaying
    // file could already be heard for a moment.
    await renderTile();
    expect(mockSources[0]?.muted).toBe(true);
  });

  test("keeps one source object across renders, so the stream never reloads", async () => {
    await renderTile();
    await tick(0);
    await tick(1);
    expect(new Set(mockSources).size).toBe(1);
  });

  test("is destroyed when the tile goes, freeing its decoder at once", async () => {
    // Reported in review: React clears an object ref before effect cleanups
    // run, so the cleanup found no player and never destroyed it.
    const { unmount } = await renderTile();
    await act(async () => unmount());
    expect(mockPlayer.destroy).toHaveBeenCalled();
  });
});

describe("when the item finishes", () => {
  const DURATION = 1302;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const playToTheEnd = async () => {
    await renderTile();
    await tick(1290, DURATION);
    await tick(1301, DURATION);
    // No more ticks: MPV has reached the end of the file.
    await act(async () => jest.advanceTimersByTime(3_000));
  };
  const finished = () => screen.queryByText("multiview.finished");

  test("says it has finished instead of loading forever", async () => {
    // Reported: an episode that ended sat on the loading wheel for good.
    await playToTheEnd();
    expect(finished()).toBeTruthy();
    expect(starting()).toBeNull();
  });

  test("a stall far from the end is still a stall", async () => {
    await renderTile();
    await tick(100, DURATION);
    await tick(101, DURATION);
    await act(async () => jest.advanceTimersByTime(3_000));
    expect(starting()).toBeTruthy();
    expect(finished()).toBeNull();
  });

  test("pausing itself on the last frame counts as finished", async () => {
    await renderTile();
    await tick(1290, DURATION);
    await tick(1301.5, DURATION);
    await playerState({ isPaused: true });
    expect(finished()).toBeTruthy();
  });

  test("pausing a few seconds before the end is just a pause", async () => {
    await renderTile();
    await tick(1290, DURATION);
    await tick(1299.5, DURATION);
    await playerState({ isPaused: true });
    expect(finished()).toBeNull();
  });

  test("a live channel that stops is a stall, never finished", async () => {
    // A live stream can report a duration that grows with the live edge,
    // which would otherwise read as having played to the end.
    mockItem = { Id: "chan-1", Name: "WBZ-DT", Type: "TvChannel" };
    await renderTile();
    await tick(0, 60);
    await tick(59.5, 60);
    await act(async () => jest.advanceTimersByTime(3_000));
    expect(finished()).toBeNull();
    expect(starting()).toBeTruthy();
  });

  test("offers the next episode, which plays in this tile", async () => {
    await playToTheEnd();
    await fireEvent.press(
      await screen.findByText("multiview.play_next:Episode 6"),
    );
    expect(mockGetEpisodes).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: "show-1", adjacentTo: "ep-5" }),
    );
    expect(onPlayNext).toHaveBeenCalledWith("ep-6");
  });

  test("the last episode offers no next one", async () => {
    mockGetEpisodes.mockResolvedValue({
      data: { Items: [{ Id: "ep-4" }, { Id: "ep-5" }] },
    });
    await playToTheEnd();
    await act(async () => {});
    expect(screen.queryByText(/multiview\.play_next/)).toBeNull();
  });

  test("a movie offers no next one, and asks nothing of the server", async () => {
    mockItem = { Id: "m-1", Name: "Dune", Type: "Movie" };
    await playToTheEnd();
    await act(async () => {});
    expect(screen.queryByText(/multiview\.play_next/)).toBeNull();
    expect(mockGetEpisodes).not.toHaveBeenCalled();
  });

  test("play again starts it over", async () => {
    await playToTheEnd();
    await fireEvent.press(screen.getByText("multiview.play_again"));
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  test("remove takes the tile off", async () => {
    await playToTheEnd();
    await fireEvent.press(screen.getByText("multiview.remove_tile"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("the loading wheel", () => {
  test("stays up while a live channel tunes, before any video", async () => {
    // The stream URL comes back long before a live channel's first frame:
    // the server still has to tune and start a transcode.
    mockItem = { Id: "chan-1", Name: "WBZ-DT", Type: "TvChannel" };
    await renderTile();
    expect(starting()).toBeTruthy();
    await tick(0);
    expect(starting()).toBeTruthy();
  });

  test("goes once playback moves", async () => {
    await renderTile();
    await tick(0);
    await tick(0.5);
    expect(starting()).toBeNull();
  });

  describe("after playback has started", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("comes back when the picture stops moving", async () => {
      // Reported: a live tile went black mid-stream with nothing to say it
      // was waiting on the server.
      await renderTile();
      await tick(0);
      await tick(1);
      await act(async () => jest.advanceTimersByTime(3_000));
      expect(starting()).toBeTruthy();

      await tick(1.5);
      expect(starting()).toBeNull();
    });

    test("stays away while the tile is paused on purpose", async () => {
      await renderTile();
      await tick(0);
      await tick(1);
      await playerState({ isPaused: true });
      await act(async () => jest.advanceTimersByTime(10_000));
      expect(starting()).toBeNull();
    });

    test("shows while the player is seeking", async () => {
      await renderTile();
      await tick(0);
      await tick(1);
      await playerState({ isLoading: true });
      expect(starting()).toBeTruthy();
      await playerState({ isLoading: false });
      expect(starting()).toBeNull();
    });
  });
});

describe("tile controls", () => {
  test("a library item gets play/pause, skip and captions", async () => {
    await renderTile();
    expect(screen.getByLabelText("multiview.pause")).toBeTruthy();
    expect(screen.getByLabelText("multiview.seek_back:10")).toBeTruthy();
    expect(screen.getByLabelText("multiview.seek_forward:30")).toBeTruthy();
    expect(screen.getByLabelText("multiview.captions")).toBeTruthy();
  });

  test("a live channel has none, there is nothing to pause or skip", async () => {
    mockItem = { Id: "chan-1", Name: "WBZ-DT", Type: "TvChannel" };
    await renderTile();
    expect(screen.queryByLabelText("multiview.pause")).toBeNull();
    expect(screen.queryByLabelText("multiview.captions")).toBeNull();
  });

  test("they hide with the toolbar", async () => {
    await renderTile(false);
    expect(screen.queryByLabelText("multiview.pause")).toBeNull();
  });

  test("pause and play follow what the player reports", async () => {
    await renderTile();
    await fireEvent.press(screen.getByLabelText("multiview.pause"));
    expect(mockPlayer.pause).toHaveBeenCalled();

    await playerState({ isPaused: true });
    await fireEvent.press(screen.getByLabelText("multiview.play"));
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  test("skip goes back 10 seconds and forward 30", async () => {
    await renderTile();
    await fireEvent.press(screen.getByLabelText("multiview.seek_back:10"));
    await fireEvent.press(screen.getByLabelText("multiview.seek_forward:30"));
    expect(mockPlayer.seekBy.mock.calls).toEqual([[-10], [30]]);
  });

  test("captions lists the server's subtitle names, leaving out burned-in ones", async () => {
    // Reported: the list read "eng", MPV's bare language code. Jellyfin names
    // every stream, the same names the full player shows. An image track the
    // server burns in cannot be turned on without restarting the stream.
    await renderTile();
    await fireEvent.press(screen.getByLabelText("multiview.captions"));
    const [options] = mockShowActionSheet.mock.calls[0];
    expect(options.options).toEqual([
      "multiview.captions_off",
      "English - SUBRIP",
      "Spanish - SRT - External",
      "common.cancel",
    ]);
  });

  test("captions turns on the player's own track for the one chosen, or off", async () => {
    await renderTile();
    await fireEvent.press(screen.getByLabelText("multiview.captions"));
    const [, choose] = mockShowActionSheet.mock.calls[0];

    await act(async () => choose(2));
    expect(mockPlayer.setSubtitleTrack).toHaveBeenLastCalledWith(2);
    await act(async () => choose(1));
    expect(mockPlayer.setSubtitleTrack).toHaveBeenLastCalledWith(1);
    await act(async () => choose(0));
    expect(mockPlayer.disableSubtitles).toHaveBeenCalled();
  });

  test("captions says so when the tile has none", async () => {
    const streams = mockMediaSource.MediaStreams;
    mockMediaSource.MediaStreams = [];
    await renderTile();
    await fireEvent.press(screen.getByLabelText("multiview.captions"));
    mockMediaSource.MediaStreams = streams;
    const [options] = mockShowActionSheet.mock.calls[0];
    expect(options.title).toBe("multiview.no_captions");
  });
});

describe("with a TV remote", () => {
  test("a focused tile draws a white ring, apart from the green heard one", async () => {
    const onFocusChange = jest.fn();
    await render(
      <QueryWrapper>
        <MultiviewTile
          itemId={mockItem.Id}
          frame={{ left: 0, top: 0, width: 320, height: 180 }}
          muted
          heard={false}
          showLabel
          onPress={jest.fn()}
          onLongPress={jest.fn()}
          onFocusChange={onFocusChange}
        />
      </QueryWrapper>,
    );
    const target = screen.getByTestId("multiview-tile-target");
    await fireEvent(target, "focus");
    expect(screen.getByTestId("multiview-tile")).toHaveStyle({
      borderColor: MultiviewColors.focusRing,
    });
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    await fireEvent(target, "blur");
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  test("the ring goes with the labels, so a tile left focused shows no border", async () => {
    await renderTile(false);
    await fireEvent(screen.getByTestId("multiview-tile-target"), "focus");
    expect(screen.getByTestId("multiview-tile")).not.toHaveStyle({
      borderColor: MultiviewColors.focusRing,
    });
  });

  test("Up goes to the toolbar, which sits inside the tile, not above it", async () => {
    await render(
      <QueryWrapper>
        <MultiviewTile
          itemId={mockItem.Id}
          frame={{ left: 0, top: 0, width: 320, height: 180 }}
          muted
          heard={false}
          showLabel
          onPress={jest.fn()}
          onLongPress={jest.fn()}
          nextFocusUp={42}
        />
      </QueryWrapper>,
    );
    expect(screen.getByTestId("multiview-tile-target").props.nextFocusUp).toBe(
      42,
    );
  });

  test("the green outline of the tile being heard goes with the labels too", async () => {
    const tile = (showLabel: boolean) => (
      <QueryWrapper>
        <MultiviewTile
          itemId={mockItem.Id}
          frame={{ left: 0, top: 0, width: 320, height: 180 }}
          muted={false}
          heard
          showLabel={showLabel}
          onPress={jest.fn()}
          onLongPress={jest.fn()}
        />
      </QueryWrapper>
    );
    const view = await render(tile(true));
    expect(screen.getByTestId("multiview-tile")).toHaveStyle({
      borderColor: Colors.primary,
    });
    await view.rerender(tile(false));
    expect(screen.getByTestId("multiview-tile")).not.toHaveStyle({
      borderColor: Colors.primary,
    });
  });
});

describe("the tile's own menu", () => {
  test("a visible button opens it, whatever the tile is playing", async () => {
    // Press and hold was the only way in: a mouse user never found it, and
    // changed the quality for every tile instead of the one stalling.
    const onLongPress = jest.fn();
    await render(
      <QueryWrapper>
        <MultiviewTile
          itemId={mockItem.Id}
          frame={{ left: 0, top: 0, width: 320, height: 180 }}
          muted
          heard={false}
          showLabel
          onPress={jest.fn()}
          onLongPress={onLongPress}
        />
      </QueryWrapper>,
    );
    await fireEvent.press(screen.getByLabelText("multiview.tile_menu"));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  test("the button hides with the labels", async () => {
    await renderTile(false);
    expect(screen.queryByLabelText("multiview.tile_menu")).toBeNull();
  });
});

describe("the TV remote's playback keys", () => {
  // Reported on a Fire TV: play, pause, forward and rewind did nothing in
  // multiview. The remote's keys never reached a tile, and its on-screen
  // buttons sit inside the tile's own focus target, out of the D-pad's reach.
  const press = async (eventType: string, eventKeyAction = 0) => {
    await act(async () => mockTVKeys?.({ eventType, eventKeyAction }));
  };
  const focus = async () => {
    await fireEvent(screen.getByTestId("multiview-tile-target"), "focus");
  };

  test("⏯ pauses the focused tile, and plays it once it is paused", async () => {
    await renderTile(false);
    await focus();

    await press("playPause");
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    await playerState({ isPaused: true });
    await press("playPause");
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test("⏪ goes back 10 seconds and ⏩ forward 30", async () => {
    await renderTile(false);
    await focus();

    await press("rewind");
    await press("fastForward");

    expect(mockPlayer.seekBy.mock.calls).toEqual([[-10], [30]]);
  });

  test("the separate Play and Pause keys play and pause", async () => {
    await renderTile(false);
    await focus();

    await press("pause");
    await press("play");

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  test("a key counts once, on the press and not the release", async () => {
    await renderTile(false);
    await focus();

    await press("rewind", 0);
    await press("rewind", 1);

    expect(mockPlayer.seekBy).toHaveBeenCalledTimes(1);
  });

  test("a tile without the focus ignores them", async () => {
    await renderTile(false);
    await focus();
    await fireEvent(screen.getByTestId("multiview-tile-target"), "blur");

    await press("playPause");
    await press("fastForward");

    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.seekBy).not.toHaveBeenCalled();
  });

  test("a live channel ignores them: there is nothing to pause or skip", async () => {
    mockItem = { Id: "chan-1", Name: "WBZ-DT", Type: "TvChannel" };
    await renderTile(false);
    await focus();

    await press("playPause");
    await press("rewind");

    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.seekBy).not.toHaveBeenCalled();
  });
});

describe("a live channel that stops receiving video", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockItem = { Id: "chan-1", Name: "WFXT", Type: "TvChannel" };
  });
  afterEach(() => jest.useRealTimers());

  const renderLive = (onStuck: () => void, onPlaying = jest.fn()) =>
    render(
      <QueryWrapper>
        <MultiviewTile
          itemId={mockItem.Id}
          frame={{ left: 0, top: 0, width: 320, height: 180 }}
          muted
          heard={false}
          showLabel
          onPress={jest.fn()}
          onLongPress={jest.fn()}
          onStuck={onStuck}
          onPlaying={onPlaying}
        />
      </QueryWrapper>,
    );

  test("asks to reconnect once stalled past the live cushion", async () => {
    // Seen on the Mac: the server stopped sending a live session's video and
    // MPV waited without end, logging nothing; a manual reconnect brought the
    // channel back.
    const onStuck = jest.fn();
    const onPlaying = jest.fn();
    await renderLive(onStuck, onPlaying);
    await tick(0, 0);
    await tick(1, 0);
    await tick(2, 0);
    expect(onPlaying).toHaveBeenCalled();

    // The stall is noticed first, then the reconnect waits 30 s. It was 12 s,
    // and on 2026-11-08 Fox dropped four times in 13 minutes: each reconnect
    // closed a channel the server was still sending (spec 2026-11-08).
    await act(async () => jest.advanceTimersByTime(3_000));
    await act(async () => jest.advanceTimersByTime(26_000));
    expect(onStuck).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(4_000));
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  test("says in the log why it reconnects", async () => {
    // The freeze behind the Fox drops is unexplained; what was buffered and
    // whether the app was in front tell a starved stream from a stuck player
    // from a backgrounded app.
    // Jest's React Native has no app state to read; this one was sent away.
    Object.defineProperty(AppState, "currentState", {
      value: "background",
      configurable: true,
    });
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await tick(0, 0, 4);
    await tick(1, 0, 3);
    await tick(2, 0, 1.5);
    await act(async () => jest.advanceTimersByTime(3_000));
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(onStuck).toHaveBeenCalledTimes(1);
    expect(mockWriteToLog).toHaveBeenCalledTimes(1);
    const [level, message, data] = mockWriteToLog.mock.calls[0];
    expect(level).toBe("WARN");
    expect(message).toMatch(/reconnect/);
    expect(data).toMatchObject({
      itemId: "chan-1",
      name: "WFXT",
      started: true,
      bufferedSeconds: 1.5,
      appState: "background",
    });
    expect(data.frozenSeconds).toBeGreaterThanOrEqual(30);
    expect(data.frozenSeconds).toBeLessThan(34);
  });

  test("a player that never says what it buffered is logged as unknown", async () => {
    // ExoPlayer on Android TV sends no cacheSeconds; a 0 would read as
    // "ran dry".
    await renderLive(jest.fn());
    await tick(0, 0);
    await tick(1, 0);
    await tick(2, 0);
    await act(async () => jest.advanceTimersByTime(3_000));
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(mockWriteToLog.mock.calls[0][2]).toMatchObject({
      bufferedSeconds: "unknown",
    });
  });

  test("a channel frozen 20 s that moves again is left alone", async () => {
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await tick(0, 0);
    await tick(1, 0);
    await tick(2, 0);
    await act(async () => jest.advanceTimersByTime(3_000));
    await act(async () => jest.advanceTimersByTime(17_000));
    await tick(3, 0);
    await act(async () => jest.advanceTimersByTime(20_000));
    expect(onStuck).not.toHaveBeenCalled();
    expect(mockWriteToLog).not.toHaveBeenCalled();
  });

  test("a movie never reconnects itself, however long it stalls", async () => {
    mockItem = { Id: "movie-1", Name: "A Movie", Type: "Movie" };
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await tick(0, 7_200);
    await tick(1, 7_200);
    await tick(2, 7_200);
    await act(async () => jest.advanceTimersByTime(3_000));
    await act(async () => jest.advanceTimersByTime(120_000));
    expect(onStuck).not.toHaveBeenCalled();
  });

  test("a channel that recovers by itself is left alone", async () => {
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await tick(0, 0);
    await tick(1, 0);
    await tick(2, 0);
    await act(async () => jest.advanceTimersByTime(6_000));
    // The cushion refilled and the picture moves again.
    await tick(3, 0);
    await act(async () => jest.advanceTimersByTime(8_000));
    expect(onStuck).not.toHaveBeenCalled();
  });

  test("a channel that never shows a first frame asks too, but later", async () => {
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await act(async () => jest.advanceTimersByTime(20_000));
    expect(onStuck).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(15_000));
    expect(onStuck).toHaveBeenCalledTimes(1);
    expect(mockWriteToLog.mock.calls[0][2]).toMatchObject({
      itemId: "chan-1",
      started: false,
    });
  });

  test("a paused channel is not reconnected", async () => {
    const onStuck = jest.fn();
    await renderLive(onStuck);
    await tick(0, 0);
    await tick(1, 0);
    await tick(2, 0);
    await playerState({ isPaused: true });
    await act(async () => jest.advanceTimersByTime(60_000));
    expect(onStuck).not.toHaveBeenCalled();
  });
});
