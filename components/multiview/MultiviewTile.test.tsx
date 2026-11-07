import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Colors, MultiviewColors } from "@/constants/Colors";
import { QueryWrapper } from "@/test-utils/queryWrapper";

type Handler<T> = (e: { nativeEvent: T }) => void;
let mockOnProgress:
  | Handler<{ position: number; duration?: number }>
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

const tick = async (position: number, duration = 0) => {
  await act(async () =>
    mockOnProgress?.({ nativeEvent: { position, duration } }),
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
